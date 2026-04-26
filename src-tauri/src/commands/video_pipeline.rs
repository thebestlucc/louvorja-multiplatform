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
use tauri::{Emitter, Manager};

/// Tauri event name for asynchronous load failures from `video_pipeline_load`.
///
/// The event is emitted from the load worker thread (not the IPC reply path)
/// because `video_pipeline_load` returns `Ok(())` synchronously to keep the
/// IPC bridge unblocked. Frontend listeners (Agent A's
/// `use-rust-video-pipeline-state.ts`) translate the payload into a toast.
///
/// Payload shape: `{ kind: "not_found" | "internal", message: string }`.
/// Locked down by integration with the frontend listener — change at your
/// peril (CONTRACT).
const VIDEO_PIPELINE_ERROR_EVENT: &str = "video-pipeline-error";

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
            // B6 fix: surface the failure to the frontend via a Tauri event.
            // Previously errors were only logged → silent failures (e.g. a
            // deleted local download or a bad YouTube URL) just left the UI
            // hanging in a spinner forever. Frontend listener translates the
            // structured payload into a localized toast.
            //
            // Event name + payload shape are part of the cross-agent contract
            // (Agent A's listener depends on them); see
            // `VIDEO_PIPELINE_ERROR_EVENT` doc above.
            let kind = match &e {
                AppError::NotFound(_) => "not_found",
                _ => "internal",
            };
            let payload = serde_json::json!({
                "kind": kind,
                "message": e.to_string(),
            });
            if let Err(emit_err) = app_for_thread.emit(VIDEO_PIPELINE_ERROR_EVENT, payload) {
                log::warn!(
                    "video_pipeline_load: failed to emit {VIDEO_PIPELINE_ERROR_EVENT}: {emit_err}"
                );
            }
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

/// Attach a native GStreamer sink to the window with `label` so the shared
/// pipeline renders directly into its OS surface (Phase 2 of
/// `docs/plans/2026-04-25-frame-perfect-multi-monitor-video.md`).
///
/// Coexists with [`video_pipeline_subscribe`]; the frontend gates which path
/// is active during the migration window. `attach_window` is idempotent —
/// re-attaching the same label detaches the previous chain first.
///
/// Window-handle resolution must run on the main thread because AppKit
/// (`NSView*`) and X11/Wayland surface accessors aren't safe to read off it.
/// We hop onto the main thread via [`tauri::AppHandle::run_on_main_thread`]
/// and ferry only a plain `usize` back across an `mpsc::channel` so nothing
/// `!Send` (e.g. `NonNull<c_void>` inside `AppKitWindowHandle`) crosses the
/// thread boundary.
#[tauri::command]
#[specta::specta]
pub async fn video_pipeline_attach_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    label: String,
) -> Result<(), AppError> {
    let runtime = runtime(&state)?;

    // Capture the runtime-agnostic state we need to validate up front. We
    // resolve the WebviewWindow on the main thread below; here we only check
    // its existence so we can return a clean `NotFound` if the caller asked
    // for a label that isn't registered.
    if app.get_webview_window(&label).is_none() {
        return Err(AppError::NotFound(format!(
            "video_pipeline_attach_window: window '{label}' not found"
        )));
    }

    let (tx, rx) = std::sync::mpsc::channel::<Result<usize, AppError>>();
    let app_for_main = app.clone();
    let label_for_main = label.clone();
    app.run_on_main_thread(move || {
        let result = (|| -> Result<usize, AppError> {
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            let window = app_for_main.get_webview_window(&label_for_main).ok_or_else(|| {
                AppError::NotFound(format!(
                    "video_pipeline_attach_window: window '{label_for_main}' not found"
                ))
            })?;
            let handle = window
                .window_handle()
                .map_err(|e| AppError::Internal(format!("window_handle() failed: {e}")))?;
            // Convert the platform-specific handle to an opaque `usize` here on
            // the main thread so nothing `!Send` escapes the closure.
            let raw = handle.as_raw();
            match raw {
                #[cfg(target_os = "macos")]
                RawWindowHandle::AppKit(h) => Ok(h.ns_view.as_ptr() as usize),
                #[cfg(target_os = "windows")]
                RawWindowHandle::Win32(h) => Ok(h.hwnd.get() as usize),
                #[cfg(any(
                    target_os = "linux",
                    target_os = "freebsd",
                    target_os = "dragonfly",
                    target_os = "netbsd",
                    target_os = "openbsd"
                ))]
                RawWindowHandle::Xlib(h) => Ok(h.window as usize),
                #[cfg(any(
                    target_os = "linux",
                    target_os = "freebsd",
                    target_os = "dragonfly",
                    target_os = "netbsd",
                    target_os = "openbsd"
                ))]
                RawWindowHandle::Wayland(h) => Ok(h.surface.as_ptr() as usize),
                other => Err(AppError::Internal(format!(
                    "unsupported window handle type: {other:?}"
                ))),
            }
        })();
        let _ = tx.send(result);
    })
    .map_err(|e| AppError::Tauri(format!("run_on_main_thread failed: {e}")))?;

    let handle_usize = rx
        .recv()
        .map_err(|e| AppError::Internal(format!("main-thread channel closed: {e}")))??;

    runtime.attach_window(&label, handle_usize)
}

