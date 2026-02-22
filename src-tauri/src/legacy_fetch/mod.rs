//! Legacy server fetch module
//!
//! Fetches hymns, albums, and lyrics from the LouvorJA API server
//! at api.louvorja.com.br

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use uuid::Uuid;

/// Base API URL
pub const API_BASE_URL: &str = "https://api.louvorja.com.br";

/// Supported languages for the API
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ApiLanguage {
    #[default]
    Pt,
    En,
    Es,
}

impl ApiLanguage {
    pub fn as_str(&self) -> &'static str {
        match self {
            ApiLanguage::Pt => "pt",
            ApiLanguage::En => "en",
            ApiLanguage::Es => "es",
        }
    }
}

/// Paginated response wrapper from the API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub current_page: i64,
    pub data: Vec<T>,
    #[serde(default)]
    pub last_page: Option<i64>,
    #[serde(default)]
    pub per_page: Option<i64>,
    #[serde(default)]
    pub total: Option<i64>,
}

/// Single item response wrapper from the API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingleResponse<T> {
    pub data: T,
}

/// Lyric entry from the API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiLyric {
    pub id_lyric: i64,
    pub id_music: i64,
    pub lyric: String,
    #[serde(default)]
    pub order: i64,
    /// Sync time for sung version (format: "00:00:03")
    #[serde(default)]
    pub time: Option<String>,
    /// Sync time for instrumental/playback version (format: "00:00:05")
    #[serde(default)]
    pub instrumental_time: Option<String>,
    #[serde(default)]
    pub show_slide: Option<i64>,
}

/// Music entry from the API (hymnal list format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMusic {
    pub id_music: i64,
    pub name: String,
    #[serde(default)]
    pub track: Option<i64>,
    #[serde(default)]
    pub id_file_image: Option<i64>,
    #[serde(default)]
    pub id_file_music: Option<i64>,
    #[serde(default)]
    pub id_file_instrumental_music: Option<i64>,
    #[serde(default)]
    pub url_image: Option<String>,
    #[serde(default)]
    pub url_music: Option<String>,
    #[serde(default)]
    pub url_instrumental_music: Option<String>,
    #[serde(default)]
    pub id_language: Option<String>,
    /// Lyrics - present when fetching single music detail
    #[serde(default, alias = "lyric")]
    pub lyrics: Vec<ApiLyric>,
}

/// API error response (e.g., language not found)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiErrorResponse {
    pub error: String,
}

/// Album entry from the API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiAlbum {
    pub id_album: i64,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub id_file_image: Option<i64>,
    #[serde(default)]
    pub url_image: Option<String>,
    #[serde(default)]
    pub subtitle: Option<String>,
    #[serde(default)]
    pub order: Option<i64>,
    #[serde(default)]
    pub image_version: Option<String>,
    #[serde(default)]
    pub musics: Vec<ApiMusic>,
}

/// Category from the API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCategory {
    pub id_category: i64,
    pub name: String,
}

/// Params response from /params endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiParams {
    #[serde(default)]
    pub conn_ftp: Option<String>,
    #[serde(default)]
    pub db_version: Option<i64>,
    #[serde(default)]
    pub download_win: Option<String>,
    #[serde(default)]
    pub download_mac: Option<String>,
    #[serde(default)]
    pub download_linux: Option<String>,
    #[serde(default)]
    pub version_win: Option<String>,
    #[serde(default)]
    pub version_mac: Option<String>,
    #[serde(default)]
    pub version_linux: Option<String>,
    #[serde(default)]
    pub help_pt: Option<String>,
    #[serde(default)]
    pub help_en: Option<String>,
    #[serde(default)]
    pub help_es: Option<String>,
}

/// Options for starting a legacy fetch operation
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchOptions {
    pub language: ApiLanguage,
    /// Whether to fetch all hymns from the hymnal
    pub include_hymnal: bool,
    /// Whether to replace existing hymns with the same title
    pub replace_existing: bool,
    /// Whether to download audio files (vs just metadata)
    pub download_audio: bool,
    /// Whether to download cover images
    pub download_images: bool,
    /// Whether to import albums as collections
    pub include_albums: bool,
}

