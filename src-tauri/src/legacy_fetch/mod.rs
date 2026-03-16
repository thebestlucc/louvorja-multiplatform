//! Legacy server fetch module
//!
//! Fetches hymns, albums, and lyrics from the LouvorJA API server
//! at api.louvorja.com.br

use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use uuid::Uuid;

/// Static API Token for legacy LouvorJA server
pub const API_TOKEN: &str = "02@v2nFB2Dc";

/// Deserialize a value that may be an integer, a numeric string, an empty string, or null
/// into `Option<i64>`. Used for API fields like `order` that return `""` instead of `null`.
fn deserialize_flexible_i64<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;
    struct FlexibleI64Visitor;
    impl<'de> de::Visitor<'de> for FlexibleI64Visitor {
        type Value = Option<i64>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("an integer, a numeric string, an empty string, or null")
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v))
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v as i64))
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> {
            Ok(Some(v as i64))
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v.is_empty() {
                Ok(None)
            } else {
                v.parse::<i64>().map(Some).map_err(de::Error::custom)
            }
        }
        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
    }
    deserializer.deserialize_any(FlexibleI64Visitor)
}

/// Deserialize a value that may be a string, an integer, or null into `Option<String>`.
/// Used for API fields like `image_version` that return `1` (int) instead of `"1"` (string).
fn deserialize_flexible_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;
    struct FlexibleStringVisitor;
    impl<'de> de::Visitor<'de> for FlexibleStringVisitor {
        type Value = Option<String>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a string, an integer, or null")
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v.is_empty() {
                Ok(None)
            } else {
                Ok(Some(v.to_string()))
            }
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
    }
    deserializer.deserialize_any(FlexibleStringVisitor)
}

/// Deserialize a value that must be an integer (or a numeric string) into `i64`.
fn deserialize_flexible_i64_mandatory<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;
    struct FlexibleI64MandatoryVisitor;
    impl<'de> de::Visitor<'de> for FlexibleI64MandatoryVisitor {
        type Value = i64;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("an integer or a numeric string")
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(v)
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(v as i64)
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> {
            Ok(v as i64)
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            v.parse::<i64>().map_err(de::Error::custom)
        }
    }
    deserializer.deserialize_any(FlexibleI64MandatoryVisitor)
}

/// Base API URL
pub const API_BASE_URL: &str = "https://api.louvorja.com.br";

/// Supported languages for the API
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, Type)]
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

    pub fn to_hymnal_name(&self) -> &'static str {
        match self {
            ApiLanguage::Pt => "Hinário Adventista",
            ApiLanguage::En => "Adventist Hymnal",
            ApiLanguage::Es => "Himnario Adventista",
        }
    }
}

/// Paginated response wrapper from the API
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PaginatedResponse<T: Type> {
    #[specta(type = f64)]
    pub current_page: i64,
    pub data: Vec<T>,
    #[serde(default)]
    #[specta(type = f64)]
    pub last_page: Option<i64>,
    #[serde(default)]
    pub next_page_url: Option<String>,
    #[serde(default)]
    #[specta(type = f64)]
    pub per_page: Option<i64>,
    #[serde(default)]
    #[specta(type = f64)]
    pub total: Option<i64>,
}

/// Single item response wrapper from the API
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SingleResponse<T: Type> {
    pub data: T,
}

/// Lyric entry from the API
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApiLyric {
    #[specta(type = f64)]
    pub id_lyric: i64,
    #[specta(type = f64)]
    pub id_music: i64,
    pub lyric: String,
    #[serde(default)]
    #[specta(type = f64)]
    pub order: i64,
    /// Sync time for sung version (format: "00:00:03")
    #[serde(default)]
    pub time: Option<String>,
    /// Sync time for instrumental/playback version (format: "00:00:05")
    #[serde(default)]
    pub instrumental_time: Option<String>,
    #[serde(default)]
    #[specta(type = f64)]
    pub show_slide: Option<i64>,
}

/// Music entry from the API (hymnal list format)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApiMusic {
    #[serde(deserialize_with = "deserialize_flexible_i64_mandatory")]
    #[specta(type = f64)]
    pub id_music: i64,
    pub name: String,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    #[specta(type = f64)]
    pub track: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    #[specta(type = f64)]
    pub id_file_image: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    #[specta(type = f64)]
    pub id_file_music: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    #[specta(type = f64)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApiErrorResponse {
    pub error: String,
}

/// Album entry from the API
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApiAlbum {
    #[serde(deserialize_with = "deserialize_flexible_i64_mandatory")]
    #[specta(type = f64)]
    pub id_album: i64,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    #[specta(type = f64)]
    pub id_file_image: Option<i64>,
    #[serde(default)]
    pub url_image: Option<String>,
    #[serde(default)]
    pub subtitle: Option<String>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    #[specta(type = f64)]
    pub order: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_string")]
    pub image_version: Option<String>,
    #[serde(default, alias = "music")]
    pub musics: Vec<ApiMusic>,
}

