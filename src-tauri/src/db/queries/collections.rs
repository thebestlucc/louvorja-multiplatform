use crate::db::models::{
    Collection, CollectionSearchResult, CollectionSong, CollectionSongSyncStatus,
    CollectionWithSongs, Hymn,
};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};
use std::path::Path;

fn map_collection_row(row: &Row) -> Result<Collection, rusqlite::Error> {
    Ok(Collection {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        year: row.get("year")?,
        cover_path: row.get("cover_path")?,
        auto_cover_path: row.get("auto_cover_path")?,
        song_count: row.get("song_count")?,
        source_type: row.get("source_type")?,
        api_album_id: row.get("api_album_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn map_collection_row_pub(row: &Row) -> Result<Collection, rusqlite::Error> {
    map_collection_row(row)
}

fn map_collection_song_row(row: &Row) -> Result<CollectionSong, rusqlite::Error> {
    let sync_status: String = row.get("sync_status")?;
    Ok(CollectionSong {
        id: row.get("id")?,
        collection_id: row.get("collection_id")?,
        source_path: row.get("source_path")?,
        source_format: row.get("source_format")?,
        source_hash: row.get("source_hash")?,
        source_mtime_ms: row.get("source_mtime_ms")?,
        cache_presentation_id: row.get("cache_presentation_id")?,
        sync_status: CollectionSongSyncStatus::from_db_str(&sync_status),
        last_sync_at: row.get("last_sync_at")?,
        item_order: row.get("item_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        cache_presentation_title: row.get("cache_presentation_title")?,
    })
}

#[derive(Debug)]
struct CollectionSongSearchDoc {
    song_id: i64,
    collection_id: i64,
    collection_name: String,
    collection_description: String,
    source_path: String,
    title: Option<String>,
    cover_path: Option<String>,
    body: String,
}

pub struct InsertCollectionSongInput<'a> {
    pub collection_id: i64,
    pub source_path: &'a str,
    pub source_format: &'a str,
    pub source_hash: Option<&'a str>,
    pub source_mtime_ms: Option<i64>,
    pub cache_presentation_id: Option<i64>,
    pub sync_status: CollectionSongSyncStatus,
    pub item_order: i64,
}

fn sanitize_fts_query(query: &str) -> Vec<String> {
    query
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .collect()
}

fn build_fts_prefix_query(query: &str) -> Option<String> {
    let terms = sanitize_fts_query(query);
    if terms.is_empty() {
        return None;
    }
    Some(
        terms
            .into_iter()
            .map(|term| format!("{term}*"))
            .collect::<Vec<_>>()
            .join(" "),
    )
}

fn derive_song_title_from_source_path(source_path: &str) -> String {
    Path::new(source_path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(std::borrow::ToOwned::to_owned)
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| source_path.to_string())
}

fn collections_fts_exists(conn: &Connection) -> Result<bool, AppError> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(1)
         FROM sqlite_master
         WHERE type = 'table' AND name = 'collections_fts'",
        [],
        |row| row.get(0),
    )?;
    Ok(exists > 0)
}

pub fn collections_fts_exists_pub(conn: &Connection) -> Result<bool, AppError> {
    collections_fts_exists(conn)
}

fn sqlite_table_exists(conn: &Connection, table: &str) -> Result<bool, AppError> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(1)
         FROM sqlite_master
         WHERE type = 'table' AND name = ?1",
        params![table],
        |row| row.get(0),
    )?;
    Ok(exists > 0)
}

fn upsert_collection_search_document(
    conn: &Connection,
    collection_id: i64,
) -> Result<(), AppError> {
    if !collections_fts_exists(conn)? {
        return Ok(());
    }

    conn.execute(
        "DELETE FROM collections_fts
         WHERE entity_type = 'collection' AND collection_id = ?1",
        params![collection_id],
    )?;

    let row = conn.query_row(
        "SELECT id, name, COALESCE(description, '') AS description, cover_path
         FROM collections
         WHERE id = ?1",
        params![collection_id],
        |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, String>("name")?,
                row.get::<_, String>("description")?,
                row.get::<_, Option<String>>("cover_path")?,
            ))
        },
    );

    let (id, name, description, cover_path) = match row {
        Ok(row) => row,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(()),
        Err(other) => return Err(AppError::Database(other)),
    };

    conn.execute(
        "INSERT INTO collections_fts (
            entity_type, collection_id, song_id, cover_path, collection_name, title, description, body
         ) VALUES ('collection', ?1, NULL, ?2, ?3, ?3, ?4, ?4)",
        params![id, cover_path, name, description],
    )?;

    Ok(())
}

