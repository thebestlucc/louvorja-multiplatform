use crate::db::models::{Album, Hymn, HymnListItem};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};

pub(super) fn map_hymn_row(row: &Row) -> Result<Hymn, rusqlite::Error> {
    Ok(Hymn {
        id: row.get("id")?,
        number: row.get("number")?,
        title: row.get("title")?,
        author: row.get("author")?,
        album: row.get("album")?,
        lyrics: row.get("lyrics")?,
        chords: row.get("chords")?,
        audio_path: row.get("audio_path")?,
        playback_path: row.get("playback_path")?,
        category: row.get("category")?,
        notes: row.get("notes")?,
        cover_path: row.get("cover_path")?,
        lyrics_sync: row.get("lyrics_sync")?,
        api_music_id: row.get("api_music_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

/// Public wrapper for cross-module use (e.g., collection_hymns JOIN queries)
pub fn map_hymn_row_pub(row: &Row) -> Result<Hymn, rusqlite::Error> {
    map_hymn_row(row)
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

pub fn search_hymns(conn: &Connection, query: &str) -> Result<Vec<Hymn>, AppError> {
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn.prepare_cached(
            "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
             FROM hymns h
             WHERE h.category = 'hymnal'
             ORDER BY h.number, h.title"
        )?;
        let hymns = stmt
            .query_map([], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // If numeric prefix, search by number using LIKE
    if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_digit()) {
        let number_prefix = format!("{}%", trimmed);
        let mut stmt = conn.prepare_cached(
            "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
             FROM hymns h
             WHERE CAST(h.number AS TEXT) LIKE ?1
             AND h.category = 'hymnal'
             ORDER BY h.number"
        )?;
        let hymns = stmt
            .query_map(params![number_prefix], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // Text search via FTS5
    let Some(fts_query) = build_fts_prefix_query(trimmed) else {
        return Ok(vec![]);
    };

    let mut stmt = conn.prepare_cached(
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
         FROM hymns h
         JOIN hymns_fts ON hymns_fts.rowid = h.id
         WHERE hymns_fts MATCH ?1
         AND h.category = 'hymnal'
         ORDER BY rank"
    )?;
    let hymns = stmt
        .query_map(params![fts_query], map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

fn map_hymn_list_row(row: &Row) -> Result<HymnListItem, rusqlite::Error> {
    Ok(HymnListItem {
        id: row.get("id")?,
        number: row.get("number")?,
        title: row.get("title")?,
        author: row.get("author")?,
        album: row.get("album")?,
        cover_path: row.get("cover_path")?,
        audio_path: row.get("audio_path")?,
        playback_path: row.get("playback_path")?,
        category: row.get("category")?,
        api_music_id: row.get("api_music_id")?,
    })
}

/// Lightweight search returning only the fields needed for list rendering.
/// Skips lyrics, chords, notes, lyrics_sync, and timestamps.
pub fn search_hymns_list(conn: &Connection, query: &str) -> Result<Vec<HymnListItem>, AppError> {
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn.prepare_cached(
            "SELECT h.id, h.number, h.title, h.author, h.album,
                    h.cover_path, h.audio_path, h.playback_path,
                    h.category, h.api_music_id
             FROM hymns h
             WHERE h.category = 'hymnal'
             ORDER BY h.number, h.title"
        )?;
        let items = stmt
            .query_map([], map_hymn_list_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(items);
    }

    // Numeric prefix → search by number
    if trimmed.chars().all(|c| c.is_ascii_digit()) {
        let number_prefix = format!("{}%", trimmed);
        let mut stmt = conn.prepare_cached(
            "SELECT h.id, h.number, h.title, h.author, h.album,
                    h.cover_path, h.audio_path, h.playback_path,
                    h.category, h.api_music_id
             FROM hymns h
             WHERE CAST(h.number AS TEXT) LIKE ?1
             AND h.category = 'hymnal'
             ORDER BY h.number"
        )?;
        let items = stmt
            .query_map(params![number_prefix], map_hymn_list_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(items);
    }

    // Text search via FTS5
    let Some(fts_query) = build_fts_prefix_query(trimmed) else {
        return Ok(vec![]);
    };

    let mut stmt = conn.prepare_cached(
        "SELECT h.id, h.number, h.title, h.author, h.album,
                h.cover_path, h.audio_path, h.playback_path,
                h.category, h.api_music_id
         FROM hymns h
         JOIN hymns_fts ON hymns_fts.rowid = h.id
         WHERE hymns_fts MATCH ?1
         AND h.category = 'hymnal'
         ORDER BY rank"
    )?;
    let items = stmt
        .query_map(params![fts_query], map_hymn_list_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

pub fn search_all_hymns(conn: &Connection, query: &str) -> Result<Vec<Hymn>, AppError> {
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn.prepare_cached(
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync, api_music_id, created_at, updated_at
             FROM hymns
             WHERE category = 'hymnal'
             ORDER BY number, title
             LIMIT 100"
        )?;
        let hymns = stmt
            .query_map([], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // If numeric prefix, search by number using LIKE
    if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_digit()) {
        let number_prefix = format!("{}%", trimmed);
        let mut stmt = conn.prepare_cached(
            "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
             FROM hymns h
             WHERE CAST(h.number AS TEXT) LIKE ?1
             AND h.category = 'hymnal'
             ORDER BY h.number
             LIMIT 100"
        )?;
        let hymns = stmt
            .query_map(params![number_prefix], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // Text search via FTS5
    let Some(fts_query) = build_fts_prefix_query(trimmed) else {
        return Ok(vec![]);
    };

    let mut stmt = conn.prepare_cached(
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
         FROM hymns h
         JOIN hymns_fts ON hymns_fts.rowid = h.id
         WHERE hymns_fts MATCH ?1
         AND h.category = 'hymnal'
         ORDER BY rank
         LIMIT 100"
    )?;
    let hymns = stmt
        .query_map(params![fts_query], map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

pub fn search_all_music(conn: &Connection, query: &str) -> Result<Vec<Hymn>, AppError> {
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn.prepare_cached(
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync, api_music_id, created_at, updated_at
             FROM hymns
             ORDER BY number NULLS LAST, title
             LIMIT 100"
        )?;
        let hymns = stmt
            .query_map([], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    if trimmed.chars().all(|c| c.is_ascii_digit()) {
        let number_prefix = format!("{}%", trimmed);
        let mut stmt = conn.prepare_cached(
            "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
             FROM hymns h
             WHERE CAST(h.number AS TEXT) LIKE ?1
             ORDER BY h.number
             LIMIT 100"
        )?;
        let hymns = stmt
            .query_map(params![number_prefix], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    let Some(fts_query) = build_fts_prefix_query(trimmed) else {
        return Ok(vec![]);
    };

    let mut stmt = conn.prepare_cached(
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
         FROM hymns h
         JOIN hymns_fts ON hymns_fts.rowid = h.id
         WHERE hymns_fts MATCH ?1
         ORDER BY rank
         LIMIT 100"
    )?;
    let hymns = stmt
        .query_map(params![fts_query], map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

pub fn rebuild_hymns_search_index(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "INSERT INTO hymns_fts(hymns_fts) VALUES('delete-all');
         INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
         SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
         FROM hymns
         WHERE category = 'hymnal';",
    )?;
    Ok(())
}

pub fn get_hymn_by_id(conn: &Connection, id: i64) -> Result<Hymn, AppError> {
    conn.query_row(
        "SELECT id, number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync, api_music_id, created_at, updated_at
         FROM hymns WHERE id = ?1",
        params![id],
        map_hymn_row,
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Hymn with id {} not found", id)),
        other => AppError::Database(other),
    })
}

pub fn get_albums(conn: &Connection) -> Result<Vec<Album>, AppError> {
    let mut stmt = conn.prepare_cached(
        "SELECT h.album, COUNT(*) as hymn_count
         FROM hymns h
         WHERE h.album IS NOT NULL AND h.album != ''
         AND h.category IN ('hymnal', 'album')
         GROUP BY h.album
         ORDER BY h.album",
    )?;
    let albums = stmt
        .query_map([], |row| {
            Ok(Album {
                name: row.get("album")?,
                hymn_count: row.get("hymn_count")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(albums)
}

pub fn get_hymns_by_album(conn: &Connection, album: &str) -> Result<Vec<Hymn>, AppError> {
    let mut stmt = conn.prepare_cached(
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
         FROM hymns h
         WHERE h.album = ?1
         AND h.category IN ('hymnal', 'album')
         ORDER BY h.number, h.title"
    )?;
    let hymns = stmt
        .query_map(params![album], map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

pub fn insert_hymn(
    conn: &Connection,
    hymn: &crate::db::models::HymnWriteInput,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO hymns (
            number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            hymn.number,
            hymn.title.trim(),
            hymn.author.as_deref().map(str::trim),
            hymn.album.as_deref().map(str::trim),
            hymn.lyrics.as_deref(),
            hymn.chords.as_deref(),
            hymn.audio_path.as_deref().map(str::trim),
            hymn.playback_path.as_deref().map(str::trim),
            hymn.category.as_deref().map(str::trim),
            hymn.notes.as_deref(),
            hymn.cover_path.as_deref().map(str::trim),
            hymn.lyrics_sync.as_deref(),
        ],
    )?;
    let hymn_id = conn.last_insert_rowid();

    Ok(hymn_id)
}

pub fn update_hymn(
    conn: &Connection,
    id: i64,
    hymn: &crate::db::models::HymnWriteInput,
) -> Result<(), AppError> {
    let rows = conn.execute(
        "UPDATE hymns
         SET number = ?1,
             title = ?2,
             author = ?3,
             album = ?4,
             lyrics = ?5,
             chords = ?6,
             audio_path = ?7,
             playback_path = ?8,
             category = ?9,
             notes = ?10,
             cover_path = ?11,
             lyrics_sync = ?12,
             updated_at = datetime('now')
         WHERE id = ?13",
        params![
            hymn.number,
            hymn.title.trim(),
            hymn.author.as_deref().map(str::trim),
            hymn.album.as_deref().map(str::trim),
            hymn.lyrics.as_deref(),
            hymn.chords.as_deref(),
            hymn.audio_path.as_deref().map(str::trim),
            hymn.playback_path.as_deref().map(str::trim),
            hymn.category.as_deref().map(str::trim),
            hymn.notes.as_deref(),
            hymn.cover_path.as_deref().map(str::trim),
            hymn.lyrics_sync.as_deref(),
            id,
        ],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Hymn with id {} not found", id)));
    }

    // Update collections_fts for all collections linking to this hymn
    let fts_exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'collections_fts'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if fts_exists {
        let mut stmt =
            conn.prepare_cached("SELECT collection_id FROM collection_hymns WHERE hymn_id = ?1")?;
        let collection_ids = stmt
            .query_map(params![id], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;

        for collection_id in collection_ids {
            // We can't call upsert_collection_hymn_search_document directly here because it's in a different module.
            // But we can replicate its logic.
            // Actually, a better approach might be to just trigger a reindex if we had a shared helper.
            // For now, let's do it manually.

            // Delete old entry
            conn.execute(
                "DELETE FROM collections_fts WHERE entity_type = 'hymn' AND collection_id = ?1 AND song_id = ?2",
                params![collection_id, id],
            )?;

            // Insert updated entry
            let mut h_stmt = conn.prepare_cached(
                "SELECT h.title,
                        COALESCE(h.lyrics, '') AS lyrics,
                        COALESCE(h.author, '') AS author,
                        COALESCE(h.album, '') AS album,
                        c.name AS collection_name,
                        COALESCE(c.description, '') AS collection_description
                 FROM hymns h
                 JOIN collections c ON c.id = ?1
                 WHERE h.id = ?2",
            )?;

            if let Ok((title, lyrics, author, album, collection_name, collection_description)) =
                h_stmt.query_row(params![collection_id, id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                })
            {
                let body = format!("{} {} {} {}", lyrics, author, album, collection_description);
                conn.execute(
                    "INSERT INTO collections_fts (
                        entity_type, collection_id, song_id, collection_name, title, description, body
                     ) VALUES ('hymn', ?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        collection_id,
                        id,
                        collection_name,
                        title,
                        collection_description,
                        body,
                    ],
                )?;
            }
        }
    }

    Ok(())
}

pub fn delete_hymn(conn: &Connection, id: i64) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM hymns WHERE id = ?1", params![id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Hymn with id {} not found", id)));
    }

    // Cleanup collections_fts if it exists
    let fts_exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'collections_fts'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if fts_exists {
        conn.execute(
            "DELETE FROM collections_fts WHERE entity_type = 'hymn' AND song_id = ?1",
            params![id],
        )?;
    }

    Ok(())
}

#[allow(dead_code)]
pub fn find_hymn_by_api_music_id(conn: &Connection, api_music_id: i64) -> Option<i64> {
    conn.query_row(
        "SELECT id FROM hymns WHERE api_music_id = ?1",
        params![api_music_id],
        |row| row.get(0),
    )
    .ok()
}
