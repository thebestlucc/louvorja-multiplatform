use crate::db::models::{Album, Hymn};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};
use std::collections::HashMap;

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
        let mut stmt =
            conn.prepare("SELECT collection_id FROM collection_hymns WHERE hymn_id = ?1")?;
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
    #[allow(dead_code)]
    show_slide: Option<i32>,
}

struct StoredSyncPoint {
    slide_index: usize,
    timestamp_ms: u64,
    instrumental_timestamp_ms: Option<u64>,
}

fn is_explicit_sync_timestamp(index: usize, timestamp_ms: Option<u64>) -> bool {
    matches!(timestamp_ms, Some(value) if value > 0) || (index == 0 && timestamp_ms == Some(0))
}

fn resolve_sync_timeline(raw_timestamps: &[Option<u64>]) -> Vec<Option<u64>> {
    let mut resolved = vec![None; raw_timestamps.len()];
    let explicit_points = raw_timestamps
        .iter()
        .enumerate()
        .filter_map(|(index, timestamp_ms)| {
            if is_explicit_sync_timestamp(index, *timestamp_ms) {
                Some((index, timestamp_ms.unwrap_or(0)))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    for (index, timestamp_ms) in &explicit_points {
        resolved[*index] = Some(*timestamp_ms);
    }

    for window in explicit_points.windows(2) {
        let Some((previous_index, previous_ms)) = window.first().copied() else {
            continue;
        };
        let Some((next_index, next_ms)) = window.get(1).copied() else {
            continue;
        };

        let gap_count = next_index.saturating_sub(previous_index + 1);
        if gap_count == 0 || next_ms <= previous_ms {
            continue;
        }

        let span_ms = next_ms - previous_ms;
        for gap_offset in 1..=gap_count {
            let interpolated = previous_ms + (span_ms * gap_offset as u64) / (gap_count as u64 + 1);
            resolved[previous_index + gap_offset] = Some(interpolated);
        }
    }

    resolved
}

fn parse_lyrics_sync_points(
    lyrics_sync: Option<&str>,
) -> Result<Vec<crate::audio::SyncPoint>, AppError> {
    let Some(json_str) = lyrics_sync else {
        return Ok(vec![]);
    };

    match serde_json::from_str::<Vec<SyncLyric>>(json_str) {
        Ok(sync_lyrics) => {
            log::debug!("[get_sync_points] Parsed {} sync lyrics", sync_lyrics.len());
            let mut sync_points = vec![crate::audio::SyncPoint {
                slide_index: 0,
                timestamp_ms: 0,
                instrumental_timestamp_ms: Some(0),
            }];

            let mut sorted_lyrics = sync_lyrics;
            sorted_lyrics.sort_by_key(|lyric| lyric.order);
            let sung_timeline = resolve_sync_timeline(
                &sorted_lyrics
                    .iter()
                    .map(|lyric| lyric.time.as_ref().and_then(|time| parse_time_to_ms(time)))
                    .collect::<Vec<_>>(),
            );
            let instrumental_timeline = resolve_sync_timeline(
                &sorted_lyrics
                    .iter()
                    .map(|lyric| {
                        lyric
                            .instrumental_time
                            .as_ref()
                            .and_then(|time| parse_time_to_ms(time))
                    })
                    .collect::<Vec<_>>(),
            );

            for (idx, _sync_lyric) in sorted_lyrics.iter().enumerate() {
                let ms_default = sung_timeline[idx];
                let ms_inst = instrumental_timeline[idx];

                if ms_default.is_some() || ms_inst.is_some() {
                    sync_points.push(crate::audio::SyncPoint {
                        slide_index: idx + 1,
                        timestamp_ms: ms_default.or(ms_inst).unwrap_or(0),
                        instrumental_timestamp_ms: ms_inst,
                    });
                } else {
                    log::debug!(
                        "[get_sync_points] Lyric idx={} has no resolvable timing after interpolation",
                        idx
                    );
                }
            }

            Ok(sync_points)
        }
        Err(error) => {
            log::warn!(
                "[get_sync_points] Failed to parse lyrics_sync JSON: {}",
                error
            );
            Ok(vec![])
        }
    }
}

fn load_stored_sync_points(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Vec<StoredSyncPoint>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT slide_index, timestamp_ms, instrumental_timestamp_ms
         FROM audio_sync_points
         WHERE hymn_id = ?1
         ORDER BY timestamp_ms, slide_index",
    )?;

    let points = stmt
        .query_map(params![hymn_id], |row| {
            Ok(StoredSyncPoint {
                slide_index: row.get::<_, i64>("slide_index")? as usize,
                timestamp_ms: row.get::<_, i64>("timestamp_ms")? as u64,
                instrumental_timestamp_ms: row
                    .get::<_, Option<i64>>("instrumental_timestamp_ms")?
                    .map(|value| value as u64),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(points)
}

pub fn get_sync_points(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Vec<crate::audio::SyncPoint>, AppError> {
    log::debug!(
        "[get_sync_points] Fetching sync points for hymn_id={}",
        hymn_id
    );
    let lyrics_sync: Option<String> = conn
        .query_row(
            "SELECT lyrics_sync FROM hymns WHERE id = ?1",
            params![hymn_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    log::debug!(
        "[get_sync_points] lyrics_sync from DB: {:?}",
        lyrics_sync.as_ref().map(|s| if s.len() > 200 {
            format!("{}...", &s[..200])
        } else {
            s.clone()
        })
    );

    let baseline_points = parse_lyrics_sync_points(lyrics_sync.as_deref())?;
    let stored_points = load_stored_sync_points(conn, hymn_id)?;

    if stored_points.is_empty() {
        log::debug!(
            "[get_sync_points] Returning {} baseline sync points",
            baseline_points.len()
        );
        return Ok(baseline_points);
    }

    let mut baseline_by_slide: HashMap<usize, crate::audio::SyncPoint> = baseline_points
        .into_iter()
        .map(|point| (point.slide_index, point))
        .collect();
    let mut merged_points = Vec::with_capacity(stored_points.len() + baseline_by_slide.len());

    for stored_point in stored_points {
        let baseline_point = baseline_by_slide.remove(&stored_point.slide_index);
        merged_points.push(crate::audio::SyncPoint {
            slide_index: stored_point.slide_index,
            timestamp_ms: stored_point.timestamp_ms,
            instrumental_timestamp_ms: stored_point
                .instrumental_timestamp_ms
                .or_else(|| baseline_point.and_then(|point| point.instrumental_timestamp_ms)),
        });
    }

    merged_points.extend(baseline_by_slide.into_values());
    merged_points.sort_by_key(|point| (point.timestamp_ms, point.slide_index));

    log::debug!(
        "[get_sync_points] Returning {} merged sync points",
        merged_points.len()
    );
    Ok(merged_points)
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
        "INSERT INTO audio_sync_points (
            hymn_id,
            slide_index,
            timestamp_ms,
            instrumental_timestamp_ms
         ) VALUES (?1, ?2, ?3, ?4)",
    )?;
    for point in points {
        stmt.execute(params![
            hymn_id,
            point.slide_index as i64,
            point.timestamp_ms as i64,
            point.instrumental_timestamp_ms.map(|value| value as i64),
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
pub fn resolve_hymn_audio_path(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Option<String>, AppError> {
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

/// Query hymnal from the content DB (downloaded legacy DB).
/// Returns Hymn structs with file paths ready for app_data_dir resolution.
pub fn get_hymns_from_content_db(
    content_db: &Connection,
    lang_bcp47: &str,
) -> Result<Vec<Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db
        .prepare(
            "SELECT
                m.id_music                    AS id,
                am.track                      AS number,
                m.name                        AS title,
                NULL                          AS author,
                a.name                        AS album,
                NULL                          AS lyrics,
                NULL                          AS chords,
                fa.dir || '/' || fa.name      AS audio_path,
                fp.dir || '/' || fp.name      AS playback_path,
                'hymnal'                      AS category,
                NULL                          AS notes,
                fi.dir || '/' || fi.name      AS cover_path,
                NULL                          AS lyrics_sync,
                m.id_music                    AS api_music_id,
                m.created_at                  AS created_at,
                m.updated_at                  AS updated_at
             FROM musics m
             LEFT JOIN albums_musics am ON am.id_music = m.id_music
             LEFT JOIN albums        a  ON a.id_album  = am.id_album
             LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
             LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
             LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
             WHERE m.id_language = ?1
             ORDER BY a.name, am.track",
        )
        .map_err(AppError::Database)?;

    let hymns = stmt
        .query_map([lang_short], |row| {
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
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Search hymnal in the content DB using FTS5 (musics_fts table).
/// Falls back to `get_hymns_from_content_db` when query is empty or FTS table is missing.
pub fn search_hymns_content_db(
    content_db: &Connection,
    query: &str,
    lang_bcp47: &str,
) -> Result<Vec<Hymn>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return get_hymns_from_content_db(content_db, lang_bcp47);
    }

    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    // Sanitize query: keep alphanumeric + whitespace, then build FTS5 prefix query.
    let sanitized: String = trimmed
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");
    if sanitized.is_empty() {
        return get_hymns_from_content_db(content_db, lang_bcp47);
    }
    let fts_query = format!("{}*", sanitized);

    // Check if FTS table exists
    let fts_exists: bool = content_db
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='musics_fts'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !fts_exists {
        return get_hymns_from_content_db(content_db, lang_bcp47);
    }

    let mut stmt = content_db
        .prepare(
            "SELECT
                m.id_music AS id, am.track AS number, m.name AS title,
                NULL AS author, a.name AS album, NULL AS lyrics, NULL AS chords,
                fa.dir || '/' || fa.name AS audio_path,
                fp.dir || '/' || fp.name AS playback_path,
                'hymnal' AS category, NULL AS notes,
                fi.dir || '/' || fi.name AS cover_path,
                NULL AS lyrics_sync, m.id_music AS api_music_id,
                m.created_at, m.updated_at
             FROM musics_fts
             JOIN musics m ON musics_fts.rowid = m.id_music
             LEFT JOIN albums_musics am ON am.id_music = m.id_music
             LEFT JOIN albums        a  ON a.id_album  = am.id_album
             LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
             LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
             LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
             WHERE musics_fts MATCH ?1
               AND m.id_language = ?2
             ORDER BY rank
             LIMIT 50",
        )
        .map_err(AppError::Database)?;

    let hymns = stmt
        .query_map(params![fts_query, lang_short], |row| {
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
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

/// Query album/collection list from the content DB (downloaded legacy DB).
pub fn get_collections_from_content_db(
    content_db: &Connection,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Collection>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db
        .prepare(
            "SELECT
                a.id_album                                   AS id,
                a.name                                       AS name,
                NULL                                         AS description,
                CAST(SUBSTR(a.name, 1, 4) AS INTEGER)        AS year,
                f.dir || '/' || f.name                       AS cover_path,
                NULL                                         AS auto_cover_path,
                COUNT(am.id_music)                           AS song_count,
                'api'                                        AS source_type,
                a.id_album                                   AS api_album_id,
                a.created_at,
                a.updated_at
             FROM albums a
             LEFT JOIN files f ON f.id_file = a.id_file_image
             LEFT JOIN albums_musics am ON am.id_album = a.id_album
             WHERE a.id_language = ?1
             GROUP BY a.id_album
             ORDER BY a.name",
        )
        .map_err(AppError::Database)?;

    let collections = stmt
        .query_map([lang_short], |row| {
            let year_raw: Option<i64> = row.get("year")?;
            let year =
                year_raw.and_then(|y| if (1900..=2100).contains(&y) { Some(y as i32) } else { None });
            Ok(crate::db::models::Collection {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                year,
                cover_path: row.get("cover_path")?,
                auto_cover_path: row.get("auto_cover_path")?,
                song_count: row.get::<_, i64>("song_count")? as i32,
                source_type: row.get("source_type")?,
                api_album_id: row.get("api_album_id")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(collections)
}

/// Query hymns belonging to a specific album in the content DB.
pub fn get_collection_hymns_from_content_db(
    content_db: &Connection,
    album_id: i64,
    lang_bcp47: &str,
) -> Result<Vec<Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db
        .prepare(
            "SELECT
                m.id_music AS id, am.track AS number, m.name AS title,
                NULL AS author, a.name AS album, NULL AS lyrics, NULL AS chords,
                fa.dir || '/' || fa.name AS audio_path,
                fp.dir || '/' || fp.name AS playback_path,
                'hymnal' AS category, NULL AS notes,
                fi.dir || '/' || fi.name AS cover_path,
                NULL AS lyrics_sync, m.id_music AS api_music_id,
                m.created_at, m.updated_at
             FROM musics m
             JOIN albums_musics am ON am.id_music = m.id_music
             LEFT JOIN albums    a  ON a.id_album  = am.id_album
             LEFT JOIN files     fa ON fa.id_file  = m.id_file_music
             LEFT JOIN files     fp ON fp.id_file  = m.id_file_instrumental_music
             LEFT JOIN files     fi ON fi.id_file  = m.id_file_image
             WHERE am.id_album = ?1
               AND m.id_language = ?2
             ORDER BY am.track",
        )
        .map_err(AppError::Database)?;

    let hymns = stmt
        .query_map(params![album_id, lang_short], |row| {
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
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(hymns)
}

pub fn find_hymn_by_api_music_id(conn: &Connection, api_music_id: i64) -> Option<i64> {
    conn.query_row(
        "SELECT id FROM hymns WHERE api_music_id = ?1",
        params![api_music_id],
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
        crate::db::migrations::run_migrations(&conn).expect("run migrations");
        conn
    }

    fn insert_hymn(conn: &Connection, lyrics_sync: Option<&str>) -> i64 {
        conn.execute(
            "INSERT INTO hymns (title, category, lyrics_sync) VALUES (?1, 'hymnal', ?2)",
            params!["Test Hymn", lyrics_sync],
        )
        .expect("insert hymn");
        conn.last_insert_rowid()
    }

    #[test]
    fn get_sync_points_merges_override_rows_with_lyrics_sync_instrumental_timestamps() {
        let conn = setup_conn();
        let hymn_id = insert_hymn(
            &conn,
            Some(
                r#"[{"lyric":"Verse 1","order":0,"time":"00:00:03","instrumentalTime":"00:00:05"},{"lyric":"Verse 2","order":1,"time":"00:00:07","instrumentalTime":"00:00:09"}]"#,
            ),
        );

        conn.execute(
            "INSERT INTO audio_sync_points (hymn_id, slide_index, timestamp_ms)
             VALUES (?1, 1, 3500), (?1, 2, 7500)",
            params![hymn_id],
        )
        .expect("insert override rows");

        let points = get_sync_points(&conn, hymn_id).expect("get sync points");
        assert_eq!(points.len(), 3, "cover slide plus two lyric slides");

        assert_eq!(points[0].slide_index, 0);
        assert_eq!(points[0].timestamp_ms, 0);
        assert_eq!(points[0].instrumental_timestamp_ms, Some(0));

        assert_eq!(points[1].slide_index, 1);
        assert_eq!(points[1].timestamp_ms, 3500);
        assert_eq!(points[1].instrumental_timestamp_ms, Some(5000));

        assert_eq!(points[2].slide_index, 2);
        assert_eq!(points[2].timestamp_ms, 7500);
        assert_eq!(points[2].instrumental_timestamp_ms, Some(9000));
    }

    #[test]
    fn save_sync_points_persists_instrumental_timestamp_ms() {
        let mut conn = setup_conn();
        let hymn_id = insert_hymn(&conn, None);

        save_sync_points(
            &mut conn,
            hymn_id,
            &[crate::audio::SyncPoint {
                slide_index: 1,
                timestamp_ms: 3000,
                instrumental_timestamp_ms: Some(5000),
            }],
        )
        .expect("save sync points");

        let saved: (i64, Option<i64>) = conn
            .query_row(
                "SELECT timestamp_ms, instrumental_timestamp_ms
                 FROM audio_sync_points
                 WHERE hymn_id = ?1 AND slide_index = 1",
                params![hymn_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read saved sync point");

        assert_eq!(saved.0, 3000);
        assert_eq!(saved.1, Some(5000));
    }

    #[test]
    fn get_sync_points_keeps_later_slide_indexes_when_zero_time_gap_entries_exist() {
        let conn = setup_conn();
        let hymn_id = insert_hymn(
            &conn,
            Some(
                r#"[{"lyric":"Verse 1","order":1,"time":"00:00:09","instrumentalTime":"00:00:09"},{"lyric":"Verse 2","order":2,"time":"00:00:20","instrumentalTime":"00:00:20"},{"lyric":"","order":3,"time":"00:00:00","instrumentalTime":"00:00:00","showSlide":0},{"lyric":"Verse 3","order":4,"time":"00:00:30","instrumentalTime":"00:00:30"}]"#,
            ),
        );

        let points = get_sync_points(&conn, hymn_id).expect("get sync points");
        assert_eq!(
            points
                .iter()
                .map(|point| (point.slide_index, point.timestamp_ms))
                .collect::<Vec<_>>(),
            vec![(0, 0), (1, 9000), (2, 20000), (3, 25000), (4, 30000)]
        );
    }
}
