use crate::error::AppError;
use rusqlite::{params, Connection};
use std::collections::HashMap;

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
