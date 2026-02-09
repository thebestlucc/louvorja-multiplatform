use crate::error::AppError;
use crate::db::models::{Presentation, Slide};

#[tauri::command]
pub fn get_presentations() -> Result<Vec<Presentation>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_presentation(_id: i64) -> Result<Presentation, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn create_presentation(_title: String) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn update_presentation(_id: i64, _title: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn delete_presentation(_id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_slides(_presentation_id: i64) -> Result<Vec<Slide>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn create_slide(_presentation_id: i64) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn update_slide(_id: i64, _content: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn delete_slide(_id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn reorder_slides(_presentation_id: i64, _slide_ids: Vec<i64>) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
