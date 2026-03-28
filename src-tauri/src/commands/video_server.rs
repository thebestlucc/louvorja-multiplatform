use crate::error::AppError;
use crate::state::VideoServerState;
use crate::video_server::VideoServerInfo;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub fn start_video_server(
    app: AppHandle,
    state: tauri::State<'_, VideoServerState>,
) -> Result<VideoServerInfo, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {e}")))?;

    let mut server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(format!("Lock poisoned: {e}")))?;

    server.set_media_root(app_data_dir);
    server.start().map_err(AppError::Internal)
}

#[tauri::command]
#[specta::specta]
pub fn get_video_server_status(
    state: tauri::State<'_, VideoServerState>,
) -> Result<VideoServerInfo, AppError> {
    let server = state
        .server
        .lock()
        .map_err(|e| AppError::Internal(format!("Lock poisoned: {e}")))?;

    Ok(server.info())
}