/// Detach the native sink for `label`. Companion to
/// [`video_pipeline_attach_window`].
///
/// Returns `Ok(())` when the pipeline runtime hasn't been initialised yet —
/// matches `unsubscribe`'s shutdown contract so frontend cleanup paths can
/// fire blindly without races.
#[tauri::command]
#[specta::specta]
pub async fn video_pipeline_detach_window(
    state: tauri::State<'_, AppState>,
    label: String,
) -> Result<(), AppError> {
    // Mirror `video_pipeline_unsubscribe`: if the pipeline runtime is absent
    // (e.g. GStreamer init failed at startup), treat detach as a no-op so
    // teardown paths don't surface confusing errors after the fact.
    let Some(runtime) = state.video_pipeline.as_ref().cloned() else {
        return Ok(());
    };
    runtime.detach_window(&label)
}

/// Broadcast the `useRustVideoPipeline` flag value to every webview from
/// Rust core via `app.emit(...)`.
///
/// Why this command exists (P3.12): the frontend `emit()` from
/// `@tauri-apps/api/event` IS broadcast across webviews in Tauri 2 (it
/// calls `plugin:event|emit` which delegates to `app.emit`), so in theory
/// the same effect could be achieved purely from JS. We funnel through Rust
/// anyway because:
///
/// 1. **Ordering**: a single Rust command lets the frontend `await` the
///    completion of disk-persist + broadcast in one round-trip — eliminating
///    the prior race where a follower window could re-read disk before the
///    main window's async `setPreference()` finished writing.
/// 2. **Single source of truth**: the same Rust function can be called by
///    other backend code paths (e.g. settings sync, remote-pwa toggles) so
///    the broadcast contract isn't duplicated.
/// 3. **Diagnostics**: a `log::debug!` line here gives us a definitive
///    server-side trace of "the broadcast did fire", separating the disk
///    write step from the listener delivery step when debugging.
///
/// Event name and payload shape match the listener in
/// `src/stores/video-player-store.ts::startVideoPlayerCrossWindowSync` —
/// CHANGE BOTH OR NEITHER.
#[tauri::command]
#[specta::specta]
pub fn set_video_pipeline_flag(
    app: tauri::AppHandle,
    value: bool,
) -> Result<(), AppError> {
    log::debug!("set_video_pipeline_flag: broadcasting useRustVideoPipeline={value}");
    app.emit(
        "video-pipeline:flag-changed",
        serde_json::json!({ "useRustVideoPipeline": value }),
    )
    .map_err(|e| AppError::Internal(format!("emit flag-changed failed: {e}")))?;
    Ok(())
}