fn get_collection_song_search_document(
    conn: &Connection,
    song_id: i64,
) -> Result<Option<CollectionSongSearchDoc>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT cs.id AS song_id,
                cs.collection_id,
                c.name AS collection_name,
                COALESCE(c.description, '') AS collection_description,
                c.cover_path AS collection_cover,
                cs.source_path,
                p.title AS title
         FROM collection_songs cs
         JOIN collections c ON c.id = cs.collection_id
         LEFT JOIN presentations p ON p.id = cs.cache_presentation_id
         WHERE cs.id = ?1",
    )?;

    let doc = stmt.query_row(params![song_id], |row| {
        Ok(CollectionSongSearchDoc {
            song_id: row.get("song_id")?,
            collection_id: row.get("collection_id")?,
            collection_name: row.get("collection_name")?,
            collection_description: row.get("collection_description")?,
            source_path: row.get("source_path")?,
            title: row.get("title")?,
            cover_path: row.get("collection_cover")?,
            body: String::new(), // To be filled below
        })
    });

    let mut doc = match doc {
        Ok(doc) => doc,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(other) => return Err(AppError::Database(other)),
    };

    // Extract text from slides JSON
    let mut slides_stmt = conn.prepare(
        "SELECT content FROM slides
         WHERE presentation_id = (SELECT cache_presentation_id FROM collection_songs WHERE id = ?1)
         ORDER BY slide_index ASC",
    )?;

    let contents = slides_stmt
        .query_map(params![song_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut lyrics_text = Vec::new();
    for content in contents {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(text) = value.get("text").and_then(|v| v.as_str()) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    lyrics_text.push(trimmed.to_string());
                }
            }
        }
    }

    doc.body = lyrics_text.join("\n\n");
    Ok(Some(doc))
}

fn upsert_collection_song_search_document(conn: &Connection, song_id: i64) -> Result<(), AppError> {
    if !collections_fts_exists(conn)? {
        return Ok(());
    }

    conn.execute(
        "DELETE FROM collections_fts
         WHERE entity_type = 'song' AND song_id = ?1",
        params![song_id],
    )?;

    let Some(doc) = get_collection_song_search_document(conn, song_id)? else {
        return Ok(());
    };

    let title = doc
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(std::borrow::ToOwned::to_owned)
        .unwrap_or_else(|| derive_song_title_from_source_path(&doc.source_path));

    let body = format!("{} {}", doc.collection_description, doc.body);

    conn.execute(
        "INSERT INTO collections_fts (
            entity_type, collection_id, song_id, cover_path, collection_name, title, description, body
         ) VALUES ('song', ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            doc.collection_id,
            doc.song_id,
            doc.cover_path,
            doc.collection_name,
            title,
            doc.collection_description,
            body,
        ],
    )?;

    Ok(())
}

fn upsert_collection_hymn_search_document(
    conn: &Connection,
    collection_id: i64,
    hymn_id: i64,
) -> Result<(), AppError> {
    if !collections_fts_exists(conn)? {
        return Ok(());
    }

    conn.execute(
        "DELETE FROM collections_fts
         WHERE entity_type = 'hymn' AND collection_id = ?1 AND song_id = ?2",
        params![collection_id, hymn_id],
    )?;

    let mut stmt = conn.prepare(
        "SELECT h.title,
                COALESCE(h.lyrics, '') AS lyrics,
                COALESCE(h.author, '') AS author,
                COALESCE(h.album, '') AS album,
                c.name AS collection_name,
                COALESCE(c.description, '') AS collection_description,
                c.cover_path
         FROM hymns h
         JOIN collections c ON c.id = ?1
         WHERE h.id = ?2",
    )?;

    let (title, lyrics, author, album, collection_name, collection_description, cover_path) = stmt
        .query_row(params![collection_id, hymn_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })?;

    let body = format!("{} {} {} {}", lyrics, author, album, collection_description);

    conn.execute(
        "INSERT INTO collections_fts (
            entity_type, collection_id, song_id, cover_path, collection_name, title, description, body
         ) VALUES ('hymn', ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            collection_id,
            hymn_id,
            cover_path,
            collection_name,
            title,
            collection_description,
            body,
        ],
    )?;

    Ok(())
}

