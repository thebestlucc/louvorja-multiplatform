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
    pub category: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub name: String,
    pub hymn_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibleVersion {
    pub id: i64,
    pub name: String,
    pub abbreviation: String,
    pub language: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub name: String,
    pub chapter_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verse {
    pub id: i64,
    pub version_id: i64,
    pub book: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Presentation {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
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
pub struct Service {
    pub id: i64,
    pub title: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub struct Favorite {
    pub id: i64,
    pub item_type: String,
    pub item_id: i64,
    pub created_at: String,
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
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}