/// Params response from /params endpoint
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApiParams {
    #[serde(default)]
    pub conn_ftp: Option<String>,
    #[serde(default)]
    #[specta(type = f64)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LegacyFetchOptions {
    /// Language to fetch (pt, en, es)
    pub language: ApiLanguage,
    /// Whether to replace existing hymns with the same title
    pub replace_existing: bool,
    /// Whether to download audio files (vs just metadata)
    pub download_audio: bool,
    /// Whether to download cover images
    pub download_images: bool,
}

/// Sub-task progress information
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchSubTask {
    pub id: String,
    pub title: String,
    pub percent: f64,
    pub status: String,
}

/// Progress information for a legacy fetch operation
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchProgress {
    pub run_id: String,
    pub step: String,
    pub status: LegacyFetchStatus,
    pub percent: f64,
    pub message: Option<String>,
    #[specta(type = f64)]
    pub items_total: u64,
    #[specta(type = f64)]
    pub items_processed: u64,
    pub sub_tasks: Vec<LegacyFetchSubTask>,
}

/// Status of a legacy fetch operation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchReport {
    pub run_id: String,
    #[specta(type = f64)]
    pub hymns_fetched: u64,
    #[specta(type = f64)]
    pub hymns_imported: u64,
    #[specta(type = f64)]
    pub hymns_skipped: u64,
    #[specta(type = f64)]
    pub albums_fetched: u64,
    #[specta(type = f64)]
    pub albums_created: u64,
    #[specta(type = f64)]
    pub collection_hymns_linked: u64,
    #[specta(type = f64)]
    pub audio_downloaded: u64,
    #[specta(type = f64)]
    pub images_downloaded: u64,
    pub errors: Vec<LegacyFetchError>,
    #[specta(type = f64)]
    pub duration_ms: u64,
}