pub fn rebuild_collections_search_index(conn: &Connection) -> Result<(), AppError> {
    if !collections_fts_exists(conn)? {
        return Ok(());
    }

    conn.execute("DELETE FROM collections_fts", [])?;

    let mut collections_stmt = conn.prepare("SELECT id FROM collections")?;
    let collection_ids = collections_stmt
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for collection_id in collection_ids {
        upsert_collection_search_document(conn, collection_id)?;
    }

    let mut songs_stmt = conn.prepare("SELECT id FROM collection_songs")?;
    let song_ids = songs_stmt
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for song_id in song_ids {
        upsert_collection_song_search_document(conn, song_id)?;
    }

    if sqlite_table_exists(conn, "collection_hymns")? {
        let mut collection_hymns_stmt =
            conn.prepare("SELECT collection_id, hymn_id FROM collection_hymns")?;
        let collection_hymn_ids = collection_hymns_stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        for (collection_id, hymn_id) in collection_hymn_ids {
            upsert_collection_hymn_search_document(conn, collection_id, hymn_id)?;
        }
    }

    Ok(())
}

fn reindex_collection_song_documents(
    conn: &Connection,
    collection_id: i64,
) -> Result<(), AppError> {
    let mut stmt = conn.prepare("SELECT id FROM collection_songs WHERE collection_id = ?1")?;
    let song_ids = stmt
        .query_map(params![collection_id], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for song_id in song_ids {
        upsert_collection_song_search_document(conn, song_id)?;
    }

    Ok(())
}

pub fn reindex_collection_song_documents_by_presentation(
    conn: &Connection,
    presentation_id: i64,
) -> Result<(), AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id
         FROM collection_songs
         WHERE cache_presentation_id = ?1",
    )?;
    let rows = stmt
        .query_map(params![presentation_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for (song_id, collection_id) in rows {
        upsert_collection_song_search_document(conn, song_id)?;
        upsert_collection_search_document(conn, collection_id)?;
    }

    Ok(())
}

pub fn search_collections(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<CollectionSearchResult>, AppError> {
    if !collections_fts_exists(conn)? {
        return Ok(vec![]);
    }

    let Some(fts_query) = build_fts_prefix_query(query) else {
        return Ok(vec![]);
    };
    let safe_limit = limit.max(1) as i64;

    let mut stmt = conn.prepare(
        "SELECT entity_type,
                collection_id,
                song_id,
                cover_path,
                collection_name,
                title,
                COALESCE(snippet(collections_fts, 7, '', '', ' ... ', 24), '') AS snippet
         FROM collections_fts
         WHERE collections_fts MATCH ?1
         ORDER BY bm25(collections_fts) ASC
         LIMIT ?2",
    )?;

    let rows = stmt
        .query_map(params![fts_query, safe_limit], |row| {
            Ok(CollectionSearchResult {
                kind: row.get("entity_type")?,
                collection_id: row.get("collection_id")?,
                song_id: row.get("song_id")?,
                collection_name: row.get("collection_name")?,
                title: row.get("title")?,
                cover_path: row.get("cover_path")?,
                snippet: row.get("snippet")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub fn get_collections(conn: &Connection, query: Option<&str>) -> Result<Vec<Collection>, AppError> {
    if let Some(q) = query.filter(|s| !s.trim().is_empty()) {
        if !collections_fts_exists(conn)? {
            return Ok(vec![]);
        }

        let Some(fts_query) = build_fts_prefix_query(q) else {
            return Ok(vec![]);
        };

        let mut stmt = conn.prepare(
            "SELECT DISTINCT c.id,
                    c.name,
                    c.description,
                    c.year,
                    c.cover_path,
                    c.auto_cover_path,
                    c.source_type,
                    c.api_album_id,
                    c.created_at,
                    c.updated_at,
                    (
                        (SELECT COUNT(1) FROM collection_songs cs WHERE cs.collection_id = c.id)
                        + (SELECT COUNT(1) FROM collection_hymns ch WHERE ch.collection_id = c.id)
                    ) AS song_count
             FROM collections c
             JOIN collections_fts fts ON fts.collection_id = c.id
             WHERE fts.collections_fts MATCH ?1
             ORDER BY c.updated_at DESC, c.name ASC",
        )?;
        let rows = stmt
            .query_map(params![fts_query], map_collection_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(rows);
    }

    let mut stmt = conn.prepare(
        "SELECT c.id,
                c.name,
                c.description,
                c.year,
                c.cover_path,
                c.auto_cover_path,
                c.source_type,
                c.api_album_id,
                c.created_at,
                c.updated_at,
                (
                    (SELECT COUNT(1) FROM collection_songs cs WHERE cs.collection_id = c.id)
                    + (SELECT COUNT(1) FROM collection_hymns ch WHERE ch.collection_id = c.id)
                ) AS song_count
         FROM collections
         AS c
         ORDER BY c.updated_at DESC, c.name ASC",
    )?;
    let rows = stmt
        .query_map([], map_collection_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_collection_by_id(conn: &Connection, id: i64) -> Result<Collection, AppError> {
    conn.query_row(
        "SELECT c.id,
                c.name,
                c.description,
                c.year,
                c.cover_path,
                c.auto_cover_path,
                c.source_type,
                c.api_album_id,
                c.created_at,
                c.updated_at,
                (
                    (SELECT COUNT(1) FROM collection_songs cs WHERE cs.collection_id = c.id)
                    + (SELECT COUNT(1) FROM collection_hymns ch WHERE ch.collection_id = c.id)
                ) AS song_count
         FROM collections AS c
         WHERE c.id = ?1",
        params![id],
        map_collection_row,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Collection with id {} not found", id))
        }
        other => AppError::Database(other),
    })
}

pub fn get_collection_songs(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<CollectionSong>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT cs.id, cs.collection_id, cs.source_path, cs.source_format, cs.source_hash,
                cs.source_mtime_ms, cs.cache_presentation_id, cs.sync_status, cs.last_sync_at,
                cs.item_order, cs.created_at, cs.updated_at, p.title AS cache_presentation_title
         FROM collection_songs cs
         LEFT JOIN presentations p ON p.id = cs.cache_presentation_id
         WHERE cs.collection_id = ?1
         ORDER BY cs.item_order ASC, cs.id ASC",
    )?;
    let rows = stmt
        .query_map(params![collection_id], map_collection_song_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_collection_with_songs(
    conn: &Connection,
    id: i64,
) -> Result<CollectionWithSongs, AppError> {
    let collection = get_collection_by_id(conn, id)?;
    let songs = get_collection_songs(conn, id)?;
    Ok(CollectionWithSongs { collection, songs })
}

pub fn insert_collection(
    conn: &Connection,
    name: &str,
    description: Option<&str>,
    year: Option<i32>,
    cover_path: Option<&str>,
    source_type: &str,
    api_album_id: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO collections (name, description, year, cover_path, source_type, api_album_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            name.trim(),
            description.map(str::trim),
            year,
            cover_path.map(str::trim),
            source_type,
            api_album_id,
        ],
    )?;
    let collection_id = conn.last_insert_rowid();
    upsert_collection_search_document(conn, collection_id)?;
    Ok(collection_id)
}

pub fn update_collection(
    conn: &Connection,
    id: i64,
    name: &str,
    description: Option<&str>,
    year: Option<i32>,
    cover_path: Option<&str>,
) -> Result<(), AppError> {
    let rows = conn.execute(
        "UPDATE collections
         SET name = ?1,
             description = ?2,
             year = ?3,
             cover_path = ?4,
             updated_at = datetime('now')
         WHERE id = ?5",
        params![
            name.trim(),
            description.map(str::trim),
            year,
            cover_path.map(str::trim),
            id,
        ],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Collection with id {} not found",
            id
        )));
    }
    upsert_collection_search_document(conn, id)?;
    reindex_collection_song_documents(conn, id)?;
    Ok(())
}

pub fn delete_collection(conn: &Connection, id: i64) -> Result<(), AppError> {
    if collections_fts_exists(conn)? {
        conn.execute(
            "DELETE FROM collections_fts
             WHERE collection_id = ?1",
            params![id],
        )?;
    }
    let rows = conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Collection with id {} not found",
            id
        )));
    }
    Ok(())
}

pub fn next_collection_song_order(conn: &Connection, collection_id: i64) -> Result<i64, AppError> {
    let order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(item_order), -1) + 1
         FROM collection_songs
         WHERE collection_id = ?1",
        params![collection_id],
        |row| row.get(0),
    )?;
    Ok(order)
}

