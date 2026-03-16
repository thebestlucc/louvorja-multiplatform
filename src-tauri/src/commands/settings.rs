use crate::db::models::Setting;
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::utils::catcher::catcher;
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
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
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
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::settings::set_setting(&conn, &key, &value)?;
    drop(conn);

    if key == "app.language" {
        if let Ok(server) = streaming_state.server.lock() {
            server.set_ui_language(&value);
        }
    }

    if key == "app.language" || key == "app.theme" {
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
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::settings::get_all_settings(&conn)
}

fn normalize_global_shortcut_token(token: &str) -> String {
    match token.trim().to_ascii_lowercase().as_str() {
        "meta" | "cmd" | "command" | "super" | "commandorcontrol" | "commandorctrl"
        | "cmdorcontrol" | "cmdorctrl" => "CmdOrCtrl".into(),
        "control" | "ctrl" => "Ctrl".into(),
        "alt" | "option" => "Alt".into(),
        "shift" => "Shift".into(),
        "arrowright" => "Right".into(),
        "arrowleft" => "Left".into(),
        "arrowup" => "Up".into(),
        "arrowdown" => "Down".into(),
        other => {
            if other.len() == 1 {
                other.to_ascii_uppercase()
            } else {
                token.trim().to_string()
            }
        }
    }
}

pub(crate) fn normalize_global_shortcut(shortcut_str: &str) -> String {
    shortcut_str
        .split('+')
        .filter(|token| !token.trim().is_empty())
        .map(normalize_global_shortcut_token)
        .collect::<Vec<_>>()
        .join("+")
}

pub(crate) fn register_global_shortcut(
    action: &str,
    shortcut_str: &str,
    app: &AppHandle,
) -> Result<String, AppError> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let normalized = normalize_global_shortcut(shortcut_str);
    let shortcut = normalized
        .parse::<Shortcut>()
        .map_err(|e| AppError::Internal(format!("Invalid shortcut: {}", e)))?;

    let action_id = action.to_string();
    let handler_action = action_id.clone();
    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if handler_action == "app-command-palette" {
                    let _ = crate::commands::spotlight::open_spotlight_window(&app_clone);
                } else {
                    let _ = app_clone.emit("global-shortcut", &handler_action);
                }
            }
        })
        .map_err(|e| AppError::Internal(format!("Failed to register shortcut: {}", e)))?;

    Ok(normalized)
}

#[tauri::command]
#[specta::specta]
pub fn update_global_shortcut(
    action: String,
    shortcut_str: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let (shortcuts_map, err) = catcher(state.global_shortcuts.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut shortcuts_map = shortcuts_map.unwrap();

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

    let normalized = register_global_shortcut(&action, &shortcut_str, &app)?;

    shortcuts_map.insert(action, normalized);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn clear_database(state: tauri::State<'_, AppState>) -> Result<ClearDatabaseResult, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::settings::clear_database(&conn)?;
    Ok(ClearDatabaseResult { success: true })
}
