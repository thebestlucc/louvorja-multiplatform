//! Audio playback handlers for remote WS commands.
//!
//! Strategy: acquire `AudioState` via `app.try_state()` and mirror the same
//! logic as the Tauri command layer (mutate player, emit `audio-status`).
//! This keeps the remote path in sync with the desktop path without duplicating
//! business logic.

use crate::{error::AppError, state::AudioState};
use tauri::{AppHandle, Manager};

const AUDIO_STATUS_EVENT: &str = "audio-status";

fn emit_audio_status_simple(app: &AppHandle, audio: &AudioState) {
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
    use tauri::Emitter;
    let _ = app.emit(AUDIO_STATUS_EVENT, snap);
}

fn audio_state(app: &AppHandle) -> Result<tauri::State<'_, AudioState>, AppError> {
    app.try_state::<AudioState>()
        .ok_or_else(|| AppError::Internal("AudioState not available".into()))
}

/// `audio.pause` — pause playback and emit status.
pub async fn pause(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let audio = audio_state(app)?;
    {
        let player = audio.player.read().map_err(|_| AppError::Internal("lock poisoned".into()))?;
        player.pause();
    }
    emit_audio_status_simple(app, &audio);
    Ok(serde_json::json!({}))
}

/// `audio.resume` (a.k.a. `audio.play`) — resume playback.
pub async fn resume(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let audio = audio_state(app)?;
    {
        let player = audio.player.read().map_err(|_| AppError::Internal("lock poisoned".into()))?;
        player.resume();
    }
    emit_audio_status_simple(app, &audio);
    Ok(serde_json::json!({}))
}

/// `audio.toggle` — pause if playing, resume if paused.
pub async fn toggle(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    let audio = audio_state(app)?;
    {
        let player = audio.player.read().map_err(|_| AppError::Internal("lock poisoned".into()))?;
        if player.is_playing() {
            player.pause();
        } else {
            player.resume();
        }
    }
    emit_audio_status_simple(app, &audio);
    Ok(serde_json::json!({}))
}

/// `audio.seek { ms }` — seek to position.
pub async fn seek(app: &AppHandle, position_ms: u64) -> Result<serde_json::Value, AppError> {
    let audio = audio_state(app)?;
    {
        let player = audio.player.read().map_err(|_| AppError::Internal("lock poisoned".into()))?;
        player.seek(position_ms)?;
    }
    emit_audio_status_simple(app, &audio);
    Ok(serde_json::json!({}))
}

/// `audio.volume { value }` — set volume in 0.0–1.0 range.
pub async fn set_volume(app: &AppHandle, value: f32) -> Result<serde_json::Value, AppError> {
    let audio = audio_state(app)?;
    {
        let mut player = audio.player.write().map_err(|_| AppError::Internal("lock poisoned".into()))?;
        player.set_volume(value);
    }
    emit_audio_status_simple(app, &audio);
    Ok(serde_json::json!({}))
}

/// `audio.skip_next` — advance to the next track in the playing queue.
/// Emits `remote-audio-skip-next` which `use-playback-coordinator.ts` handles.
pub async fn skip_next(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    use tauri::Emitter;
    app.emit("remote-audio-skip-next", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `audio.skip_prev` — go back to the previous track in the playing queue.
/// Emits `remote-audio-skip-prev` which `use-playback-coordinator.ts` handles.
pub async fn skip_prev(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    use tauri::Emitter;
    app.emit("remote-audio-skip-prev", ())
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_status_event_name_matches_backend() {
        assert_eq!(AUDIO_STATUS_EVENT, "audio-status");
    }

    #[test]
    fn volume_range_is_not_validated_here() {
        // Volume clamping is the player's responsibility; handler passes through.
        // Document that callers should send 0.0–1.0.
        let _ = 0.5f32.clamp(0.0, 1.0);
    }
}
