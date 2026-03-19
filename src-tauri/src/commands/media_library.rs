use crate::db::models::{MediaLibraryCategory, MediaLibraryCategoryInput, MediaLibraryItem, MediaLibraryItemInput};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;

#[tauri::command]
#[specta::specta]
pub fn get_media_library_categories(
    language: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaLibraryCategory>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::get_categories(&conn, &language)
}

#[tauri::command]
#[specta::specta]
pub fn upsert_media_library_category(
    input: MediaLibraryCategoryInput,
    state: tauri::State<'_, AppState>,
) -> Result<i64, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::upsert_category(&conn, input)
}

#[tauri::command]
#[specta::specta]
pub fn delete_media_library_category(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::delete_category(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn get_media_library_items(
    category_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaLibraryItem>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::get_items_by_category(&conn, category_id)
}

#[tauri::command]
#[specta::specta]
pub fn upsert_media_library_item(
    input: MediaLibraryItemInput,
    state: tauri::State<'_, AppState>,
) -> Result<i64, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::upsert_item(&conn, input)
}

#[tauri::command]
#[specta::specta]
pub fn delete_media_library_item(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::delete_item(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn search_media_library_items(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaLibraryItem>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::media_library::search_library_items(&conn, &query)
}
