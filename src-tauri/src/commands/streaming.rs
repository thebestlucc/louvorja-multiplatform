use crate::error::AppError;

#[tauri::command]
pub fn start_streaming_server(_port: u16) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn stop_streaming_server() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_streaming_status() -> Result<String, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
