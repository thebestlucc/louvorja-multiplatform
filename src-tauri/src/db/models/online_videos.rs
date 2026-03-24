use serde::{Deserialize, Serialize};
use specta::Type;

/// Online Videos feature — channel metadata (subset of DB columns; queries SELECT explicitly).
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineVideoChannel {
    #[specta(type = i32)]
    pub id: i64,
    pub channel_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub images: Option<String>,
    pub status: String,
    pub playlists: Option<String>,
    pub error: Option<String>,
}

/// Online Videos feature — playlist view model (queries SELECT explicitly).
/// `channel_title` comes from JOIN on `online_videos_channels`.
/// `video_count` is a computed COUNT(*) subquery.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineVideoPlaylist {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = Option<i32>)]
    pub id_channel: Option<i64>,
    pub playlist_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub images: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub cover_path: Option<String>,
    pub channel_title: Option<String>,
    #[specta(type = Option<i32>)]
    pub video_count: Option<i64>,
}

/// Online Videos feature — individual video record (queries SELECT explicitly).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineVideo {
    #[specta(type = i32)]
    pub id: i64,
    #[specta(type = i32)]
    pub id_playlist: i64,
    pub video_id: String,
    pub sequence: i32,
    pub title: Option<String>,
    pub description: Option<String>,
    pub images: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub local_path: Option<String>,
    pub duration_seconds: Option<i64>,
}

/// Online Videos feature — input for adding a playlist via Tauri command.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AddPlaylistInput {
    pub playlist_id: String,
    pub channel_id: String,
    pub channel_title: String,
    pub playlist_title: String,
    pub thumbnail_url: String,
}

/// Online Videos feature — result from YouTube channel fetch API.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeChannelResult {
    pub channel_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub playlists: Vec<YoutubePlaylistInfo>,
}

/// Online Videos feature — playlist info from YouTube API response.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YoutubePlaylistInfo {
    pub playlist_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub video_count: u32,
}

/// Online Videos feature — search result for command palette FTS5 search.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlinePlaylistSearchResult {
    #[specta(type = i32)]
    pub db_id: i64,
    pub playlist_id: String,
    pub title: String,
    pub channel_title: String,
    pub snippet: String,
    pub cover_path: Option<String>,
}

/// Online Videos feature — video info from YouTube API response.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeVideoInfo {
    pub video_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub duration_seconds: Option<i64>,
    pub sequence: i32,
}
