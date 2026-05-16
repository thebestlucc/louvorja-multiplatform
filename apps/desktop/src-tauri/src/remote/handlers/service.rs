//! Service playback handlers for remote WS commands.
//!
//! Strategy: service playback is driven by the frontend `use-liturgy-playback.ts`
//! hook. This handler emits `remote-service-*` events that the main-window React
//! code listens for — keeping the frontend as the single source of truth for
//! service state while allowing remote clients to trigger transitions.

use crate::error::AppError;
use tauri::{AppHandle, Emitter};

/// `service.start { serviceId }` — begin playing a specific service.
pub async fn start(app: &AppHandle, service_id: i64) -> Result<serde_json::Value, AppError> {
    app.emit("remote-service-start", serde_json::json!({ "serviceId": service_id }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `service.stop` — stop playback and clear the active service.
pub async fn stop(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-service-stop", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `service.next_item` — advance to the next service item.
pub async fn next_item(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-service-next", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `service.prev_item` — go back to the previous service item.
pub async fn prev_item(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-service-prev", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `service.jump_to { index }` — jump to a specific item index (0-based).
pub async fn jump_to(app: &AppHandle, index: usize) -> Result<serde_json::Value, AppError> {
    app.emit("remote-service-jump", serde_json::json!({ "index": index }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

#[cfg(test)]
mod tests {
    #[test]
    fn service_event_names_are_kebab_case() {
        // Document the contract: these are the events the frontend must listen for.
        for name in &[
            "remote-service-start",
            "remote-service-stop",
            "remote-service-next",
            "remote-service-prev",
            "remote-service-jump",
        ] {
            assert!(name.starts_with("remote-"), "event should have remote- prefix: {name}");
        }
    }
}
