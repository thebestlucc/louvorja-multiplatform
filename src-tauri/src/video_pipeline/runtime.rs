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
    events::{VideoPipelineEnded, VideoPipelineState},
    pipeline,
    signaling::{AnswerPayload, IcePayload, SignalingChannel},
    state::{LoopMode, PlaybackState, PlaybackStateSnapshot},
};
use gstreamer::{self as gst, prelude::*};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri_specta::Event;

/// 100 ms between state ticks → 10 Hz broadcast rate (Task 2.3).
const BROADCAST_INTERVAL: Duration = Duration::from_millis(100);

/// Blocking timeout for bus message polling (Task 3.1). 500 ms keeps the EOS
/// latency well under a video-frame boundary while letting the thread exit
/// promptly on shutdown.
const BUS_POLL_TIMEOUT: Duration = Duration::from_millis(500);

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
    /// Set to `true` to signal the bus watcher thread (Task 3.1) to exit at
    /// the next poll boundary. Same shutdown contract as `broadcaster_stop`.
    bus_watcher_stop: Arc<AtomicBool>,
    /// `true` while a bus watcher thread is alive. Guards against spawning
    /// duplicate watchers when `load()` is called repeatedly.
    bus_watcher_running: Arc<AtomicBool>,
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
            bus_watcher_stop: Arc::new(AtomicBool::new(false)),
            bus_watcher_running: Arc::new(AtomicBool::new(false)),
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
    ///
    /// Task 3.2: when a URI was previously loaded, cycle the pipeline through
    /// NULL before swapping the URI. That forces `uridecodebin` to release
    /// its internal decoders + auto-plugged pads from the previous stream —
    /// simply re-setting the `uri` property leaves stale elements behind and
    /// can fail or produce stale output on the next load. The `vtee` and any
    /// attached `webrtcbin` consumer branches are separate elements in the
    /// pipeline topology; they stay linked across the NULL→PAUSED transition.
    pub fn load(&self, uri: &str) -> Result<(), AppError> {
        let pipeline = self.get_or_init_pipeline()?;

        // If a URI was previously set, tear the pipeline down to NULL first
        // so uridecodebin releases its internal decoders + src pads cleanly.
        let had_previous_uri = self.state.snapshot()?.uri.is_some();
        if had_previous_uri {
            pipeline
                .set_state(gst::State::Null)
                .map_err(|e| {
                    AppError::Internal(format!("video_pipeline.load set_state(NULL): {e}"))
                })?;
            // Wait for the NULL transition to complete before swapping the URI
            // so uridecodebin is fully torn down (async state changes are
            // otherwise queued and race with the URI swap on internal pads).
            let (change_result, _current, _pending) = pipeline.state(gst::ClockTime::NONE);
            change_result.map_err(|e| {
                AppError::Internal(format!("video_pipeline.load NULL state wait: {e}"))
            })?;
            // Drain any pending bus messages queued from the previous URI
            // (stale EOS, async-done, errors) so the re-armed bus watcher at
            // the end of load() starts fresh. Without this, a stale EOS from
            // the prior URI would fire on_eos() → emit VideoPipelineEnded →
            // coordinator calls queueStore.next() and skips the new video.
            if let Some(bus) = pipeline.bus() {
                while bus.pop().is_some() {
                    // Discard.
                }
            }
        }

        pipeline::set_source_uri(&pipeline, uri)?;
        pipeline
            .set_state(gst::State::Paused)
            .map_err(|e| AppError::Internal(format!("video_pipeline.load set_state(PAUSED): {e}")))?;
        self.state.load(uri.to_string())?;
        // Task 3.1: start the bus watcher if it isn't already running so we
        // can observe EOS and either re-seek (loop=one) or emit the ended
        // event. Idempotent — no-op when already alive.
        //
        // Task 3.2: respawn is critical here. After a prior `on_eos` fired in
        // `LoopMode::None`, the watcher set `bus_watcher_stop=true` and the
        // worker exited. Without this call, the next load() would have no
        // EOS detection armed and the queue-advance path would never fire.
        // The CAS inside `spawn_bus_watcher` keeps this idempotent when the
        // watcher is still alive from an earlier load.
        self.spawn_bus_watcher();
        // Task 3.2: also ensure the state broadcaster is alive. Normally it's
        // spawned in `play()` which follows load() on the queue-advance path,
        // but respawn-on-load is cheap (CAS-guarded) and makes load() self-
        // sufficient for tests / callers that pause-then-subscribe.
        self.spawn_state_broadcaster();
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

    /// Update playback volume on the live audio chain AND mirror to the
    /// snapshot so the 10 Hz broadcaster keeps the UI in sync.
    ///
    /// The input is clamped to `[0.0, 1.0]` (we don't expose >1.0 gain yet)
    /// and pushed as an `f64` onto the `audio_volume` element's `volume`
    /// property. When the pipeline hasn't been built yet (first call before
    /// `load()`), the property-set is a no-op and only the snapshot updates.
    pub fn set_volume(&self, volume: f32) -> Result<(), AppError> {
        let clamped = volume.clamp(0.0, 1.0);
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            if let Some(elem) = pipeline.by_name("audio_volume") {
                elem.set_property("volume", clamped as f64);
            }
        }
        drop(guard);
        self.state.set_volume(volume)
    }

    /// Update the loop mode (Task 3.1).
    pub fn set_loop(&self, mode: LoopMode) -> Result<(), AppError> {
        self.state.set_loop(mode)
    }

    /// Seek to 0 and ensure the pipeline is PLAYING (Task 3.1).
    ///
    /// Matches the legacy pause → seek → play sequence but collapsed server-
    /// side so the frontend doesn't need to issue three round trips.
    pub fn restart(&self) -> Result<(), AppError> {
        self.seek(0.0)?;
        self.play()
    }

    /// Bus-watcher callback for end-of-stream (Task 3.1).
    ///
    /// Loop one → re-seek to 0 and stay in PLAYING. Loop none → emit the
    /// typed [`VideoPipelineEnded`] event so the frontend can advance the
    /// queue.
    fn on_eos(&self) {
        let mode = match self.state.loop_mode() {
            Ok(m) => m,
            Err(e) => {
                log::warn!("video_pipeline: on_eos loop_mode read failed: {e}");
                return;
            }
        };

        match mode {
            LoopMode::One => {
                if let Err(e) = self.seek(0.0) {
                    log::warn!("video_pipeline: on_eos seek(0) failed: {e}");
                }
                if let Err(e) = self.play() {
                    log::warn!("video_pipeline: on_eos play() failed: {e}");
                }
            }
            LoopMode::None => {
                if let Some(app) = self.app.as_ref() {
                    let event = VideoPipelineEnded {};
                    if let Err(e) = event.emit(app) {
                        log::warn!("video_pipeline: VideoPipelineEnded emit failed: {e}");
                    }
                }
                // After emitting Ended, stop the bus watcher — the bus retains
                // the EOS message, so the next timed_pop would re-fire on_eos
                // in a loop.
                self.bus_watcher_stop.store(true, Ordering::SeqCst);
            }
        }
    }

    /// Drop the pipeline (set to NULL and free) and reset the snapshot.
    pub fn unload(&self) -> Result<(), AppError> {
        // Signal background threads to exit BEFORE we tear down the pipeline
        // so they can't observe a half-disposed pipeline. SeqCst pairs with
        // the spawn-side reset + CAS to give total ordering across the race.
        self.broadcaster_stop.store(true, Ordering::SeqCst);
        self.bus_watcher_stop.store(true, Ordering::SeqCst);
        let mut guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.take() {
            pipeline
                .set_state(gst::State::Null)
                .map_err(|e| AppError::Internal(format!("video_pipeline.unload set_state(NULL): {e}")))?;
            // Wait for NULL transition to complete before dropping the
            // pipeline so uridecodebin finishes tearing down its decoders.
            let (change_result, _current, _pending) = pipeline.state(gst::ClockTime::NONE);
            change_result.map_err(|e| {
                AppError::Internal(format!("video_pipeline.unload NULL state wait: {e}"))
            })?;
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
        // Reset the stop flag BEFORE the CAS so a racing unload() that sets
        // stop=true always wins (SeqCst gives total ordering).
        self.broadcaster_stop.store(false, Ordering::SeqCst);
        // CAS so only the first concurrent caller wins.
        if self
            .broadcaster_running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let stop_flag = self.broadcaster_stop.clone();
        let running_flag = self.broadcaster_running.clone();
        // The runtime lives inside an `Arc<VideoPipelineRuntime>` on `AppState`.
        // Re-fetch that Arc through the AppHandle on each tick rather than
        // aliasing `self.pipeline` directly — `&self` can't outlive this call.
        let app_for_thread = app.clone();

        std::thread::spawn(move || {
            loop {
                if stop_flag.load(Ordering::SeqCst) {
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
            running_flag.store(false, Ordering::SeqCst);
        });
    }

    /// Spawn the EOS bus-watcher thread if none is running (Task 3.1).
    ///
    /// Polls `pipeline.bus().timed_pop(500 ms)` in a loop. Exits cleanly when
    /// `bus_watcher_stop` is set (unload/app shutdown) or when the pipeline
    /// slot is cleared. EOS messages dispatch to [`Self::on_eos`].
    ///
    /// We avoid `bus.add_watch(...)` + `BusWatchGuard` because that path needs
    /// a running GLib main loop, which we don't own. The timed-pop pattern
    /// mirrors the 10 Hz broadcaster's shutdown contract.
    fn spawn_bus_watcher(&self) {
        if self.app.is_none() {
            // Without an AppHandle we can't re-fetch the runtime; unit tests
            // bypass this path.
            return;
        }
        // Reset the stop flag BEFORE the CAS so a racing unload() that sets
        // stop=true always wins (SeqCst gives total ordering).
        self.bus_watcher_stop.store(false, Ordering::SeqCst);
        if self
            .bus_watcher_running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let stop_flag = self.bus_watcher_stop.clone();
        let running_flag = self.bus_watcher_running.clone();
        let app_for_thread = self
            .app
            .as_ref()
            .expect("app handle checked above")
            .clone();

        std::thread::spawn(move || {
            loop {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }

                // Re-fetch the runtime on each iteration so we don't alias
                // `self` across threads.
                let runtime = match runtime_from_app(&app_for_thread) {
                    Some(rt) => rt,
                    None => break,
                };

                // Snapshot the bus (cloneable) without holding the pipeline
                // lock across the blocking `timed_pop`.
                let bus = {
                    let guard = match runtime.pipeline.lock() {
                        Ok(g) => g,
                        Err(_) => break,
                    };
                    match guard.as_ref() {
                        Some(pipeline) => pipeline.bus(),
                        None => None,
                    }
                };
                let bus = match bus {
                    Some(b) => b,
                    None => break,
                };

                if let Some(msg) = bus.timed_pop(gst::ClockTime::from_mseconds(
                    BUS_POLL_TIMEOUT.as_millis() as u64,
                )) {
                    match msg.view() {
                        gst::MessageView::Eos(_) => runtime.on_eos(),
                        gst::MessageView::Error(err) => {
                            // Surface async pipeline failures (HTTP 403 from
                            // expired yt-dlp URLs, missing codecs, etc.)
                            // that would otherwise be swallowed silently.
                            let src = err
                                .src()
                                .map(|s| s.path_string().to_string())
                                .unwrap_or_else(|| "<unknown>".into());
                            log::warn!(
                                "video_pipeline bus ERROR from {src}: {} ({:?})",
                                err.error(),
                                err.debug()
                            );
                        }
                        gst::MessageView::Warning(w) => {
                            let src = w
                                .src()
                                .map(|s| s.path_string().to_string())
                                .unwrap_or_else(|| "<unknown>".into());
                            log::warn!(
                                "video_pipeline bus WARNING from {src}: {} ({:?})",
                                w.error(),
                                w.debug()
                            );
                        }
                        _ => {}
                    }
                }
            }
            running_flag.store(false, Ordering::SeqCst);
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
        assert_eq!(rt.snapshot().expect("snapshot").volume, 1.0);
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

    #[test]
    fn set_loop_round_trips_through_runtime() {
        let rt = runtime();
        rt.set_loop(LoopMode::One).expect("set_loop");
        assert_eq!(rt.snapshot().expect("snapshot").loop_mode, LoopMode::One);
        rt.set_loop(LoopMode::None).expect("set_loop");
        assert_eq!(rt.snapshot().expect("snapshot").loop_mode, LoopMode::None);
    }

    #[test]
    fn unload_resets_loop_mode_through_runtime() {
        let rt = runtime();
        rt.set_loop(LoopMode::One).expect("set_loop");
        rt.unload().expect("unload");
        assert_eq!(rt.snapshot().expect("snapshot").loop_mode, LoopMode::None);
    }

    #[test]
    fn bus_watcher_does_not_spawn_without_app_handle() {
        let rt = runtime();
        // `spawn_bus_watcher` is a no-op when there's no AppHandle to re-fetch
        // the runtime from. The running flag must stay false.
        rt.spawn_bus_watcher();
        assert!(!rt.bus_watcher_running.load(Ordering::Relaxed));
    }

    #[test]
    fn bus_watcher_spawn_is_idempotent_without_app_handle() {
        // Task 3.2: load() calls spawn_bus_watcher() on every invocation so
        // the watcher re-arms after a prior LoopMode::None EOS shut it down.
        // Without an app handle the spawn is a no-op — the key invariant is
        // that repeated calls leave the running flag false (no orphan threads).
        let rt = runtime();
        rt.spawn_bus_watcher();
        rt.spawn_bus_watcher();
        rt.spawn_bus_watcher();
        assert!(!rt.bus_watcher_running.load(Ordering::Relaxed));
    }
}
