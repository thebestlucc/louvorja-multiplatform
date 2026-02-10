use crate::db::models::{Album, Hymn};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};

fn map_hymn_row(row: &Row) -> Result<Hymn, rusqlite::Error> {
    Ok(Hymn {
        id: row.get("id")?,
        number: row.get("number")?,
        title: row.get("title")?,
        author: row.get("author")?,
        album: row.get("album")?,
        lyrics: row.get("lyrics")?,
        chords: row.get("chords")?,
        audio_path: row.get("audio_path")?,
        category: row.get("category")?,
        notes: row.get("notes")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn sanitize_fts_query(query: &str) -> String {
    query
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

pub fn search_hymns(conn: &Connection, query: &str) -> Result<Vec<Hymn>, AppError> {
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn.prepare(
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at
             FROM hymns ORDER BY number, title"
        )?;
        let hymns = stmt
            .query_map([], |row| map_hymn_row(row))?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // If numeric, search by number
    if let Ok(num) = trimmed.parse::<i64>() {
        let mut stmt = conn.prepare(
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at
             FROM hymns WHERE number = ?1 ORDER BY title"
        )?;
        let hymns = stmt
            .query_map(params![num], |row| map_hymn_row(row))?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // Text search via FTS5
    let sanitized = sanitize_fts_query(trimmed);
    if sanitized.is_empty() {
        return Ok(vec![]);
    }

    let fts_query = format!("{}*", sanitized);
    let mut stmt = conn.prepare(
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.category, h.notes, h.created_at, h.updated_at
         FROM hymns h
         JOIN hymns_fts ON hymns_fts.rowid = h.id
         WHERE hymns_fts MATCH ?1
         ORDER BY rank"
    )?;
    let hymns = stmt
        .query_map(params![fts_query], |row| map_hymn_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

pub fn get_hymn_by_id(conn: &Connection, id: i64) -> Result<Hymn, AppError> {
    conn.query_row(
        "SELECT id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at
         FROM hymns WHERE id = ?1",
        params![id],
        |row| map_hymn_row(row),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Hymn with id {} not found", id)),
        other => AppError::Database(other),
    })
}

pub fn get_albums(conn: &Connection) -> Result<Vec<Album>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT album, COUNT(*) as hymn_count
         FROM hymns
         WHERE album IS NOT NULL AND album != ''
         GROUP BY album
         ORDER BY album",
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
    let mut stmt = conn.prepare(
        "SELECT id, number, title, author, album, lyrics, chords, audio_path, category, notes, created_at, updated_at
         FROM hymns WHERE album = ?1 ORDER BY number, title"
    )?;
    let hymns = stmt
        .query_map(params![album], |row| map_hymn_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
}

pub fn insert_hymn(_conn: &Connection, _hymn: &Hymn) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn update_hymn(_conn: &Connection, _hymn: &Hymn) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn delete_hymn(_conn: &Connection, _id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_sync_points(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Vec<crate::audio::SyncPoint>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT slide_index, timestamp_ms FROM audio_sync_points WHERE hymn_id = ?1 ORDER BY timestamp_ms"
    )?;
    let points = stmt
        .query_map(params![hymn_id], |row| {
            Ok(crate::audio::SyncPoint {
                slide_index: row.get::<_, i64>("slide_index")? as usize,
                timestamp_ms: row.get::<_, i64>("timestamp_ms")? as u64,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(points)
}

pub fn save_sync_points(
    conn: &Connection,
    hymn_id: i64,
    points: &[crate::audio::SyncPoint],
) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM audio_sync_points WHERE hymn_id = ?1",
        params![hymn_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT INTO audio_sync_points (hymn_id, slide_index, timestamp_ms) VALUES (?1, ?2, ?3)",
    )?;
    for point in points {
        stmt.execute(params![
            hymn_id,
            point.slide_index as i64,
            point.timestamp_ms as i64
        ])?;
    }
    Ok(())
}
