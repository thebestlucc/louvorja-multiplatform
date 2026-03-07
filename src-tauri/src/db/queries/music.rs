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
        let mut stmt = conn.prepare(
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

    // If numeric, search by number
    if let Ok(num) = trimmed.parse::<i64>() {
        let mut stmt = conn.prepare(
            "SELECT h.id, h.number, h.title, h.author, h.album, h.lyrics, h.chords, h.audio_path, h.playback_path, h.category, h.notes, h.cover_path, h.lyrics_sync, h.api_music_id, h.created_at, h.updated_at
             FROM hymns h
             WHERE h.number = ?1
             AND h.category = 'hymnal'
             ORDER BY h.title"
        )?;
        let hymns = stmt
            .query_map(params![num], map_hymn_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    // Text search via FTS5
    let Some(fts_query) = build_fts_prefix_query(trimmed) else {
        return Ok(vec![]);
    };

    let mut stmt = conn.prepare(
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

pub fn search_all_hymns(conn: &Connection, query: &str) -> Result<Vec<Hymn>, AppError> {
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn.prepare(
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

    // Text search via FTS5
    let Some(fts_query) = build_fts_prefix_query(trimmed) else {
        return Ok(vec![]);
    };

    let mut stmt = conn.prepare(
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

pub fn rebuild_hymns_search_index(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "INSERT INTO hymns_fts(hymns_fts) VALUES('delete-all');
         INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
         SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
         FROM hymns
         WHERE category = 'hymnal';"
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
    let mut stmt = conn.prepare(
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
    let mut stmt = conn.prepare(
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
        let mut stmt = conn.prepare("SELECT collection_id FROM collection_hymns WHERE hymn_id = ?1")?;
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
            let mut h_stmt = conn.prepare(
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

            if let Ok((title, lyrics, author, album, collection_name, collection_description)) = h_stmt.query_row(
                params![collection_id, id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                },
            ) {
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
    instrumental_time: Option<String>,
}

pub fn get_sync_points(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Vec<crate::audio::SyncPoint>, AppError> {
    log::debug!("[get_sync_points] Fetching sync points for hymn_id={}", hymn_id);
    
    // First, try to get sync points from the audio_sync_points table
    // (Note: manual overrides currently only apply to default audio, not instrumental)
    let mut stmt = conn.prepare(
        "SELECT slide_index, timestamp_ms FROM audio_sync_points WHERE hymn_id = ?1 ORDER BY timestamp_ms"
    )?;
    let points: Vec<crate::audio::SyncPoint> = stmt
        .query_map(params![hymn_id], |row| {
            Ok(crate::audio::SyncPoint {
                slide_index: row.get::<_, i64>("slide_index")? as usize,
                timestamp_ms: row.get::<_, i64>("timestamp_ms")? as u64,
                instrumental_timestamp_ms: None,
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
                    instrumental_timestamp_ms: Some(0),
                });

                // Sort by order and convert to SyncPoint
                let mut sorted_lyrics = sync_lyrics;
                sorted_lyrics.sort_by_key(|l| l.order);

                // Cover slide is index 0, lyrics start at index 1
                for (idx, sync_lyric) in sorted_lyrics.iter().enumerate() {
                    let ms_default = sync_lyric.time.as_ref().and_then(|t| parse_time_to_ms(t));
                    let ms_inst = sync_lyric.instrumental_time.as_ref().and_then(|t| parse_time_to_ms(t));
                    
                    if ms_default.is_some() || ms_inst.is_some() {
                        sync_points.push(crate::audio::SyncPoint {
                            // Slide index 0 is cover, so lyrics start at 1
                            slide_index: idx + 1,
                            timestamp_ms: ms_default.unwrap_or(0),
                            instrumental_timestamp_ms: ms_inst,
                        });
                    } else {
                        log::debug!("[get_sync_points] Lyric idx={} has no parsable time", idx);
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
