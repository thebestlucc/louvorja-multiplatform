use crate::db::models::{Album, Hymn};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn search_hymns(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::search_hymns(&conn, &query)
}

#[tauri::command]
pub fn get_hymn(id: i64, state: tauri::State<'_, AppState>) -> Result<Hymn, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_hymn_by_id(&conn, id)
}

#[tauri::command]
pub fn get_albums(state: tauri::State<'_, AppState>) -> Result<Vec<Album>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_albums(&conn)
}

#[tauri::command]
pub fn get_hymns_by_album(
    album: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_hymns_by_album(&conn, &album)
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
