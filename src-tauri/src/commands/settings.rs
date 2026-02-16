use crate::db::models::Setting;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn get_setting(key: String, state: tauri::State<'_, AppState>) -> Result<Setting, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_setting(&conn, &key)
}

#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::set_setting(&conn, &key, &value)
}

#[tauri::command]
pub fn get_all_settings(state: tauri::State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_all_settings(&conn)
}
