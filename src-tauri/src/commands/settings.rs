use crate::error::AppError;
use crate::db::models::Setting;

#[tauri::command]
pub fn get_setting(_key: String) -> Result<Setting, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn set_setting(_key: String, _value: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_all_settings() -> Result<Vec<Setting>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
