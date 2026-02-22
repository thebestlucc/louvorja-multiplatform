use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hymn {
    pub id: i64,
    pub number: Option<i64>,
    pub title: String,
    pub author: Option<String>,
    pub album: Option<String>,
    pub lyrics: Option<String>,
    pub chords: Option<String>,
    pub audio_path: Option<String>,
    pub playback_path: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub cover_path: Option<String>,
    pub lyrics_sync: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HymnWriteInput {
    pub number: Option<i64>,
    pub title: String,
    pub author: Option<String>,
    pub album: Option<String>,
    pub lyrics: Option<String>,
    pub chords: Option<String>,
    pub audio_path: Option<String>,
    pub playback_path: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub cover_path: Option<String>,
    pub lyrics_sync: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub name: String,
    pub hymn_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    pub id: i64,
    pub name: String,
    pub abbreviation: String,
    pub language: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub name: String,
    pub chapter_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Verse {
    pub id: i64,
    pub version_id: i64,
    pub book: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleSearchResult {
    pub verse: Verse,
    pub book_name: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Presentation {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
    pub library_kind: Option<String>,
    pub file_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Slide {
    pub id: i64,
    pub presentation_id: i64,
    pub slide_index: i64,
    pub slide_type: String,
    pub content: String,
    pub notes: Option<String>,
    pub transition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: i64,
    pub title: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceItem {
    pub id: i64,
    pub service_id: i64,
    pub item_type: String,
    pub item_id: Option<i64>,
    pub title: String,
    pub item_order: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceWithItems {
    pub service: Service,
    pub items: Vec<ServiceItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub id: i64,
    pub monitor_id: String,
    pub role: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub friendly_name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub connection_type: Option<String>,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideContent {
    pub slide_type: String,
    pub text: Option<String>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub label: Option<String>,
    #[serde(default, alias = "videoPath")]
    pub video_path: Option<String>,
    #[serde(default, alias = "backgroundImage")]
    pub background_image: Option<String>,
    #[serde(default, alias = "backgroundColor")]
    pub background_color: Option<String>,
    #[serde(default, alias = "audioPath")]
    pub audio_path: Option<String>,
    #[serde(default, alias = "autoPlay")]
    pub auto_play: Option<bool>,
    #[serde(default, alias = "loop")]
    pub r#loop: Option<bool>,
    #[serde(default)]
    pub muted: Option<bool>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default, alias = "textColor")]
    pub text_color: Option<String>,
    #[serde(default, alias = "textSize")]
    pub text_size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    pub black_screen: bool,
    pub logo_screen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideContext {
    pub next: Option<SlideContent>,
    pub index: i32,
    pub total: i32,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    pub duration_ms: i64,
    pub width: i32,
    pub height: i32,
    pub file_size: i64,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub year: Option<i32>,
    pub cover_path: Option<String>,
    pub auto_cover_path: Option<String>,
    pub song_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectionSongSyncStatus {
    InSync,
    Stale,
    MissingSource,
    Error,
}

impl CollectionSongSyncStatus {
    pub fn as_db_str(&self) -> &'static str {
        match self {
            Self::InSync => "in_sync",
            Self::Stale => "stale",
            Self::MissingSource => "missing_source",
            Self::Error => "error",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "in_sync" => Self::InSync,
            "stale" => Self::Stale,
            "missing_source" => Self::MissingSource,
            "error" => Self::Error,
            _ => Self::Error,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSong {
    pub id: i64,
    pub collection_id: i64,
    pub source_path: String,
    pub source_format: String,
    pub source_hash: Option<String>,
    pub source_mtime_ms: Option<i64>,
    pub cache_presentation_id: Option<i64>,
    pub sync_status: CollectionSongSyncStatus,
    pub last_sync_at: Option<String>,
    pub item_order: i64,
    pub created_at: String,
    pub updated_at: String,
    pub cache_presentation_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionWithSongs {
    pub collection: Collection,
    pub songs: Vec<CollectionSong>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSearchResult {
    pub kind: String,
    pub collection_id: i64,
    pub song_id: Option<i64>,
    pub collection_name: String,
    pub title: String,
    pub snippet: String,
}
