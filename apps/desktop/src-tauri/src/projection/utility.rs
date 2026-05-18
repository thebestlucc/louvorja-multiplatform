use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::Sender;
use tauri::{AppHandle, Emitter, Manager};

static PROJECTION_SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UtilityProjectionEventPayload {
    pub phase: String,
    pub session_id: String,
    pub kind: String,
    pub value_ms: u64,
    pub use_24_hour: bool,
    pub show_date: bool,
}

pub fn new_projection_session_id(kind: &str) -> String {
    let counter = PROJECTION_SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!(
        "{}-{}-{}",
        kind,
        chrono::Utc::now().timestamp_millis(),
        counter
    )
}

pub fn stop_live_utility_projection(state: &AppState) -> Result<(), AppError> {
    let mut stop_guard = state
        .utility_projection_stop
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if let Some(sender) = stop_guard.take() {
        let _ = sender.send(());
    }

    Ok(())
}

pub fn register_live_utility_projection_sender(
    state: &AppState,
    sender: Sender<()>,
) -> Result<(), AppError> {
    stop_live_utility_projection(state)?;

    let mut stop_guard = state
        .utility_projection_stop
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *stop_guard = Some(sender);

    Ok(())
}

pub fn emit_utility_projection_event(
    app: &AppHandle,
    payload: &UtilityProjectionEventPayload,
) -> Result<(), AppError> {
    app.emit("utility-projection", payload)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    if let Some(streaming_state) = app.try_state::<StreamingState>() {
        if let Ok(server) = streaming_state.server.lock() {
            if let Ok(json) = serde_json::to_string(payload) {
                server.broadcast_utility(&json);

                if payload.phase == "start" || payload.phase == "tick" || payload.phase == "stop" {
                    let envelope = serde_json::json!({
                        "utilityProjection": payload,
                    });
                    server.broadcast_music_transient(&envelope.to_string());
                    server.broadcast_return_transient(&envelope.to_string());
                }
            }
        }
    }

    Ok(())
}
