use crate::db::models::{Service, ServiceItem, ServiceWithItems};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn get_services(state: tauri::State<'_, AppState>) -> Result<Vec<Service>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::liturgy::get_services(&conn)
}

#[tauri::command]
pub fn get_service(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<ServiceWithItems, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let service = crate::db::queries::liturgy::get_service_by_id(&conn, id)?;
    let items = crate::db::queries::liturgy::get_service_items(&conn, id)?;
    Ok(ServiceWithItems { service, items })
}

#[tauri::command]
pub fn create_service(
    title: String,
    date: Option<String>,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Service, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let id = crate::db::queries::liturgy::insert_service(
        &conn,
        &title,
        date.as_deref(),
        notes.as_deref(),
    )?;
    crate::db::queries::liturgy::get_service_by_id(&conn, id)
}

#[tauri::command]
pub fn update_service(
    id: i64,
    title: String,
    date: Option<String>,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::liturgy::update_service(&conn, id, &title, date.as_deref(), notes.as_deref())
}

#[tauri::command]
pub fn delete_service(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::liturgy::delete_service(&conn, id)
}

#[tauri::command]
pub fn add_service_item(
    service_id: i64,
    item_type: String,
    title: String,
    item_id: Option<i64>,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<ServiceItem, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let id = crate::db::queries::liturgy::insert_service_item(
        &conn,
        service_id,
        &item_type,
        &title,
        item_id,
        notes.as_deref(),
    )?;
    crate::db::queries::liturgy::get_service_item_by_id(&conn, id)
}

#[tauri::command]
pub fn remove_service_item(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::liturgy::delete_service_item(&conn, id)
}

#[tauri::command]
pub fn reorder_service_items(
    service_id: i64,
    item_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::liturgy::reorder_items(&conn, service_id, &item_ids)
}

#[tauri::command]
pub fn duplicate_service(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Service, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let new_id = crate::db::queries::liturgy::duplicate_service_with_items(&conn, id)?;
    crate::db::queries::liturgy::get_service_by_id(&conn, new_id)
}

#[tauri::command]
pub fn update_service_item(
    id: i64,
    title: String,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::liturgy::update_service_item(&conn, id, &title, notes.as_deref())
}
