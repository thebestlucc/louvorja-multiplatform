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
    pipeline::{self, PadReadiness},
    signaling::{AnswerPayload, IcePayload, SignalingChannel},
    state::{LoopMode, PlaybackState, PlaybackStateSnapshot},
};
use gstreamer::{self as gst, prelude::*};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tauri_specta::Event;

/// Tauri event name for "first audio buffer flowed through the pipeline" /
/// "new load just started — drop pending state". Emitted from `load()` with
/// `{ ready: bool }`. Frontend listener (use-rust-video-pipeline-state.ts)
/// drives the projection-window slide buffer that holds back onlineVideo
/// slides until the pipeline is actually producing samples — without this,
/// the operator sees a black gap between "click project" and "first frame".
const VIDEO_PIPELINE_FRAME_READY_EVENT: &str = "video-pipeline-frame-ready";

/// Bound on `PadReadiness::wait_for_pads` inside `load()`.
///
/// uridecodebin emits `no-more-pads` after stream discovery completes.
/// 2 s is generous for local files (typically <50 ms) and HTTP (typically
/// <500 ms) without making "stuck pipeline" diagnostics impossibly slow.
/// On timeout we proceed anyway — the pipeline reaching PAUSED via AsyncDone
/// is the primary readiness signal; this is belt-and-suspenders for the
/// audio-pad race documented in P3.8 fix S2.
const PAD_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(2);

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
    /// Tracks `uridecodebin` pad discovery for the currently loaded URI.
    /// Reset by `load()` BEFORE the URI swap so a stale `no-more-pads` flag
    /// from the previous stream doesn't make the wait return instantly.
    /// `None` until the pipeline is built; cleared back to `None` by
    /// `unload()`. Required by P3.8 fix S2 (audio start delay).
    pads: Mutex<Option<Arc<PadReadiness>>>,
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
    /// B3 fix: serialize `attach_window` / `detach_window` across windows.
    /// Without this, two near-simultaneous attaches (e.g. user opens
    /// projector + return monitor at once) race the tee request pad
    /// allocation: both call `vtee.request_pad_simple("src_%u")` and both
    /// receive valid pads, but the second one's BLOCK_DOWNSTREAM probe is
    /// not honored because the first attach has already removed its probe
    /// and unblocked buffer flow. Result: second-attached window starts
    /// mid-stream. Holding this mutex for the full attach/detach prevents
    /// the race without taking the long-held `pipeline` lock.
    attach_mutex: Mutex<()>,
    /// P3.19 — attached-window registry for re-attach after a full reload
    /// (loop-one EOS path) or seek-after-EOS recovery. Map of window_label
    /// → native window handle, populated by `attach_window` and cleared by
    /// `detach_window`. After a `pipeline.set_state(NULL)` cycle inside
    /// `load()`, the existing native sink elements may have lost their tee
    /// request-pad blocking probes / sticky events, so we tear them down
    /// (`detach_native_sink`) and re-attach with the cached handles.
    attached_windows: Mutex<HashMap<String, usize>>,
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
            pads: Mutex::new(None),
            state: PlaybackState::new(),
            consumers: ConsumerRegistry::new(),
            signaling,
            app,
            broadcaster_stop: Arc::new(AtomicBool::new(false)),
            broadcaster_running: Arc::new(AtomicBool::new(false)),
            bus_watcher_stop: Arc::new(AtomicBool::new(false)),
            bus_watcher_running: Arc::new(AtomicBool::new(false)),
            attach_mutex: Mutex::new(()),
            attached_windows: Mutex::new(HashMap::new()),
        }
    }

    /// Get-or-create the shared GStreamer pipeline.
    fn get_or_init_pipeline(&self) -> Result<gst::Pipeline, AppError> {
        let mut guard = self.pipeline.lock()?;
        if guard.is_none() {
            let built = pipeline::build_base_pipeline()?;
            *guard = Some(built.pipeline);
            // Pair the pad-readiness tracker with the freshly built pipeline.
            let mut pads_guard = self.pads.lock()?;
            *pads_guard = Some(built.pads);
        }
        // Safe: just inserted above if it was None.
        Ok(guard.as_ref().expect("pipeline initialized above").clone())
    }

    /// Snapshot the current `PadReadiness` if the pipeline is built.
    fn pads_snapshot(&self) -> Result<Option<Arc<PadReadiness>>, AppError> {
        Ok(self.pads.lock()?.clone())
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
        let pads = self.pads_snapshot()?;

        // Tell projection windows to STOP rendering the (about-to-arrive)
        // onlineVideo slide until the pipeline is producing samples. The
        // frontend `useRustVideoPipelineStore.isFrameReady` flag mirrors this
        // payload — projector-view / return.tsx hold back onlineVideo slides
        // while it's false so the operator keeps seeing the previous content
        // (lyric, logo, prior slide) instead of a black hole over the
        // GStreamer surface that hasn't pushed a buffer yet.
        if let Some(app) = self.app.as_ref() {
            if let Err(e) = app.emit(
                VIDEO_PIPELINE_FRAME_READY_EVENT,
                serde_json::json!({ "ready": false }),
            ) {
                log::warn!(
                    "video_pipeline.load: emit {VIDEO_PIPELINE_FRAME_READY_EVENT} (ready=false) failed: {e}"
                );
            }
        }

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

        // P3.8 fix S2: clear stale pad-readiness flags BEFORE swapping the
        // URI. After a NULL → PAUSED cycle, uridecodebin will re-fire
        // pad-added + no-more-pads for the new stream; we must wait for the
        // NEW signal, not return instantly because the prior stream's flags
        // were still set.
        if let Some(p) = pads.as_ref() {
            p.reset();
        }

        pipeline::set_source_uri(&pipeline, uri)?;
        pipeline
            .set_state(gst::State::Paused)
            .map_err(|e| AppError::Internal(format!("video_pipeline.load set_state(PAUSED): {e}")))?;
        // Block until PAUSED is fully reached (GstMessage::AsyncDone). This
        // ensures uridecodebin has discovered and linked ALL pads (audio +
        // video) and every sink has prerolled before the caller calls play().
        // Without this wait, play() races pad-added: the H.264 video pad is
        // discovered first so video renders immediately, while the audio pad
        // arrives later — producing an audible "video without audio" gap on
        // every load. The NULL wait above uses the same pattern.
        let (change_result, _current, _pending) = pipeline.state(gst::ClockTime::NONE);
        change_result.map_err(|e| {
            AppError::Internal(format!("video_pipeline.load PAUSED state wait: {e}"))
        })?;

        // P3.8 fix S2: belt-and-suspenders pad-discovery wait. AsyncDone is
        // posted when every CURRENTLY-LINKED sink has prerolled. If
        // uridecodebin races the audio pad (video pad arrives first, audio
        // pad still mid-discovery), the video sink prerolls and AsyncDone
        // fires while the audio sink is still pending data → PLAYING starts
        // and the user sees video before hearing audio. Block until
        // `no-more-pads` confirms uridecodebin has finished stream
        // discovery; on timeout we proceed because either (a) there is no
        // audio stream — uridecodebin still emits no-more-pads but maybe
        // late, (b) the source genuinely takes longer (network, slow disk).
        // Either way we already paid for AsyncDone above.
        if let Some(p) = pads.as_ref() {
            let signaled = p.wait_for_pads(PAD_DISCOVERY_TIMEOUT)?;
            if !signaled {
                log::warn!(
                    "video_pipeline.load: no-more-pads not signalled within {:?}, proceeding",
                    PAD_DISCOVERY_TIMEOUT
                );
            }
        }

        // Install a one-shot probe on the audio sink's sink pad that fires
        // `video-pipeline-frame-ready { ready: true }` the moment the first
        // buffer flows. That marker is what projection windows watch to swap
        // a buffered onlineVideo slide in — keeping the prior visible content
        // on screen until the pipeline is actually rendering instead of
        // showing a black gap during pipeline init / device cold-start /
        // network buffering.
        //
        // Why audio_sink and not video sinks: by the time an audio buffer
        // hits this probe the pipeline is fully running (the audio chain is
        // the clock master via `provide-clock=true`), so any video sinks
        // attached have either already received their first buffer or are
        // about to in the same ~1ms window. Installing on each video sink
        // would require re-installing on every attach_window() call too.
        // Audio is the simplest single source of truth.
        //
        // Edge case: video-only source (no audio stream) — the probe never
        // fires. The frontend `use-rust-video-pipeline-state` hook applies a
        // safety-net timeout to flip `isFrameReady` after a bounded wait so
        // the user isn't stuck on a stale slide. For this app's content
        // (worship music videos), video-only is exceedingly rare; the
        // timeout is the pragmatic compromise.
        //
        // Idempotency: every load() call installs a fresh probe. Each is
        // one-shot (returns Remove on first fire), so accumulated probes
        // from rapid re-loads simply each fire once on the next first-buffer
        // and self-detach. The frontend setting `isFrameReady = true`
        // multiple times is a no-op (Zustand sets the same boolean).
        if let Some(app) = self.app.as_ref() {
            let pipeline_for_probe = pipeline.clone();
            let app_for_probe = app.clone();
            if let Some(audio_sink) = pipeline_for_probe.by_name("audio_sink") {
                if let Some(sink_pad) = audio_sink.static_pad("sink") {
                    let probe_result = sink_pad.add_probe(
                        gst::PadProbeType::BUFFER,
                        move |_pad, _info| {
                            if let Err(e) = app_for_probe.emit(
                                VIDEO_PIPELINE_FRAME_READY_EVENT,
                                serde_json::json!({ "ready": true }),
                            ) {
                                log::warn!(
                                    "video_pipeline.load: emit {VIDEO_PIPELINE_FRAME_READY_EVENT} (ready=true) failed: {e}"
                                );
                            }
                            gst::PadProbeReturn::Remove
                        },
                    );
                    if probe_result.is_none() {
                        log::warn!(
                            "video_pipeline.load: failed to install audio_sink BUFFER probe; first-frame readiness will rely on frontend timeout"
                        );
                    }
                } else {
                    log::warn!(
                        "video_pipeline.load: audio_sink has no sink pad; first-frame readiness will rely on frontend timeout"
                    );
                }
            } else {
                log::warn!(
                    "video_pipeline.load: audio_sink element missing; first-frame readiness will rely on frontend timeout"
                );
            }
        }

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
    ///
    /// When no source URI has been loaded (snapshot.uri is None), this skips
    /// the GStreamer state transition silently — `set_state(Playing)` on a
    /// sourceless pipeline (NULL or post-prewarm READY) returns
    /// `StateChangeError` because uridecodebin has no URI to plug. The
    /// snapshot is still updated so any UI bound to `paused` reflects intent.
    pub fn play(&self) -> Result<(), AppError> {
        let has_uri = self.state.snapshot()?.uri.is_some();
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            if has_uri {
                let current = pipeline.current_state();
                pipeline.set_state(gst::State::Playing).map_err(|e| {
                    AppError::Internal(format!(
                        "video_pipeline.play: set_state(Playing) from {current:?} failed: {e}"
                    ))
                })?;
            }
        }
        drop(guard);
        self.state.play()?;
        // Spawn the 10 Hz broadcaster on the *first* play (or after a previous
        // unload tore it down). Subsequent play() calls are a no-op.
        self.spawn_state_broadcaster();
        Ok(())
    }

    /// Transition the pipeline (if built) to PAUSED.
    ///
    /// Mirrors `play()` and silently skips the GStreamer transition when no
    /// URI is loaded (PAUSED on a sourceless uridecodebin also fails).
    pub fn pause(&self) -> Result<(), AppError> {
        let has_uri = self.state.snapshot()?.uri.is_some();
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            if has_uri {
                let current = pipeline.current_state();
                pipeline.set_state(gst::State::Paused).map_err(|e| {
                    AppError::Internal(format!(
                        "video_pipeline.pause: set_state(Paused) from {current:?} failed: {e}"
                    ))
                })?;
            }
        }
        drop(guard);
        self.state.pause()?;
        Ok(())
    }

    /// Seek the pipeline to `secs` (sub-second precision via microseconds).
    ///
    /// GStreamer's `seek_simple` is only valid in PAUSED or PLAYING. This
    /// function guards against calls that race the load() worker thread: since
    /// `video_pipeline_load` returns immediately while a background thread
    /// blocks on `pipeline.state(NONE)`, any concurrent seek arriving during
    /// that async transition would fail. When the pipeline is mid-transition
    /// (pending state ≠ VoidPending) or not yet in PAUSED/PLAYING, the
    /// GStreamer seek is skipped silently and only the snapshot is updated.
    ///
    /// **P3.19 — EOS recovery.** When the user scrubs the timeline AFTER the
    /// video has reached end-of-stream (e.g. loop OFF, or first iteration
    /// with loop ON before the auto-reload completes), the pipeline is
    /// nominally PLAYING/PAUSED but every downstream pad has acknowledged
    /// EOS. `seek_simple` returns `Err` because there's no segment to seek
    /// within — the previous one was finalized by EOS. Pre-P3.19 this
    /// surfaced as a generic INTERNAL_ERROR toast on the frontend. We detect
    /// this case via a position-vs-duration heuristic and route through the
    /// same full-reload path the loop-one EOS handler uses, then seek to the
    /// requested position on the fresh pipeline. Cost: ~200-500 ms hitch on
    /// scrub-after-finish; acceptable because the alternative is a hard
    /// error toast.
    pub fn seek(&self, secs: f64) -> Result<(), AppError> {
        let secs = secs.max(0.0);

        // EOS detection — done OUTSIDE the pipeline lock so the recovery
        // path (which calls `load()` → takes the pipeline lock) doesn't
        // deadlock. Heuristic: snapshot position + duration; if position is
        // within `EOS_PROXIMITY_US` of duration AND the pipeline is in
        // Playing/Paused, treat as post-EOS and recover. Falsely triggering
        // during normal end-of-track scrubs is harmless — the recovery just
        // does a load+seek, which is what the user wants.
        const EOS_PROXIMITY_US: u64 = 100_000; // 100 ms
        let post_eos = {
            let guard = self.pipeline.lock()?;
            if let Some(pipeline) = guard.as_ref() {
                let pos = pipeline
                    .query_position::<gst::ClockTime>()
                    .map(|t| t.useconds())
                    .unwrap_or(0);
                let dur = pipeline
                    .query_duration::<gst::ClockTime>()
                    .map(|t| t.useconds())
                    .unwrap_or(0);
                let (_, current, _) = pipeline.state(gst::ClockTime::ZERO);
                let in_runnable_state = matches!(
                    current,
                    gst::State::Playing | gst::State::Paused
                );
                in_runnable_state && dur > 0 && pos >= dur.saturating_sub(EOS_PROXIMITY_US)
            } else {
                false
            }
        };

        if post_eos {
            log::info!(
                "video_pipeline.seek({secs:.3}s): pipeline at end-of-stream, \
                 doing full reload + seek"
            );
            let uri = self
                .state
                .snapshot()?
                .uri
                .clone()
                .ok_or_else(|| {
                    AppError::Internal("video_pipeline.seek: post-EOS but no URI in snapshot".into())
                })?;
            // Full reload re-creates the segment so seek_simple can land
            // somewhere meaningful. load() leaves the pipeline in PAUSED
            // (and synchronously waits for that state to be reached, so
            // pending == VoidPending after this call).
            self.load(&uri)?;
            // Native sink branches may need re-attaching after the NULL
            // cycle (same reason as the loop-one path).
            if let Err(e) = self.reattach_all_windows() {
                log::warn!("video_pipeline.seek: post-EOS reattach failed: {e}");
            }
            // Issue the actual seek WHILE THE PIPELINE IS PAUSED, before the
            // play() call below. PAUSED is a valid seek-target state per the
            // GStreamer state-change matrix; doing it here keeps the call
            // atomic with the reload (the user sees: scrub bar moves →
            // brief loading flash → playback resumes from new position).
            // If we delayed the seek past play(), `pipeline.state(0)` would
            // briefly report `pending: PLAYING` and the post-reload seek
            // path below would skip the seek_simple call (the
            // `stable_and_seekable` guard rejects pending != VoidPending),
            // landing the user back at position 0.
            {
                let guard = self.pipeline.lock()?;
                if let Some(pipeline) = guard.as_ref() {
                    let (_, current, _) = pipeline.state(gst::ClockTime::ZERO);
                    let useconds = (secs * 1_000_000.0) as u64;
                    let position = gst::ClockTime::from_useconds(useconds);
                    pipeline
                        .seek_simple(
                            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                            position,
                        )
                        .map_err(|e| {
                            AppError::Internal(format!(
                                "video_pipeline.seek({secs:.3}s) post-EOS from {current:?}: {e}"
                            ))
                        })?;
                }
            }
            self.state.seek(secs)?;
            // Resume PLAYING so the user sees motion at the seeked position
            // instead of a paused first frame. The user is scrubbing, which
            // implies they want playback resumed; play() also writes
            // paused=false to the snapshot, matching the GStreamer state.
            self.play()?;
            return Ok(());
        }

        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            // Non-blocking state query (timeout = 0).
            let (_, current, pending) = pipeline.state(gst::ClockTime::ZERO);
            let stable_and_seekable = pending == gst::State::VoidPending
                && (current == gst::State::Paused || current == gst::State::Playing);
            if stable_and_seekable {
                let useconds = (secs * 1_000_000.0) as u64;
                let position = gst::ClockTime::from_useconds(useconds);
                pipeline
                    .seek_simple(
                        gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                        position,
                    )
                    .map_err(|e| {
                        AppError::Internal(format!(
                            "video_pipeline.seek({secs:.3}s) from {current:?}: {e}"
                        ))
                    })?;
            }
            // If mid-transition or not in a seekable state, skip the GStreamer
            // seek. stop()/restart() callers already .catch() errors; silently
            // succeeding here avoids spurious INTERNAL_ERROR toasts.
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
    ///
    /// **P3.16 fix S2 — bus watcher revival.** The bus watcher exits itself
    /// after a `LoopMode::None` EOS (so the EOS message doesn't re-fire on the
    /// next `timed_pop` iteration — see `on_eos`). If the user then toggles
    /// loop ON without first issuing a new `load()` — e.g. they hit replay,
    /// then enable loop, expecting the next end-of-stream to wrap — the EOS
    /// would fire on the bus but no watcher is alive to observe it. The video
    /// freezes at end. We re-arm the watcher here whenever loop becomes One.
    /// `spawn_bus_watcher` is CAS-guarded so it's a no-op when the watcher is
    /// already alive (the common case during normal playback).
    pub fn set_loop(&self, mode: LoopMode) -> Result<(), AppError> {
        log::info!("video_pipeline: set_loop({mode:?}) called");
        self.state.set_loop(mode)?;
        if mode == LoopMode::One {
            let was_running = self.bus_watcher_running.load(Ordering::SeqCst);
            log::info!(
                "video_pipeline: set_loop(One) — bus_watcher_running={was_running}; \
                 ensuring watcher is alive"
            );
            self.spawn_bus_watcher();
        }
        Ok(())
    }

    /// Seek to 0 and ensure the pipeline is PLAYING (Task 3.1).
    ///
    /// Matches the legacy pause → seek → play sequence but collapsed server-
    /// side so the frontend doesn't need to issue three round trips.
    ///
    /// **Sourceless guard:** restart is the user-facing "loop / replay"
    /// action. When no URI has been loaded — typical after `unload()` clears
    /// the queue, or before the first load() on a freshly-built pipeline —
    /// `seek(0)` silently no-ops (the snapshot stable_and_seekable check
    /// rejects NULL/READY) and the subsequent `set_state(Playing)` would
    /// return `StateChangeError` from a sourceless uridecodebin, surfacing
    /// to the frontend as a generic INTERNAL_ERROR toast. There's nothing to
    /// restart, so succeed silently.
    pub fn restart(&self) -> Result<(), AppError> {
        if self.state.snapshot()?.uri.is_none() {
            return Ok(());
        }
        self.seek(0.0)?;
        self.play()
    }

    /// Bus-watcher callback for end-of-stream (Task 3.1).
    ///
    /// Loop one → full pipeline reload (NULL → PAUSED → PLAYING) of the same
    /// URI. Loop none → emit the typed [`VideoPipelineEnded`] event so the
    /// frontend can advance the queue.
    ///
    /// **P3.18 — full reload (nuclear option) for LoopMode::One.** Earlier
    /// rounds tried in-place loop strategies that all ultimately failed in
    /// dogfood (P3.14 plain `seek_simple`, P3.15 same-URI re-set + seek, P3.16
    /// explicit FlushStart/Stop + full `seek` API). Symptom every round: video
    /// freezes at end-of-stream, no restart. Root cause hypothesis: under
    /// certain muxer/demuxer combos uridecodebin's internal pads retain
    /// EOS-acknowledged state in a way that survives explicit flush events
    /// when issued post-EOS — so the segment event from the seek lands on a
    /// pad that has already finalized its stream.
    ///
    /// The bulletproof pattern is to fully recycle the pipeline through NULL
    /// (which destroys the auto-plugged decoders entirely) and re-load the
    /// same URI, which is exactly what `Self::load(uri)` already does. Cost:
    /// ~200-500 ms hitch on every loop cycle (NULL transition + uridecodebin
    /// re-discovery + first-frame buffering). Acceptable because:
    ///   - Loop is rare (most videos play once via LoopMode::None).
    ///   - Looping worship videos are typically short jingles/intros where
    ///     a brief pause matches the natural beat between iterations.
    ///   - Guaranteed correctness > minor latency.
    ///
    /// `load()` re-emits `video-pipeline-frame-ready { ready: false }` so
    /// projection windows hold the previous (final) frame until the new
    /// stream's first audio buffer fires the probe — the visual effect is a
    /// brief freeze on the last frame, then restart from 0.
    fn on_eos(&self) {
        let mode = match self.state.loop_mode() {
            Ok(m) => m,
            Err(e) => {
                log::warn!("video_pipeline: on_eos loop_mode read failed: {e}");
                return;
            }
        };
        log::info!("video_pipeline: on_eos fired, loop_mode={mode:?}");

        match mode {
            LoopMode::One => {
                log::info!(
                    "video_pipeline: on_eos LoopMode::One — spawning reload thread \
                     (bus watcher must stay free to keep observing the bus)"
                );

                // P3.19 — CRITICAL: do the reload OFF the bus watcher thread.
                //
                // Earlier rounds (P3.18) called `self.load(&uri)` directly
                // here. That call internally executes
                // `pipeline.set_state(NULL)` → `pipeline.state(ClockTime::NONE)`
                // — a BLOCKING wait with no timeout. We are running inside
                // the bus watcher thread that polls `bus.timed_pop`, and we
                // hold no locks here, so in theory the wait should complete.
                // In practice, on macOS, when the EOS message we're currently
                // processing has not yet been fully ack'd by every downstream
                // sink (sticky-event drainage), `set_state(NULL)` can return
                // `StateChangeReturn::Async` and the subsequent `state(NONE)`
                // wait blocks until those sinks finish unwinding — which they
                // can't do, because the bus thread that would deliver their
                // completion messages is THIS thread, currently parked on the
                // state wait. Result: classic self-deadlock; bus watcher
                // wedges; loop appears "broken" and pipeline freezes at last
                // frame. (P3.14 → P3.18 each tried different in-place strategies
                // but all suffer the same root cause: doing pipeline lifecycle
                // work from inside the bus watcher thread.)
                //
                // The fix is structural: spawn a dedicated thread for the
                // reload. The bus watcher returns immediately and keeps
                // pumping the bus, which lets the new pipeline's
                // PAUSED/PLAYING transitions complete cleanly. After load()
                // we re-attach all tracked windows (the NULL transition can
                // leave native sink branches in a state where they don't
                // render after the next PLAYING — see `reattach_all_windows`).
                //
                // CLAUDE.md error #8 (spawned threads must exit on app
                // shutdown): this is a one-shot worker that runs ~500 ms and
                // exits — fits the "short-lived bare spawn" pattern explicitly
                // permitted there. Errors are logged + the thread exits; the
                // bus watcher continues running and will observe any future
                // EOS / errors normally.
                let app = match self.app.clone() {
                    Some(a) => a,
                    None => {
                        log::warn!(
                            "video_pipeline: on_eos LoopMode::One — no app handle, \
                             cannot spawn reload thread (test runtime?)"
                        );
                        return;
                    }
                };
                std::thread::spawn(move || {
                    let runtime = match runtime_from_app(&app) {
                        Some(r) => r,
                        None => {
                            log::warn!(
                                "video_pipeline: on_eos reload thread — runtime missing"
                            );
                            return;
                        }
                    };
                    let uri = match runtime.state.snapshot() {
                        Ok(s) => s.uri.clone(),
                        Err(e) => {
                            log::warn!(
                                "video_pipeline: on_eos reload thread snapshot read failed: {e}"
                            );
                            return;
                        }
                    };
                    let uri = match uri {
                        Some(u) => u,
                        None => {
                            log::warn!(
                                "video_pipeline: on_eos reload thread — no URI in snapshot, \
                                 aborting loop"
                            );
                            return;
                        }
                    };
                    if let Err(e) = runtime.load(&uri) {
                        log::warn!(
                            "video_pipeline: on_eos reload thread load() failed: {e}"
                        );
                        return;
                    }
                    // load() can leave native sink branches without their
                    // tee blocking + sticky events after a NULL cycle — re-
                    // attach so projector/return don't go black on loop.
                    if let Err(e) = runtime.reattach_all_windows() {
                        log::warn!(
                            "video_pipeline: on_eos reload thread reattach failed: {e}"
                        );
                    }
                    if let Err(e) = runtime.play() {
                        log::warn!(
                            "video_pipeline: on_eos reload thread play() failed: {e}"
                        );
                        return;
                    }
                    log::info!("video_pipeline: on_eos LoopMode::One — reload complete (thread)");
                });
            }
            LoopMode::None => {
                log::info!("video_pipeline: on_eos LoopMode::None — emitting Ended event");
                if let Some(app) = self.app.as_ref() {
                    let event = VideoPipelineEnded {};
                    if let Err(e) = event.emit(app) {
                        log::warn!("video_pipeline: VideoPipelineEnded emit failed: {e}");
                    }
                }
                // After emitting Ended, stop the bus watcher — the bus retains
                // the EOS message, so the next timed_pop would re-fire on_eos
                // in a loop.
                log::info!(
                    "video_pipeline: on_eos LoopMode::None — stopping bus watcher \
                     (will be re-armed on next load() or set_loop(One))"
                );
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
        // Drop the pad-readiness tracker too — `get_or_init_pipeline` will
        // construct a fresh one on the next load(). Required by P3.8 fix S2
        // so a re-load after unload() doesn't reuse stale signal state.
        let mut pads_guard = self.pads.lock()?;
        *pads_guard = None;
        drop(pads_guard);
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

    /// Attach a native sink for `window_label` so the shared pipeline renders
    /// directly into the OS window's native handle.
    ///
    /// Idempotent — any previous attachment for the same label is detached
    /// first (best-effort). Phase 1 of the frame-perfect multi-monitor video
    /// plan (`docs/plans/2026-04-25-frame-perfect-multi-monitor-video.md`).
    /// This path coexists beside `subscribe`/`unsubscribe` (WebRTC consumer);
    /// the frontend gates which is active during the migration window.
    ///
    /// B3 fix: holds `attach_mutex` for the full duration so concurrent
    /// attach/detach calls across windows can't race the tee request-pad
    /// allocation. The lock is HELD across `detach_native_sink` +
    /// `attach_native_sink` (both of which now do meaningful work — see B1
    /// and B2). The pipeline `Mutex` is only briefly taken inside
    /// `get_or_init_pipeline` so we don't deadlock with bus-watcher / state-
    /// broadcaster threads that need it.
    ///
    /// **P3.11 — pure hot-attach (zero existing-window disruption).** Earlier
    /// P3.10 paused the pipeline → attached → FLUSH|KEY_UNIT seek → resumed,
    /// trading ~100-300 ms hitch on the EXISTING window for keyframe-aligned
    /// instant rendering on the NEW window. Operator feedback: the existing-
    /// window pause is unacceptable. Now we keep the pipeline running and let
    /// the new branch wait for the next natural IDR (up to GOP-length, ~1-4 s
    /// for typical YouTube MP4) before producing visible output.
    ///
    /// The `attach_native_sink` BLOCK_DOWNSTREAM probe (P3.9) ensures the new
    /// branch's tee request pad is gated until the new elements have prerolled
    /// — no buffers race to the not-yet-allocated render surface. Other tee
    /// branches (audio, already-attached video sinks) are NEVER disturbed.
    ///
    /// Tradeoffs vs P3.10:
    ///   - Existing screen: zero hitch (was ~200ms pause).
    ///   - New screen first frame: up to GOP-length wait for next IDR (was
    ///     ~200ms post-seek).
    ///
    /// If the GOP wait proves too long in practice, the follow-up is to keep
    /// a rolling buffer of recent IDR+frames upstream and replay them into
    /// the new branch on attach — significantly more complex; do not preempt.
    pub fn attach_window(&self, window_label: &str, window_handle: usize) -> Result<(), AppError> {
        let _attach_guard = self
            .attach_mutex
            .lock()
            .map_err(|e| AppError::Internal(format!("attach_mutex poisoned: {e}")))?;
        let pipeline = self.get_or_init_pipeline()?;

        log::info!(
            "attach_window: '{window_label}' (pipeline state = {:?})",
            pipeline.current_state()
        );

        // Best-effort detach previous (idempotent re-attach). Errors are
        // intentionally swallowed: when there's nothing to detach this is a
        // no-op, and any structural problem will resurface as the subsequent
        // attach fails loudly.
        let _ = pipeline::detach_native_sink(&pipeline, window_label);

        // Hot-attach: pipeline keeps running. The BLOCK_DOWNSTREAM probe
        // inside `attach_native_sink` ensures the new branch transitions
        // through PAUSED preroll cleanly without disturbing other branches
        // (audio, already-attached video sinks). The new branch may show
        // black until its decoder receives the next KEY_UNIT (IDR) frame
        // from the upstream stream — typically 1-4 s for standard GOP
        // sizes. This is the canonical GStreamer hot-attach pattern.
        pipeline::attach_native_sink(&pipeline, window_label, window_handle).map(|_| ())?;

        // P3.19: track the (label, handle) pair so a subsequent full pipeline
        // reload (loop-one EOS or seek-after-EOS recovery) can re-attach
        // without the frontend's `useEffect` having to fire. The frontend
        // attaches once per window mount; if Rust internally cycles NULL the
        // existing native sinks lose their tee request-pad blocking + sticky
        // events and stop rendering — re-attach restores them.
        if let Ok(mut tracked) = self.attached_windows.lock() {
            tracked.insert(window_label.to_string(), window_handle);
        }
        Ok(())
    }

    /// Detach the native sink for `window_label` if present.
    ///
    /// No-op (returns `Ok(())`) when the pipeline has not been built yet.
    /// Mirrors the shutdown contract of `unsubscribe`.
    ///
    /// B3 fix: same `attach_mutex` as `attach_window` so an attach-while-
    /// detaching across two windows can't race.
    pub fn detach_window(&self, window_label: &str) -> Result<(), AppError> {
        let _attach_guard = self
            .attach_mutex
            .lock()
            .map_err(|e| AppError::Internal(format!("attach_mutex poisoned: {e}")))?;
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            let pipeline = pipeline.clone();
            drop(guard);
            pipeline::detach_native_sink(&pipeline, window_label)?;
        }
        // P3.19: keep the registry in sync so a future reload doesn't try to
        // re-attach a window the frontend has already torn down.
        if let Ok(mut tracked) = self.attached_windows.lock() {
            tracked.remove(window_label);
        }
        Ok(())
    }

    /// P3.19 — re-attach every tracked window to the live pipeline.
    ///
    /// Called from the loop-one EOS reload path and the seek-after-EOS
    /// recovery path AFTER `load()` has cycled the pipeline NULL → PAUSED.
    /// During NULL the existing native sink branches' tee request-pad
    /// blocking probes and sticky events are not guaranteed to be reinstated
    /// when the pipeline next reaches PLAYING — empirically the symptom is a
    /// black projector/return after a loop iteration. Tearing them down +
    /// re-running the canonical hot-attach sequence (BLOCK_DOWNSTREAM probe
    /// → link → sync_state_with_parent → preroll wait → release probe)
    /// restores frame delivery without disturbing audio.
    ///
    /// Snapshot the registry (then drop the lock) before touching the
    /// pipeline so we can't deadlock with `attach_window` /
    /// `detach_window` if they race in (unlikely — caller holds the bus
    /// watcher / restart path, but the snapshot pattern is cheap insurance).
    fn reattach_all_windows(&self) -> Result<(), AppError> {
        let snapshot: Vec<(String, usize)> = match self.attached_windows.lock() {
            Ok(g) => g.iter().map(|(k, v)| (k.clone(), *v)).collect(),
            Err(e) => {
                log::warn!("reattach_all_windows: registry lock poisoned: {e}");
                return Ok(());
            }
        };
        if snapshot.is_empty() {
            return Ok(());
        }
        log::info!(
            "reattach_all_windows: re-attaching {} window(s) after pipeline reload",
            snapshot.len()
        );
        let _attach_guard = self
            .attach_mutex
            .lock()
            .map_err(|e| AppError::Internal(format!("attach_mutex poisoned: {e}")))?;
        let pipeline = self.get_or_init_pipeline()?;
        for (label, handle) in snapshot {
            let _ = pipeline::detach_native_sink(&pipeline, &label);
            if let Err(e) = pipeline::attach_native_sink(&pipeline, &label, handle) {
                log::warn!("reattach_all_windows: '{label}' re-attach failed: {e}");
            }
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
            // P3.20 — preemptive loop seek state. Tracks whether we've already
            // issued a wrap-around seek for the current iteration so we don't
            // spam GStreamer with one seek per 100ms broadcaster tick while
            // position lingers in the [duration-200ms, duration] window. The
            // flag is cleared once position drops below half-duration on the
            // next iteration (i.e. the seek successfully reset the playhead).
            let mut looped_this_cycle: bool = false;

            loop {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }

                // Snapshot pipeline + volume by re-borrowing the runtime.
                let runtime = match runtime_from_app(&app_for_thread) {
                    Some(rt) => rt,
                    None => break,
                };

                // P3.20 — preemptive loop seek. Read raw ClockTime values
                // alongside the secs-converted ones so we can run the
                // wrap-around check in nanosecond precision while still
                // emitting seconds to the frontend.
                //
                // Run the seek INSIDE the same pipeline-lock guard so we
                // can't race a concurrent unload() that drops the pipeline
                // between the position-query and the seek_simple call. The
                // guard is released before sleep().
                let (position_secs, duration_secs, pipeline_present) = {
                    let guard = match runtime.pipeline.lock() {
                        Ok(g) => g,
                        Err(_) => break,
                    };
                    if let Some(pipeline) = guard.as_ref() {
                        let position = pipeline
                            .query_position::<gst::ClockTime>()
                            .unwrap_or(gst::ClockTime::ZERO);
                        let duration = pipeline
                            .query_duration::<gst::ClockTime>()
                            .unwrap_or(gst::ClockTime::ZERO);

                        // Preemptive loop: if we're approaching EOS and
                        // loop=One, seek to start BEFORE EOS fires. The
                        // pipeline never reaches EOS state — no recovery
                        // hell, no NULL cycle, no native sink loss.
                        //
                        // Threshold of 200ms gives 2 broadcaster ticks of
                        // margin so we never miss the window. on_eos's
                        // LoopMode::One arm remains as a safety-net
                        // fallback for the unlikely case the broadcaster
                        // misses (e.g. thread starvation, sub-200ms video).
                        let loop_mode = runtime
                            .state
                            .loop_mode()
                            .unwrap_or(LoopMode::None);
                        if duration > gst::ClockTime::ZERO {
                            let near_end = position
                                + gst::ClockTime::from_mseconds(200)
                                >= duration;
                            // Reset the spam-prevention flag once we've
                            // actually wrapped around. Half-duration is a
                            // generous threshold — any normal playback past
                            // the midpoint would have non-zero position.
                            //
                            // P3.21 — also gate the reset on the pipeline
                            // being in PLAYING state. During a fallback
                            // reload (see below), the pipeline cycles
                            // through NULL → READY → PAUSED and position
                            // queries can briefly return 0 — without this
                            // gate, `looped_this_cycle` would clear
                            // mid-reload and the next tick could fire a
                            // second seek on a half-loaded pipeline.
                            let near_start = position < duration / 2;
                            let pipeline_state = pipeline.current_state();
                            if near_start && pipeline_state == gst::State::Playing {
                                looped_this_cycle = false;
                            }
                            if loop_mode == LoopMode::One
                                && near_end
                                && !looped_this_cycle
                            {
                                log::info!(
                                    "preemptive loop seek: pos={pos}ms dur={dur}ms",
                                    pos = position.mseconds(),
                                    dur = duration.mseconds()
                                );
                                match pipeline.seek_simple(
                                    gst::SeekFlags::FLUSH
                                        | gst::SeekFlags::KEY_UNIT,
                                    gst::ClockTime::ZERO,
                                ) {
                                    Ok(()) => {
                                        looped_this_cycle = true;
                                    }
                                    Err(e) => {
                                        // P3.21 — When loop is toggled ON
                                        // AFTER the video has already
                                        // reached EOS, `seek_simple` returns
                                        // Err because the pipeline is past
                                        // its end. Without this fallback,
                                        // the broadcaster spams seek every
                                        // 100ms forever (position stays at
                                        // ~duration, so `looped_this_cycle`
                                        // never gets set). Symptom: app
                                        // becomes unresponsive, user kills
                                        // it as a "crash".
                                        //
                                        // Fix: set the flag immediately so
                                        // we stop trying, then spawn the
                                        // same full-reload thread used by
                                        // `on_eos LoopMode::One` (P3.19).
                                        // After reload, position resets to
                                        // 0, the gated `near_start` check
                                        // re-clears the flag once the
                                        // pipeline is back in PLAYING, and
                                        // normal preemptive seeks resume.
                                        log::warn!(
                                            "preemptive loop seek failed: {e}; \
                                             falling back to full reload"
                                        );
                                        looped_this_cycle = true;
                                        let app = app_for_thread.clone();
                                        std::thread::spawn(move || {
                                            let runtime = match runtime_from_app(&app) {
                                                Some(r) => r,
                                                None => {
                                                    log::warn!(
                                                        "preemptive seek fallback: \
                                                         runtime missing"
                                                    );
                                                    return;
                                                }
                                            };
                                            let uri = match runtime.state.snapshot() {
                                                Ok(s) => s.uri.clone(),
                                                Err(e) => {
                                                    log::warn!(
                                                        "preemptive seek fallback \
                                                         snapshot read failed: {e}"
                                                    );
                                                    return;
                                                }
                                            };
                                            let uri = match uri {
                                                Some(u) => u,
                                                None => {
                                                    log::warn!(
                                                        "preemptive seek fallback: \
                                                         no URI in snapshot"
                                                    );
                                                    return;
                                                }
                                            };
                                            log::info!(
                                                "preemptive seek fallback: spawning reload"
                                            );
                                            if let Err(e) = runtime.load(&uri) {
                                                log::warn!(
                                                    "preemptive seek fallback \
                                                     load failed: {e}"
                                                );
                                                return;
                                            }
                                            if let Err(e) = runtime.reattach_all_windows() {
                                                log::warn!(
                                                    "preemptive seek fallback \
                                                     reattach failed: {e}"
                                                );
                                            }
                                            if let Err(e) = runtime.play() {
                                                log::warn!(
                                                    "preemptive seek fallback \
                                                     play failed: {e}"
                                                );
                                                return;
                                            }
                                            log::info!(
                                                "preemptive seek fallback: reload complete"
                                            );
                                        });
                                    }
                                }
                            }
                        }

                        let pos_secs = position.useconds() as f64 / 1_000_000.0;
                        let dur_secs = duration.useconds() as f64 / 1_000_000.0;
                        (pos_secs, dur_secs, true)
                    } else {
                        (0.0, 0.0, false)
                    }
                };

                if !pipeline_present {
                    // Pipeline gone (unload after a play); stop broadcasting.
                    break;
                }

                // CRITICAL: read `paused` + `volume` from the snapshot, NOT
                // from `pipeline.current_state()`. `current_state()` returns
                // the last-cached state and lags async transitions (PAUSED →
                // PLAYING for live HTTP/HLS sources can take hundreds of ms
                // to flush). The snapshot reflects intent: it's updated
                // synchronously by play()/pause()/load()/seek()/set_volume().
                //
                // Reading the cached state instead would cause the bridge in
                // `use-rust-video-pipeline-state.ts` to mirror PLAYING back
                // into mpStore.status right after the user clicked pause,
                // bouncing the UI back inside one tick — symptom: every
                // control "silently fails".
                let (paused, volume) = runtime
                    .state
                    .snapshot()
                    .map(|s| (s.paused, s.volume))
                    .unwrap_or((true, 0.0));

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
            log::info!(
                "video_pipeline: spawn_bus_watcher — already running, skipping spawn"
            );
            return;
        }

        log::info!("video_pipeline: spawn_bus_watcher — starting watcher thread");

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
            log::info!("video_pipeline: bus watcher thread exiting");
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

    /// Regression guard for the dogfood "[video-pipeline] restart – Internal
    /// application error" symptom. When the user clicks the loop/replay
    /// button with no source loaded (snapshot.uri == None) — which happens
    /// on a freshly-built pipeline before the first load(), or after
    /// unload() clears the queue — restart() must succeed silently rather
    /// than propagating the StateChangeError that
    /// `set_state(Playing)` would emit on a sourceless pipeline.
    #[test]
    fn restart_with_no_source_is_silent_noop() {
        let rt = runtime();
        // Fresh runtime: no load() ever called → snapshot.uri == None.
        assert!(rt.snapshot().expect("snapshot").uri.is_none());
        // Restart MUST not error — no source = nothing to restart.
        rt.restart().expect("restart on sourceless runtime");
        // And it must not have flipped paused to false (no source = no
        // active playback, snapshot stays in its default state).
        // (snapshot.paused defaults to false on a fresh PlaybackState; the
        // important invariant is that the call returned Ok.)
    }

    /// Companion guard for play/pause: those commands also early-return
    /// without touching GStreamer when the pipeline has no source. This
    /// matches the same defensive contract restart() uses.
    #[test]
    fn play_and_pause_with_no_source_dont_error() {
        let rt = runtime();
        rt.play().expect("play on sourceless runtime");
        rt.pause().expect("pause on sourceless runtime");
    }

    /// P3.19 regression guard — `attached_windows` registry must start
    /// empty and `reattach_all_windows` must be a no-op when the registry
    /// is empty. The full attach/reattach round trip is exercised by
    /// pipeline-level tests with a real `videotestsrc`; here we only check
    /// the registry plumbing.
    #[test]
    fn attached_windows_registry_starts_empty() {
        let rt = runtime();
        assert!(
            rt.attached_windows
                .lock()
                .expect("registry lock")
                .is_empty()
        );
    }

    /// `reattach_all_windows` with an empty registry must succeed silently.
    /// This is the path exercised by `seek` recovery + `on_eos` reload when
    /// no projector / return monitor has been attached yet (e.g. user
    /// triggered a loop video before opening any output window).
    #[test]
    fn reattach_all_windows_with_empty_registry_is_noop() {
        let rt = runtime();
        rt.reattach_all_windows().expect("reattach with empty registry");
    }

    /// P3.11 regression guard — `attach_window` is now pure hot-attach with
    /// zero state mutation on the pipeline, so it must complete quickly even
    /// when the pipeline is NULL/READY (no `load()` issued). Pre-P3.11 the
    /// PLAYING path would pause + state-wait + seek + resume; pre-P3.9 there
    /// were even unconditional state changes. Post-P3.11 there is no
    /// state-change path at all — the call hands off to `attach_native_sink`
    /// whose only blocking step is the per-element preroll wait (skipped when
    /// the parent is NULL/READY).
    ///
    /// We can't easily test the PLAYING path without a real video source,
    /// so the multi-window hot-attach correctness lives in pipeline
    /// integration tests with `videotestsrc` (see
    /// `attach_native_sink_to_playing_pipeline_keeps_pipeline_playing` in
    /// `pipeline.rs`).
    #[test]
    fn attach_window_does_not_block_on_idle_pipeline() {
        let rt = runtime();
        // First call: pipeline gets built lazily; will be in NULL.
        // Use window handle 0 — fine in NULL state since the sink doesn't
        // try to allocate its render surface until PAUSED/PLAYING.
        // We don't assert success of attach itself (depends on glimagesink
        // factory availability in the host) — what we DO assert is that the
        // call doesn't panic or hang.
        let started = std::time::Instant::now();
        let _ = rt.attach_window("test_window", 0);
        let elapsed = started.elapsed();
        // Pre-P3.11 the seek path included two `pipeline.state(2s)` waits;
        // post-fix there is none. This bound is now slack but still catches
        // any future regression that re-introduces a state-wait.
        assert!(
            elapsed < Duration::from_millis(2_500),
            "attach_window in NULL took {elapsed:?} (expected <2.5s — possible regression \
             that re-introduced a pipeline-wide state-wait on attach)"
        );
    }
}
