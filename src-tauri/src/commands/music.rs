use crate::error::AppError;
use crate::db::models::Hymn;

#[tauri::command]
pub fn search_hymns(_query: String) -> Result<Vec<Hymn>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_hymn(_id: i64) -> Result<Hymn, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_albums() -> Result<Vec<String>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_hymns_by_album(_album: String) -> Result<Vec<Hymn>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn create_hymn(_title: String) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn update_hymn(_id: i64, _title: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn delete_hymn(_id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
