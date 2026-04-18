//! Per-app singleton wiring for the Rust video pipeline.
//!
//! Holds the lazily-built GStreamer pipeline, the [`PlaybackState`] snapshot
//! mirror, and the [`ConsumerRegistry`] of WebRTC fan-out branches. The
//! singleton is instantiated once in `lib.rs` `setup()` and stored on
//! [`AppState::video_pipeline`](crate::state::AppState::video_pipeline).
//!
//! Plan reference: `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 4.1.
#![allow(dead_code)]

use crate::error::AppError;
use crate::video_pipeline::{
    consumer::ConsumerRegistry,
    events::VideoPipelineState,
    pipeline,
    signaling::{AnswerPayload, IcePayload, SignalingChannel},
    state::{PlaybackState, PlaybackStateSnapshot},
};
use gstreamer::{self as gst, prelude::*};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri_specta::Event;

/// 100 ms between state ticks → 10 Hz broadcast rate (Task 2.3).
const BROADCAST_INTERVAL: Duration = Duration::from_millis(100);

/// Process-wide handle for the Rust video pipeline.
///
/// Cheap to clone (an `Arc` of this is what `AppState` actually stores).
/// All public methods take `&self` so it can be shared freely between
/// commands and the signaling channel callbacks.
pub struct VideoPipelineRuntime {
    /// Lazily built on first `load()` (or `subscribe()`). Held as `Option`
    /// so `unload()` can drop it back to `None` and free GStreamer resources.
    pipeline: Mutex<Option<gst::Pipeline>>,
    state: PlaybackState,
    consumers: ConsumerRegistry,
    signaling: Arc<dyn SignalingChannel>,
    /// `Some` in production, `None` in unit tests that bypass `lib.rs` setup.
    app: Option<tauri::AppHandle>,
    /// Set to `true` to signal the running broadcaster thread (if any) to
    /// terminate at its next tick. Reset to `false` whenever a new broadcaster
    /// is spawned. Required by CLAUDE.md error #8 (spawned threads must exit
    /// on app shutdown).
    broadcaster_stop: Arc<AtomicBool>,
    /// `true` while a broadcaster thread is alive — guards against spawning
    /// multiple broadcasters when `play()` is called repeatedly.
    broadcaster_running: Arc<AtomicBool>,
}

impl VideoPipelineRuntime {
    /// Create a new runtime with the supplied signaling channel and Tauri
    /// app handle.
    ///
    /// The handle is kept so the runtime can emit the typed
    /// [`VideoPipelineState`] event from a background broadcaster thread.
    /// Pass `None` from unit tests.
    pub fn new(app: Option<tauri::AppHandle>, signaling: Arc<dyn SignalingChannel>) -> Self {
        Self {
            pipeline: Mutex::new(None),
            state: PlaybackState::new(),
            consumers: ConsumerRegistry::new(),
            signaling,
            app,
            broadcaster_stop: Arc::new(AtomicBool::new(false)),
            broadcaster_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Get-or-create the shared GStreamer pipeline.
    fn get_or_init_pipeline(&self) -> Result<gst::Pipeline, AppError> {
        let mut guard = self.pipeline.lock()?;
        if guard.is_none() {
            *guard = Some(pipeline::build_base_pipeline()?);
        }
        // Safe: just inserted above if it was None.
        Ok(guard.as_ref().expect("pipeline initialized above").clone())
    }

    /// Set the URI on the shared pipeline and transition to PAUSED so
    /// caps + transceivers negotiate before the first `play()`.
    pub fn load(&self, uri: &str) -> Result<(), AppError> {
        let pipeline = self.get_or_init_pipeline()?;
        pipeline::set_source_uri(&pipeline, uri)?;
        pipeline
            .set_state(gst::State::Paused)
            .map_err(|e| AppError::Internal(format!("video_pipeline.load set_state(PAUSED): {e}")))?;
        self.state.load(uri.to_string())?;
        Ok(())
    }

    /// Transition the pipeline (if built) to PLAYING.
    pub fn play(&self) -> Result<(), AppError> {
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            pipeline
                .set_state(gst::State::Playing)
                .map_err(|e| AppError::Internal(format!("video_pipeline.play: {e}")))?;
        }
        drop(guard);
        self.state.play()?;
        // Spawn the 10 Hz broadcaster on the *first* play (or after a previous
        // unload tore it down). Subsequent play() calls are a no-op.
        self.spawn_state_broadcaster();
        Ok(())
    }

    /// Transition the pipeline (if built) to PAUSED.
    pub fn pause(&self) -> Result<(), AppError> {
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            pipeline
                .set_state(gst::State::Paused)
                .map_err(|e| AppError::Internal(format!("video_pipeline.pause: {e}")))?;
        }
        drop(guard);
        self.state.pause()?;
        Ok(())
    }