pub fn insert_collection_song(
    conn: &Connection,
    input: InsertCollectionSongInput<'_>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO collection_songs (
            collection_id, source_path, source_format, source_hash, source_mtime_ms,
            cache_presentation_id, sync_status, last_sync_at, item_order
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), ?8)",
        params![
            input.collection_id,
            input.source_path,
            input.source_format,
            input.source_hash,
            input.source_mtime_ms,
            input.cache_presentation_id,
            input.sync_status.as_db_str(),
            input.item_order,
        ],
    )?;
    conn.execute(
        "UPDATE collections SET updated_at = datetime('now') WHERE id = ?1",
        params![input.collection_id],
    )?;
    let song_id = conn.last_insert_rowid();
    upsert_collection_song_search_document(conn, song_id)?;
    Ok(song_id)
}

pub fn get_collection_song_by_id(
    conn: &Connection,
    song_id: i64,
) -> Result<CollectionSong, AppError> {
    conn.query_row(
        "SELECT cs.id, cs.collection_id, cs.source_path, cs.source_format, cs.source_hash,
                cs.source_mtime_ms, cs.cache_presentation_id, cs.sync_status, cs.last_sync_at,
                cs.item_order, cs.created_at, cs.updated_at, p.title AS cache_presentation_title
         FROM collection_songs cs
         LEFT JOIN presentations p ON p.id = cs.cache_presentation_id
         WHERE cs.id = ?1",
        params![song_id],
        map_collection_song_row,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Collection song with id {} not found", song_id))
        }
        other => AppError::Database(other),
    })
}

