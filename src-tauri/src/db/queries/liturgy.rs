use crate::db::models::{Service, ServiceItem};
use crate::error::AppError;
use rusqlite::Connection;

pub fn get_services(_conn: &Connection) -> Result<Vec<Service>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_service_by_id(_conn: &Connection, _id: i64) -> Result<Service, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn insert_service(_conn: &Connection, _service: &Service) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn update_service(_conn: &Connection, _service: &Service) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn delete_service(_conn: &Connection, _id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_service_items(
    _conn: &Connection,
    _service_id: i64,
) -> Result<Vec<ServiceItem>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn insert_service_item(_conn: &Connection, _item: &ServiceItem) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn delete_service_item(_conn: &Connection, _id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn reorder_items(
    _conn: &Connection,
    _service_id: i64,
    _item_ids: &[i64],
) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
