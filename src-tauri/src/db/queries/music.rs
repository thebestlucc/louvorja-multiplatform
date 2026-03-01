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
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync, api_music_id, created_at, updated_at
             FROM hymns ORDER BY number, title LIMIT 200"
        )?;
        let hymns = stmt
            .query_map([], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // If numeric, search by number
    if let Ok(num) = trimmed.parse::<i64>() {
        let mut stmt = conn.prepare(
            "SELECT id, number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync, api_music_id, created_at, updated_at
             FROM hymns WHERE number = ?1 ORDER BY title LIMIT 200"
        )?;
        let hymns = stmt
            .query_map(params![num], map_hymn_row)?
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
        "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
         FROM hymns h
         JOIN hymns_fts ON hymns_fts.rowid = h.id
         WHERE hymns_fts MATCH ?1
         ORDER BY rank LIMIT 200"
    )?;
    let hymns = stmt
        .query_map(params![fts_query], map_hymn_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hymns)
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
        "SELECT id, number, title, author, album, lyrics, chords, audio_path, playback_path, category, notes, cover_path, lyrics_sync, api_music_id, created_at, updated_at
         FROM hymns WHERE album = ?1 ORDER BY number, title"
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

    conn.execute(
        "INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
         SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
         FROM hymns WHERE id = ?1",
        params![hymn_id],
    )?;

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

    conn.execute(
        "INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
         VALUES('delete', ?1, '', '', '', '')",
        params![id],
    )?;
    conn.execute(
        "INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
         SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
         FROM hymns WHERE id = ?1",
        params![id],
    )?;

    Ok(())
}

pub fn delete_hymn(conn: &Connection, id: i64) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM hymns WHERE id = ?1", params![id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Hymn with id {} not found", id)));
    }
    conn.execute(
        "INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
         VALUES('delete', ?1, '', '', '', '')",
        params![id],
    )?;
    Ok(())
}

/// Parse time string to milliseconds
/// Handles formats:
/// - "00:01.500" or "01:30.250" (MM:SS.mmm)
/// - "00:00:03" (MM:SS:frames where frames are typically centiseconds)
/// - "00:01:500" (MM:SS:mmm)
fn parse_time_to_ms(time_str: &str) -> Option<u64> {
    let time_str = time_str.trim();
    if time_str.is_empty() {
        return None;
    }

    // Count colons to determine format
    let colon_count = time_str.chars().filter(|&c| c == ':').count();

    if colon_count == 2 {
        // Format: HH:MM:SS (e.g., "00:01:50" means 1 min 50 sec)
        // This is the standard format from the LouvorJA API.
        let parts: Vec<&str> = time_str.split(':').collect();
        if parts.len() != 3 {
            return None;
        }
        let hours: u64 = parts[0].parse().ok()?;
        let minutes: u64 = parts[1].parse().ok()?;
        let seconds: u64 = parts[2].parse().ok()?;
        return Some(hours * 3600 * 1000 + minutes * 60 * 1000 + seconds * 1000);
    } else if colon_count == 1 {
        // Format: MM:SS.mmm (e.g., "00:01.500")
        let parts: Vec<&str> = time_str.split(':').collect();
        if parts.len() != 2 {
            return None;
        }
        let minutes: u64 = parts[0].parse().ok()?;
        let seconds_part = parts[1];

        // Check if seconds part has a decimal
        if let Some(dot_pos) = seconds_part.find('.') {
            let seconds: u64 = seconds_part[..dot_pos].parse().ok()?;
            let ms_str = &seconds_part[dot_pos + 1..];
            let padded = format!("{:0<3}", ms_str);
            let millis: u64 = padded[..3].parse().unwrap_or(0);
            return Some(minutes * 60 * 1000 + seconds * 1000 + millis);
        } else {
            // No decimal - just seconds
            let seconds: u64 = seconds_part.parse().ok()?;
            return Some(minutes * 60 * 1000 + seconds * 1000);
        }
    }

    None
}

/// SyncLyric struct matching the JSON format stored in lyrics_sync
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncLyric {
    _lyric: String,
    order: i32,
    time: Option<String>,
    _instrumental_time: Option<String>,
}

