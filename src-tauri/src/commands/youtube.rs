use crate::db::models::{AddPlaylistInput, OnlineVideo, OnlineVideoPlaylist};
use crate::error::AppError;
use crate::state::AppState;
use crate::youtube::{api, parser, thumbnails};
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyValidationResult {
    pub valid: bool,
    pub error: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn validate_youtube_api_key(key: String, app: AppHandle) -> Result<(), AppError> {
    std::thread::spawn(move || {
        let result = match api::validate_api_key(&key) {
            Ok(valid) => ApiKeyValidationResult { valid, error: None },
            Err(e) => ApiKeyValidationResult {
                valid: false,
                error: Some(e.to_string()),
            },
        };
        let _ = app.emit("youtube-api-key-validated", &result);
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn fetch_youtube_channel(url: String, api_key: String, app: AppHandle) -> Result<(), AppError> {
    std::thread::spawn(move || {
        let result = (|| -> Result<_, AppError> {
            let parsed = parser::parse_youtube_url(&url)?;
            let channel_id = match parsed {
                parser::YoutubeUrl::Channel(id) => id,
                parser::YoutubeUrl::Handle(handle) => api::resolve_handle(&api_key, &handle)?,
                other => {
                    return Err(AppError::Internal(format!(
                        "Expected channel URL, got {:?}",
                        other
                    )))
                }
            };
            api::fetch_channel(&api_key, &channel_id)
        })();
        match result {
            Ok(channel) => {
                let _ = app.emit("youtube-channel-fetched", &channel);
            }
            Err(e) => {
                let _ = app.emit("youtube-channel-fetch-error", &e.to_string());
            }
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn add_youtube_playlist(
    input: AddPlaylistInput,
    api_key: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let pool = state.db.clone();

    std::thread::spawn(move || {
        let result = (|| -> Result<(), AppError> {
            let conn = pool.get().map_err(|e| AppError::Internal(e.to_string()))?;

            // 1. Upsert channel
            let images_json =
                serde_json::json!({ "thumbnail": input.thumbnail_url }).to_string();
            let db_channel_id = crate::db::queries::online_videos::upsert_channel(
                &conn,
                &input.channel_id,
                &input.channel_title,
                &images_json,
            )?;

            // 2. Download cover thumbnail
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?;
            let cover_path = thumbnails::download_thumbnail(
                &app_data_dir,
                &input.thumbnail_url,
                &input.playlist_id,
            )
            .ok(); // Non-fatal if cover download fails

            // 3. Insert/upsert playlist
            let db_playlist_id = crate::db::queries::online_videos::insert_playlist(
                &conn,
                db_channel_id,
                &input.playlist_id,
                &input.playlist_title,
                cover_path.as_deref(),
                0,
            )?;

            // 4. Fetch and save videos
            let videos = api::fetch_playlist_videos(&api_key, &input.playlist_id)?;
            let video_tuples: Vec<_> = videos
                .iter()
                .map(|v| {
                    (
                        v.video_id.clone(),
                        v.title.clone(),
                        v.thumbnail_url.clone(),
                        v.duration_seconds,
                        v.sequence,
                    )
                })
                .collect();
            crate::db::queries::online_videos::upsert_videos(
                &conn,
                db_playlist_id,
                &video_tuples,
            )?;

            Ok(())
        })();

        match result {
            Ok(()) => {
                let _ = app.emit("youtube-playlist-added", &());
            }
            Err(e) => {
                let _ = app.emit("youtube-playlist-add-error", &e.to_string());
            }
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_youtube_playlists(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<OnlineVideoPlaylist>, AppError> {
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::online_videos::get_playlists(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn get_youtube_playlist_videos(
    playlist_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<OnlineVideo>, AppError> {
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    let playlist = crate::db::queries::online_videos::get_playlist(&conn, &playlist_id)?;
    crate::db::queries::online_videos::get_playlist_videos(&conn, playlist.id)
}

#[tauri::command]
#[specta::specta]
pub fn refresh_youtube_playlist(
    playlist_id: String,
    api_key: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let pool = state.db.clone();

    std::thread::spawn(move || {
        let result = (|| -> Result<(), AppError> {
            let conn = pool.get().map_err(|e| AppError::Internal(e.to_string()))?;
            let playlist =
                crate::db::queries::online_videos::get_playlist(&conn, &playlist_id)?;

            let videos = api::fetch_playlist_videos(&api_key, &playlist_id)?;
            let video_tuples: Vec<_> = videos
                .iter()
                .map(|v| {
                    (
                        v.video_id.clone(),
                        v.title.clone(),
                        v.thumbnail_url.clone(),
                        v.duration_seconds,
                        v.sequence,
                    )
                })
                .collect();
            crate::db::queries::online_videos::upsert_videos(
                &conn,
                playlist.id,
                &video_tuples,
            )?;

            Ok(())
        })();

        match result {
            Ok(()) => {
                let _ = app.emit("youtube-playlist-refreshed", &());
            }
            Err(e) => {
                let _ = app.emit("youtube-playlist-refresh-error", &e.to_string());
            }
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn delete_youtube_playlist(
    playlist_id: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;

    // Clean up local video files before deleting from DB
    let local_paths =
        crate::db::queries::online_videos::get_videos_with_local_path(&conn, &playlist_id)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?;
    for path in &local_paths {
        let full_path = app_data_dir.join(path);
        let _ = std::fs::remove_file(&full_path); // Best-effort cleanup
    }

    crate::db::queries::online_videos::delete_playlist(&conn, &playlist_id)?;
    Ok(())
}
