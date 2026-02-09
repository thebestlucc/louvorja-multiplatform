use crate::error::AppError;
use crate::db::models::{Service, ServiceItem};

#[tauri::command]
pub fn get_services() -> Result<Vec<Service>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn get_service(_id: i64) -> Result<Service, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn create_service(_title: String) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn update_service(_id: i64, _title: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn delete_service(_id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn add_service_item(_service_id: i64, _item_type: String, _title: String) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn remove_service_item(_id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn reorder_service_items(_service_id: i64, _item_ids: Vec<i64>) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
