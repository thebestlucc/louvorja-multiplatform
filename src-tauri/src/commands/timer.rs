use crate::error::AppError;

#[tauri::command]
pub fn start_timer(_duration_secs: u64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn stop_timer() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn reset_timer() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_timer_state() -> Result<String, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
