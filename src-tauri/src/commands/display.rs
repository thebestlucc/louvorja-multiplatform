use crate::error::AppError;
use crate::db::models::MonitorInfo;

#[tauri::command]
pub fn get_available_monitors() -> Result<Vec<MonitorInfo>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn open_projector_window() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn close_projector_window() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn open_return_window() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn close_return_window() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn set_monitor_config(_monitor_id: String, _role: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
