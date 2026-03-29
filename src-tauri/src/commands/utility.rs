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
    let (_, ffprobe_path) = load_ffprobe_settings(&state)?;

    let resolved_path_clone = resolved_path.clone();
    let parsed = tokio::task::spawn_blocking(move || -> Result<Option<crate::video::metadata::ParsedVideoMetadata>, AppError> {
        match video::parse_video_metadata(&resolved_path_clone) {
            Ok(parsed) => Ok(Some(parsed)),
            Err(primary_error) => {
                // Attempt ffprobe fallback (uses PATH when no path is configured).
                // This handles MPEG-TS files stored with .mp4 extension (common with
                // yt-dlp downloads) and other formats the native parser can't handle.
                match video::parse_video_metadata_with_ffprobe(
                    &resolved_path_clone,
                    ffprobe_path.as_deref(),
                    4000,
                ) {
                    Ok(parsed) => Ok(Some(parsed)),
                    Err(_) => {
                        // Both parsers failed — log and continue with unknown metadata.
                        // The file passed extension validation so playback will still work
                        // via the streaming server. Metadata (dimensions/duration) is
                        // display-only and 0/unknown is safe.
                        eprintln!(
                            "[video-metadata] could not extract metadata from '{}': {}. Continuing with unknown metadata.",
                            resolved_path_clone.display(),
                            primary_error
                        );
                        Ok(None)
                    }
                }
            }
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("Metadata task panicked: {}", e)))??;

    let (duration_ms, width, height, parsed_format) = match parsed {
        Some(p) => (p.duration_ms, p.width, p.height, p.format),
        None => (0, 0, 0, String::new()),
    };

    Ok(crate::db::models::VideoMetadata {
        duration_ms,
        width,
        height,
        file_size,
        format: if parsed_format.is_empty() {
            format
        } else {
            parsed_format
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
