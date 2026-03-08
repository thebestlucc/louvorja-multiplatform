use crate::db::queries::{collections, music};
use crate::error::AppError;
use crate::legacy_fetch::{fetcher::download_file, ApiAlbum, ApiLyric, ApiMusic};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;

/// Convert lyrics from API format to text format (stanzas separated by double newlines).
pub fn lyrics_to_text(lyrics: &[ApiLyric]) -> String {
    let mut sorted_lyrics: Vec<_> = lyrics.iter().collect();
    sorted_lyrics.sort_by_key(|lyric| lyric.order);

    sorted_lyrics
        .iter()
        .map(|lyric| lyric.lyric.trim())
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Synchronized lyric entry for JSON storage.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncLyric {
    pub lyric: String,
    #[specta(type = f64)]
    pub order: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instrumental_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[specta(type = Option<f64>)]
    pub show_slide: Option<i64>,
}

/// Convert lyrics from API format to JSON format with sync timing data.
pub fn lyrics_to_sync_json(lyrics: &[ApiLyric]) -> Option<String> {
    if lyrics.is_empty() {
        return None;
    }

    let has_timing = lyrics
        .iter()
        .any(|lyric| lyric.time.is_some() || lyric.instrumental_time.is_some());
    if !has_timing {
        return None;
    }

    let mut sorted_lyrics: Vec<_> = lyrics.iter().collect();
    sorted_lyrics.sort_by_key(|lyric| lyric.order);

    let sync_lyrics: Vec<SyncLyric> = sorted_lyrics
        .iter()
        .map(|lyric| SyncLyric {
            lyric: lyric.lyric.trim().to_string(),
            order: lyric.order,
            time: lyric.time.clone(),
            instrumental_time: lyric.instrumental_time.clone(),
            show_slide: lyric.show_slide,
        })
        .collect();

    serde_json::to_string(&sync_lyrics).ok()
}

fn filename_from_url(url: &str, default_ext: &str) -> String {
    url.rsplit('/')
        .next()
        .map(|segment| {
            let decoded = urlencoding::decode(segment).unwrap_or_else(|_| segment.into());
            let sanitized: String = decoded
                .chars()
                .map(|ch| {
                    if ch.is_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                        ch
                    } else {
                        '_'
                    }
                })
                .collect();

            if sanitized.contains('.') {
                sanitized
            } else {
                format!("{}.{}", sanitized, default_ext)
            }
        })
        .unwrap_or_else(|| format!("file.{}", default_ext))
}

