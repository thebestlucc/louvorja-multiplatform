//! Projector / monitor handlers for remote WS commands.
//!
//! Window creation must run on the Tauri main thread. We use
//! `app.run_on_main_thread()` for open ops. Close ops call the existing
//! command logic directly since they don't spawn windows.

use crate::error::AppError;
use tauri::{AppHandle, Emitter, Manager};

/// `projector.open` — open the projector window on its configured monitor.
pub async fn projector_open(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    // Emit a remote event that the main window's `useMonitorsControl` hook handles.
    // This mirrors the keyboard shortcut path (F5) and keeps window-creation logic
    // in one place (the frontend open_fullscreen_window wrapper).
    app.emit("remote-projector-open", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `projector.close` — close the projector window.
pub async fn projector_close(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-projector-close", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `projector.set_monitor { monitorId }` — change which monitor the projector uses.
pub async fn projector_set_monitor(
    app: &AppHandle,
    monitor_id: String,
) -> Result<serde_json::Value, AppError> {
    app.emit(
        "remote-projector-set-monitor",
        serde_json::json!({ "monitorId": monitor_id }),
    )
    .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `return_monitor.open` — open the return (confidence) monitor window.
pub async fn return_open(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-return-open", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `return_monitor.close` — close the return monitor window.
pub async fn return_close(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-return-close", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// Check whether the projector window is currently open.
pub fn is_projector_open(app: &AppHandle) -> bool {
    use crate::state::AppState;
    app.try_state::<AppState>()
        .map(|s| s.projector_open.load(std::sync::atomic::Ordering::SeqCst))
        .unwrap_or(false)
}

/// Check whether the return monitor window is currently open.
pub fn is_return_open(app: &AppHandle) -> bool {
    use crate::state::AppState;
    app.try_state::<AppState>()
        .map(|s| s.return_open.load(std::sync::atomic::Ordering::SeqCst))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_names_have_remote_prefix() {
        for name in &[
            "remote-projector-open",
            "remote-projector-close",
            "remote-projector-set-monitor",
            "remote-return-open",
            "remote-return-close",
        ] {
            assert!(
                name.starts_with("remote-"),
                "event must have remote- prefix: {name}"
            );
        }
    }
}
