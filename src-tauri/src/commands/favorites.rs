use crate::db::models::{Favorite, Hymn};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn get_favorite_hymns(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::favorites::get_favorite_hymns(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn toggle_favorite(
    item_type: String,
    item_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<bool, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::favorites::toggle_favorite(&conn, &item_type, item_id)
}

#[tauri::command]
#[specta::specta]
pub fn get_favorites(
    item_type: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Favorite>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::favorites::get_favorites(&conn, &item_type)
}

#[tauri::command]
#[specta::specta]
pub fn is_favorite(
    item_type: String,
    item_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<bool, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::favorites::is_favorite(&conn, &item_type, item_id)
}
