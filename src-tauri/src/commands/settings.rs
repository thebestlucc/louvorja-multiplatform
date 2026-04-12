use crate::db::models::Setting;
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use crate::utils::catcher::catcher;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

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
    let conn = state.db.get()?;
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
    let conn = state.db.get()?;
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
    let conn = state.db.get()?;
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
pub fn clear_database(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ClearDatabaseResult, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::settings::clear_database(&conn)?;

    // Remove the cached manifest so the next check fetches fresh from CDN
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?;
    let _ = std::fs::remove_file(data_dir.join("manifest_cache.json"));

    // NOTE: The media/ folder (user-downloaded videos, custom slide backgrounds) is
    // intentionally NOT deleted — it contains user-managed content, not CDN data.
    // CDN-extracted packs live in covers/, images/, and musics/ at the data_dir root
    // and are removed in the loop below.

    // --- Content DB / pack-sync cleanup ---

    // 1. Drain all content DB pools so file handles are released before deleting the files.
    // Use unwrap_or_else to recover gracefully from a poisoned mutex (can happen if a
    // background pack-sync thread panicked while holding the lock).
    {
        let mut map = state
            .content_dbs
            .write()
            .unwrap_or_else(|e| {
                log::warn!(
                    "[settings] content_dbs RwLock was poisoned (a background thread panicked \
                     while holding it). Recovering: {}",
                    e
                );
                e.into_inner()
            });
        map.clear();
    }

    // 2. Delete content-*.db files, extracted pack dirs, and temp files
    if let Ok(entries) = std::fs::read_dir(&data_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            // Content databases
            if name.starts_with("content-") && name.ends_with(".db") {
                let _ = std::fs::remove_file(&path);
            }
            // Extracted pack directories
            if matches!(name, "musics" | "covers" | "images") {
                let _ = std::fs::remove_dir_all(&path);
            }
            // Temp files from downloads
            if name.ends_with(".db.tmp") || name.ends_with(".zip.tmp") {
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    // 3. Reset pack_sync-related settings
    conn.execute(
        "DELETE FROM settings WHERE key LIKE ?1",
        rusqlite::params!["pack_sync.%"],
    )
    .ok();

    Ok(ClearDatabaseResult { success: true })
}

/// Broadcasts projection display settings (font size + family) to all windows.
/// Must route through Rust because JS `emit()` is scoped to the current window;
/// `app.emit()` from Rust is global and reaches the projector/return webviews.
#[tauri::command]
#[specta::specta]
pub fn broadcast_projection_display(
    app: AppHandle,
    font_size: f64,
    font_family: String,
) -> Result<(), AppError> {
    #[derive(Clone, serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Payload {
        font_size: f64,
        font_family: String,
    }
    app.emit("projection-display-changed", Payload { font_size, font_family })
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(())
}

/// Broadcasts full projection + lyrics display settings to all windows.
#[tauri::command]
#[specta::specta]
pub fn broadcast_projection_display_full(
    app: AppHandle,
    font_size: f64,
    font_family: String,
    text_color: String,
    background_color: String,
    enable_background_image: bool,
    enable_backdrop_filter: bool,
    backdrop_opacity: f64,
    panel_opacity: f64,
) -> Result<(), AppError> {
    #[derive(Clone, serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Payload {
        font_size: f64,
        font_family: String,
        text_color: String,
        background_color: String,
        enable_background_image: bool,
        enable_backdrop_filter: bool,
        backdrop_opacity: f64,
        panel_opacity: f64,
    }
    app.emit(
        "projection-display-changed",
        Payload {
            font_size,
            font_family,
            text_color,
            background_color,
            enable_background_image,
            enable_backdrop_filter,
            backdrop_opacity,
            panel_opacity,
        },
    )
    .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(())
}
