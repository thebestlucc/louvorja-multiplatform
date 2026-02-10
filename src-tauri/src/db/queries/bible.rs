use crate::db::models::{BibleVersion, Book, Verse};
use crate::error::AppError;
use rusqlite::Connection;

pub fn get_versions(_conn: &Connection) -> Result<Vec<BibleVersion>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_books(_conn: &Connection, _version_id: i64) -> Result<Vec<Book>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_verses(
    _conn: &Connection,
    _version_id: i64,
    _book: &str,
    _chapter: i64,
) -> Result<Vec<Verse>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn search_bible_text(_conn: &Connection, _query: &str) -> Result<Vec<Verse>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
