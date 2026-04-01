use crate::db::models::{Liturgy, LiturgyItem, LiturgyWithItems};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;

#[tauri::command]
#[specta::specta]
pub fn get_services(state: tauri::State<'_, AppState>) -> Result<Vec<Liturgy>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::get_services(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn get_service(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<LiturgyWithItems, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let service = crate::db::queries::liturgy::get_service_by_id(&conn, id)?;
    let items = crate::db::queries::liturgy::get_service_items(&conn, id)?;
    Ok(LiturgyWithItems { service, items })
}

#[tauri::command]
#[specta::specta]
pub fn create_service(
    title: String,
    date: Option<String>,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Liturgy, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let id = crate::db::queries::liturgy::insert_service(
        &conn,
        &title,
        date.as_deref(),
        notes.as_deref(),
    )?;
    crate::db::queries::liturgy::get_service_by_id(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn update_service(
    id: i64,
    title: String,
    date: Option<String>,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::update_service(
        &conn,
        id,
        &title,
        date.as_deref(),
        notes.as_deref(),
    )
}

#[tauri::command]
#[specta::specta]
pub fn delete_service(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::delete_service(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn add_service_item(
    service_id: i64,
    item_type: String,
    title: String,
    item_id: Option<i64>,
    notes: Option<String>,
    parent_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<LiturgyItem, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let id = crate::db::queries::liturgy::insert_service_item(
        &conn,
        service_id,
        &item_type,
        &title,
        item_id,
        notes.as_deref(),
        parent_id,
    )?;
    crate::db::queries::liturgy::get_service_item_by_id(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn remove_service_item(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::delete_service_item(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn reorder_service_items(
    service_id: i64,
    item_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::reorder_items(&conn, service_id, &item_ids)
}

#[tauri::command]
#[specta::specta]
pub fn duplicate_service(id: i64, state: tauri::State<'_, AppState>) -> Result<Liturgy, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let new_id = crate::db::queries::liturgy::duplicate_service_with_items(&conn, id)?;
    crate::db::queries::liturgy::get_service_by_id(&conn, new_id)
}

#[tauri::command]
#[specta::specta]
pub fn update_service_item(
    id: i64,
    title: String,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::update_service_item(&conn, id, &title, notes.as_deref())
}

#[tauri::command]
#[specta::specta]
pub fn set_service_week_day(
    id: i64,
    week_day: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::set_service_week_day(&conn, id, week_day)
}

#[tauri::command]
#[specta::specta]
pub fn move_service_item_to_parent(
    id: i64,
    parent_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::liturgy::move_service_item_to_parent(&conn, id, parent_id)
}