    /// Seek the pipeline to `secs` (sub-second precision via microseconds).
    pub fn seek(&self, secs: f64) -> Result<(), AppError> {
        let secs = secs.max(0.0);
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            // Convert to microseconds for sub-second precision.
            let useconds = (secs * 1_000_000.0) as u64;
            let position = gst::ClockTime::from_useconds(useconds);
            pipeline
                .seek_simple(
                    gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                    position,
                )
                .map_err(|e| AppError::Internal(format!("video_pipeline.seek: {e}")))?;
        }
        drop(guard);
        self.state.seek(secs)?;
        Ok(())
    }

    /// Update the snapshot's volume.
    ///
    /// TODO(Task 3.x): the base pipeline (Task 1.2) does NOT include a
    /// `volume` element in the audio chain, so this currently mutates only
    /// the snapshot. Phase 3 will add the element + propagate the property.
    pub fn set_volume(&self, volume: f32) -> Result<(), AppError> {
        self.state.set_volume(volume)
    }

    /// Drop the pipeline (set to NULL and free) and reset the snapshot.
    pub fn unload(&self) -> Result<(), AppError> {
        // Signal the broadcaster (if any) to exit BEFORE we tear down the
        // pipeline so it can't observe a half-disposed pipeline.
        self.broadcaster_stop.store(true, Ordering::Relaxed);
        let mut guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.take() {
            pipeline
                .set_state(gst::State::Null)
                .map_err(|e| AppError::Internal(format!("video_pipeline.unload set_state(NULL): {e}")))?;
        }
        drop(guard);
        self.state.unload()
    }

    /// Snapshot the current playback state.
    pub fn snapshot(&self) -> Result<PlaybackStateSnapshot, AppError> {
        self.state.snapshot()
    }

    /// Add (or replace) a WebRTC consumer for `window_label`.
    pub fn subscribe(&self, window_label: &str) -> Result<(), AppError> {
        let pipeline = self.get_or_init_pipeline()?;
        self.consumers
            .subscribe(&pipeline, window_label, self.signaling.clone())
    }

    /// Tear down the WebRTC consumer for `window_label` if present.
    ///
    /// No-op (returns `Ok(())`) when the pipeline has not been built yet.
    pub fn unsubscribe(&self, window_label: &str) -> Result<(), AppError> {
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            let pipeline = pipeline.clone();
            drop(guard);
            self.consumers.unsubscribe(&pipeline, window_label)?;
        }
        Ok(())
    }

    /// Forward an SDP answer to the matching consumer.
    pub fn dispatch_answer(&self, payload: AnswerPayload) -> Result<(), AppError> {
        self.consumers.dispatch_answer(payload)
    }

    /// Forward a remote ICE candidate to the matching consumer.
    pub fn dispatch_ice(&self, payload: IcePayload) -> Result<(), AppError> {
        self.consumers.dispatch_ice(payload)
    }

    /// Spawn the 10 Hz broadcaster thread if none is running and we have a
    /// Tauri app handle. Idempotent — repeated calls are a no-op.
    ///
    /// The thread polls position/duration/state from the live pipeline plus
    /// volume from the snapshot, emits a [`VideoPipelineState`] event each
    /// tick, and exits cleanly when either:
    /// - `broadcaster_stop` is set (`unload()` or app shutdown),
    /// - the pipeline slot drops to `None`.
    fn spawn_state_broadcaster(&self) {
        // No app handle in unit tests — emit would have nowhere to go.
        let Some(app) = self.app.clone() else {
            return;
        };
        // CAS so only the first concurrent caller wins.
        if self
            .broadcaster_running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        // Reset the stop flag for this new lifecycle.
        self.broadcaster_stop.store(false, Ordering::Relaxed);

        let stop_flag = self.broadcaster_stop.clone();
        let running_flag = self.broadcaster_running.clone();
        // The runtime lives inside an `Arc<VideoPipelineRuntime>` on `AppState`.
        // Re-fetch that Arc through the AppHandle on each tick rather than
        // aliasing `self.pipeline` directly — `&self` can't outlive this call.
        let app_for_thread = app.clone();

        std::thread::spawn(move || {
            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }

                // Snapshot pipeline + volume by re-borrowing the runtime.
                let runtime = match runtime_from_app(&app_for_thread) {
                    Some(rt) => rt,
                    None => break,
                };

                let (position_secs, duration_secs, paused, pipeline_present) = {
                    let guard = match runtime.pipeline.lock() {
                        Ok(g) => g,
                        Err(_) => break,
                    };
                    if let Some(pipeline) = guard.as_ref() {
                        let pos = pipeline
                            .query_position::<gst::ClockTime>()
                            .map(|t| t.useconds() as f64 / 1_000_000.0)
                            .unwrap_or(0.0);
                        let dur = pipeline
                            .query_duration::<gst::ClockTime>()
                            .map(|t| t.useconds() as f64 / 1_000_000.0)
                            .unwrap_or(0.0);
                        let cur = pipeline.current_state();
                        let paused = cur != gst::State::Playing;
                        (pos, dur, paused, true)
                    } else {
                        (0.0, 0.0, true, false)
                    }
                };

                if !pipeline_present {
                    // Pipeline gone (unload after a play); stop broadcasting.
                    break;
                }

                let volume = runtime
                    .state
                    .snapshot()
                    .map(|s| s.volume)
                    .unwrap_or(0.0);

                let event = VideoPipelineState {
                    position_secs,
                    duration_secs,
                    paused,
                    volume,
                };
                if let Err(e) = event.emit(&app_for_thread) {
                    log::warn!("video_pipeline VideoPipelineState emit failed: {e}");
                }

                std::thread::sleep(BROADCAST_INTERVAL);
            }
            running_flag.store(false, Ordering::Relaxed);
        });
    }
}