pub fn update_collection_song_sync(
    conn: &Connection,
    song_id: i64,
    source_hash: Option<&str>,
    source_mtime_ms: Option<i64>,
    cache_presentation_id: Option<i64>,
    sync_status: CollectionSongSyncStatus,
) -> Result<(), AppError> {
    let rows = conn.execute(
        "UPDATE collection_songs
         SET source_hash = ?1,
             source_mtime_ms = ?2,
             cache_presentation_id = ?3,
             sync_status = ?4,
             last_sync_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?5",
        params![
            source_hash,
            source_mtime_ms,
            cache_presentation_id,
            sync_status.as_db_str(),
            song_id,
        ],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Collection song with id {} not found",
            song_id
        )));
    }
    upsert_collection_song_search_document(conn, song_id)?;
    Ok(())
}

pub fn update_collection_song_status(
    conn: &Connection,
    song_id: i64,
    sync_status: CollectionSongSyncStatus,
) -> Result<(), AppError> {
    let rows = conn.execute(
        "UPDATE collection_songs
         SET sync_status = ?1,
             updated_at = datetime('now')
         WHERE id = ?2",
        params![sync_status.as_db_str(), song_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Collection song with id {} not found",
            song_id
        )));
    }
    Ok(())
}

pub fn remove_collection_song(conn: &Connection, song_id: i64) -> Result<(), AppError> {
    let (collection_id, item_order): (i64, i64) = conn
        .query_row(
            "SELECT collection_id, item_order FROM collection_songs WHERE id = ?1",
            params![song_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Collection song with id {} not found", song_id))
            }
            other => AppError::Database(other),
        })?;

    conn.execute(
        "DELETE FROM collection_songs WHERE id = ?1",
        params![song_id],
    )?;
    if collections_fts_exists(conn)? {
        conn.execute(
            "DELETE FROM collections_fts
             WHERE entity_type = 'song' AND song_id = ?1",
            params![song_id],
        )?;
    }
    conn.execute(
        "UPDATE collection_songs
         SET item_order = item_order - 1,
             updated_at = datetime('now')
         WHERE collection_id = ?1 AND item_order > ?2",
        params![collection_id, item_order],
    )?;
    conn.execute(
        "UPDATE collections SET updated_at = datetime('now') WHERE id = ?1",
        params![collection_id],
    )?;
    Ok(())
}

