use crate::db::models::{Collection, Favorite, Hymn};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;

#[tauri::command]
#[specta::specta]
pub fn get_favorite_collections(
    query: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Collection>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::favorites::get_favorite_collections(&conn, query.as_deref())
}

#[tauri::command]
#[specta::specta]
pub fn get_favorite_hymns(
    query: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::favorites::get_favorite_hymns(&conn, query.as_deref())
}

#[tauri::command]
#[specta::specta]
pub fn toggle_favorite(
    item_type: String,
    item_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<bool, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::favorites::toggle_favorite(&conn, &item_type, item_id)
}

#[tauri::command]
#[specta::specta]
pub fn get_favorites(
    item_type: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Favorite>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::favorites::get_favorites(&conn, &item_type)
}

#[tauri::command]
#[specta::specta]
pub fn is_favorite(
    item_type: String,
    item_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<bool, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::favorites::is_favorite(&conn, &item_type, item_id)
}

#[tauri::command]
#[specta::specta]
pub fn get_all_favorite_ids(
    item_type: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<i64>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::favorites::get_all_favorite_ids(&conn, &item_type)
}
