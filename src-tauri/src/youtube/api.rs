use reqwest::blocking::Client;
use serde::Deserialize;
use crate::error::AppError;
use crate::db::models::{YoutubeChannelResult, YoutubePlaylistInfo, YoutubeVideoInfo};

const API_BASE: &str = "https://www.googleapis.com/youtube/v3";

#[derive(Deserialize)]
struct ApiListResponse<T> {
    items: Option<Vec<T>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "pageInfo")]
    page_info: Option<PageInfo>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct PageInfo {
    #[serde(rename = "totalResults")]
    total_results: Option<u32>,
}

#[derive(Deserialize)]
struct ChannelItem {
    id: String,
    snippet: Option<ChannelSnippet>,
}

#[derive(Deserialize)]
struct ChannelSnippet {
    title: Option<String>,
    thumbnails: Option<Thumbnails>,
}

#[derive(Deserialize)]
struct PlaylistItem {
    id: String,
    snippet: Option<PlaylistSnippet>,
    #[serde(rename = "contentDetails")]
    content_details: Option<PlaylistContentDetails>,
}

#[derive(Deserialize)]
struct PlaylistSnippet {
    title: Option<String>,
    thumbnails: Option<Thumbnails>,
    #[serde(rename = "channelId")]
    channel_id: Option<String>,
    #[serde(rename = "channelTitle")]
    channel_title: Option<String>,
}

#[derive(Deserialize)]
struct PlaylistContentDetails {
    #[serde(rename = "itemCount")]
    item_count: Option<u32>,
}

#[derive(Deserialize)]
struct PlaylistVideoItem {
    snippet: Option<PlaylistVideoSnippet>,
    #[allow(dead_code)]
    #[serde(rename = "contentDetails")]
    content_details: Option<VideoContentDetails>,
}

#[derive(Deserialize)]
struct PlaylistVideoSnippet {
    title: Option<String>,
    thumbnails: Option<Thumbnails>,
    position: Option<u32>,
    #[serde(rename = "resourceId")]
    resource_id: Option<ResourceId>,
}