/// Download a file from URL to media directory, returning a relative path.
/// Returns `None` if the URL is missing or the download fails.
pub async fn download_media_file(
    url: Option<&String>,
    media_dir: &Path,
    subfolder: &str,
    remote_id: i64,
    default_ext: &str,
) -> Option<String> {
    let url = url?;
    if url.is_empty() {
        return None;
    }

    let filename = filename_from_url(url, default_ext);
    let relative_path = format!("media/{}/{}/{}", subfolder, remote_id, filename);
    let full_path = media_dir
        .join(subfolder)
        .join(remote_id.to_string())
        .join(&filename);

    match download_file(url, &full_path).await {
        Ok(()) => {
            log::debug!("Downloaded {} to {}", url, full_path.display());
            Some(relative_path)
        }
        Err(error) => {
            log::warn!("Failed to download {}: {}", url, error);
            None
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct DownloadedMusicMedia {
    pub audio_path: Option<String>,
    pub playback_path: Option<String>,
    pub cover_path: Option<String>,
}

impl DownloadedMusicMedia {
    pub fn has_audio_download(&self) -> bool {
        self.audio_path.is_some()
    }

    pub fn has_playback_download(&self) -> bool {
        self.playback_path.is_some()
    }

    pub fn has_cover_download(&self) -> bool {
        self.cover_path.is_some()
    }
}

pub async fn download_music_media(
    music: &ApiMusic,
    media_dir: &Path,
    download_audio: bool,
    download_images: bool,
) -> DownloadedMusicMedia {
    let (audio_path, playback_path, cover_path) = tokio::join!(
        async {
            if download_audio {
                download_media_file(
                    music.url_music.as_ref(),
                    media_dir,
                    "audio",
                    music.id_music,
                    "mp3",
                )
                .await
            } else {
                None
            }
        },
        async {
            if download_audio {
                download_media_file(
                    music.url_instrumental_music.as_ref(),
                    media_dir,
                    "playback",
                    music.id_music,
                    "mp3",
                )
                .await
            } else {
                None
            }
        },
        async {
            if download_images {
                download_media_file(
                    music.url_image.as_ref(),
                    media_dir,
                    "images",
                    music.id_music,
                    "jpg",
                )
                .await
            } else {
                None
            }
        }
    );

    DownloadedMusicMedia {
        audio_path,
        playback_path,
        cover_path,
    }
}

pub async fn download_album_cover(
    album: &ApiAlbum,
    media_dir: &Path,
    download_images: bool,
) -> Option<String> {
    if download_images {
        download_media_file(
            album.url_image.as_ref(),
            media_dir,
            "album_covers",
            album.id_album,
            "jpg",
        )
        .await
    } else {
        None
    }
}

pub fn extract_year_from_url(url: &str) -> Option<i32> {
    let filename = url.split('/').next_back()?.split('.').next()?;
    if filename.len() == 4 && filename.chars().all(|ch| ch.is_ascii_digit()) {
        filename.parse::<i32>().ok()
    } else {
        None
    }
}

/// Import a music entry into the hymns table (sync, with pre-downloaded paths).
pub fn import_music_to_db(
    conn: &Connection,
    music: &ApiMusic,
    audio_path: Option<&str>,
    playback_path: Option<&str>,
    cover_path: Option<&str>,
    replace_existing: bool,
    album_name: Option<&str>,
    api_music_id: Option<i64>,
    category: Option<&str>,
) -> Result<(bool, Option<i64>), AppError> {
    let lyrics_text = lyrics_to_text(&music.lyrics);
    let lyrics_sync = lyrics_to_sync_json(&music.lyrics);
    let track_number = music.track;

    let id_match: Option<i64> = if let Some(api_music_id) = api_music_id {
        conn.query_row(
            "SELECT id FROM hymns WHERE api_music_id = ?1",
            rusqlite::params![api_music_id],
            |row| row.get(0),
        )
        .optional()?
    } else {
        None
    };

    let title_match: Option<i64> = if id_match.is_none() {
        conn.query_row(
            "SELECT id FROM hymns WHERE title = ?1",
            rusqlite::params![music.name],
            |row| row.get::<_, i64>(0),
        )
        .ok()
    } else {
        None
    };

    let existing_id = if replace_existing {
        id_match
    } else {
        id_match.or(title_match)
    };

    let (was_imported, hymn_id) = match existing_id {
        Some(id) if replace_existing => {
            conn.execute(
                r#"
                UPDATE hymns SET
                    number = COALESCE(?1, number),
                    lyrics = COALESCE(?2, lyrics),
                    audio_path = COALESCE(?3, audio_path),
                    playback_path = COALESCE(?4, playback_path),
                    cover_path = COALESCE(?5, cover_path),
                    lyrics_sync = COALESCE(?6, lyrics_sync),
                    album = COALESCE(?7, album),
                    api_music_id = COALESCE(?8, api_music_id),
                    category = COALESCE(?9, category),
                    updated_at = datetime('now')
                WHERE id = ?10
                "#,
                rusqlite::params![
                    track_number,
                    if lyrics_text.is_empty() {
                        None
                    } else {
                        Some(&lyrics_text)
                    },
                    audio_path,
                    playback_path,
                    cover_path,
                    lyrics_sync.as_ref(),
                    album_name,
                    api_music_id,
                    category,
                    id,
                ],
            )?;
            (true, Some(id))
        }
        Some(id) => {
            if api_music_id.is_some() || category.is_some() {
                conn.execute(
                    "UPDATE hymns SET
                        api_music_id = COALESCE(api_music_id, ?1),
                        category = CASE
                            WHEN ?2 = 'hymnal' THEN 'hymnal'
                            ELSE COALESCE(category, ?2)
                        END
                     WHERE id = ?3",
                    rusqlite::params![api_music_id, category, id],
                )?;
            }
            (false, Some(id))
        }
        None => {
            if replace_existing {
                if let Some(id) = title_match {
                    return Ok((false, Some(id)));
                }
            }
            conn.execute(
                r#"
                INSERT INTO hymns (
                    number,
                    title,
                    album,
                    lyrics,
                    audio_path,
                    playback_path,
                    cover_path,
                    lyrics_sync,
                    api_music_id,
                    category,
                    created_at,
                    updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'), datetime('now'))
                "#,
                rusqlite::params![
                    track_number,
                    music.name,
                    album_name,
                    if lyrics_text.is_empty() {
                        None
                    } else {
                        Some(lyrics_text)
                    },
                    audio_path,
                    playback_path,
                    cover_path,
                    lyrics_sync,
                    api_music_id,
                    category,
                ],
            )?;
            let new_id = conn.last_insert_rowid();
            (true, Some(new_id))
        }
    };

    Ok((was_imported, hymn_id))
}

pub fn upsert_api_album_collection(
    conn: &Connection,
    album: &ApiAlbum,
    cover_path: Option<&str>,
    release_year: Option<i32>,
) -> Result<(i64, bool), AppError> {
    if let Some(collection_id) = collections::find_collection_by_api_album_id(conn, album.id_album) {
        conn.execute(
            "UPDATE collections
             SET name = ?1,
                 description = COALESCE(?2, description),
                 year = COALESCE(?3, year),
                 cover_path = COALESCE(?4, cover_path),
                 source_type = 'api',
                 api_album_id = COALESCE(api_album_id, ?5),
                 updated_at = datetime('now')
             WHERE id = ?6",
            rusqlite::params![
                album.name,
                album.subtitle.as_deref(),
                release_year,
                cover_path,
                album.id_album,
                collection_id,
            ],
        )?;
        Ok((collection_id, false))
    } else {
        let collection_id = collections::insert_collection(
            conn,
            &album.name,
            album.subtitle.as_deref(),
            release_year,
            cover_path,
            "api",
            Some(album.id_album),
        )?;
        Ok((collection_id, true))
    }
}

pub fn link_collection_hymn(
    conn: &Connection,
    collection_id: i64,
    hymn_id: i64,
    track_order: i64,
) -> Result<bool, AppError> {
    collections::insert_collection_hymn(conn, collection_id, hymn_id, track_order)
}

pub fn import_music_and_link_to_collection(
    conn: &Connection,
    collection_id: i64,
    music: &ApiMusic,
    media: &DownloadedMusicMedia,
    replace_existing: bool,
    album_name: Option<&str>,
    category: Option<&str>,
    fallback_order: i64,
) -> Result<(bool, i64, bool), AppError> {
    let (was_imported, hymn_id) = import_music_to_db(
        conn,
        music,
        media.audio_path.as_deref(),
        media.playback_path.as_deref(),
        media.cover_path.as_deref(),
        replace_existing,
        album_name,
        Some(music.id_music),
        category,
    )?;

    let hymn_id = hymn_id
        .or_else(|| music::find_hymn_by_api_music_id(conn, music.id_music))
        .ok_or_else(|| AppError::Internal("Missing local hymn id after import".to_string()))?;

    let linked = link_collection_hymn(
        conn,
        collection_id,
        hymn_id,
        music.track.unwrap_or(fallback_order),
    )?;

    Ok((was_imported, hymn_id, linked))
}

#[cfg(test)]
mod tests {
    use super::import_music_to_db;
    use crate::legacy_fetch::ApiMusic;
    use rusqlite::Connection;

    fn setup_hymns_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            r#"
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
            "#,
        )
        .expect("schema setup");
        conn
    }

    fn make_api_music(id: i64, name: &str) -> ApiMusic {
        ApiMusic {
            id_music: id,
            name: name.to_string(),
            track: Some(7),
            id_file_image: None,
            id_file_music: None,
            id_file_instrumental_music: None,
            url_image: None,
            url_music: None,
            url_instrumental_music: None,
            id_language: None,
            lyrics: vec![],
        }
    }

    #[test]
    fn legacy_fetch_shared_importer_contract_upserts_media() {
        let conn = setup_hymns_db();
        let music = make_api_music(77, "Shared Importer Hymn");

        let (inserted, hymn_id) = import_music_to_db(
            &conn,
            &music,
            Some("media/audio/77/original.mp3"),
            Some("media/playback/77/original.mp3"),
            Some("media/images/77/original.jpg"),
            false,
            Some("Album A"),
            Some(77),
            Some("hymnal"),
        )
        .expect("insert hymn");

        assert!(inserted);
        let hymn_id = hymn_id.expect("local hymn id");

        let (audio_path, playback_path, cover_path): (
            Option<String>,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT audio_path, playback_path, cover_path FROM hymns WHERE id = ?1",
                rusqlite::params![hymn_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("select media paths");
        assert_eq!(audio_path.as_deref(), Some("media/audio/77/original.mp3"));
        assert_eq!(
            playback_path.as_deref(),
            Some("media/playback/77/original.mp3")
        );
        assert_eq!(cover_path.as_deref(), Some("media/images/77/original.jpg"));

        let (updated, updated_hymn_id) = import_music_to_db(
            &conn,
            &music,
            Some("media/audio/77/updated.mp3"),
            Some("media/playback/77/updated.mp3"),
            Some("media/images/77/updated.jpg"),
            true,
            Some("Album A"),
            Some(77),
            Some("hymnal"),
        )
        .expect("update hymn");

        assert!(updated);
        assert_eq!(updated_hymn_id, Some(hymn_id));

        let (updated_audio, updated_playback, updated_cover): (
            Option<String>,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT audio_path, playback_path, cover_path FROM hymns WHERE id = ?1",
                rusqlite::params![hymn_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("select updated media paths");
        assert_eq!(updated_audio.as_deref(), Some("media/audio/77/updated.mp3"));
        assert_eq!(
            updated_playback.as_deref(),
            Some("media/playback/77/updated.mp3")
        );
        assert_eq!(updated_cover.as_deref(), Some("media/images/77/updated.jpg"));
    }
}