/// Resolve the singleton runtime from the Tauri app state. Returns `None`
/// when the runtime hasn't been initialised (should never happen at runtime
/// past `setup()` but we treat absence as a clean shutdown signal).
fn runtime_from_app(app: &tauri::AppHandle) -> Option<Arc<VideoPipelineRuntime>> {
    use tauri::Manager;
    let state = app.try_state::<crate::state::AppState>()?;
    state.video_pipeline.as_ref().cloned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::video_pipeline::signaling::NoopSignalingChannel;

    fn runtime() -> VideoPipelineRuntime {
        let signaling: Arc<dyn SignalingChannel> = Arc::new(NoopSignalingChannel);
        VideoPipelineRuntime::new(None, signaling)
    }

    #[test]
    fn snapshot_starts_default() {
        let rt = runtime();
        let snap = rt.snapshot().expect("snapshot");
        assert!(snap.uri.is_none());
        assert_eq!(snap.position_secs, 0.0);
    }

    #[test]
    fn set_volume_clamps_to_unit_range() {
        let rt = runtime();
        rt.set_volume(2.5).expect("set_volume");
        assert_eq!(rt.snapshot().expect("snapshot").volume, 1.0);
        rt.set_volume(-0.1).expect("set_volume");
        assert_eq!(rt.snapshot().expect("snapshot").volume, 0.0);
    }

    #[test]
    fn unload_resets_snapshot_without_pipeline() {
        let rt = runtime();
        // No pipeline built yet; unload should still succeed and reset snapshot.
        rt.set_volume(0.5).expect("set_volume");
        rt.unload().expect("unload");
        assert_eq!(rt.snapshot().expect("snapshot").volume, 0.0);
    }

    #[test]
    fn unsubscribe_without_pipeline_is_noop() {
        let rt = runtime();
        rt.unsubscribe("ghost").expect("unsubscribe is no-op");
    }

    #[test]
    fn broadcaster_does_not_spawn_without_app_handle() {
        let rt = runtime();
        // Without an AppHandle the broadcaster must short-circuit; play() should
        // still succeed and the running flag must remain false.
        rt.spawn_state_broadcaster();
        assert!(!rt.broadcaster_running.load(Ordering::Relaxed));
    }
}
