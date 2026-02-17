use crate::db::models::Setting;
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingChangedPayload {
    key: String,
    value: String,
}

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
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::set_setting(&conn, &key, &value)?;
    drop(conn);

    if key == "app.language" {
        if let Ok(server) = streaming_state.server.lock() {
            server.set_ui_language(&value);
        }
        let _ = app.emit(
            "setting-changed",
            SettingChangedPayload {
                key: key.clone(),
                value: value.clone(),
            },
        );
    }

    Ok(())
}

#[tauri::command]
pub fn get_all_settings(state: tauri::State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_all_settings(&conn)
}
