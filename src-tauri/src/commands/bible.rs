use crate::error::AppError;
use crate::db::models::{BibleVersion, Verse};

#[tauri::command]
pub fn get_bible_versions() -> Result<Vec<BibleVersion>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_books(_version_id: i64) -> Result<Vec<String>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_verses(_version_id: i64, _book: String, _chapter: i64) -> Result<Vec<Verse>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn search_bible(_query: String) -> Result<Vec<Verse>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