pub fn reorder_collection_songs(
    conn: &Connection,
    collection_id: i64,
    song_ids: &[i64],
) -> Result<(), AppError> {
    for (index, song_id) in song_ids.iter().enumerate() {
        conn.execute(
            "UPDATE collection_songs
             SET item_order = ?1, updated_at = datetime('now')
             WHERE id = ?2 AND collection_id = ?3",
            params![index as i64, song_id, collection_id],
        )?;
    }
    conn.execute(
        "UPDATE collections SET updated_at = datetime('now') WHERE id = ?1",
        params![collection_id],
    )?;
    Ok(())
}

pub fn set_collection_auto_cover_path(
    conn: &Connection,
    collection_id: i64,
    auto_cover_path: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE collections
         SET auto_cover_path = ?1,
             updated_at = datetime('now')
         WHERE id = ?2",
        params![auto_cover_path, collection_id],
    )?;
    Ok(())
}

// --- Collection-Hymn join table queries (for API-imported album collections) ---

pub fn insert_collection_hymn(
    conn: &Connection,
    collection_id: i64,
    hymn_id: i64,
    item_order: i64,
) -> Result<bool, AppError> {
    // Check if link already exists (to return accurate "was new" flag)
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM collection_hymns WHERE collection_id = ?1 AND hymn_id = ?2",
            params![collection_id, hymn_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    conn.execute(
        "INSERT INTO collection_hymns (collection_id, hymn_id, item_order)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(collection_id, hymn_id) DO UPDATE SET item_order = excluded.item_order",
        params![collection_id, hymn_id, item_order],
    )?;

    upsert_collection_hymn_search_document(conn, collection_id, hymn_id)?;

    Ok(!exists) // true = newly created link
}

pub fn get_collection_hymns(conn: &Connection, collection_id: i64) -> Result<Vec<Hymn>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords,
                h.audio_path, h.playback_path, h.category, h.notes, h.cover_path,
                h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
         FROM collection_hymns ch
         JOIN hymns h ON h.id = ch.hymn_id
         WHERE ch.collection_id = ?1
         ORDER BY ch.item_order ASC, ch.id ASC",
    )?;
    let rows = stmt
        .query_map(params![collection_id], super::music::map_hymn_row_pub)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn delete_collection_hymn(
    conn: &Connection,
    collection_id: i64,
    hymn_id: i64,
) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM collection_hymns WHERE collection_id = ?1 AND hymn_id = ?2",
        params![collection_id, hymn_id],
    )?;
    if collections_fts_exists(conn)? {
        conn.execute(
            "DELETE FROM collections_fts
             WHERE entity_type = 'hymn' AND collection_id = ?1 AND song_id = ?2",
            params![collection_id, hymn_id],
        )?;
    }
    Ok(())
}

