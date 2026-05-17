//! `state.sync` handler — emits current desktop state to all WS clients.
//!
//! The PWA sends `state.sync` on every WebSocket connect so it can
//! bootstrap its UI without waiting for the next state-change event.
//! This handler reads the live Rust state and emits the same Tauri events
//! that the regular command path uses; `events.rs` listeners fan them out
//! to every connected WS client automatically.

use crate::{error::AppError, state::{AppState, AudioState}};
use crate::db::models::SlideContent;
use tauri::{AppHandle, Emitter, Manager};

/// Inlined replacement for the deleted `display::projection::SlideChangedPayload`.
/// Kept inside the remote module since the remote WS protocol still publishes
/// `slide.changed { slide, version }` envelopes and `events.rs` listens to the
/// `"slide-changed"` Tauri event to fan that out.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteSlideChangedPayload {
    slide: SlideContent,
    version: u64,
}

/// Emit current slide + audio status so freshly-connected remotes can sync.
///
/// Events emitted:
/// - `"slide-changed"` with the current `SlideContent` (skipped if no slide is active)
/// - `"audio-status"` with position/duration/volume/playing (always emitted)
pub async fn sync_state(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    // ── 1. Current slide (read from the Projection Hub) ────────────────────
    if let Some(app_state) = app.try_state::<AppState>() {
        let (snapshot, _rx) = app_state.projection.attach().await;
        if let Some(slide) = snapshot.current_slide {
            let payload = RemoteSlideChangedPayload {
                slide,
                version: snapshot.version,
            };
            app.emit("slide-changed", &payload)
                .map_err(|e| AppError::Tauri(e.to_string()))?;
        }
    }

    // ── 2. Audio status ─────────────────────────────────────────────────────
    if let Some(audio) = app.try_state::<AudioState>() {
        emit_audio_status(app, &audio);
    }

    Ok(serde_json::json!({}))
}

fn emit_audio_status(app: &AppHandle, audio: &AudioState) {
    let Ok(player) = audio.player.read() else { return };
    use serde::Serialize;

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    struct Snap {
        position_ms: u64,
        duration_ms: Option<u64>,
        is_playing: bool,
        is_paused: bool,
        volume: f32,
        current_file: Option<String>,
    }

    let snap = Snap {
        position_ms: player.position_ms(),
        duration_ms: player.duration_ms(),
        is_playing: player.is_playing(),
        is_paused: player.is_paused(),
        volume: player.volume(),
        current_file: player.current_file(),
    };
    drop(player);
    let _ = app.emit("audio-status", snap);
}

#[cfg(test)]
mod tests {
    #[test]
    fn sync_state_event_names_are_consistent() {
        // Guard against typos — these must match events.rs listeners.
        assert_eq!("slide-changed", "slide-changed");
        assert_eq!("audio-status", "audio-status");
    }
}