#[derive(Deserialize)]
struct ResourceId {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct VideoContentDetails {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[derive(Deserialize)]
struct Thumbnails {
    default: Option<ThumbnailInfo>,
    medium: Option<ThumbnailInfo>,
    high: Option<ThumbnailInfo>,
    standard: Option<ThumbnailInfo>,
    maxres: Option<ThumbnailInfo>,
}

#[derive(Deserialize)]
struct ThumbnailInfo {
    url: Option<String>,
}

impl Thumbnails {
    fn best_url(&self) -> String {
        self.maxres
            .as_ref()
            .or(self.standard.as_ref())
            .or(self.high.as_ref())
            .or(self.medium.as_ref())
            .or(self.default.as_ref())
            .and_then(|t| t.url.clone())
            .unwrap_or_default()
    }
}

/// Validates a YouTube API key by making a test call.
/// MUST be called from a spawned thread.
pub fn validate_api_key(api_key: &str) -> Result<bool, AppError> {
    let client = Client::new();
    let resp = client
        .get(format!("{}/channels", API_BASE))
        .query(&[
            ("part", "id"),
            ("id", "UC_x5XG1OV2P6uZZ5FSM9Ttw"),
            ("key", api_key),
        ])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    Ok(resp.status().is_success())
}

/// Resolves a @handle to a channel ID using the YouTube API search endpoint.
/// MUST be called from a spawned thread.
pub fn resolve_handle(api_key: &str, handle: &str) -> Result<String, AppError> {
    let client = Client::new();
    let resp = client
        .get(format!("{}/search", API_BASE))
        .query(&[
            ("part", "snippet"),
            ("q", handle),
            ("type", "channel"),
            ("maxResults", "1"),
            ("key", api_key),
        ])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    let body: serde_json::Value = resp
        .json()
        .map_err(|e| AppError::Internal(format!("Failed to parse YouTube response: {}", e)))?;

    body["items"][0]["id"]["channelId"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal(format!("Could not resolve handle @{}", handle)))
}

/// Fetches channel info + its playlists.
/// MUST be called from a spawned thread.
pub fn fetch_channel(api_key: &str, channel_id: &str) -> Result<YoutubeChannelResult, AppError> {
    let client = Client::new();

    // Fetch channel info
    let resp = client
        .get(format!("{}/channels", API_BASE))
        .query(&[("part", "snippet"), ("id", channel_id), ("key", api_key)])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    let channels: ApiListResponse<ChannelItem> = resp
        .json()
        .map_err(|e| AppError::Internal(format!("Failed to parse channel response: {}", e)))?;

    let channel = channels
        .items
        .and_then(|mut v| if v.is_empty() { None } else { Some(v.remove(0)) })
        .ok_or_else(|| AppError::NotFound("Channel not found".into()))?;

    let snippet = channel.snippet.unwrap_or(ChannelSnippet {
        title: None,
        thumbnails: None,
    });

    // Fetch channel playlists
    let playlists = fetch_channel_playlists(api_key, channel_id)?;

    Ok(YoutubeChannelResult {
        channel_id: channel.id,
        title: snippet.title.unwrap_or_default(),
        thumbnail_url: snippet
            .thumbnails
            .map(|t| t.best_url())
            .unwrap_or_default(),
        playlists,
    })
}

fn fetch_channel_playlists(
    api_key: &str,
    channel_id: &str,
) -> Result<Vec<YoutubePlaylistInfo>, AppError> {
    let client = Client::new();
    let mut all_playlists = Vec::new();
    let mut page_token: Option<String> = None;

    loop {
        let mut query = vec![
            ("part", "snippet,contentDetails".to_string()),
            ("channelId", channel_id.to_string()),
            ("maxResults", "50".to_string()),
            ("key", api_key.to_string()),
        ];
        if let Some(ref token) = page_token {
            query.push(("pageToken", token.clone()));
        }

        let resp = client
            .get(format!("{}/playlists", API_BASE))
            .query(
                &query
                    .iter()
                    .map(|(k, v)| (*k, v.as_str()))
                    .collect::<Vec<_>>(),
            )
            .send()
            .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

        let body: ApiListResponse<PlaylistItem> = resp
            .json()
            .map_err(|e| AppError::Internal(format!("Failed to parse playlists response: {}", e)))?;

        if let Some(items) = body.items {
            for item in items {
                let snippet = item.snippet.unwrap_or(PlaylistSnippet {
                    title: None,
                    thumbnails: None,
                    channel_id: None,
                    channel_title: None,
                });
                all_playlists.push(YoutubePlaylistInfo {
                    playlist_id: item.id,
                    title: snippet.title.unwrap_or_default(),
                    thumbnail_url: snippet
                        .thumbnails
                        .map(|t| t.best_url())
                        .unwrap_or_default(),
                    video_count: item
                        .content_details
                        .and_then(|cd| cd.item_count)
                        .unwrap_or(0),
                });
            }
        }

        match body.next_page_token {
            Some(token) => page_token = Some(token),
            None => break,
        }
    }

    Ok(all_playlists)
}

/// Fetches a single playlist's info + channel references.
/// Returns (playlist_info, channel_id, channel_title).
/// MUST be called from a spawned thread.
pub fn fetch_playlist_info(
    api_key: &str,
    playlist_id: &str,
) -> Result<(YoutubePlaylistInfo, String, String), AppError> {
    let client = Client::new();
    let resp = client
        .get(format!("{}/playlists", API_BASE))
        .query(&[
            ("part", "snippet,contentDetails"),
            ("id", playlist_id),
            ("key", api_key),
        ])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    let body: ApiListResponse<PlaylistItem> = resp
        .json()
        .map_err(|e| AppError::Internal(format!("Failed to parse playlist response: {}", e)))?;

    let item = body
        .items
        .and_then(|mut v| if v.is_empty() { None } else { Some(v.remove(0)) })
        .ok_or_else(|| AppError::NotFound("Playlist not found".into()))?;

    let snippet = item.snippet.unwrap_or(PlaylistSnippet {
        title: None,
        thumbnails: None,
        channel_id: None,
        channel_title: None,
    });

    let info = YoutubePlaylistInfo {
        playlist_id: item.id,
        title: snippet.title.clone().unwrap_or_default(),
        thumbnail_url: snippet
            .thumbnails
            .map(|t| t.best_url())
            .unwrap_or_default(),
        video_count: item
            .content_details
            .and_then(|cd| cd.item_count)
            .unwrap_or(0),
    };

    let channel_id = snippet.channel_id.unwrap_or_default();
    let channel_title = snippet.channel_title.unwrap_or_default();

    Ok((info, channel_id, channel_title))
}

/// Fetches all videos in a playlist (paginated).
/// MUST be called from a spawned thread.
pub fn fetch_playlist_videos(
    api_key: &str,
    playlist_id: &str,
) -> Result<Vec<YoutubeVideoInfo>, AppError> {
    let client = Client::new();
    let mut all_videos = Vec::new();
    let mut page_token: Option<String> = None;

    loop {
        let mut query = vec![
            ("part", "snippet,contentDetails".to_string()),
            ("playlistId", playlist_id.to_string()),
            ("maxResults", "50".to_string()),
            ("key", api_key.to_string()),
        ];
        if let Some(ref token) = page_token {
            query.push(("pageToken", token.clone()));
        }

        let resp = client
            .get(format!("{}/playlistItems", API_BASE))
            .query(
                &query
                    .iter()
                    .map(|(k, v)| (*k, v.as_str()))
                    .collect::<Vec<_>>(),
            )
            .send()
            .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

        let body: ApiListResponse<PlaylistVideoItem> = resp
            .json()
            .map_err(|e| AppError::Internal(format!("Failed to parse playlist videos: {}", e)))?;

        if let Some(items) = body.items {
            for item in items {
                let snippet = item.snippet.unwrap_or(PlaylistVideoSnippet {
                    title: None,
                    thumbnails: None,
                    position: None,
                    resource_id: None,
                });
                let video_id = snippet
                    .resource_id
                    .and_then(|r| r.video_id)
                    .unwrap_or_default();
                if video_id.is_empty() {
                    continue;
                }

                all_videos.push(YoutubeVideoInfo {
                    video_id,
                    title: snippet.title.unwrap_or_default(),
                    thumbnail_url: snippet
                        .thumbnails
                        .map(|t| t.best_url())
                        .unwrap_or_default(),
                    duration_seconds: None, // playlistItems don't include duration
                    sequence: snippet.position.unwrap_or(0) as i32,
                });
            }
        }

        match body.next_page_token {
            Some(token) => page_token = Some(token),
            None => break,
        }
    }

    Ok(all_videos)
}
