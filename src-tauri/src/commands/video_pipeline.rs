//! Tauri commands for the Rust video pipeline
//! (see `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 4.1).
//!
//! These commands route IPC traffic into the [`VideoPipelineRuntime`] held on
//! [`AppState::video_pipeline`](crate::state::AppState::video_pipeline). The
//! runtime is created in `lib.rs` `setup()` after the AppState is built.
//!
//! Long-running operations (currently only YouTube URL resolution via
//! `yt-dlp`) are wrapped in `std::thread::spawn` to avoid blocking the IPC
//! bridge — the main loop must stay responsive.
//!
//! `video_pipeline_set_loop` parses `"none"` / `"one"` into [`LoopMode`] and
//! delegates to the runtime (Task 3.1). `video_pipeline_restart` collapses
//! the legacy pause → seek(0) → play trio into a single server call.

use crate::error::AppError;
use crate::state::AppState;
use crate::video_pipeline::{
    runtime::VideoPipelineRuntime,
    signaling::{AnswerPayload, IcePayload},
    source::MediaSource,
    state::LoopMode,
};
use std::sync::Arc;
use tauri::Manager;

/// Borrow the runtime out of `AppState`.
fn runtime<'a>(
    state: &'a tauri::State<'_, AppState>,
) -> Result<Arc<VideoPipelineRuntime>, AppError> {
    state
        .video_pipeline
        .as_ref()
        .cloned()
        .ok_or_else(|| AppError::Internal("video pipeline runtime not initialized".into()))
}

/// Resolve `source` to a GStreamer URI and load it on the pipeline.
///
/// YouTube sources require shelling out to `yt-dlp` for streaming URL
/// resolution, which can take a few seconds. The resolution + load runs on a
/// dedicated thread so the IPC reply returns immediately.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_load(
    source: MediaSource,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let runtime = runtime(&state)?;

    // Resolve fully on a worker thread; both yt-dlp probing and the
    // GStreamer state transition can briefly block.
    //
    // Auto-play after load completes so the frontend doesn't race against
    // this thread by issuing a separate `play()` IPC call (which would run
    // before the URI is set, get dropped against an empty pipeline, then
    // get overridden when this thread transitions to PAUSED).
    let app_for_thread = app.clone();
    std::thread::spawn(move || {
        let result = (|| -> Result<(), AppError> {
            let app_data_dir = app_for_thread
                .path()
                .app_data_dir()
                .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {e}")))?;

            let uri = match &source {
                MediaSource::Local { .. } => {
                    // No yt-dlp needed; use a dummy path (resolve_uri ignores
                    // it for the Local variant).
                    source.resolve_uri(std::path::Path::new(""))?
                }
                MediaSource::Youtube { .. } => {
                    let binary_path = crate::ytdlp::binary::ensure_binary(&app_data_dir)?;
                    source.resolve_uri(&binary_path)?
                }
            };

            runtime.load(&uri)?;
            runtime.play()
        })();

        if let Err(e) = result {
            log::warn!("video_pipeline_load failed: {e}");
        }
    });

    Ok(())
}

/// Transition the pipeline to PLAYING.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_play(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    runtime(&state)?.play()
}

/// Transition the pipeline to PAUSED.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_pause(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    runtime(&state)?.pause()
}

/// Seek to `secs` (sub-second precision via microseconds).
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_seek(secs: f64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    runtime(&state)?.seek(secs)
}

/// Update playback volume (0.0–1.0). Sets the `volume` property on the live
/// `audio_volume` element and mirrors to the state snapshot.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_set_volume(
    volume: f32,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    runtime(&state)?.set_volume(volume)
}

/// Set the loop mode (Task 3.1). Accepts `"none"` or `"one"`.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_set_loop(
    loop_mode: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let mode = match loop_mode.as_str() {
        "none" => LoopMode::None,
        "one" => LoopMode::One,
        other => {
            return Err(AppError::Internal(format!(
                "video_pipeline_set_loop: unknown loop mode '{other}' (expected 'none' or 'one')"
            )));
        }
    };
    runtime(&state)?.set_loop(mode)
}

/// Seek to 0 and resume PLAYING (Task 3.1).
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_restart(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    runtime(&state)?.restart()
}

/// Attach a WebRTC consumer for `window_label`. Triggers an SDP offer to
/// flow back through the [`VideoPipelineOffer`](crate::video_pipeline::events::VideoPipelineOffer)
/// event once the upstream caps reach the encoder.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_subscribe(
    window_label: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    runtime(&state)?.subscribe(&window_label)
}

/// Tear down the WebRTC consumer for `window_label`.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_unsubscribe(
    window_label: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    runtime(&state)?.unsubscribe(&window_label)
}

/// Forward an SDP answer from the frontend `RTCPeerConnection`.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_answer(
    window_label: String,
    sdp: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    runtime(&state)?.dispatch_answer(AnswerPayload { window_label, sdp })
}

/// Forward a remote ICE candidate from the frontend `RTCPeerConnection`.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_ice(
    window_label: String,
    candidate: String,
    sdp_m_line_index: u32,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    runtime(&state)?.dispatch_ice(IcePayload {
        window_label,
        candidate,
        sdp_m_line_index,
    })
}

/// Tear down the pipeline and reset the snapshot.
#[tauri::command]
#[specta::specta]
pub fn video_pipeline_unload(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    runtime(&state)?.unload()
}