pub fn get_sync_points(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Vec<crate::audio::SyncPoint>, AppError> {
    log::debug!("[get_sync_points] Fetching sync points for hymn_id={}", hymn_id);
    
    // First, try to get sync points from the audio_sync_points table
    let mut stmt = conn.prepare(
        "SELECT slide_index, timestamp_ms FROM audio_sync_points WHERE hymn_id = ?1 ORDER BY timestamp_ms"
    )?;
    let points: Vec<crate::audio::SyncPoint> = stmt
        .query_map(params![hymn_id], |row| {
            Ok(crate::audio::SyncPoint {
                slide_index: row.get::<_, i64>("slide_index")? as usize,
                timestamp_ms: row.get::<_, i64>("timestamp_ms")? as u64,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // If we found sync points in the table, return them
    if !points.is_empty() {
        log::debug!("[get_sync_points] Found {} sync points in audio_sync_points table", points.len());
        return Ok(points);
    }

    // Otherwise, fall back to parsing the lyrics_sync JSON field from hymns table
    let lyrics_sync: Option<String> = conn
        .query_row(
            "SELECT lyrics_sync FROM hymns WHERE id = ?1",
            params![hymn_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();
    
    log::debug!("[get_sync_points] lyrics_sync from DB: {:?}", lyrics_sync.as_ref().map(|s| if s.len() > 200 { format!("{}...", &s[..200]) } else { s.clone() }));

    if let Some(json_str) = lyrics_sync {
        match serde_json::from_str::<Vec<SyncLyric>>(&json_str) {
            Ok(sync_lyrics) => {
                log::debug!("[get_sync_points] Parsed {} sync lyrics", sync_lyrics.len());
                let mut sync_points: Vec<crate::audio::SyncPoint> = Vec::new();

                // Add cover slide at time 0
                sync_points.push(crate::audio::SyncPoint {
                    slide_index: 0,
                    timestamp_ms: 0,
                });

                // Sort by order and convert to SyncPoint
                let mut sorted_lyrics = sync_lyrics;
                sorted_lyrics.sort_by_key(|l| l.order);

                // Cover slide is index 0, lyrics start at index 1
                for (idx, sync_lyric) in sorted_lyrics.iter().enumerate() {
                    if let Some(time_str) = &sync_lyric.time {
                        if let Some(ms) = parse_time_to_ms(time_str) {
                            log::debug!("[get_sync_points] Lyric idx={} time={:?} -> {}ms", idx, time_str, ms);
                            sync_points.push(crate::audio::SyncPoint {
                                // Slide index 0 is cover, so lyrics start at 1
                                slide_index: idx + 1,
                                timestamp_ms: ms,
                            });
                        } else {
                            log::warn!("[get_sync_points] Failed to parse time: {:?}", time_str);
                        }
                    } else {
                        log::debug!("[get_sync_points] Lyric idx={} has no time", idx);
                    }
                }

                log::debug!("[get_sync_points] Returning {} sync points", sync_points.len());
                return Ok(sync_points);
            }
            Err(e) => {
                log::warn!("[get_sync_points] Failed to parse lyrics_sync JSON: {}", e);
            }
        }
    }

    log::debug!("[get_sync_points] No sync points found for hymn_id={}", hymn_id);
    Ok(vec![])
}

pub fn save_sync_points(
    conn: &mut Connection,
    hymn_id: i64,
    points: &[crate::audio::SyncPoint],
) -> Result<(), AppError> {
    // Wrap in a transaction: a failed INSERT mid-loop would leave the hymn with
    // zero sync points (DELETE already committed) without this guard.
    let tx = conn.transaction()?;

    tx.execute(
        "DELETE FROM audio_sync_points WHERE hymn_id = ?1",
        params![hymn_id],
    )?;

    let mut stmt = tx.prepare(
        "INSERT INTO audio_sync_points (hymn_id, slide_index, timestamp_ms) VALUES (?1, ?2, ?3)",
    )?;
    for point in points {
        stmt.execute(params![
            hymn_id,
            point.slide_index as i64,
            point.timestamp_ms as i64
        ])?;
    }
    drop(stmt);

    tx.commit()?;

    Ok(())
}

/// Resolve the audio path for a hymn, checking both modern and legacy sources.
///
/// Priority:
/// 1. Modern `audio_path` (if set and non-empty)
/// 2. Legacy file reference via `legacy_file_id` (reconstructed from files table)
///
/// Used during migration when audio files exist in legacy database but not in modern media directory.
pub fn resolve_hymn_audio_path(conn: &Connection, hymn_id: i64) -> Result<Option<String>, AppError> {
    // Try modern audio_path first
    let modern_path = conn.query_row(
        "SELECT audio_path FROM hymns WHERE id = ?1",
        params![hymn_id],
        |row| row.get::<_, Option<String>>("audio_path"),
    )?;

    if let Some(ref path) = modern_path {
        if !path.is_empty() {
            return Ok(Some(path.clone()));
        }
    }

    // Fall back to legacy file reference
    let legacy_path = conn.query_row(
        "SELECT COALESCE(f.dir || '/' || f.file_name, NULL)
         FROM hymns h
         LEFT JOIN files f ON f.id_file = h.legacy_file_id
         WHERE h.id = ?1",
        params![hymn_id],
        |row| row.get::<_, Option<String>>(0),
    )?;

    Ok(legacy_path)
}

pub fn find_hymn_by_api_music_id(conn: &Connection, api_music_id: i64) -> Option<i64> {
    conn.query_row(
        "SELECT id FROM hymns WHERE api_music_id = ?1",
        params![api_music_id],
        |row| row.get(0),
    )
    .ok()
}
