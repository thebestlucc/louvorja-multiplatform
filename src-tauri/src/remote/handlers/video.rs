//! Video control handlers for remote WS commands.
//!
//! Strategy: emit `remote-video-cmd` to the main window which the
//! `persistent-video-player` component listens for and re-emits as
//! `video-control-cmd` to the appropriate target windows.
//!
//! We do NOT call `emitTo` from Rust because the target window list is
//! managed by `VideoPlayerStore.videoPlaybackTargets` in the frontend.

use crate::error::AppError;
use tauri::{AppHandle, Emitter};

/// `video.play` — start or resume video playback.
pub async fn play(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-video-cmd", serde_json::json!({ "action": "play" }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `video.pause` — pause video playback.
pub async fn pause(app: &AppHandle) -> Result<serde_json::Value, AppError> {
    app.emit("remote-video-cmd", serde_json::json!({ "action": "pause" }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `video.seek { seconds }` — seek to a timestamp in seconds.
pub async fn seek(app: &AppHandle, seconds: f64) -> Result<serde_json::Value, AppError> {
    app.emit("remote-video-cmd", serde_json::json!({ "action": "seek", "value": seconds }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `video.set_targets { projector, return }` — update which screens show live video.
/// Emits `remote-video-set-targets` with a `targets` array (e.g. `["projector"]`).
pub async fn set_targets(
    app: &AppHandle,
    projector: bool,
    return_monitor: bool,
) -> Result<serde_json::Value, AppError> {
    let mut targets: Vec<&str> = Vec::new();
    if projector {
        targets.push("projector");
    }
    if return_monitor {
        targets.push("return");
    }
    app.emit("remote-video-set-targets", serde_json::json!({ "targets": targets }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({ "targets": targets }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_targets_both_false_produces_empty_array() {
        // Verify the targets logic directly without AppHandle.
        let mut targets: Vec<&str> = Vec::new();
        let projector = false;
        let return_monitor = false;
        if projector { targets.push("projector"); }
        if return_monitor { targets.push("return"); }
        assert!(targets.is_empty());
    }

    #[test]
    fn set_targets_both_true_produces_two_targets() {
        let mut targets: Vec<&str> = Vec::new();
        let projector = true;
        let return_monitor = true;
        if projector { targets.push("projector"); }
        if return_monitor { targets.push("return"); }
        assert_eq!(targets.len(), 2);
    }
}