/// Progress information for a legacy fetch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchProgress {
    pub run_id: String,
    pub step: String,
    pub status: LegacyFetchStatus,
    pub percent: f64,
    pub message: Option<String>,
    pub items_total: u64,
    pub items_processed: u64,
}

/// Status of a legacy fetch operation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LegacyFetchStatus {
    Pending,
    Fetching,
    Importing,
    Downloading,
    Completed,
    Failed,
    Cancelled,
}

/// Final report after a legacy fetch operation
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchReport {
    pub run_id: String,
    pub hymns_fetched: u64,
    pub hymns_imported: u64,
    pub hymns_skipped: u64,
    pub albums_fetched: u64,
    pub albums_created: u64,
    pub collection_hymns_linked: u64,
    pub audio_downloaded: u64,
    pub images_downloaded: u64,
    pub errors: Vec<LegacyFetchError>,
    pub duration_ms: u64,
}

/// Error during legacy fetch
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchError {
    pub item_type: String,
    pub item_id: Option<String>,
    pub message: String,
}

/// Fetch functions
pub mod fetcher {
    use super::*;
    use crate::error::AppError;

    /// Fetch params from the API
    pub async fn fetch_params() -> Result<ApiParams, AppError> {
        let url = format!("{}/params", API_BASE_URL);
        let response = reqwest::get(&url)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch params: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status: {}",
                response.status()
            )));
        }

        let params = response
            .json::<ApiParams>()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse params response: {}", e)))?;
        
        Ok(params)
    }

    /// Fetch all musics for a language - handles pagination
    pub async fn fetch_musics(lang: ApiLanguage) -> Result<Vec<ApiMusic>, AppError> {
        let mut all_musics = Vec::new();
        let mut page = 1;
        
        loop {
            let url = format!("{}/{}/musics?page={}", API_BASE_URL, lang.as_str(), page);
            let response = reqwest::get(&url)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to fetch musics page {}: {}", page, e)))?;
            
            if !response.status().is_success() {
                return Err(AppError::Internal(format!(
                    "API returned error status: {}",
                    response.status()
                )));
            }

            // Get response text to check for API error response
            let body = response.text().await
                .map_err(|e| AppError::Internal(format!("Failed to read response body: {}", e)))?;

            // Check if response is an error (e.g., language not found)
            if let Ok(error_resp) = serde_json::from_str::<ApiErrorResponse>(&body) {
                if error_resp.error.contains("não encontrado") || error_resp.error.contains("not found") {
                    return Err(AppError::Internal(format!("NO_CONTENT_AVAILABLE:{}", lang.as_str())));
                }
                return Err(AppError::Internal(format!("API error: {}", error_resp.error)));
            }

            let paginated: PaginatedResponse<ApiMusic> = serde_json::from_str(&body)
                .map_err(|e| AppError::Internal(format!("Failed to parse musics response page {}: {}", page, e)))?;
            
            let is_last = paginated.last_page.map(|lp| page >= lp).unwrap_or(true)
                || paginated.data.is_empty();
            
            all_musics.extend(paginated.data);
            
            if is_last {
                break;
            }
            page += 1;
        }
        
        Ok(all_musics)
    }

    /// Fetch all albums for a language — handles pagination
    pub async fn fetch_albums(lang: ApiLanguage) -> Result<Vec<ApiAlbum>, AppError> {
        let mut all_albums = Vec::new();
        let mut page = 1;

        loop {
            let url = format!("{}/{}/albums?page={}", API_BASE_URL, lang.as_str(), page);
            let response = reqwest::get(&url)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to fetch albums page {}: {}", page, e)))?;

            if !response.status().is_success() {
                return Err(AppError::Internal(format!(
                    "API returned error status: {}",
                    response.status()
                )));
            }

            let body = response.text().await
                .map_err(|e| AppError::Internal(format!("Failed to read response body: {}", e)))?;

            // Check if response is an error
            if let Ok(error_resp) = serde_json::from_str::<ApiErrorResponse>(&body) {
                if error_resp.error.contains("não encontrado") || error_resp.error.contains("not found") {
                    return Err(AppError::Internal(format!("NO_CONTENT_AVAILABLE:{}", lang.as_str())));
                }
                return Err(AppError::Internal(format!("API error: {}", error_resp.error)));
            }

            let paginated: PaginatedResponse<ApiAlbum> = serde_json::from_str(&body)
                .map_err(|e| AppError::Internal(format!("Failed to parse albums response page {}: {}", page, e)))?;

            let is_last = paginated.last_page.map(|lp| page >= lp).unwrap_or(true)
                || paginated.data.is_empty();

            all_albums.extend(paginated.data);

            if is_last {
                break;
            }
            page += 1;
        }

        Ok(all_albums)
    }

    /// Fetch a single album with nested musics list (no lyrics)
    pub async fn fetch_album_detail(lang: ApiLanguage, album_id: i64) -> Result<ApiAlbum, AppError> {
        let url = format!("{}/{}/albums/{}", API_BASE_URL, lang.as_str(), album_id);
        let response = reqwest::get(&url)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch album {}: {}", album_id, e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status for album {}: {}",
                album_id, response.status()
            )));
        }

        let single: SingleResponse<ApiAlbum> = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse album {} response: {}", album_id, e)))?;

        Ok(single.data)
    }

    /// Fetch hymnal musics (official hymnal collection) - handles pagination
    pub async fn fetch_hymnal(lang: ApiLanguage) -> Result<Vec<ApiMusic>, AppError> {
        let mut all_musics = Vec::new();
        let mut page = 1;
        
        loop {
            let url = format!("{}/{}/hymnal?page={}", API_BASE_URL, lang.as_str(), page);
            let response = reqwest::get(&url)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to fetch hymnal page {}: {}", page, e)))?;
            
            if !response.status().is_success() {
                return Err(AppError::Internal(format!(
                    "API returned error status: {}",
                    response.status()
                )));
            }

            // Get response text to check for API error response
            let body = response.text().await
                .map_err(|e| AppError::Internal(format!("Failed to read response body: {}", e)))?;

            // Check if response is an error (e.g., language not found)
            if let Ok(error_resp) = serde_json::from_str::<ApiErrorResponse>(&body) {
                if error_resp.error.contains("não encontrado") || error_resp.error.contains("not found") {
                    return Err(AppError::Internal(format!("NO_CONTENT_AVAILABLE:{}", lang.as_str())));
                }
                return Err(AppError::Internal(format!("API error: {}", error_resp.error)));
            }

            let paginated: PaginatedResponse<ApiMusic> = serde_json::from_str(&body)
                .map_err(|e| AppError::Internal(format!("Failed to parse hymnal response page {}: {}", page, e)))?;
            
            let is_last = paginated.last_page.map(|lp| page >= lp).unwrap_or(true)
                || paginated.data.is_empty();
            
            all_musics.extend(paginated.data);
            
            if is_last {
                break;
            }
            page += 1;
        }
        
        Ok(all_musics)
    }

    /// Fetch a single music with lyrics
    pub async fn fetch_music_detail(lang: ApiLanguage, music_id: i64) -> Result<ApiMusic, AppError> {
        let url = format!("{}/{}/musics/{}", API_BASE_URL, lang.as_str(), music_id);
        let response = reqwest::get(&url)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch music {}: {}", music_id, e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status for music {}: {}",
                music_id, response.status()
            )));
        }

        let single: SingleResponse<ApiMusic> = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse music {} response: {}", music_id, e)))?;
        
        Ok(single.data)
    }

    /// Download a file from a URL to a local path
    pub async fn download_file(url: &str, target_path: &std::path::Path) -> Result<(), AppError> {
        let response = reqwest::get(url)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to download file: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Download returned error status: {}",
                response.status()
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read download bytes: {}", e)))?;
        
        // Create parent directories if needed
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Io(e))?;
        }

        std::fs::write(target_path, &bytes)
            .map_err(|e| AppError::Io(e))?;
        
        Ok(())
    }
}

