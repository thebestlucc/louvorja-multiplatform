use crate::db::models::{
    Collection, CollectionSong, CollectionSongSyncStatus, CollectionWithSongs,
};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};

fn map_collection_row(row: &Row) -> Result<Collection, rusqlite::Error> {
    Ok(Collection {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        cover_path: row.get("cover_path")?,
        auto_cover_path: row.get("auto_cover_path")?,
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

pub fn get_collections(conn: &Connection) -> Result<Vec<Collection>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, cover_path, auto_cover_path, created_at, updated_at
         FROM collections
         ORDER BY updated_at DESC, name ASC",
    )?;
    let rows = stmt
        .query_map([], map_collection_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_collection_by_id(conn: &Connection, id: i64) -> Result<Collection, AppError> {
    conn.query_row(
        "SELECT id, name, description, cover_path, auto_cover_path, created_at, updated_at
         FROM collections WHERE id = ?1",
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
    cover_path: Option<&str>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO collections (name, description, cover_path)
         VALUES (?1, ?2, ?3)",
        params![
            name.trim(),
            description.map(str::trim),
            cover_path.map(str::trim),
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_collection(
    conn: &Connection,
    id: i64,
    name: &str,
    description: Option<&str>,
    cover_path: Option<&str>,
) -> Result<(), AppError> {
    let rows = conn.execute(
        "UPDATE collections
         SET name = ?1,
             description = ?2,
             cover_path = ?3,
             updated_at = datetime('now')
         WHERE id = ?4",
        params![
            name.trim(),
            description.map(str::trim),
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
    Ok(())
}

pub fn delete_collection(conn: &Connection, id: i64) -> Result<(), AppError> {
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
    collection_id: i64,
    source_path: &str,
    source_format: &str,
    source_hash: Option<&str>,
    source_mtime_ms: Option<i64>,
    cache_presentation_id: Option<i64>,
    sync_status: CollectionSongSyncStatus,
    item_order: i64,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO collection_songs (
            collection_id, source_path, source_format, source_hash, source_mtime_ms,
            cache_presentation_id, sync_status, last_sync_at, item_order
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), ?8)",
        params![
            collection_id,
            source_path,
            source_format,
            source_hash,
            source_mtime_ms,
            cache_presentation_id,
            sync_status.as_db_str(),
            item_order,
        ],
    )?;
    conn.execute(
        "UPDATE collections SET updated_at = datetime('now') WHERE id = ?1",
        params![collection_id],
    )?;
    Ok(conn.last_insert_rowid())
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

    conn.execute("DELETE FROM collection_songs WHERE id = ?1", params![song_id])?;
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
