use crate::error::AppError;

#[tauri::command]
pub fn run_lottery(_min: i64, _max: i64) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn format_text(_text: String, _format: String) -> Result<String, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
