use crate::db::models::{AddPlaylistInput, OnlinePlaylistSearchResult, OnlineVideo, OnlineVideoPlaylist};
use crate::error::AppError;
use crate::state::AppState;
use crate::youtube::{api, parser, thumbnails};
use serde::Serialize;
use specta::Type;
use std::sync::Arc;
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
    let output_dir = app_data_dir.join("media").join("videos").join("youtube");
    for path in &local_paths {
        // Extract video_id from stored relative path (e.g. "media/videos/youtube/VIDEO_ID.mp4")
        if let Some(stem) = std::path::Path::new(path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
        {
            // Delete all files for this video_id (covers separate audio tracks too)
            crate::ytdlp::downloader::delete_video_files(&output_dir, &stem);
        }
        // Fallback: remove the exact stored path
        let full_path = app_data_dir.join(path);
        let _ = std::fs::remove_file(&full_path);
    }

    crate::db::queries::online_videos::delete_playlist(&conn, &playlist_id)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn delete_video_local_file(
    video_id: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), AppError> {
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let local_path: Option<String> = conn
        .query_row(
            "SELECT local_path FROM online_videos WHERE video_id = ?1",
            rusqlite::params![&video_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    // Delete all files matching this video_id (video + any separate audio tracks)
    let output_dir = app_data_dir.join("media").join("videos").join("youtube");
    crate::ytdlp::downloader::delete_video_files(&output_dir, &video_id);

    // Also remove the stored path explicitly in case the naming differs
    if let Some(path) = local_path {
        let full_path = app_data_dir.join(&path);
        let _ = std::fs::remove_file(&full_path); // best-effort, already covered above
    }

    crate::db::queries::online_videos::clear_video_local_path(&conn, &video_id)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn ensure_ytdlp(app: AppHandle) -> Result<(), AppError> {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let result = (|| -> Result<String, AppError> {
            let app_data_dir = app_clone.path().app_data_dir()
                .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?;
            let path = crate::ytdlp::binary::ensure_binary(&app_data_dir)?;
            Ok(path.to_string_lossy().to_string())
        })();
        match result {
            Ok(path) => { let _ = app_clone.emit("ytdlp-binary-ready", &path); }
            Err(e) => { let _ = app_clone.emit("ytdlp-binary-error", &e.to_string()); }
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn update_ytdlp(app: AppHandle) -> Result<(), AppError> {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let result = (|| -> Result<String, AppError> {
            let app_data_dir = app_clone.path().app_data_dir()
                .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?;
            let path = crate::ytdlp::binary::update_binary(&app_data_dir)?;
            Ok(path.to_string_lossy().to_string())
        })();
        match result {
            Ok(path) => { let _ = app_clone.emit("ytdlp-binary-ready", &path); }
            Err(e) => { let _ = app_clone.emit("ytdlp-binary-error", &e.to_string()); }
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn download_online_video(
    video_id: String,
    playlist_id: String,
    quality: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    // playlist_id is part of the IPC contract and will be used for filtering in future tasks
    let _ = &playlist_id;
    let run_id = uuid::Uuid::new_v4().to_string();
    let cancel_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));

    {
        let mut runtime = state.ytdlp.lock()
            .map_err(|e| AppError::Internal(format!("Lock error: {}", e)))?;
        runtime.active_run_id = Some(run_id.clone());
        runtime.cancel_flags.insert(run_id.clone(), cancel_flag.clone());
    }

    let pool = state.db.clone();
    let run_id_clone = run_id.clone();
    let video_id_clone = video_id.clone();

    std::thread::spawn(move || {
        let result = (|| -> Result<(), AppError> {
            let app_data_dir = app.path().app_data_dir()
                .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?;

            // 1. Ensure yt-dlp binary exists
            let binary_path = crate::ytdlp::binary::ensure_binary(&app_data_dir)?;

            // 2. Download the video
            let output_dir = app_data_dir.join("media").join("videos").join("youtube");
            let output_path = crate::ytdlp::downloader::download_video(
                &binary_path, &video_id_clone, &output_dir, &quality,
                cancel_flag, &app, &run_id_clone,
            )?;

            // 3. Update DB with local path
            let relative_path = format!("media/videos/youtube/{}", output_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| format!("{}.mp4", video_id_clone)));

            let conn = pool.get().map_err(|e| AppError::Internal(e.to_string()))?;
            crate::db::queries::online_videos::update_video_local_path(&conn, &video_id_clone, &relative_path)?;

            Ok(())
        })();

        if let Err(e) = result {
            // Error already emitted by downloader for cancel/error cases
            // but emit a generic error for unexpected failures
            if !e.to_string().contains("cancelled") {
                let _ = app.emit("ytdlp-download-error", &serde_json::json!({
                    "runId": run_id_clone,
                    "videoId": video_id_clone,
                    "error": e.to_string(),
                }));
            }
        }
    });

    Ok(run_id)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_download(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let runtime = state.ytdlp.lock()
        .map_err(|e| AppError::Internal(format!("Lock error: {}", e)))?;
    if let Some(flag) = runtime.cancel_flags.get(&run_id) {
        flag.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn search_online_playlists(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<OnlinePlaylistSearchResult>, AppError> {
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::online_videos::search_online_playlists(&conn, &query, 8)
}

#[tauri::command]
#[specta::specta]
pub fn find_online_video_by_yt_id(
    yt_video_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<OnlineVideo>, AppError> {
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::online_videos::find_video_by_yt_id(&conn, &yt_video_id)
}
