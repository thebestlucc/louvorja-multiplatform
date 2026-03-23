use crate::db::models::{OnlineVideo, OnlineVideoPlaylist};
use crate::error::AppError;
use rusqlite::{params, Connection};

pub fn upsert_channel(
    conn: &Connection,
    channel_id: &str,
    title: &str,
    images: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO online_videos_channels (channel_id, title, images, status)
         VALUES (?1, ?2, ?3, 'validated')
         ON CONFLICT(channel_id) DO UPDATE SET title = ?2, images = ?3, updated_at = CURRENT_TIMESTAMP",
         params![channel_id, title, images],
    )?;    let id = conn.query_row(
        "SELECT id FROM online_videos_channels WHERE channel_id = ?1",
        params![channel_id],
        |row| row.get(0),
    )?;
    Ok(id)
}

pub fn insert_playlist(
    conn: &Connection,
    id_channel: i64,
    playlist_id: &str,
    title: &str,
    cover_path: Option<&str>,
    _video_count: u32,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO online_videos_playlists (id_channel, playlist_id, title, cover_path, status)
         VALUES (?1, ?2, ?3, ?4, 'validated')
         ON CONFLICT(playlist_id) DO UPDATE SET title = ?3, cover_path = ?4, updated_at = CURRENT_TIMESTAMP",
         params![id_channel, playlist_id, title, cover_path],
    )?;    let id = conn.query_row(
        "SELECT id FROM online_videos_playlists WHERE playlist_id = ?1",
        params![playlist_id],
        |row| row.get(0),
    )?;
    Ok(id)
}

pub fn get_playlists(conn: &Connection) -> Result<Vec<OnlineVideoPlaylist>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.id_channel, p.playlist_id, p.title, p.description, p.images, p.status,
                p.error, p.cover_path,
                c.title as channel_title,
                (SELECT COUNT(*) FROM online_videos WHERE id_playlist = p.id) as video_count
         FROM online_videos_playlists p
         LEFT JOIN online_videos_channels c ON c.id = p.id_channel
         ORDER BY p.created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(OnlineVideoPlaylist {
            id: row.get("id")?,
            id_channel: row.get("id_channel")?,
            playlist_id: row.get("playlist_id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            images: row.get("images")?,
            status: row.get("status")?,
            error: row.get("error")?,
            cover_path: row.get("cover_path")?,
            channel_title: row.get("channel_title")?,
            video_count: row.get("video_count")?,
        })
    })?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn get_playlist(conn: &Connection, playlist_id: &str) -> Result<OnlineVideoPlaylist, AppError> {
    let row = conn
        .query_row(
            "SELECT p.id, p.id_channel, p.playlist_id, p.title, p.description, p.images, p.status,
                p.error, p.cover_path,
                c.title as channel_title,
                (SELECT COUNT(*) FROM online_videos WHERE id_playlist = p.id) as video_count
         FROM online_videos_playlists p
         LEFT JOIN online_videos_channels c ON c.id = p.id_channel
         WHERE p.playlist_id = ?1",
            params![playlist_id],
            |row| {
                Ok(OnlineVideoPlaylist {
                    id: row.get("id")?,
                    id_channel: row.get("id_channel")?,
                    playlist_id: row.get("playlist_id")?,
                    title: row.get("title")?,
                    description: row.get("description")?,
                    images: row.get("images")?,
                    status: row.get("status")?,
                    error: row.get("error")?,
                    cover_path: row.get("cover_path")?,
                    channel_title: row.get("channel_title")?,
                    video_count: row.get("video_count")?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Playlist {} not found", playlist_id))
            }
            other => AppError::Database(other),
        })?;
    Ok(row)
}

pub fn delete_playlist(conn: &Connection, playlist_id: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM online_videos_playlists WHERE playlist_id = ?1",
        params![playlist_id],
    )?;
    Ok(())
}

pub fn upsert_videos(
    conn: &Connection,
    db_playlist_id: i64,
    videos: &[(String, String, String, Option<i64>, i32)], // (video_id, title, thumbnail_url, duration, sequence)
) -> Result<(), AppError> {
    let mut stmt = conn.prepare(
        "INSERT INTO online_videos (id_playlist, video_id, title, images, duration_seconds, sequence, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')
         ON CONFLICT(id_playlist, video_id) DO UPDATE SET
            title = ?3, images = ?4, duration_seconds = ?5, sequence = ?6, updated_at = CURRENT_TIMESTAMP",
    )?;
    for (video_id, title, thumbnail_url, duration, seq) in videos {
        stmt.execute(params![db_playlist_id, video_id, title, thumbnail_url, duration, seq])?;
    }
    Ok(())
}

pub fn get_playlist_videos(
    conn: &Connection,
    db_playlist_id: i64,
) -> Result<Vec<OnlineVideo>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, id_playlist, video_id, sequence, title, description, images, status, error, local_path, duration_seconds
         FROM online_videos
         WHERE id_playlist = ?1
         ORDER BY sequence ASC",
    )?;
    let rows = stmt.query_map(params![db_playlist_id], |row| {
        Ok(OnlineVideo {
            id: row.get("id")?,
            id_playlist: row.get("id_playlist")?,
            video_id: row.get("video_id")?,
            sequence: row.get("sequence")?,
            title: row.get("title")?,
            description: row.get("description")?,
            images: row.get("images")?,
            status: row.get("status")?,
            error: row.get("error")?,
            local_path: row.get("local_path")?,
            duration_seconds: row.get("duration_seconds")?,
        })
    })?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

/// Used by yt-dlp download command (Task 5) when a video is fully downloaded.
#[allow(dead_code)]
pub fn update_video_local_path(
    conn: &Connection,
    video_id: &str,
    local_path: &str,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE online_videos SET local_path = ?1, status = 'validated', updated_at = CURRENT_TIMESTAMP WHERE video_id = ?2",
        params![local_path, video_id],
    )?;
    Ok(())
}

pub fn get_videos_with_local_path(
    conn: &Connection,
    playlist_id: &str,
) -> Result<Vec<String>, AppError> {
    // Get the internal playlist id first
    let db_playlist_id: i64 = conn
        .query_row(
            "SELECT id FROM online_videos_playlists WHERE playlist_id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Playlist {} not found", playlist_id))
            }
            other => AppError::Database(other),
        })?;

    let mut stmt = conn.prepare(
        "SELECT local_path FROM online_videos WHERE id_playlist = ?1 AND local_path IS NOT NULL",
    )?;
    let paths = stmt.query_map(params![db_playlist_id], |row| row.get::<_, String>(0))?;
    let mut result = Vec::new();
    for path in paths {
        result.push(path?);
    }
    Ok(result)
}

pub fn clear_video_local_path(
    conn: &Connection,
    video_id: &str,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE online_videos SET local_path = NULL, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE video_id = ?1",
        params![video_id],
    )?;
    Ok(())
}
