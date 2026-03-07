use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Hymn {
    #[specta(type = i32)]
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
    #[specta(type = i32)]
    pub api_music_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub name: String,
    pub hymn_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    #[specta(type = i32)]
    pub id: i64,
    pub name: String,
    pub abbreviation: String,
    pub language: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub name: String,
    pub chapter_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Verse {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub version_id: i64,
    pub book: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BibleSearchResult {
    pub verse: Verse,
    pub book_name: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Presentation {
    #[specta(type = i32)]
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
    pub library_kind: Option<String>,
    pub file_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub presentation_id: i64,
    pub slide_index: i32,
    pub slide_type: String,
    pub content: String,
    pub notes: Option<String>,
    pub transition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    #[specta(type = i32)]
    pub id: i64,
    pub title: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ServiceItem {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub service_id: i64,
    pub item_type: String,
    #[specta(type = i32)]
    pub item_id: Option<i64>,
    pub title: String,
    pub item_order: i32,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ServiceWithItems {
    pub service: Service,
    pub items: Vec<ServiceItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MonitorConfig {
    #[specta(type = i32)]
    pub id: i64,
    pub monitor_id: String,
    pub role: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlideContent {
    pub slide_type: String,
    pub text: Option<String>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub label: Option<String>,
    pub video_path: Option<String>,
    pub background_image: Option<String>,
    pub background_color: Option<String>,
    pub audio_path: Option<String>,
    pub auto_play: Option<bool>,
    pub r#loop: Option<bool>,
    pub muted: Option<bool>,
    pub mode: Option<String>,
    pub text_color: Option<String>,
    pub text_size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    pub black_screen: bool,
    pub logo_screen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlideContext {
    pub next: Option<SlideContent>,
    pub index: i32,
    pub total: i32,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    #[specta(type = f64)]
    pub duration_ms: i64,
    pub width: i32,
    pub height: i32,
    #[specta(type = f64)]
    pub file_size: i64,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    #[specta(type = i32)]
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub year: Option<i32>,
    pub cover_path: Option<String>,
    pub auto_cover_path: Option<String>,
    pub song_count: i32,
    pub source_type: String,
    #[specta(type = i32)]
    pub api_album_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSong {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub collection_id: i64,
    pub source_path: String,
    pub source_format: String,
    pub source_hash: Option<String>,
    #[specta(type = i32)]
    pub source_mtime_ms: Option<i64>,
    #[specta(type = i32)]
    pub cache_presentation_id: Option<i64>,
    pub sync_status: CollectionSongSyncStatus,
    pub last_sync_at: Option<String>,
    pub item_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub cache_presentation_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionWithSongs {
    pub collection: Collection,
    pub songs: Vec<CollectionSong>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSearchResult {
    pub kind: String,
    #[specta(type = i32)]
    pub collection_id: i64,
    #[specta(type = i32)]
    pub song_id: Option<i64>,
    pub collection_name: String,
    pub title: String,
    pub cover_path: Option<String>,
    pub snippet: String,
}

/// Schema reference for the `collection_hymns` join table.
/// The table is actively used via raw queries in `db/queries/collections.rs`.
/// This struct documents the table shape but row mapping uses direct field access.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionHymn {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub collection_id: i64,
    #[specta(type = i32)]
    pub hymn_id: i64,
    pub item_order: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDepartmentMember {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub department_id: i64,
    pub name: String,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDepartment {
    #[specta(type = i32)]
    pub id: i64,
    pub code: Option<String>,
    pub name_pt: Option<String>,
    pub name_en: Option<String>,
    pub name_es: Option<String>,
    pub icon: String,
    pub color: String,
    pub people_per_day: i32,
    pub sort_order: i32,
    pub is_system: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub members: Vec<ScheduleDepartmentMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMonth {
    #[specta(type = i32)]
    pub id: i64,
    pub year: i32,
    pub month: i32,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleAssignment {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub schedule_day_department_id: i64,
    #[specta(type = i32)]
    pub member_id: i64,
    pub sort_order: i32,
    pub created_at: String,
    pub member: Option<ScheduleDepartmentMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDayDepartment {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub schedule_day_id: i64,
    #[specta(type = i32)]
    pub department_id: i64,
    pub people_per_day: i32,
    pub manual_override: bool,
    pub created_at: String,
    pub updated_at: String,
    pub department: Option<ScheduleDepartment>,
    pub assignments: Vec<ScheduleAssignment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDay {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub schedule_month_id: i64,
    pub service_date: String,
    pub label: Option<String>,
    pub source_kind: String,
    pub responsible_department_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub responsible_department: Option<ScheduleDepartment>,
    pub departments: Vec<ScheduleDayDepartment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleMonthDetail {
    pub month: ScheduleMonth,
    pub departments: Vec<ScheduleDepartment>,
    pub days: Vec<ScheduleDay>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDepartmentInput {
    pub id: Option<i64>,
    pub code: Option<String>,
    pub name_pt: Option<String>,
    pub name_en: Option<String>,
    pub name_es: Option<String>,
    pub icon: String,
    pub color: String,
    pub people_per_day: i32,
    pub sort_order: i32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDayInput {
    pub service_date: String,
    pub label: Option<String>,
    pub source_kind: Option<String>,
    pub responsible_department_id: Option<i64>,
    #[specta(type = Vec<i32>)]
    pub department_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleGenerationRequest {
    pub year: i32,
    pub month: i32,
    pub overwrite_manual: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleAssignmentInput {
    #[specta(type = i32)]
    pub schedule_day_department_id: i64,
    #[specta(type = Vec<i32>)]
    pub member_ids: Vec<i64>,
}