/// Error during legacy fetch
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
    use reqwest::Client;

    /// Helper to get an authenticated reqwest client
    fn get_api_client() -> Client {
        Client::builder()
            .use_rustls_tls()
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert("Api-Token", API_TOKEN.parse().unwrap());
                headers
            })
            .build()
            .unwrap_or_default()
    }

    /// Fetch params from the API
    pub async fn fetch_params() -> Result<ApiParams, AppError> {
        let url = format!("{}/params", API_BASE_URL);
        let response = get_api_client()
            .get(&url)
            .send()
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

    /// Fetch all albums for a language — a single page
    pub async fn fetch_albums_page(
        lang: ApiLanguage,
        page: i64,
    ) -> Result<PaginatedResponse<ApiAlbum>, AppError> {
        let url = format!("{}/{}/albums?page={}", API_BASE_URL, lang.as_str(), page);
        let response = get_api_client()
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch albums page {}: {}", page, e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status: {}",
                response.status()
            )));
        }

        let body = response
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read response body: {}", e)))?;

        // Check if response is an error
        if let Ok(error_resp) = serde_json::from_str::<ApiErrorResponse>(&body) {
            if error_resp.error.contains("não encontrado") || error_resp.error.contains("not found")
            {
                return Err(AppError::Internal(format!(
                    "NO_CONTENT_AVAILABLE:{}",
                    lang.as_str()
                )));
            }
            return Err(AppError::Internal(format!(
                "API error: {}",
                error_resp.error
            )));
        }

        let paginated: PaginatedResponse<ApiAlbum> = serde_json::from_str(&body).map_err(|e| {
            AppError::Internal(format!(
                "Failed to parse albums response page {}: {}",
                page, e
            ))
        })?;

        Ok(paginated)
    }

    /// Fetch musics for a single album
    pub async fn fetch_album_musics_page(
        lang: ApiLanguage,
        album_id: i64,
        page: i64,
    ) -> Result<PaginatedResponse<ApiMusic>, AppError> {
        let url = format!(
            "{}/{}/albums/{}?page={}",
            API_BASE_URL,
            lang.as_str(),
            album_id,
            page
        );
        let response = get_api_client()
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(format!(
                    "Failed to fetch album {} musics page {}: {}",
                    album_id, page, e
                ))
            })?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status for album {} page {}: {}",
                album_id,
                page,
                response.status()
            )));
        }

        let body = response
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read response body: {}", e)))?;

        // 1. Try to parse as a paginated response of musics
        if let Ok(paginated) = serde_json::from_str::<PaginatedResponse<ApiMusic>>(&body) {
            return Ok(paginated);
        }

        // 2. Try to parse as a single ApiAlbum (which contains the musics array)
        if let Ok(album) = serde_json::from_str::<ApiAlbum>(&body) {
            return Ok(PaginatedResponse {
                current_page: 1,
                data: album.musics,
                last_page: Some(1),
                next_page_url: None,
                per_page: None,
                total: None,
            });
        }

        // 3. Try to parse as a raw array of musics
        if let Ok(musics) = serde_json::from_str::<Vec<ApiMusic>>(&body) {
            return Ok(PaginatedResponse {
                current_page: 1,
                data: musics,
                last_page: Some(1),
                next_page_url: None,
                per_page: None,
                total: None,
            });
        }

        // 4. Try to parse as an object with a "data" field that is an array
        #[derive(Deserialize)]
        struct DataWrapper {
            data: Vec<ApiMusic>,
        }
        if let Ok(wrapper) = serde_json::from_str::<DataWrapper>(&body) {
            return Ok(PaginatedResponse {
                current_page: 1,
                data: wrapper.data,
                last_page: Some(1),
                next_page_url: None,
                per_page: None,
                total: None,
            });
        }

        // 5. Try to parse as an object with a "data" field that is an ApiAlbum
        #[derive(Deserialize)]
        struct AlbumDataWrapper {
            data: ApiAlbum,
        }
        if let Ok(wrapper) = serde_json::from_str::<AlbumDataWrapper>(&body) {
            return Ok(PaginatedResponse {
                current_page: 1,
                data: wrapper.data.musics,
                last_page: Some(1),
                next_page_url: None,
                per_page: None,
                total: None,
            });
        }

        Err(AppError::Internal(format!(
            "Failed to parse album {} musics response (unknown format)",
            album_id
        )))
    }

    /// Fetch hymnal musics (official hymnal collection) - a single page
    pub async fn fetch_hymnal_page(
        lang: ApiLanguage,
        page: i64,
    ) -> Result<PaginatedResponse<ApiMusic>, AppError> {
        let url = format!("{}/{}/hymnal?page={}", API_BASE_URL, lang.as_str(), page);
        let response = get_api_client()
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(format!("Failed to fetch hymnal page {}: {}", page, e))
            })?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status: {}",
                response.status()
            )));
        }

        // Get response text to check for API error response
        let body = response
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read response body: {}", e)))?;

        // Check if response is an error (e.g., language not found)
        if let Ok(error_resp) = serde_json::from_str::<ApiErrorResponse>(&body) {
            if error_resp.error.contains("não encontrado") || error_resp.error.contains("not found")
            {
                return Err(AppError::Internal(format!(
                    "NO_CONTENT_AVAILABLE:{}",
                    lang.as_str()
                )));
            }
            return Err(AppError::Internal(format!(
                "API error: {}",
                error_resp.error
            )));
        }

        let paginated: PaginatedResponse<ApiMusic> = serde_json::from_str(&body).map_err(|e| {
            AppError::Internal(format!(
                "Failed to parse hymnal response page {}: {}",
                page, e
            ))
        })?;

        Ok(paginated)
    }
    /// Fetch a single music with lyrics
    pub async fn fetch_music_detail(
        lang: ApiLanguage,
        music_id: i64,
    ) -> Result<ApiMusic, AppError> {
        let url = format!("{}/{}/musics/{}", API_BASE_URL, lang.as_str(), music_id);
        let response = get_api_client()
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(format!("Failed to fetch music {}: {}", music_id, e))
            })?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "API returned error status for music {}: {}",
                music_id,
                response.status()
            )));
        }

        let single: SingleResponse<ApiMusic> = response.json().await.map_err(|e| {
            AppError::Internal(format!(
                "Failed to parse music {} response: {}",
                music_id, e
            ))
        })?;

        Ok(single.data)
    }

    /// Maximum download size (50 MB) to guard against oversized API responses
    pub const MAX_DOWNLOAD_SIZE: u64 = 50 * 1024 * 1024;

    /// Download a file from a URL to a local path
    pub async fn download_file(url: &str, target_path: &std::path::Path) -> Result<(), AppError> {
        let response = get_api_client()
            .get(url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to download file: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Download returned error status: {}",
                response.status()
            )));
        }

        // Guard against oversized responses
        if let Some(len) = response.content_length() {
            if len > MAX_DOWNLOAD_SIZE {
                return Err(AppError::Internal(format!(
                    "File too large: {} bytes (max {} bytes)",
                    len, MAX_DOWNLOAD_SIZE
                )));
            }
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read download bytes: {}", e)))?;

        // Post-download size check for responses without content-length header
        if bytes.len() as u64 > MAX_DOWNLOAD_SIZE {
            return Err(AppError::Internal(format!(
                "Downloaded file too large: {} bytes (max {} bytes)",
                bytes.len(),
                MAX_DOWNLOAD_SIZE
            )));
        }

        // Create parent directories if needed
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
        }

        std::fs::write(target_path, &bytes).map_err(|e| AppError::Io(e))?;

        Ok(())
    }
}

