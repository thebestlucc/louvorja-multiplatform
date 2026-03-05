use crate::db::models::Setting;
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use specta::Type;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingChangedPayload {
    key: String,
    value: String,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ClearDatabaseResult {
    pub success: bool,
}

#[tauri::command]
#[specta::specta]
pub fn get_setting(key: String, state: tauri::State<'_, AppState>) -> Result<Setting, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_setting(&conn, &key)
}

#[tauri::command]
#[specta::specta]
pub fn set_setting(
    key: String,
    value: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .get()
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
#[specta::specta]
pub fn get_all_settings(state: tauri::State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_all_settings(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn update_global_shortcut(
    action: String,
    shortcut_str: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let mut shortcuts_map = state
        .global_shortcuts
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Unregister the previous shortcut for this action if one exists
    if let Some(old_str) = shortcuts_map.get(&action) {
        if let Ok(old_shortcut) = old_str.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(old_shortcut);
        }
    }

    // Empty string means "unset" — just unregister without re-registering
    if shortcut_str.is_empty() {
        shortcuts_map.remove(&action);
        return Ok(());
    }

    let shortcut = shortcut_str
        .parse::<Shortcut>()
        .map_err(|e| AppError::Internal(format!("Invalid shortcut: {}", e)))?;

    let action_clone = action.clone();
    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app_clone.emit("global-shortcut", &action_clone);
            }
        })
        .map_err(|e| AppError::Internal(format!("Failed to register shortcut: {}", e)))?;

    shortcuts_map.insert(action, shortcut_str);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn clear_database(state: tauri::State<'_, AppState>) -> Result<ClearDatabaseResult, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::clear_database(&conn)?;
    Ok(ClearDatabaseResult { success: true })
}
