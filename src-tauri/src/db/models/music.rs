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

/// Lightweight projection of a hymn for list/search rendering.
/// Excludes lyrics, chords, notes, lyrics_sync, and timestamps
/// to reduce IPC payload size on the hymnal search screen.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HymnListItem {
    #[specta(type = i32)]
    pub id: i64,
    pub number: Option<i64>,
    pub title: String,
    pub author: Option<String>,
    pub album: Option<String>,
    pub cover_path: Option<String>,
    pub audio_path: Option<String>,
    pub playback_path: Option<String>,
    pub category: Option<String>,
    // TODO(review): #[specta(type = i32)] on Option<i64> drops the Option wrapper —
    // generates non-nullable `number` in TS. Fix: use #[specta(type = Option<i32>)].
    // Pre-existing same issue in Hymn struct. Track: api_music_id TS binding correctness.
    #[specta(type = i32)]
    pub api_music_id: Option<i64>,
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
