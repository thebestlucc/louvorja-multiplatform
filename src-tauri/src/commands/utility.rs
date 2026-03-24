use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use crate::video;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get metadata for a video file.
///
/// Accepts any absolute OS path (e.g. user-picked via file dialog) or a managed
/// relative path (`media/videos/...`) resolved against `app_data_dir`.
/// SafePath is intentionally NOT used here — this command is for user-picked files
/// that live anywhere on disk, not for managed internal paths.
///
/// The native parser runs synchronously (fast). If it fails and ffprobe is
/// enabled, the ffprobe fallback can block up to 4 seconds — that work is
/// offloaded to `tokio::task::spawn_blocking` so the IPC bridge stays
/// responsive on Windows during the wait.
#[tauri::command]
#[specta::specta]
pub async fn get_video_metadata(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::db::models::VideoMetadata, AppError> {
    let p = std::path::Path::new(&path);
    let resolved_path: PathBuf = if p.is_absolute() {
        p.canonicalize().map_err(|e| AppError::NotFound(format!("Video file '{}' not found: {}", path, e)))?
    } else {
        // Relative path — resolve against app_data_dir
        let (app_data_dir, err) = catcher(app.path().app_data_dir());
        if let Some(e) = err {
            return Err(e);
        }
        let base = app_data_dir.unwrap();
        base.join(&path).canonicalize().map_err(|e| AppError::NotFound(format!("Video file '{}' not found: {}", path, e)))?
    };

    if !resolved_path.exists() {
        return Err(AppError::NotFound(format!(
            "Video file '{}' not found",
            resolved_path.display()
        )));
    }

    let format = video::ensure_supported_video(&resolved_path)?;
    let (metadata, err) = catcher(std::fs::metadata(&resolved_path));
    if let Some(e) = err {
        return Err(e);
    }
    let file_size = metadata.unwrap().len() as i64;

    // Load ffprobe settings before entering spawn_blocking — tauri::State
    // is not Send and cannot cross the async boundary.
    let (ffprobe_enabled, ffprobe_path) = load_ffprobe_settings(&state)?;

    let resolved_path_clone = resolved_path.clone();
    let parsed = tokio::task::spawn_blocking(move || {
        match video::parse_video_metadata(&resolved_path_clone) {
            Ok(parsed) => Ok(parsed),
            Err(primary_error) => {
                if !ffprobe_enabled {
                    return Err(primary_error);
                }
                video::parse_video_metadata_with_ffprobe(
                    &resolved_path_clone,
                    ffprobe_path.as_deref(),
                    4000,
                )
                .map_err(|fallback_error| {
                    AppError::Internal(format!(
                        "Video metadata parsing failed (native parser error: {}; ffprobe fallback error: {})",
                        primary_error, fallback_error
                    ))
                })
            }
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("Metadata task panicked: {}", e)))??;

    Ok(crate::db::models::VideoMetadata {
        duration_ms: parsed.duration_ms,
        width: parsed.width,
        height: parsed.height,
        file_size,
        format: if parsed.format.is_empty() {
            format
        } else {
            parsed.format
        },
    })
}

#[tauri::command]
#[specta::specta]
pub fn open_media_folder(app: AppHandle) -> Result<(), AppError> {
    let media_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?
        .join("media");

    // Create the folder if it doesn't exist yet so opener doesn't fail
    if !media_dir.exists() {
        std::fs::create_dir_all(&media_dir)
            .map_err(|e| AppError::Io(e))?;
    }

    tauri_plugin_opener::open_path(media_dir, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Could not open folder: {}", e)))
}

fn load_ffprobe_settings(
    state: &tauri::State<'_, AppState>,
) -> Result<(bool, Option<String>), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    let enabled = crate::db::queries::settings::get_setting(&conn, "video.ffprobeEnabled")
        .ok()
        .map(|s| s.value == "true")
        .unwrap_or(false);

    let path = crate::db::queries::settings::get_setting(&conn, "video.ffprobePath")
        .ok()
        .map(|s| s.value)
        .filter(|v| !v.trim().is_empty());

    Ok((enabled, path))
}
