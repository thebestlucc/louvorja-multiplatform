use rusqlite::Connection;
use crate::db::models::{Hymn, Album};
use crate::error::AppError;

pub fn search_hymns(_conn: &Connection, _query: &str) -> Result<Vec<Hymn>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_hymn_by_id(_conn: &Connection, _id: i64) -> Result<Hymn, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_albums(_conn: &Connection) -> Result<Vec<Album>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_hymns_by_album(_conn: &Connection, _album: &str) -> Result<Vec<Hymn>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn insert_hymn(_conn: &Connection, _hymn: &Hymn) -> Result<i64, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn update_hymn(_conn: &Connection, _hymn: &Hymn) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn delete_hymn(_conn: &Connection, _id: i64) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