/// Import functions - convert API data to local database format
pub mod importer {
    #[allow(unused_imports)]
    pub use crate::content_sync::importer::{
        DownloadedMusicMedia, SyncLyric, download_album_cover, download_media_file,
        download_music_media, extract_year_from_url, import_music_and_link_to_collection,
        import_music_to_db, link_collection_hymn, lyrics_to_sync_json, lyrics_to_text,
        upsert_api_album_collection,
    };
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

#[cfg(test)]
mod tests {
    use super::*;
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
            CREATE VIRTUAL TABLE hymns_fts USING fts5(
                title, lyrics, author, album, content=hymns, content_rowid=id
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
            track: Some(1),
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

    /// Verify import_music_to_db with replace_existing=true updates existing hymns
    #[test]
    fn import_music_to_db_replace_existing_updates_cover() {
        let conn = setup_hymns_db();
        let music = make_api_music(42, "Test Hymn");

        // First import
        let (was_imported, hymn_id) = importer::import_music_to_db(
            &conn,
            &music,
            None,
            None,
            Some("media/images/42/old_cover.jpg"),
            false,
            Some("Album A"),
            Some(42),
            None,
        )
        .unwrap();
        assert!(was_imported);
        let hid = hymn_id.unwrap();

        // Verify initial cover
        let cover: Option<String> = conn
            .query_row(
                "SELECT cover_path FROM hymns WHERE id = ?1",
                rusqlite::params![hid],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(cover, Some("media/images/42/old_cover.jpg".to_string()));

        // Re-import with replace_existing=true and new cover
        let (was_imported2, hymn_id2) = importer::import_music_to_db(
            &conn,
            &music,
            None,
            None,
            Some("media/images/42/new_cover.jpg"),
            true, // replace_existing
            Some("Album A"),
            Some(42),
            None,
        )
        .unwrap();
        assert!(was_imported2);
        assert_eq!(hymn_id2, Some(hid), "should return same hymn id");

        // Verify cover was updated
        let cover2: Option<String> = conn
            .query_row(
                "SELECT cover_path FROM hymns WHERE id = ?1",
                rusqlite::params![hid],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(cover2, Some("media/images/42/new_cover.jpg".to_string()));
    }

    /// Verify import_music_to_db with replace_existing=false doesn't overwrite
    #[test]
    fn import_music_to_db_no_replace_keeps_existing() {
        let conn = setup_hymns_db();
        let music = make_api_music(42, "Test Hymn");

        // First import
        importer::import_music_to_db(
            &conn,
            &music,
            None,
            None,
            Some("media/images/42/original.jpg"),
            false,
            Some("Album A"),
            Some(42),
            None,
        )
        .unwrap();

        // Re-import with replace_existing=false
        let (was_imported, _) = importer::import_music_to_db(
            &conn,
            &music,
            None,
            None,
            Some("media/images/42/should_not_replace.jpg"),
            false,
            Some("Album A"),
            Some(42),
            None,
        )
        .unwrap();
        assert!(
            !was_imported,
            "should not flag as imported when not replacing"
        );

        // Verify cover wasn't changed
        let cover: Option<String> = conn
            .query_row(
                "SELECT cover_path FROM hymns WHERE api_music_id = 42",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(cover, Some("media/images/42/original.jpg".to_string()));
    }

    #[test]
    fn import_music_to_db_replace_existing_preserves_number_when_track_is_missing() {
        let conn = setup_hymns_db();
        let mut original = make_api_music(42, "Test Hymn");
        original.track = Some(18);

        let (was_imported, hymn_id) = importer::import_music_to_db(
            &conn,
            &original,
            None,
            None,
            None,
            false,
            Some("Album A"),
            Some(42),
            None,
        )
        .unwrap();
        assert!(was_imported);

        let hid = hymn_id.expect("hymn id");
        let mut updated = make_api_music(42, "Test Hymn");
        updated.track = None;

        let (was_reimported, updated_hymn_id) = importer::import_music_to_db(
            &conn,
            &updated,
            None,
            None,
            None,
            true,
            Some("Album A"),
            Some(42),
            None,
        )
        .unwrap();

        assert!(was_reimported);
        assert_eq!(updated_hymn_id, Some(hid));

        let number: Option<i64> = conn
            .query_row(
                "SELECT number FROM hymns WHERE id = ?1",
                rusqlite::params![hid],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(number, Some(18));
    }
}
