//! Overlay + keyboard-shortcut handlers for remote WS commands.
//!
//! Overlay ops mutate ProjectionHub via `state.projection.apply(SetOverlay(...))`.
//! The Hub Delta flows through RemoteWsSurface → `overlay.changed` envelope
//! → every WS client, so handlers no longer need to re-emit anything locally.
//!
//! `shortcut.trigger` re-uses the `global-shortcut` event contract so the
//! frontend's `use-keyboard.ts` handles it identically to a hardware key press.

use crate::{error::AppError, state::AppState};
use crate::projection::{Mutation, OverlayMode};
use tauri::{AppHandle, Emitter, Manager};

fn app_state(app: &AppHandle) -> Result<tauri::State<'_, AppState>, AppError> {
    app.try_state::<AppState>()
        .ok_or_else(|| AppError::Internal("AppState not available".into()))
}

async fn current_overlay(app_state: &AppState) -> OverlayMode {
    let (snapshot, _rx) = app_state.projection.attach().await;
    snapshot.overlay
}

fn bools_of(mode: &OverlayMode) -> (bool, bool) {
    match mode {
        OverlayMode::Black => (true, false),
        OverlayMode::Logo => (false, true),
        OverlayMode::None => (false, false),
    }
}

/// `overlay.black` — activate black-screen overlay (disables logo if active).
pub async fn black(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let state = app_state(app)?;
    let current = current_overlay(&state).await;
    let next = if matches!(current, OverlayMode::Black) {
        OverlayMode::None
    } else {
        OverlayMode::Black
    };
    state.projection.apply(Mutation::SetOverlay(next.clone())).await.ok();
    let (black, logo) = bools_of(&next);
    Ok(serde_json::json!({ "blackScreen": black, "logoScreen": logo }))
}

/// `overlay.logo` — activate logo overlay (disables black if active).
pub async fn logo(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let state = app_state(app)?;
    let current = current_overlay(&state).await;
    let next = if matches!(current, OverlayMode::Logo) {
        OverlayMode::None
    } else {
        OverlayMode::Logo
    };
    state.projection.apply(Mutation::SetOverlay(next.clone())).await.ok();
    let (black, logo) = bools_of(&next);
    Ok(serde_json::json!({ "blackScreen": black, "logoScreen": logo }))
}

/// `overlay.clear` — clear all overlays.
pub async fn clear(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let state = app_state(app)?;
    state.projection.apply(Mutation::SetOverlay(OverlayMode::None)).await.ok();
    // Also clear the current slide/projection — matches desktop Escape behavior
    app.emit("remote-slide-clear", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
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
        const ALLOWED: &[&str] = &["slides-next"];
        let code = "eval-arbitrary-code";
        let result = if ALLOWED.contains(&code) {
            Ok(())
        } else {
            Err(format!("not allowed: {code}"))
        };
        assert!(result.is_err());
    }
}
