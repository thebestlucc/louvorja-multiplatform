use serde::{Deserialize, Serialize};
use specta::Type;

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
