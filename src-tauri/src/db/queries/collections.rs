use crate::db::models::{
    Collection, CollectionHymn, CollectionSearchResult, CollectionSong, CollectionSongSyncStatus,
    CollectionWithHymns, CollectionWithSongs, Hymn,
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
        "SELECT id, name, COALESCE(description, '') AS description
         FROM collections
         WHERE id = ?1",
        params![collection_id],
        |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, String>("name")?,
                row.get::<_, String>("description")?,
            ))
        },
    );

    let (id, name, description) = match row {
        Ok(row) => row,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(()),
        Err(other) => return Err(AppError::Database(other)),
    };

    conn.execute(
        "INSERT INTO collections_fts (
            entity_type, collection_id, song_id, collection_name, title, description, body
         ) VALUES ('collection', ?1, NULL, ?2, ?2, ?3, ?3)",
        params![id, name, description],
    )?;

    Ok(())
}

fn get_collection_song_search_document(
    conn: &Connection,
    song_id: i64,
) -> Result<Option<CollectionSongSearchDoc>, AppError> {
    let row = conn.query_row(
        "SELECT cs.id AS song_id,
                cs.collection_id,
                c.name AS collection_name,
                COALESCE(c.description, '') AS collection_description,
                cs.source_path,
                p.title AS title,
                COALESCE(GROUP_CONCAT(s.content, ' '), '') AS body
         FROM collection_songs cs
         JOIN collections c ON c.id = cs.collection_id
         LEFT JOIN presentations p ON p.id = cs.cache_presentation_id
         LEFT JOIN slides s ON s.presentation_id = cs.cache_presentation_id
         WHERE cs.id = ?1
         GROUP BY cs.id, cs.collection_id, c.name, c.description, cs.source_path, p.title",
        params![song_id],
        |row| {
            Ok(CollectionSongSearchDoc {
                song_id: row.get("song_id")?,
                collection_id: row.get("collection_id")?,
                collection_name: row.get("collection_name")?,
                collection_description: row.get("collection_description")?,
                source_path: row.get("source_path")?,
                title: row.get("title")?,
                body: row.get("body")?,
            })
        },
    );

    match row {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(other) => Err(AppError::Database(other)),
    }
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
            entity_type, collection_id, song_id, collection_name, title, description, body
         ) VALUES ('song', ?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            doc.collection_id,
            doc.song_id,
            doc.collection_name,
            title,
            doc.collection_description,
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
                collection_name,
                title,
                COALESCE(snippet(collections_fts, 6, '', '', ' ... ', 24), '') AS snippet
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
                snippet: row.get("snippet")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub fn get_collections(conn: &Connection) -> Result<Vec<Collection>, AppError> {
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
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT OR IGNORE INTO collection_hymns (collection_id, hymn_id, item_order)
         VALUES (?1, ?2, ?3)",
        params![collection_id, hymn_id, item_order],
    )?;
    Ok(conn.last_insert_rowid())
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

pub fn get_collection_with_hymns(
    conn: &Connection,
    id: i64,
) -> Result<CollectionWithHymns, AppError> {
    let collection = get_collection_by_id(conn, id)?;
    let hymns = get_collection_hymns(conn, id)?;
    Ok(CollectionWithHymns { collection, hymns })
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
    Ok(())
}

pub fn find_collection_by_api_album_id(
    conn: &Connection,
    api_album_id: i64,
) -> Option<i64> {
    conn.query_row(
        "SELECT id FROM collections WHERE api_album_id = ?1",
        params![api_album_id],
        |row| row.get(0),
    )
    .ok()
}