/// Import functions - convert API data to local database format
pub mod importer {
    use super::*;
    use super::fetcher::download_file;
    use rusqlite::{Connection, OptionalExtension};
    use crate::error::AppError;
    use std::path::Path;

    /// Convert lyrics from API format to text format (stanzas separated by double newlines)
    pub fn lyrics_to_text(lyrics: &[ApiLyric]) -> String {
        let mut sorted_lyrics: Vec<_> = lyrics.iter().collect();
        sorted_lyrics.sort_by_key(|l| l.order);
        
        sorted_lyrics
            .iter()
            .map(|l| l.lyric.trim())
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    /// Synchronized lyric entry for JSON storage
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct SyncLyric {
        pub lyric: String,
        pub order: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub time: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub instrumental_time: Option<String>,
    }

    /// Convert lyrics from API format to JSON format with sync timing data
    pub fn lyrics_to_sync_json(lyrics: &[ApiLyric]) -> Option<String> {
        if lyrics.is_empty() {
            return None;
        }

        // Check if any lyric has timing data
        let has_timing = lyrics.iter().any(|l| l.time.is_some() || l.instrumental_time.is_some());
        if !has_timing {
            return None;
        }

        let mut sorted_lyrics: Vec<_> = lyrics.iter().collect();
        sorted_lyrics.sort_by_key(|l| l.order);

        let sync_lyrics: Vec<SyncLyric> = sorted_lyrics
            .iter()
            .map(|l| SyncLyric {
                lyric: l.lyric.trim().to_string(),
                order: l.order,
                time: l.time.clone(),
                instrumental_time: l.instrumental_time.clone(),
            })
            .collect();

        serde_json::to_string(&sync_lyrics).ok()
    }

    /// Extract filename from URL, sanitizing for filesystem use
    fn filename_from_url(url: &str, default_ext: &str) -> String {
        url.rsplit('/')
            .next()
            .map(|s| {
                // URL decode and sanitize
                let decoded = urlencoding::decode(s).unwrap_or_else(|_| s.into());
                let sanitized: String = decoded
                    .chars()
                    .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
                    .collect();
                if sanitized.contains('.') {
                    sanitized
                } else {
                    format!("{}.{}", sanitized, default_ext)
                }
            })
            .unwrap_or_else(|| format!("file.{}", default_ext))
    }

    /// Download a file from URL to media directory, returning relative path
    /// Returns None if URL is None or download fails
    pub async fn download_media_file(
        url: Option<&String>,
        media_dir: &Path,
        subfolder: &str,
        music_id: i64,
        default_ext: &str,
    ) -> Option<String> {
        let url = url?;
        if url.is_empty() {
            return None;
        }

        let filename = filename_from_url(url, default_ext);
        let relative_path = format!("media/{}/{}/{}", subfolder, music_id, filename);
        let full_path = media_dir.join(subfolder).join(music_id.to_string()).join(&filename);

        match download_file(url, &full_path).await {
            Ok(()) => {
                log::debug!("Downloaded {} to {}", url, full_path.display());
                Some(relative_path)
            }
            Err(e) => {
                log::warn!("Failed to download {}: {}", url, e);
                None
            }
        }
    }

    /// Import a music entry with file downloads
    #[allow(dead_code)]
    pub async fn import_music_with_download(
        conn: &Connection,
        music: &ApiMusic,
        media_dir: &Path,
        replace_existing: bool,
        download_audio: bool,
        download_images: bool,
    ) -> Result<(bool, u32, u32), AppError> {
        // Download files if requested
        let mut audio_count = 0u32;
        let mut image_count = 0u32;

        let audio_path = if download_audio {
            let path = download_media_file(
                music.url_music.as_ref(),
                media_dir,
                "audio",
                music.id_music,
                "mp3",
            )
            .await;
            if path.is_some() {
                audio_count += 1;
            }
            path
        } else {
            None
        };

        // Download playback/instrumental version
        let playback_path = if download_audio {
            let path = download_media_file(
                music.url_instrumental_music.as_ref(),
                media_dir,
                "playback",
                music.id_music,
                "mp3",
            )
            .await;
            if path.is_some() {
                audio_count += 1;
            }
            path
        } else {
            None
        };

        let cover_path = if download_images {
            let path = download_media_file(
                music.url_image.as_ref(),
                media_dir,
                "images",
                music.id_music,
                "jpg",
            )
            .await;
            if path.is_some() {
                image_count += 1;
            }
            path
        } else {
            None
        };

        let was_imported = import_music_to_db(
            conn,
            music,
            audio_path.as_deref(),
            playback_path.as_deref(),
            cover_path.as_deref(),
            replace_existing,
            None,
            None,
        )?;

        Ok((was_imported.0, audio_count, image_count))
    }

    /// Import a music entry into the hymns table (sync, with pre-downloaded paths)
    pub fn import_music_to_db(
        conn: &Connection,
        music: &ApiMusic,
        audio_path: Option<&str>,
        playback_path: Option<&str>,
        cover_path: Option<&str>,
        replace_existing: bool,
        album_name: Option<&str>,
        api_music_id: Option<i64>,
    ) -> Result<(bool, Option<i64>), AppError> {
        let lyrics_text = lyrics_to_text(&music.lyrics);
        let lyrics_sync = lyrics_to_sync_json(&music.lyrics);
        let track_number = music.track;

        // Check if hymn with this api_music_id already exists (preferred dedup)
        let existing_id: Option<i64> = if let Some(amid) = api_music_id {
            conn.query_row(
                "SELECT id FROM hymns WHERE api_music_id = ?1",
                rusqlite::params![amid],
                |row| row.get(0),
            )
            .optional()?
        } else {
            None
        };

        // Fall back to title-based dedup
        let existing_id = existing_id.or_else(|| {
            conn.query_row(
                "SELECT id FROM hymns WHERE title = ?1",
                rusqlite::params![music.name],
                |row| row.get::<_, i64>(0),
            )
            .ok()
        });

        let (was_imported, hymn_id) = match existing_id {
            Some(id) if replace_existing => {
                conn.execute(
                    r#"
                    UPDATE hymns SET
                        number = ?1,
                        lyrics = COALESCE(?2, lyrics),
                        audio_path = COALESCE(?3, audio_path),
                        playback_path = COALESCE(?4, playback_path),
                        cover_path = COALESCE(?5, cover_path),
                        lyrics_sync = COALESCE(?6, lyrics_sync),
                        album = COALESCE(?7, album),
                        api_music_id = COALESCE(?8, api_music_id),
                        updated_at = datetime('now')
                    WHERE id = ?9
                    "#,
                    rusqlite::params![
                        track_number,
                        if lyrics_text.is_empty() { None } else { Some(&lyrics_text) },
                        audio_path,
                        playback_path,
                        cover_path,
                        lyrics_sync.as_ref(),
                        album_name,
                        api_music_id,
                        id,
                    ],
                )?;
                (true, Some(id))
            }
            Some(id) => {
                // Exists but don't replace — still set api_music_id if missing
                if api_music_id.is_some() {
                    conn.execute(
                        "UPDATE hymns SET api_music_id = COALESCE(api_music_id, ?1) WHERE id = ?2",
                        rusqlite::params![api_music_id, id],
                    )?;
                }
                (false, Some(id))
            }
            None => {
                conn.execute(
                    r#"
                    INSERT INTO hymns (number, title, album, lyrics, audio_path, playback_path, cover_path, lyrics_sync, api_music_id, created_at, updated_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'), datetime('now'))
                    "#,
                    rusqlite::params![
                        track_number,
                        music.name,
                        album_name,
                        if lyrics_text.is_empty() { None } else { Some(lyrics_text) },
                        audio_path,
                        playback_path,
                        cover_path,
                        lyrics_sync,
                        api_music_id,
                    ],
                )?;
                let new_id = conn.last_insert_rowid();
                (true, Some(new_id))
            }
        };

        // Update FTS index for search
        if let Some(id) = hymn_id {
            // Delete old FTS entry if updating
            if existing_id.is_some() {
                let _ = conn.execute(
                    "INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
                     VALUES('delete', ?1, '', '', '', '')",
                    rusqlite::params![id],
                );
            }
            // Insert new FTS entry
            conn.execute(
                "INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
                 SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
                 FROM hymns WHERE id = ?1",
                rusqlite::params![id],
            )?;
        }

        Ok((was_imported, hymn_id))
    }
}

/// Create a new unique run ID
pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

/// State for a single legacy fetch run
pub struct LegacyFetchRunState {
    pub progress: LegacyFetchProgress,
    pub report: Option<LegacyFetchReport>,
    pub cancel_flag: Arc<AtomicBool>,
}

/// Runtime state for legacy fetch operations
#[derive(Default)]
pub struct LegacyFetchRuntimeState {
    pub active_run_id: Option<String>,
    pub runs: HashMap<String, LegacyFetchRunState>,
}

