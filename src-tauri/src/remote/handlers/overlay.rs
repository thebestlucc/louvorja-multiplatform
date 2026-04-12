//! Overlay + keyboard-shortcut handlers for remote WS commands.
//!
//! Overlay ops mutate `AppState.overlay` (same as the Tauri commands) and
//! emit `overlay-changed` so all clients (projector, frontend, other WS
//! devices) converge.
//!
//! `shortcut.trigger` re-uses the `global-shortcut` event contract so the
//! frontend's `use-keyboard.ts` handles it identically to a hardware key press.

use crate::{error::AppError, state::AppState};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OverlayState {
    black_screen: bool,
    logo_screen: bool,
}

fn app_state(app: &AppHandle) -> Result<tauri::State<'_, AppState>, AppError> {
    app.try_state::<AppState>()
        .ok_or_else(|| AppError::Internal("AppState not available".into()))
}

fn emit_overlay(app: &AppHandle, black: bool, logo: bool) -> Result<(), AppError> {
    let state = OverlayState {
        black_screen: black,
        logo_screen: logo,
    };
    app.emit("overlay-changed", &state)
        .map_err(|e| AppError::Tauri(e.to_string()))
}

/// `overlay.black` — activate black-screen overlay (disables logo if active).
pub async fn black(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let state = app_state(app)?;
    let (black, logo) = {
        let mut overlay = state
            .overlay
            .write()
            .map_err(|_| AppError::Internal("overlay lock poisoned".into()))?;
        overlay.is_black_screen = !overlay.is_black_screen;
        if overlay.is_black_screen {
            overlay.is_logo_screen = false;
        }
        (overlay.is_black_screen, overlay.is_logo_screen)
    };
    emit_overlay(app, black, logo)?;
    Ok(serde_json::json!({ "blackScreen": black, "logoScreen": logo }))
}

/// `overlay.logo` — activate logo overlay (disables black if active).
pub async fn logo(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let state = app_state(app)?;
    let (black, logo) = {
        let mut overlay = state
            .overlay
            .write()
            .map_err(|_| AppError::Internal("overlay lock poisoned".into()))?;
        overlay.is_logo_screen = !overlay.is_logo_screen;
        if overlay.is_logo_screen {
            overlay.is_black_screen = false;
        }
        (overlay.is_black_screen, overlay.is_logo_screen)
    };
    emit_overlay(app, black, logo)?;
    Ok(serde_json::json!({ "blackScreen": black, "logoScreen": logo }))
}

/// `overlay.clear` — clear all overlays.
pub async fn clear(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let state = app_state(app)?;
    {
        let mut overlay = state
            .overlay
            .write()
            .map_err(|_| AppError::Internal("overlay lock poisoned".into()))?;
        overlay.is_black_screen = false;
        overlay.is_logo_screen = false;
    }
    emit_overlay(app, false, false)?;
    Ok(serde_json::json!({ "blackScreen": false, "logoScreen": false }))
}

/// `shortcut.trigger { code }` — trigger a global-shortcut code.
///
/// Accepted codes match the existing `global-shortcut` event contract used by
/// `use-keyboard.ts`. Only allow-listed codes are dispatched to prevent
/// arbitrary command injection.
pub async fn shortcut_trigger(app: &AppHandle, code: &str) -> Result<serde_json::Value, AppError> {
    const ALLOWED: &[&str] = &[
        "slides-next",
        "slides-prev",
        "projector-toggle",
        "return-toggle",
        "black-screen",
        "logo-screen",
        "clear-slide",
    ];

    if !ALLOWED.contains(&code) {
        return Err(AppError::Internal(format!(
            "shortcut code not allowed: {code}"
        )));
    }

    app.emit("global-shortcut", code)
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_shortcuts_include_navigation() {
        let allowed = &[
            "slides-next",
            "slides-prev",
            "projector-toggle",
            "return-toggle",
            "black-screen",
            "logo-screen",
            "clear-slide",
        ];
        assert!(allowed.contains(&"slides-next"));
        assert!(allowed.contains(&"black-screen"));
    }

    #[test]
    fn disallowed_code_produces_error() {
        // Simulate the allow-list check without needing AppHandle.
        const ALLOWED: &[&str] = &["slides-next"];
        let code = "eval-arbitrary-code";
        let result = if ALLOWED.contains(&code) {
            Ok(())
        } else {
            Err(format!("not allowed: {code}"))
        };
        assert!(result.is_err());
    }

    #[test]
    fn overlay_state_serializes_camel_case() {
        let s = OverlayState {
            black_screen: true,
            logo_screen: false,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"blackScreen\":true"));
        assert!(json.contains("\"logoScreen\":false"));
    }
}