#[allow(dead_code)]
pub fn find_collection_by_api_album_id(conn: &Connection, api_album_id: i64) -> Option<i64> {
    conn.query_row(
        "SELECT id FROM collections WHERE api_album_id = ?1",
        params![api_album_id],
        |row| row.get(0),
    )
    .ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            r#"
            CREATE TABLE collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                year INTEGER,
                cover_path TEXT,
                auto_cover_path TEXT,
                source_type TEXT NOT NULL DEFAULT 'file',
                api_album_id INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE hymns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number INTEGER,
                title TEXT NOT NULL,
                author TEXT,
                album TEXT,
                lyrics TEXT,
                chords TEXT,
                audio_path TEXT,
                playback_path TEXT,
                category TEXT,
                notes TEXT,
                cover_path TEXT,
                lyrics_sync TEXT,
                api_music_id INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE collection_hymns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                hymn_id INTEGER NOT NULL REFERENCES hymns(id) ON DELETE CASCADE,
                item_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(collection_id, hymn_id)
            );
            CREATE VIRTUAL TABLE collections_fts USING fts5(
                entity_type UNINDEXED,
                collection_id UNINDEXED,
                song_id UNINDEXED,
                cover_path UNINDEXED,
                collection_name,
                title,
                description,
                body
            );
            "#,
        )
        .expect("schema setup");
        conn
    }

    #[test]
    fn test_collection_hymn_fts_indexing() {
        let conn = setup_conn();
        let coll_id = insert_test_collection(&conn);
        let hymn_id = insert_test_hymn(&conn, "Amazing Grace");

        // Insert collection hymn
        insert_collection_hymn(&conn, coll_id, hymn_id, 1).unwrap();

        // Search for it
        let results = search_collections(&conn, "Amazing", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Amazing Grace");
        assert_eq!(results[0].kind, "hymn");
        assert_eq!(results[0].song_id, Some(hymn_id));

        // Delete it
        delete_collection_hymn(&conn, coll_id, hymn_id).unwrap();

        // Search again
        let results = search_collections(&conn, "Amazing", 10).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_upsert_collection_search_document() {
        let conn = setup_conn();
        let coll_id = insert_test_collection(&conn);

        // This call previously panicked due to parameter mismatch
        upsert_collection_search_document(&conn, coll_id).unwrap();

        let results = search_collections(&conn, "Test", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Test Album");
    }

    fn insert_test_collection(conn: &Connection) -> i64 {
        conn.execute("INSERT INTO collections (name) VALUES ('Test Album')", [])
            .unwrap();
        conn.last_insert_rowid()
    }

    fn insert_test_hymn(conn: &Connection, title: &str) -> i64 {
        conn.execute("INSERT INTO hymns (title) VALUES (?1)", params![title])
            .unwrap();
        conn.last_insert_rowid()
    }

    /// Fix 4: insert_collection_hymn should return accurate info on duplicates.
    /// Currently returns stale last_insert_rowid() when INSERT OR IGNORE skips.
    /// After fix: returns `bool` — true if newly inserted, false if already existed.
    #[test]
    fn insert_collection_hymn_returns_false_on_duplicate() {
        let conn = setup_conn();
        let coll_id = insert_test_collection(&conn);
        let hymn_id = insert_test_hymn(&conn, "Amazing Grace");

        // First insert — should indicate "newly created"
        let first = insert_collection_hymn(&conn, coll_id, hymn_id, 1);
        assert!(first.is_ok());
        assert_eq!(
            first.unwrap(),
            true,
            "first insert should return true (new link)"
        );

        // Second insert (duplicate) — should indicate "already existed"
        let second = insert_collection_hymn(&conn, coll_id, hymn_id, 1);
        assert!(second.is_ok());
        assert_eq!(
            second.unwrap(),
            false,
            "duplicate insert should return false (already existed)"
        );
    }

    /// Fix 5: item_order should be updated when re-importing the same hymn-collection link.
    /// Currently INSERT OR IGNORE silently discards the new item_order.
    #[test]
    fn insert_collection_hymn_updates_item_order_on_duplicate() {
        let conn = setup_conn();
        let coll_id = insert_test_collection(&conn);
        let hymn_id = insert_test_hymn(&conn, "How Great Thou Art");

        // Insert with order 1
        insert_collection_hymn(&conn, coll_id, hymn_id, 1).unwrap();

        // Verify initial order
        let order: i64 = conn
            .query_row(
                "SELECT item_order FROM collection_hymns WHERE collection_id = ?1 AND hymn_id = ?2",
                params![coll_id, hymn_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(order, 1);

        // Re-insert with order 5 (simulating re-import with different track order)
        insert_collection_hymn(&conn, coll_id, hymn_id, 5).unwrap();

        // item_order should be updated to 5
        let updated_order: i64 = conn
            .query_row(
                "SELECT item_order FROM collection_hymns WHERE collection_id = ?1 AND hymn_id = ?2",
                params![coll_id, hymn_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            updated_order, 5,
            "item_order should be updated on re-import"
        );
    }
}
