use crate::error::AppError;

#[derive(Debug, Clone, PartialEq)]
pub enum YoutubeUrl {
    Channel(String),  // channel_id (UC...)
    Handle(String),   // @handle
    Playlist(String), // playlist_id (PL...)
    Video(String),    // video_id
}

/// Parses a YouTube URL into a structured enum.
/// Supports: /channel/UC..., /@handle, /playlist?list=PL..., /watch?v=...
pub fn parse_youtube_url(url: &str) -> Result<YoutubeUrl, AppError> {
    let url = url.trim();

    // Handle youtu.be short links
    if url.contains("youtu.be/") {
        let video_id = url
            .split("youtu.be/")
            .nth(1)
            .and_then(|s| s.split(['?', '&', '#']).next())
            .ok_or_else(|| AppError::Internal("Invalid youtu.be URL".into()))?;
        return Ok(YoutubeUrl::Video(video_id.to_string()));
    }

    // Playlist URL: ?list=PLxxxx
    if url.contains("list=") {
        let list_id = url
            .split("list=")
            .nth(1)
            .and_then(|s| s.split(['&', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract playlist ID".into()))?;
        return Ok(YoutubeUrl::Playlist(list_id.to_string()));
    }

    // Channel URL: /channel/UCxxxx
    if url.contains("/channel/") {
        let channel_id = url
            .split("/channel/")
            .nth(1)
            .and_then(|s| s.split(['/', '?', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract channel ID".into()))?;
        return Ok(YoutubeUrl::Channel(channel_id.to_string()));
    }

    // Handle URL: /@handle
    if url.contains("/@") {
        let handle = url
            .split("/@")
            .nth(1)
            .and_then(|s| s.split(['/', '?', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract handle".into()))?;
        return Ok(YoutubeUrl::Handle(handle.to_string()));
    }

    // Watch URL: /watch?v=xxxx (without list param — already handled above)
    if url.contains("v=") {
        let video_id = url
            .split("v=")
            .nth(1)
            .and_then(|s| s.split(['&', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract video ID".into()))?;
        return Ok(YoutubeUrl::Video(video_id.to_string()));
    }

    Err(AppError::Internal(
        "Unrecognized YouTube URL format".into(),
    ))
}
