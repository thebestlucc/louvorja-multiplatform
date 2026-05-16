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
    events::{VideoPipelineEnded, VideoPipelineSinkDegraded, VideoPipelineState},
    pipeline::{self, AttachResult, PadReadiness},
    signaling::{AnswerPayload, IcePayload, SignalingChannel},
    state::{LoopMode, PlaybackState, PlaybackStateSnapshot},
};
use gstreamer::{self as gst, prelude::*};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tauri_specta::Event;

/// CD-4 — single-flight gate for loop-driven pipeline mutations.
///
/// After Phase A's SEGMENT-loop refactor, the only path that still recycles
/// the pipeline through NULL on EOS is the unseekable fallback in
/// `on_eos::LoopMode::One` (live HTTP streams, demuxers that fail the
/// seekability probe). That fallback spawns a fresh thread for each EOS so
/// the bus watcher isn't blocked on the NULL transition wait. Without a
/// gate, two near-simultaneous EOS messages — or an EOS racing a
/// `set_loop(One)`-triggered reload — would each spawn their own reload
/// thread. Both call `runtime.load(uri)` which takes the pipeline lock
/// serially, but the second thread sees a half-initialised pipeline state
/// (NULL transition in progress) and either deadlocks the state-wait or
/// observes a stale URI in the snapshot.
///
/// Encoded as `AtomicU8` rather than `Mutex<LoopOperation>` so the
/// CAS-transition is lock-free and the gate composition with the existing
/// `pipeline` mutex is straightforward (no "held cross-mutex" patterns to
/// audit). State machine:
///
/// ```text
///   Idle ──acquire──▶ Reloading ──release──▶ Idle
///       \─acquire──▶ Seeking   ──release──▶ Idle
/// ```
///
/// The `Seeking` state is reserved for a future direct-seek loop primitive
/// (e.g. if we expose `seek(SEGMENT)` re-arms outside the bus watcher) —
/// today only `Reloading` is taken on the unseekable EOS reload path.
const LOOP_OP_IDLE: u8 = 0;
/// Reserved for a future direct-seek loop primitive (e.g. exposing
/// `seek(SEGMENT)` re-arms outside the bus watcher). Currently unused —
/// keep the discriminant stable so the `AtomicU8` state machine doesn't
/// renumber when the seeking path is wired in.
///
/// Planned for the SEGMENT-seek follow-up tracked in
/// `docs/plans/2026-04-25-video-pipeline-consolidation.md` (Phase B).
#[allow(dead_code)]
const LOOP_OP_SEEKING: u8 = 1;
const LOOP_OP_RELOADING: u8 = 2;

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

/// M3-rev — shared "user is at/near end-of-stream" tolerance, in microseconds.
///
/// 100 ms covers (a) `seek()` post-EOS heuristic on the unseekable fallback
/// (`pos >= dur - 100ms` ⇒ user scrubbed onto the last frame, so reload then
/// seek instead of plain seek_simple) and (b) `set_loop(One)` recovery
/// (user toggled loop on while the playhead is parked at natural end —
/// re-arm the SEGMENT seek so the loop resumes). One frame at 30 fps is
/// ~33 ms; 100 ms is ~3 frames of slack — wide enough that a position
/// query racing AsyncDone doesn't false-negative, tight enough that legit
/// scrubs near (but not at) the end don't trigger recovery.
const EOS_PROXIMITY_US: u64 = 100_000;

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
    /// Phase A — set by `load()` after a seekability probe. Drives the canonical
    /// SEGMENT seek loop: when `true`, `load()` arms an initial
    /// `seek(FLUSH | SEGMENT)` and the bus watcher's `SegmentDone` handler
    /// re-arms (loop=One) or converts to EOS (loop=None) — pipeline never
    /// reaches EOS state during loop iteration so native sinks never see
    /// flush. When `false` (rare — non-seekable source), the legacy
    /// EOS-based reload path in `on_eos::LoopMode::One` acts as fallback.
    ///
    /// I6: bare `AtomicBool` rather than `Arc<AtomicBool>` (siblings above)
    /// because `is_seekable` is only ever read/written through `&self` —
    /// no spawned thread captures it directly (the bus watcher re-fetches
    /// the runtime via `runtime_from_app` each tick and accesses through
    /// that `Arc<VideoPipelineRuntime>`).
    is_seekable: AtomicBool,
    /// Phase A / I5 — duration cached from the seekability probe in `load()`
    /// so `on_segment_done` (segment re-arm) and `seek()` (user scrub
    /// preserving SEGMENT contract) don't have to re-query GStreamer each
    /// time. `None` until the first successful seekable load; cleared by
    /// `unload()`. Stored as plain `Mutex<Option<...>>` (not atomic) because
    /// `gst::ClockTime` is 64 bits and `AtomicU64` would still need a sentinel
    /// for the absent state.
    cached_duration: Mutex<Option<gst::ClockTime>>,
    /// B3 fix: serialize `attach_window` / `detach_window` across windows.
    /// Without this, two near-simultaneous attaches (e.g. user opens
    /// projector + return monitor at once) race the tee request pad
    /// allocation: both call `vtee.request_pad_simple("src_%u")` and both
    /// receive valid pads, but the second one's BLOCK_DOWNSTREAM probe is
    /// not honored because the first attach has already removed its probe
    /// and unblocked buffer flow. Result: second-attached window starts
    /// mid-stream. Holding this mutex for the full attach/detach prevents
    /// the race without taking the long-held `pipeline` lock.
    ///
    /// **Lock-ordering invariant.** All call sites that take this lock,
    /// in the order they were introduced:
    ///   1. [`Self::attach_window`] — IPC handler.
    ///   2. [`Self::detach_window`] — IPC handler.
    ///   3. [`Self::refresh_sinks`] — per-sink GL/D3D11 recovery.
    ///   4. [`Self::load_full`] — cross-URI rebuild (Phase 5 Batch 1).
    ///
    /// Functions that take this lock MUST NOT call other functions that
    /// also take this lock (would deadlock — `Mutex<()>` is not
    /// reentrant). Helper functions like [`pipeline::attach_native_sink`],
    /// [`pipeline::detach_native_sink`], [`pipeline::set_source_uri`], and
    /// [`pipeline::attach_native_sink_or_fakesink`] do NOT take this lock
    /// and can be called from any holder.
    attach_mutex: Mutex<()>,
    /// CD-4 — single-flight gate for loop-driven reload threads. CAS from
    /// `LOOP_OP_IDLE` to `LOOP_OP_RELOADING` at the entry of the unseekable
    /// EOS reload thread; restored to `LOOP_OP_IDLE` when that thread
    /// exits. Failed CAS ⇒ another reload is already in flight, drop this
    /// one. See module-level constants for state values.
    loop_op: AtomicU8,
    /// Phase 5 / Track 1 / Task 1 (A1) — `(window_label → opaque OS window
    /// handle as usize)` for every successful native-sink attach.
    ///
    /// Populated by [`Self::attach_window`] on success; removed by
    /// [`Self::detach_window`]. The map drives the
    /// detach-all-then-reattach-all sequence inside [`Self::load_full`]
    /// (cross-URI rebuilds force `uridecodebin` and the upstream caps to
    /// renegotiate; without detaching the GL/D3D11 sinks first they
    /// inherit stale GL state from the prior stream and fail to convert
    /// the first buffer of the new one — symptom:
    /// `GstGLImageSinkBin/GstGLColorConvertElement: Failed to convert
    /// video buffer`).
    ///
    /// Cleared by [`Self::unload`] when the pipeline is fully torn down.
    /// The cached `usize` is the same opaque value the
    /// `video_pipeline_attach_window` Tauri command resolved on the main
    /// thread (NSView*/HWND/X Window XID/wl_surface*). On reattach the
    /// runtime tries to re-resolve a fresh handle via the Tauri
    /// AppHandle; the cached value is the fallback when re-resolution
    /// fails (e.g. the window was closed between detach and reattach).
    attached_handles: Mutex<HashMap<String, usize>>,
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
            is_seekable: AtomicBool::new(false),
            cached_duration: Mutex::new(None),
            attach_mutex: Mutex::new(()),
            loop_op: AtomicU8::new(LOOP_OP_IDLE),
            attached_handles: Mutex::new(HashMap::new()),
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
    pub fn load(&self, uri: &str, source_key: &str) -> Result<(), AppError> {
        // Phase 3 — source dispatch matrix
        // (`docs/plans/2026-04-26-video-loop-and-first-play-recovery.md`,
        //  amended by `docs/plans/2026-04-26-phase5-hotfix-source-identity-dedup.md`).
        //
        // Same `source_key` as the snapshot ⇒ delegate to in-place
        // `restart()` so we don't tear uridecodebin down through NULL
        // (which on YouTube HLS sources triggers `Couldn't download
        // fragments` because the signed/rate-limited segment URLs can't
        // be re-pulled mid-session).
        //
        // Why `source_key` and NOT `uri`: yt-dlp returns a fresh signed
        // URL on every `resolve_uri()` call (the `expire`, `sig`, `lsig`,
        // `pot` query params rotate per resolution). String-equality on
        // the URI would NEVER match for repeated YouTube loads of the
        // same `videoId`, so the dispatch would always fall through to
        // the heavy `load_full()` rebuild → double-rebuild crash. The
        // stable `source_key` (e.g. `youtube:dQw4w9WgXcQ`) is
        // deterministic per logical source and routes correctly.
        //
        // Different key (or cold start) ⇒ fall through to the existing
        // full-reload path which rebuilds uridecodebin against the new
        // source.
        //
        // Internal callers that explicitly need a full reload (e.g.
        // `on_eos` LoopMode::None unseekable fallback after `restart()`
        // has failed) call `load_full()` directly, bypassing this
        // dispatch.
        let snapshot_key = self.state.snapshot()?.source_key.clone();
        if let Some(existing) = snapshot_key {
            if existing == source_key {
                log::info!(
                    "video_pipeline.load: same source_key={source_key} (URI may differ \
                     for yt-dlp), delegating to restart()"
                );
                return self.restart();
            }
        }

        self.load_full(uri, source_key)
    }

    /// Full pipeline reload (NULL → URI swap → PAUSED) — the legacy
    /// `load()` body. Public `load()` wraps this with the Phase 3 source
    /// dispatch matrix so same-`source_key` calls delegate to `restart()`.
    /// Direct callers of this method commit to the heavy reload path
    /// regardless of snapshot state — used by the unseekable EOS fallback
    /// in `on_eos` after `restart()` has failed.
    ///
    /// `source_key` is the stable identity key written into the snapshot
    /// alongside `uri` so the next `load()` dispatch can detect a same-
    /// source call and route to `restart()` instead of another rebuild.
    /// See `docs/plans/2026-04-26-phase5-hotfix-source-identity-dedup.md`.
    fn load_full(&self, uri: &str, source_key: &str) -> Result<(), AppError> {
        // CRITICAL: serialize against `attach_window` / `detach_window` /
        // `refresh_sinks` for the entire detach → NULL → URI swap → PAUSED →
        // pad-readiness wait → reattach sequence. Without this lock, a
        // concurrent IPC `attach_window("foo")` racing with `load_full`
        // could:
        //   - Insert into `attached_handles` after the detach-pass
        //     snapshot was taken → phantom entry detached again on the
        //     NEXT rebuild OR a double-attach if the IPC lands during
        //     reattach.
        //   - Call `attach_native_sink` while `load_full` is mid-rebuild
        //     (pipeline NULL or pad-discovery in progress) → undefined
        //     GStreamer state.
        //
        // The guard is dropped automatically when `load_full` returns
        // (Ok or Err — the failure paths return through this scope too).
        // Inner helpers (`pipeline::set_source_uri`,
        // `pipeline::detach_native_sink`,
        // `pipeline::attach_native_sink_or_fakesink`) do NOT take this
        // lock themselves, so there is no reentrant-deadlock risk. See
        // the lock-ordering invariant on the `attach_mutex` field doc.
        let _attach_guard = self.attach_mutex.lock().map_err(|e| {
            AppError::Internal(format!(
                "video_pipeline.load_full attach_mutex poisoned: {e}"
            ))
        })?;

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

        // Phase 5 / Track 1 / Task 1 (A1) — snapshot every currently-attached
        // native sink BEFORE the NULL transition. The cross-URI rebuild we're
        // about to perform tears uridecodebin and the upstream caps out
        // through NULL; if we leave the GL/D3D11 sinks attached they
        // inherit stale GL state from the prior stream and the first
        // buffer of the new stream hits a sink whose color-converter is
        // still configured for the old caps. Symptom in dogfood:
        //
        //   GstGLImageSinkBin/GstGLColorConvertElement: Failed to convert
        //   video buffer
        //
        // …blocking PAUSED preroll → the entire load() fails. The
        // detach-before-NULL contract gives each sink a chance to release
        // its GL context cleanly, so the reattach below can build fresh
        // GL/D3D11 contexts against the NEW stream's caps.
        //
        // Best-effort throughout: a per-sink failure logs and continues so
        // a single broken window can't take down the whole reload. We do
        // NOT clear `attached_handles` here — keeping the snapshot map
        // intact lets the reattach loop re-add the SAME labels with
        // possibly-fresher window handles.
        let attached_snapshot: Vec<(String, usize)> = self
            .attached_handles
            .lock()
            .map(|h| h.iter().map(|(k, v)| (k.clone(), *v)).collect())
            .unwrap_or_default();
        if !attached_snapshot.is_empty() {
            log::info!(
                "video_pipeline.load_full: detaching {} native sink(s) before NULL transition: {:?}",
                attached_snapshot.len(),
                attached_snapshot.iter().map(|(l, _)| l).collect::<Vec<_>>()
            );
            for (label, _) in &attached_snapshot {
                if let Err(e) = pipeline::detach_native_sink(&pipeline, label) {
                    log::warn!(
                        "video_pipeline.load_full: pre-NULL detach for '{label}' failed: {e} \
                         (continuing — reattach will best-effort rebuild)"
                    );
                }
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

        // Helper closure: drain bus error messages and reset pipeline to NULL
        // so the next load() starts clean. Returns concatenated error detail.
        // Used by both the synchronous set_state failure path and the async
        // state-wait failure path — without this, the frontend toast surfaces
        // an opaque "Element failed to change its state" with no root cause.
        //
        // Phase 5 / Track 1 / Batch 1 review fix (Important 2): also clear
        // `attached_handles` on the failure path. Sinks were detached at the
        // top of `load_full` and the pipeline is now NULL'd, so the map's
        // entries no longer correspond to live tee branches. The frontend
        // must call `attach_window` again after a load failure anyway, so
        // emptying the map matches the actual state. Without this, the next
        // `load_full` retry would idempotently re-detach phantom entries
        // and `resolve_window_handle` may fail if the user's window was
        // destroyed in the interim.
        let drain_and_reset = || -> String {
            let mut detail = String::new();
            if let Some(bus) = pipeline.bus() {
                while let Some(msg) = bus.pop() {
                    if let gst::MessageView::Error(err) = msg.view() {
                        if !detail.is_empty() {
                            detail.push_str("; ");
                        }
                        let src = err
                            .src()
                            .map(|s| s.path_string().to_string())
                            .unwrap_or_else(|| "<unknown>".into());
                        detail.push_str(&format!("{src}: {}", err.error()));
                        if let Some(d) = err.debug() {
                            detail.push_str(&format!(" ({d})"));
                        }
                    }
                }
            }
            // Failures during PAUSED transition leave uridecodebin in a half-
            // built state where retrying without NULL first fails repeatedly.
            let _ = pipeline.set_state(gst::State::Null);
            // Wait for NULL to settle so the recovery teardown finishes before
            // the caller retries. Best-effort; swallow errors.
            let _ = pipeline.state(gst::ClockTime::from_seconds(2));
            // Clear `attached_handles` — sinks were detached at the top of
            // `load_full` and the pipeline is now NULL, so the map no
            // longer reflects reality. Best-effort: ignore poisoned lock.
            if let Ok(mut handles) = self.attached_handles.lock() {
                if !handles.is_empty() {
                    log::warn!(
                        "video_pipeline.load_full: failure path clearing {} \
                         entry/entries from attached_handles ({:?}) — sinks \
                         were already detached at the top of load_full and \
                         the pipeline is now NULL'd, so the map no longer \
                         reflects live tee branches. Frontend must reattach.",
                        handles.len(),
                        handles.keys().collect::<Vec<_>>()
                    );
                    handles.clear();
                }
            }
            detail
        };

        if let Err(e) = pipeline.set_state(gst::State::Paused) {
            // Synchronous state-change failure (rare for Pipeline elements but
            // surfaces on first-load when uridecodebin can't validate the URI
            // synchronously, or when prior failure left pipeline corrupted).
            // Drain bus + reset before returning.
            let detail = drain_and_reset();
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" — {detail}")
            };
            return Err(AppError::Internal(format!(
                "video_pipeline.load set_state(PAUSED): {e}{suffix}"
            )));
        }
        // Block until PAUSED is fully reached (GstMessage::AsyncDone). This
        // ensures uridecodebin has discovered and linked ALL pads (audio +
        // video) and every sink has prerolled before the caller calls play().
        // Without this wait, play() races pad-added: the H.264 video pad is
        // discovered first so video renders immediately, while the audio pad
        // arrives later — producing an audible "video without audio" gap on
        // every load. The NULL wait above uses the same pattern.
        let (change_result, _current, _pending) = pipeline.state(gst::ClockTime::NONE);
        if let Err(e) = change_result {
            let detail = drain_and_reset();
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" — {detail}")
            };
            return Err(AppError::Internal(format!(
                "video_pipeline.load PAUSED state wait: {e}{suffix}"
            )));
        }

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

        // Phase 5 / Track 1 / Task 1 (A1) — reattach every native sink
        // that was attached before the NULL transition. We do this AFTER
        // PAUSED settled + pad-discovery completed so:
        //   (a) the new stream's caps are fully negotiated upstream of the
        //       tee (the new `video_caps` capsfilter from Task 3 ensures a
        //       single canonical I420/NV12 format is locked in by now),
        //   (b) the BLOCK_DOWNSTREAM probe inside `attach_native_sink`
        //       has known-good caps to gate buffers against,
        //   (c) the per-sink fakesink fallback (Task 2) can engage
        //       without leaving the pipeline half-attached.
        //
        // Handle re-fetch policy: try `WebviewWindow::raw_window_handle()`
        // through the AppHandle first (Tauri may have reallocated the
        // underlying NSView/HWND if the window was hidden + reshown
        // between detach and reattach); fall back to the cached `usize`
        // when re-resolution fails (e.g. window was destroyed entirely).
        if !attached_snapshot.is_empty() {
            if let Some(app) = self.app.as_ref() {
                log::info!(
                    "video_pipeline.load_full: reattaching {} native sink(s) after PAUSED",
                    attached_snapshot.len()
                );
                for (label, cached_handle) in &attached_snapshot {
                    let resolved = resolve_window_handle(app, label).unwrap_or_else(|e| {
                        log::warn!(
                            "video_pipeline.load_full: re-resolve handle for '{label}' \
                             failed ({e}); falling back to cached value 0x{:x}",
                            cached_handle
                        );
                        *cached_handle
                    });
                    match pipeline::attach_native_sink_or_fakesink(&pipeline, label, resolved) {
                        Ok(AttachResult::Native) => {
                            // Refresh cached handle in case re-resolution gave
                            // us a fresher value (window surface re-allocated).
                            if let Ok(mut handles) = self.attached_handles.lock() {
                                handles.insert(label.clone(), resolved);
                            }
                        }
                        Ok(AttachResult::Fakesink { reason }) => {
                            log::warn!(
                                "video_pipeline.load_full: reattach for '{label}' fell back \
                                 to fakesink ({reason})"
                            );
                            // Still refresh the cached handle so a follow-up
                            // refreshSinks() can retry the native path against
                            // the latest known good window value.
                            if let Ok(mut handles) = self.attached_handles.lock() {
                                handles.insert(label.clone(), resolved);
                            }
                            let event = VideoPipelineSinkDegraded {
                                window_label: label.clone(),
                                reason,
                            };
                            if let Err(emit_err) = event.emit(app) {
                                log::warn!(
                                    "video_pipeline.load_full: emit \
                                     VideoPipelineSinkDegraded for '{label}' failed: \
                                     {emit_err}"
                                );
                            }
                        }
                        Err(e) => {
                            log::warn!(
                                "video_pipeline.load_full: reattach for '{label}' failed \
                                 entirely ({e}); dropping from attached_handles"
                            );
                            if let Ok(mut handles) = self.attached_handles.lock() {
                                handles.remove(label);
                            }
                            let event = VideoPipelineSinkDegraded {
                                window_label: label.clone(),
                                reason: format!(
                                    "reattach failed (no fakesink fallback): {e}"
                                ),
                            };
                            if let Err(emit_err) = event.emit(app) {
                                log::warn!(
                                    "video_pipeline.load_full: emit \
                                     VideoPipelineSinkDegraded for '{label}' failed: \
                                     {emit_err}"
                                );
                            }
                        }
                    }
                }
            } else {
                // Phase 5 / Track 1 / Batch 1 review fix (Important 3):
                // when `app` is None (test mode), we have no AppHandle to
                // re-resolve window handles against, so the snapshot
                // cannot be reattached. The sinks were detached at the
                // top of `load_full`, so leaving the map populated would
                // create phantom entries pointing at nothing. Clear the
                // map to match actual state — the test harness must call
                // `attach_window` again after a load if it wants sinks
                // reattached.
                log::warn!(
                    "video_pipeline.load_full: {} attached sink(s) detached for rebuild but \
                     no AppHandle present to re-resolve window handles ({:?}); clearing \
                     attached_handles to match actual state — caller must reattach",
                    attached_snapshot.len(),
                    attached_snapshot.iter().map(|(l, _)| l).collect::<Vec<_>>()
                );
                if let Ok(mut handles) = self.attached_handles.lock() {
                    handles.clear();
                }
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

        // Phase A — seekability probe + initial SEGMENT seek.
        //
        // The canonical GStreamer loop primitive is `seek(SEGMENT)` +
        // `SEGMENT_DONE` bus message: the pipeline emits `SegmentDone` at the
        // end of each segment instead of EOS, the bus watcher re-arms
        // `seek(SEGMENT)` (no FLUSH) for the next iteration. The pipeline
        // never reaches EOS state, sinks never see flush events on loop, and
        // native sinks (P3.x's reattach hell) are entirely sidestepped.
        //
        // Source must support seeking. `uridecodebin` answers a `Seeking`
        // query once it has reached PAUSED. HTTP YouTube URLs are seekable
        // (range requests); local MP4 is seekable; live streams are not.
        // When non-seekable, fall back to the legacy P3.18-P3.21 EOS-based
        // reload path (left in place; gated on `is_seekable=false`).
        let mut seekable = false;
        let mut duration_for_seek = gst::ClockTime::ZERO;
        let mut q = gst::query::Seeking::new(gst::Format::Time);
        // I2: log the pipeline state at probe time so production logs can
        // distinguish "probe ran too early (Async transition)" from "source is
        // genuinely non-seekable". `pipeline.state(NONE)` above blocked until
        // PAUSED was reached, so this should always be PAUSED — but if a
        // future refactor races, we'll see it here.
        log::debug!(
            "video_pipeline.load: seekability probe at state={:?}",
            pipeline.current_state()
        );
        let queried = pipeline.query(&mut q);
        if queried {
            // I3: `_start` is intentionally discarded. Some demuxers report
            // (seekable=true, start=NONE, end=NONE); we trust `seekable`
            // alone and resolve duration via `query_duration` fallback below.
            let (s, _start, end) = q.result();
            seekable = s;
            if let gst::GenericFormattedValue::Time(Some(t)) = end {
                duration_for_seek = t;
            }
        } else {
            log::warn!(
                "video_pipeline.load: Seeking query returned false at state={:?} — \
                 probe-too-early or source genuinely refuses query",
                pipeline.current_state()
            );
        }
        // Fallback: query duration directly when Seeking.end is unset
        // (some demuxers report seekable=true but leave end=NONE).
        if duration_for_seek.is_zero() {
            if let Some(d) = pipeline.query_duration::<gst::ClockTime>() {
                duration_for_seek = d;
            }
        }
        if seekable && !duration_for_seek.is_zero() {
            // Phase A regression fix: only ARM the SEGMENT seek when the
            // user actually wants to loop. Issuing `seek(FLUSH | SEGMENT)`
            // on a freshly-PAUSED pipeline flushes the prerolled buffers
            // that the audio frame-ready probe is waiting for; the
            // projection windows then never see ready=true and the slide
            // buffer holds the previous content forever (visible symptom:
            // "video doesn't show up").
            //
            // Mark the source as seekable + cache duration so future
            // `set_loop(One)` toggles or user scrubs in loop mode can use
            // the canonical SEGMENT primitive — but defer the actual seek
            // until set_loop(One) recovery handles it. For non-loop
            // playback (the common case), the pipeline runs to natural
            // EOS and on_eos's LoopMode::None path fires queue advance.
            self.is_seekable.store(true, Ordering::SeqCst);
            if let Ok(mut cached) = self.cached_duration.lock() {
                *cached = Some(duration_for_seek);
            }
            let initial_loop_mode = self.state.snapshot().map(|s| s.loop_mode).ok();
            if initial_loop_mode == Some(LoopMode::One) {
                log::info!(
                    "video_pipeline.load: seekable=true, dur={}ms, loop=One — arming SEGMENT seek",
                    duration_for_seek.mseconds()
                );
                if let Err(e) = self.arm_segment_seek(
                    &pipeline,
                    gst::ClockTime::ZERO,
                    duration_for_seek,
                    true,
                ) {
                    log::warn!(
                        "video_pipeline.load: initial SEGMENT seek failed ({e}); \
                         falling back to legacy EOS-based loop path"
                    );
                    self.is_seekable.store(false, Ordering::SeqCst);
                    if let Ok(mut cached) = self.cached_duration.lock() {
                        *cached = None;
                    }
                }
            } else {
                log::info!(
                    "video_pipeline.load: seekable=true, dur={}ms, loop={:?} — segment deferred",
                    duration_for_seek.mseconds(),
                    initial_loop_mode
                );
            }
        } else {
            log::info!(
                "video_pipeline.load: seekable={seekable} dur={}ms (queried={queried}) — using \
                 legacy EOS-based loop fallback",
                duration_for_seek.mseconds()
            );
            self.is_seekable.store(false, Ordering::SeqCst);
            // I5: clear stale cached duration from a prior seekable load.
            if let Ok(mut cached) = self.cached_duration.lock() {
                *cached = None;
            }
        }

        self.state
            .set_source(uri.to_string(), source_key.to_string())?;
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
    /// sourceless pipeline returns `StateChangeError` because uridecodebin has
    /// no URI to plug. The snapshot is still updated so any UI bound to
    /// `paused` reflects intent.
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
    /// **Phase A regression follow-up:** post-EOS recovery applies to BOTH
    /// is_seekable=true and is_seekable=false sources. Originally the
    /// canonical SEGMENT loop was supposed to keep seekable pipelines from
    /// ever reaching EOS, but the initial-segment arm was deferred to
    /// `set_loop(One)` (the FLUSH-on-PAUSED regression), which means
    /// LoopMode::None playback DOES reach natural EOS even on seekable
    /// sources. After that EOS, gst rejects `seek_simple` on the now-
    /// terminal pipeline; the user-visible symptom is "Failed to seek"
    /// when they scrub back or the queue advances. Fall through to the
    /// reload+seek recovery using the cached URI — but ONLY when the
    /// `post_eos` heuristic indicates a terminal pipeline. An unconditional
    /// reload on every `try_seek_simple` rejection races the SEGMENT loop
    /// (broadcaster → on_segment_done → arm_segment_seek can return Err
    /// transiently mid-transition) and would re-`load()` the pipeline on
    /// every loop iteration.
    pub fn seek(&self, secs: f64) -> Result<(), AppError> {
        let secs = secs.max(0.0);

        // EOS detection — done OUTSIDE the pipeline lock so the recovery
        // path (which calls `load()` → takes the pipeline lock) doesn't
        // deadlock. Heuristic: position within `EOS_PROXIMITY_US` of
        // duration AND pipeline in Playing/Paused.
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
                let (_, current, pending) = pipeline.state(gst::ClockTime::ZERO);
                let stable_and_seekable = pending == gst::State::VoidPending
                    && (current == gst::State::Paused || current == gst::State::Playing);
                stable_and_seekable && dur > 0 && pos >= dur.saturating_sub(EOS_PROXIMITY_US)
            } else {
                false
            }
        };

        if post_eos {
            // CD-4 single-flight: `restart()` self-gates via the `loop_op`
            // CAS, so a user scrub landing exactly at EOS that races
            // `on_eos`'s reload thread will be dropped at the inner CAS
            // and return Ok harmlessly. The follow-up `seek_simple(secs)`
            // below runs unconditionally because by then `restart()` has
            // either completed (gate released) or been dropped (no-op);
            // either way the pipeline is in a consistent state for the
            // subsequent seek.
            log::info!(
                "video_pipeline.seek({secs:.3}s): post-EOS recovery, \
                 doing in-place restart + seek"
            );
            // Phase 3 (2026-04-26) — switched from full pipeline reload to
            // in-place `restart()` so YouTube HLS sources don't re-pull
            // signed/rate-limited segments mid-session. `restart()` leaves
            // the pipeline in PLAYING at position 0; we then seek to the
            // user-requested position.
            self.restart()?;
            {
                let guard = self.pipeline.lock()?;
                if let Some(pipeline) = guard.as_ref() {
                    let useconds = (secs * 1_000_000.0) as u64;
                    let position = gst::ClockTime::from_useconds(useconds);
                    pipeline
                        .seek_simple(
                            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                            position,
                        )
                        .map_err(|e| {
                            AppError::Internal(format!(
                                "video_pipeline.seek({secs:.3}s) post-EOS post-restart seek_simple: {e}"
                            ))
                        })?;
                }
            }
            self.state.seek(secs)?;
            return Ok(());
        }

        // Non-post-EOS: try the fast-path seek. If gst rejects it, surface
        // the error as AppError (the pre-`98db5ff` behaviour) instead of
        // racing into a full reload — that race is what produced the
        // "video_pipeline.load PAUSED state wait" cascade on every loop
        // iteration after commit `98db5ff`.
        match self.try_seek_simple(secs)? {
            Ok(()) => {
                self.state.seek(secs)?;
                Ok(())
            }
            Err(msg) => Err(AppError::Internal(format!(
                "video_pipeline.seek({secs:.3}s): {msg}"
            ))),
        }
    }

    /// Attempt the fast-path seek (no reload). Returns:
    /// - `Ok(Ok(()))` — seek issued successfully (or pipeline absent / mid-
    ///   transition, which is silently fine; snapshot still updates).
    /// - `Ok(Err(msg))` — gst rejected the seek; caller should fall back
    ///   to reload+seek recovery.
    /// - `Err(_)` — lock poisoned or other infrastructure failure.
    fn try_seek_simple(&self, secs: f64) -> Result<Result<(), String>, AppError> {
        let guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.as_ref() {
            // Non-blocking state query (timeout = 0).
            let (_, current, pending) = pipeline.state(gst::ClockTime::ZERO);
            let stable_and_seekable = pending == gst::State::VoidPending
                && (current == gst::State::Paused || current == gst::State::Playing);
            if !stable_and_seekable {
                // Mid-transition or NULL/READY — silently treat as success;
                // snapshot still updates. Same contract as the legacy code.
                return Ok(Ok(()));
            }
            let useconds = (secs * 1_000_000.0) as u64;
            let position = gst::ClockTime::from_useconds(useconds);
            // C1: when the canonical SEGMENT loop is active (is_seekable=true
            // AND loop=One), a `seek_simple(FLUSH | KEY_UNIT)` would flush
            // away the armed segment — pipeline plays to natural EOS,
            // SEGMENT_DONE never fires, on_eos LoopMode::One ignores
            // (is_seekable=true guard), video freezes. Issue a fresh
            // SEGMENT seek with the cached duration as `stop` to keep the
            // loop alive across user scrubs.
            let seekable_loop = self.is_seekable.load(Ordering::SeqCst)
                && self.state.snapshot()?.loop_mode == LoopMode::One;
            if seekable_loop {
                let stop = self.cached_duration_or_zero();
                if !stop.is_zero() {
                    if let Err(e) = self.arm_segment_seek(pipeline, position, stop, true) {
                        return Ok(Err(format!("arm_segment_seek from {current:?}: {e}")));
                    }
                    return Ok(Ok(()));
                }
                // cached_duration unset while is_seekable=true: clear the
                // flag so the next natural EOS reaches the legacy reload
                // path, then fall through to plain seek_simple.
                log::warn!(
                    "video_pipeline.seek({secs:.3}s): seekable_loop but \
                     cached_duration unset — clearing is_seekable"
                );
                self.is_seekable.store(false, Ordering::SeqCst);
            }
            if let Err(e) = pipeline.seek_simple(
                gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                position,
            ) {
                return Ok(Err(format!("seek_simple from {current:?}: {e}")));
            }
        }
        Ok(Ok(()))
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

            // C2 (round-2 rebuild): if the user toggles loop ON after natural
            // EOS (or near-EOS) on a seekable source, the original load()-time
            // SEGMENT seek already fired SEGMENT_DONE → was converted to EOS
            // (loop=None path) → the bus watcher exited. Just respawning the
            // watcher doesn't re-arm the SEGMENT contract — there's no
            // SegmentDone pending. Detect "at/near EOS" and re-arm a fresh
            // SEGMENT seek from position 0 so the canonical loop resumes.
            //
            // **Round-2 fix:** the prior implementation read
            // `snap.position_secs` from the state-snapshot mirror. That mirror
            // is only written by `load()` (sets to 0.0) and `seek()` (user
            // input) — the broadcaster reads `query_position()` from the live
            // pipeline but does NOT write back. During normal playback
            // `snap.position_secs` stayed at 0.0, the heuristic was always
            // false, and this entire branch was dead code. Query the live
            // pipeline directly (mirrors the broadcaster pattern) for the
            // truthful current position.
            //
            // **Lock-ordering note (I1-rev):** we acquire `cached_duration`
            // FIRST (this scope), let it drop at scope end, THEN take the
            // pipeline lock for the live position query and seek. Inverting
            // the order (pipeline → cached_duration) would conflict with
            // `seek()` and `on_segment_done` which hold the pipeline lock
            // across `cached_duration_or_zero()`. Keep cached_duration access
            // outside / before any pipeline-lock scope here.
            if self.is_seekable.load(Ordering::SeqCst) {
                let stop = self.cached_duration_or_zero();
                let dur_secs = stop.useconds() as f64 / 1_000_000.0;

                // Query live position. None ⇒ pipeline gone or query failed
                // (mid-NULL→PAUSED transition); skip recovery, the next
                // explicit play()/seek() from the user resolves it.
                let live_pos = {
                    let guard = self.pipeline.lock()?;
                    guard
                        .as_ref()
                        .and_then(|p| p.query_position::<gst::ClockTime>())
                };
                let pos_us = match live_pos {
                    Some(t) => t.useconds(),
                    None => {
                        log::info!(
                            "video_pipeline: set_loop(One) recovery — live position \
                             unavailable; skipping (no pipeline or query failed)"
                        );
                        return Ok(());
                    }
                };
                let dur_us = stop.useconds();
                // M3-rev: shared `EOS_PROXIMITY_US` tolerance. After natural
                // EOS the live position can equal duration exactly, sit a few
                // ms short, or jump back to 0 (decoder reset). We treat
                // `pos >= dur - 100ms` as "at/near end" — this matches the
                // tolerance used by `seek()`'s post-EOS heuristic on the
                // unseekable fallback. `pos == 0 && dur > 0` (post-EOS jump
                // back) is NOT covered here intentionally: in that case the
                // pipeline is already at the start of the segment, plain
                // `play()` from the watcher respawn is enough.
                let near_eos = dur_us > 0
                    && pos_us >= dur_us.saturating_sub(EOS_PROXIMITY_US);
                let pos_secs = pos_us as f64 / 1_000_000.0;
                // Phase A regression fix companion: load() no longer arms
                // the initial SEGMENT seek for default-None loads, so any
                // path that flips loop to One (mid-playback OR at EOS) must
                // arm here. Two cases:
                //  - near EOS / post-EOS: seek from 0 with FLUSH, then play
                //    (matches the original C2 recovery scenario).
                //  - mid-playback: seek from current_pos with FLUSH so the
                //    upcoming end emits SEGMENT_DONE instead of EOS. The
                //    FLUSH causes a brief audio glitch (~1 frame) which is
                //    the price of toggling loop mid-track; subsequent
                //    iterations re-arm without FLUSH via on_segment_done.
                if !stop.is_zero() {
                    let (start, label) = if near_eos {
                        (gst::ClockTime::ZERO, "at/near EOS — re-arming from 0")
                    } else {
                        (
                            gst::ClockTime::from_useconds(pos_us),
                            "mid-playback — arming from current position",
                        )
                    };
                    log::info!(
                        "video_pipeline: set_loop(One) {label} \
                         (live_pos={pos_secs:.3}s dur={dur_secs:.3}s)"
                    );
                    let arm_result = {
                        let guard = self.pipeline.lock()?;
                        guard.as_ref().map(|pipeline| {
                            self.arm_segment_seek(pipeline, start, stop, true)
                        })
                    };
                    match arm_result {
                        Some(Err(e)) => {
                            log::warn!(
                                "video_pipeline: set_loop(One) arm seek failed: {e} \
                                 — attempting in-place restart() recovery"
                            );
                            // Phase 3 (2026-04-26) — `arm_segment_seek` rejects
                            // FLUSH-segment-seek when uridecodebin is in a
                            // terminal/transitional state at EOS. Try in-place
                            // restart so the next loop iteration can resume
                            // without a full pipeline reload (which on YouTube
                            // HLS would trigger fragment re-download failures).
                            match self.restart() {
                                Ok(()) => log::info!(
                                    "video_pipeline: set_loop(One) restart() recovery succeeded"
                                ),
                                Err(re) => log::warn!(
                                    "video_pipeline: set_loop(One) restart() recovery failed: {re}"
                                ),
                            }
                        }
                        Some(Ok(())) => {
                            if near_eos {
                                // FLUSH-from-EOS leaves state at PAUSED; user
                                // expects playback to resume when toggling
                                // loop on at end. `play()` is idempotent for
                                // an already-PLAYING pipeline (mid-playback
                                // case).
                                if let Err(e) = self.play() {
                                    log::warn!(
                                        "video_pipeline: set_loop(One) play() \
                                         after re-arm failed: {e}"
                                    );
                                }
                            }
                        }
                        None => {
                            // Pipeline dropped between live-position query
                            // and here (concurrent unload). Nothing to do.
                        }
                    }
                }
            }
        }
        Ok(())
    }

    /// In-place restart of the currently-loaded URI (Phase 3 — see
    /// `docs/plans/2026-04-26-video-loop-and-first-play-recovery.md`).
    ///
    /// Avoids a full pipeline reload (NULL → URI swap → PAUSED → PLAYING)
    /// which on YouTube HLS sources triggers `GstHLSDemux: Couldn't download
    /// fragments` because re-pulling signed/rate-limited segments from
    /// scratch fails mid-session. The in-place sequence keeps uridecodebin's
    /// already-discovered pads + downloaded fragments intact:
    ///
    /// 1. `set_state(Paused)` — transitions back from EOS / PLAYING
    /// 2. wait state stable (`pipeline.state(NONE)`)
    /// 3. `seek_simple(FLUSH | KEY_UNIT, 0)` — reset playhead
    /// 4. `set_state(Playing)` — resume playback
    /// 5. wait state stable
    ///
    /// **Sourceless guard:** restart is the user-facing "loop / replay"
    /// action. When no URI has been loaded — typical after `unload()` clears
    /// the queue, or before the first load() on a freshly-built pipeline —
    /// succeed silently (nothing to restart). Regression guard:
    /// `restart_with_no_source_is_silent_noop` test.
    ///
    /// **Lock-ordering note:** the pipeline guard is dropped before
    /// `state.seek()` / `state.play()` so we don't hold pipeline.lock()
    /// across a state-lock acquisition (matches the established `seek()` /
    /// `play()` pattern in this file).
    pub fn restart(&self) -> Result<(), AppError> {
        // Single-flight gate: a concurrent restart attempt is dropped.
        // Whichever caller wins the CAS does the work; loser early-returns
        // Ok because the winner will leave the pipeline in the same end
        // state. Without this gate, parallel callers (load() same-URI
        // dispatch, set_loop(One) recovery, Tauri command, on_eos fallback)
        // could issue concurrent set_state(Paused) / set_state(Playing) /
        // seek_simple events on the same pipeline → race + undefined gst
        // behaviour.
        //
        // Internal callers that already hold the gate (currently `on_eos`'s
        // reload thread, which needs to keep the gate held across the
        // restart-then-fallback-to-load_full sequence) MUST call
        // `restart_unguarded()` directly to avoid double-acquire.
        if self
            .loop_op
            .compare_exchange(
                LOOP_OP_IDLE,
                LOOP_OP_RELOADING,
                Ordering::SeqCst,
                Ordering::SeqCst,
            )
            .is_err()
        {
            log::info!("video_pipeline.restart: another loop op in flight, dropping");
            return Ok(());
        }
        let _release = LoopOpGuard::new(&self.loop_op);
        self.restart_unguarded()
    }

    /// Inner restart body — assumes the caller already holds the
    /// `loop_op` CAS gate. Public [`restart`] wraps this with CAS +
    /// `LoopOpGuard`. Direct callers commit to managing the gate
    /// themselves (currently only `on_eos`'s reload thread, which needs
    /// to keep the gate held across the restart-then-load_full fallback
    /// sequence).
    ///
    /// **Frame-ready event note:** in-place restart preserves the
    /// existing pipeline (uridecodebin, decoders, sinks all stay alive),
    /// so the previously-rendered frame stays valid on the projection
    /// windows. We deliberately do NOT emit
    /// `video-pipeline-frame-ready { ready: false }` here — projection
    /// windows should keep showing the current (final) frame across the
    /// brief PAUSED → seek(0) → PLAYING hitch rather than blanking back
    /// to the prior slide. Contrast with `load_full()` which DOES emit
    /// `ready: false` because the pipeline is being torn down to NULL.
    fn restart_unguarded(&self) -> Result<(), AppError> {
        if self.state.snapshot()?.uri.is_none() {
            return Ok(());
        }

        // Local helper: drain bus error messages so any returned AppError
        // carries diagnostic detail instead of an opaque "Element failed to
        // change its state". Mirrors the `drain_and_reset` closure in
        // `load()` but does NOT force the pipeline to NULL — restart's whole
        // purpose is to keep uridecodebin's state intact.
        let drain_bus_errors = |pipeline: &gst::Pipeline| -> String {
            let mut detail = String::new();
            if let Some(bus) = pipeline.bus() {
                while let Some(msg) = bus.pop() {
                    if let gst::MessageView::Error(err) = msg.view() {
                        if !detail.is_empty() {
                            detail.push_str("; ");
                        }
                        let src = err
                            .src()
                            .map(|s| s.path_string().to_string())
                            .unwrap_or_else(|| "<unknown>".into());
                        detail.push_str(&format!("{src}: {}", err.error()));
                        if let Some(d) = err.debug() {
                            detail.push_str(&format!(" ({d})"));
                        }
                    }
                }
            }
            detail
        };

        // Take the pipeline out of the guard scope so we don't hold it
        // across `state.seek()` / `state.play()` (those acquire the state
        // lock). The Pipeline is internally an Arc-like GObject — cloning
        // it is cheap and the cloned reference keeps the underlying object
        // alive even if `unload()` clears the slot mid-restart.
        let pipeline = {
            let guard = self.pipeline.lock()?;
            match guard.as_ref() {
                Some(p) => p.clone(),
                None => {
                    return Err(AppError::Internal(
                        "video_pipeline.restart: no pipeline loaded".into(),
                    ));
                }
            }
        };

        // Step 1: set_state(Paused).
        if let Err(e) = pipeline.set_state(gst::State::Paused) {
            let detail = drain_bus_errors(&pipeline);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" — {detail}")
            };
            return Err(AppError::Internal(format!(
                "video_pipeline.restart set_state(PAUSED): {e}{suffix}"
            )));
        }
        // Step 2: wait stable (5 s cap — prevents indefinite IPC/thread block
        // when the pipeline is in an error or terminal state).
        let (change_result, _current, _pending) =
            pipeline.state(gst::ClockTime::from_seconds(5));
        if let Err(e) = change_result {
            let detail = drain_bus_errors(&pipeline);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" — {detail}")
            };
            return Err(AppError::Internal(format!(
                "video_pipeline.restart PAUSED state wait: {e}{suffix}"
            )));
        }

        // Step 3: seek to 0 with FLUSH | KEY_UNIT.
        if let Err(e) = pipeline.seek_simple(
            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
            gst::ClockTime::ZERO,
        ) {
            return Err(AppError::Internal(format!(
                "video_pipeline.restart seek_simple(0): {e}"
            )));
        }

        // Step 4: set_state(Playing).
        if let Err(e) = pipeline.set_state(gst::State::Playing) {
            let detail = drain_bus_errors(&pipeline);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" — {detail}")
            };
            return Err(AppError::Internal(format!(
                "video_pipeline.restart set_state(PLAYING): {e}{suffix}"
            )));
        }
        // Step 5: wait stable (5 s cap — same rationale as the PAUSED wait above).
        let (change_result, _current, _pending) =
            pipeline.state(gst::ClockTime::from_seconds(5));
        if let Err(e) = change_result {
            let detail = drain_bus_errors(&pipeline);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" — {detail}")
            };
            return Err(AppError::Internal(format!(
                "video_pipeline.restart PLAYING state wait: {e}{suffix}"
            )));
        }

        // Mirror snapshot. `state.seek(0)` resets `position_secs` to 0;
        // `state.play()` flips `paused = false`. Both acquire the state
        // lock — pipeline guard is already dropped above.
        self.state.seek(0.0)?;
        self.state.play()?;
        Ok(())
    }

    /// Bus-watcher callback for end-of-stream (Task 3.1).
    ///
    /// **Phase A note — this path is the unseekable-source fallback only.**
    /// The canonical loop is now `on_segment_done`. EOS reaches this handler
    /// from two distinct origins, both converge on `LoopMode::None`:
    ///   1. **Natural EOS** — only the unseekable fallback reaches this
    ///      naturally; the seekable SEGMENT loop never reaches EOS state
    ///      during normal playback.
    ///   2. **Synthetic EOS** — `on_segment_done::LoopMode::None` posts
    ///      `Eos::new()` on the pipeline so this handler still drives the
    ///      "advance the queue" UX. The synthetic event traverses the
    ///      pipeline before reaching the bus, so by the time we set
    ///      `bus_watcher_stop=true` the EOS message has already been popped
    ///      — same shutdown contract works for both.
    ///
    /// Loop one (unseekable only) → full pipeline reload. Loop none → emit
    /// the typed [`VideoPipelineEnded`] event so the frontend can advance
    /// the queue.
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
                // Phase A — when the source is seekable, loop is handled by
                // the canonical `seek(SEGMENT)` + `SEGMENT_DONE` path
                // (`on_segment_done`). The pipeline never reaches EOS state in
                // that flow, so reaching this arm with `is_seekable=true` is
                // unexpected; ignore defensively to avoid a stray reload that
                // would compete with the segment-done re-arm.
                if self.is_seekable.load(Ordering::SeqCst) {
                    log::warn!(
                        "video_pipeline: on_eos LoopMode::One fired with is_seekable=true — \
                         ignoring (canonical SEGMENT loop owns this path)"
                    );
                    return;
                }
                // Phase A unseekable fallback — legacy P3.18 reload path.
                // Retained for sources that don't support range seeks (live
                // HTTP streams, certain demuxers). The canonical SEGMENT
                // loop short-circuits this arm via the `is_seekable` guard
                // above; only sources that failed the seekability probe
                // ever reach this code.
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
                // PAUSED/PLAYING transitions complete cleanly.
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
                // CD-4: CAS-acquire the loop op gate BEFORE spawning so two
                // EOS messages can never race to spawn two reload threads
                // (which would both contend on the pipeline lock and observe
                // a half-disposed pipeline). On failed CAS, log + drop —
                // whichever thread already won will reload to the same URI.
                if self
                    .loop_op
                    .compare_exchange(
                        LOOP_OP_IDLE,
                        LOOP_OP_RELOADING,
                        Ordering::SeqCst,
                        Ordering::SeqCst,
                    )
                    .is_err()
                {
                    log::info!(
                        "video_pipeline: on_eos LoopMode::One — reload already in flight, \
                         dropping duplicate EOS"
                    );
                    return;
                }
                std::thread::spawn(move || {
                    let runtime = match runtime_from_app(&app) {
                        Some(r) => r,
                        None => {
                            log::warn!(
                                "video_pipeline: on_eos reload thread — runtime missing"
                            );
                            // CD-4: app went away (shutdown raced spawn).
                            // No runtime ⇒ nothing to release the gate on,
                            // and the process is exiting anyway. Returning
                            // without release is safe here.
                            return;
                        }
                    };
                    // RAII guard so every early-return path below releases
                    // the loop_op gate. Without this any `return` after this
                    // point would leak `LOOP_OP_RELOADING` and permanently
                    // block all future reload attempts.
                    let _release = LoopOpGuard::new(&runtime.loop_op);
                    let (uri, source_key) = match runtime.state.snapshot() {
                        Ok(s) => (s.uri.clone(), s.source_key.clone()),
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
                    let source_key = source_key.unwrap_or_else(|| uri.clone());
                    // Phase 3 (2026-04-26) — try in-place `restart()` first so
                    // we don't re-pull HLS fragments / re-build uridecodebin on
                    // every loop iteration. Falls through to the legacy
                    // `load_full` (full reload) only when restart() fails
                    // (preserves the unseekable-source fallback for live
                    // streams that genuinely can't restart in place).
                    //
                    // We call `load_full` (not `load`) because the public
                    // `load()` would dispatch back to `restart()` for the
                    // same URI, infinitely deferring the actual full reload
                    // we need here.
                    //
                    // Use `restart_unguarded` (NOT public `restart`) because
                    // the on_eos handler already holds the `loop_op` CAS
                    // gate (acquired pre-spawn, released by `_release` on
                    // thread exit). Calling public `restart()` would CAS
                    // against an already-held gate, see it busy, log
                    // "another loop op in flight, dropping", and return
                    // Ok early — masking real restart failures and
                    // skipping the load_full fallback.
                    match runtime.restart_unguarded() {
                        Ok(()) => {
                            log::info!(
                                "video_pipeline: on_eos LoopMode::One — in-place restart \
                                 succeeded (thread)"
                            );
                            return;
                        }
                        Err(e) => {
                            log::warn!(
                                "video_pipeline: on_eos LoopMode::One — restart() failed \
                                 ({e}); falling back to full reload"
                            );
                        }
                    }
                    if let Err(e) = runtime.load_full(&uri, &source_key) {
                        log::warn!(
                            "video_pipeline: on_eos reload thread load_full() failed: {e}"
                        );
                        return;
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

    /// M2-rev — centralized accessor for `cached_duration`.
    ///
    /// Returns `gst::ClockTime::ZERO` when the cache hasn't been populated
    /// (load probe didn't run yet, was cleared by `unload()`, or the mutex
    /// is poisoned). Callers that branch on "is the duration known?" should
    /// check `result.is_zero()` to detect the absent case — the original
    /// `Mutex<Option<gst::ClockTime>>` shape is preserved so future callers
    /// that need three-way logic (None / zero-duration / positive) can still
    /// access the field directly.
    fn cached_duration_or_zero(&self) -> gst::ClockTime {
        self.cached_duration
            .lock()
            .ok()
            .and_then(|g| *g)
            .unwrap_or(gst::ClockTime::ZERO)
    }

    /// Phase A / I5 — issue a SEGMENT seek on `pipeline` from `start` to
    /// `stop`. Used by:
    ///   - `load()` for the initial arm (with FLUSH so the pipeline starts
    ///     iterating the new segment),
    ///   - `on_segment_done` to re-arm the next loop iteration (no FLUSH —
    ///     sinks see contiguous stream),
    ///   - `seek()` when the user scrubs while loop=One is active (FLUSH —
    ///     drop pending data, preserve SEGMENT contract for the loop),
    ///   - `set_loop(One)` recovery when the user toggled loop on after EOS.
    ///
    /// `with_flush=true` ⇒ `FLUSH | SEGMENT`; `false` ⇒ `SEGMENT` only.
    fn arm_segment_seek(
        &self,
        pipeline: &gst::Pipeline,
        start: gst::ClockTime,
        stop: gst::ClockTime,
        with_flush: bool,
    ) -> Result<(), AppError> {
        let mut flags = gst::SeekFlags::SEGMENT;
        if with_flush {
            flags |= gst::SeekFlags::FLUSH;
        }
        pipeline
            .seek(
                1.0,
                flags,
                gst::SeekType::Set,
                start,
                gst::SeekType::Set,
                stop,
            )
            .map_err(|e| {
                AppError::Internal(format!(
                    "arm_segment_seek({start:?} -> {stop:?}, flush={with_flush}): {e}"
                ))
            })
    }

    /// Phase A — bus-watcher callback for `SEGMENT_DONE`.
    ///
    /// Fires when the segment armed by `load()`'s initial
    /// `seek(FLUSH | SEGMENT, 0, duration)` reaches its `stop` time.
    /// Pipeline is still running (no EOS, no flush, native sinks intact).
    ///
    /// - `LoopMode::One`: re-arm with `seek(SEGMENT, 0, duration)` (NO FLUSH)
    ///   to start the next iteration. Sinks see a contiguous stream.
    /// - `LoopMode::None`: convert to real EOS via
    ///   `pipeline.send_event(Eos::new())` so the existing `on_eos` path
    ///   (queue-advance) fires.
    ///
    /// When `is_seekable=false`, this branch is unreachable in practice (no
    /// SEGMENT seek was ever armed, so SEGMENT_DONE never fires); the legacy
    /// P3.18-P3.21 EOS-based reload path handles loop in that case. Fall
    /// through silently as a defensive guard.
    fn on_segment_done(&self) {
        if !self.is_seekable.load(Ordering::SeqCst) {
            log::warn!(
                "video_pipeline: on_segment_done fired but is_seekable=false — ignoring"
            );
            return;
        }
        let mode = match self.state.loop_mode() {
            Ok(m) => m,
            Err(e) => {
                log::warn!("video_pipeline: on_segment_done loop_mode read failed: {e}");
                return;
            }
        };
        // I4: hold the pipeline lock across the seek (matches `seek()`
        // pattern). Pre-fix the lock was dropped before issuing the seek,
        // which left a window where `unload()` could transition the cloned
        // pipeline to NULL → benign seek failure but inconsistent with the
        // rest of the runtime which serializes lifecycle vs. seek through
        // this lock.
        let guard = match self.pipeline.lock() {
            Ok(g) => g,
            Err(e) => {
                log::warn!("video_pipeline: on_segment_done pipeline lock poisoned: {e}");
                return;
            }
        };
        let Some(pipeline) = guard.as_ref() else {
            return;
        };
        // I5: use the duration cached at load() time. A fresh
        // `query_duration` on every segment re-arm is redundant (duration is
        // a property of the source, not the playback state) and adds load on
        // the bus watcher thread.
        let duration = self
            .cached_duration
            .lock()
            .ok()
            .and_then(|g| *g)
            .unwrap_or_else(|| {
                pipeline
                    .query_duration::<gst::ClockTime>()
                    .unwrap_or(gst::ClockTime::ZERO)
            });
        match mode {
            LoopMode::One => {
                if duration.is_zero() {
                    log::warn!(
                        "video_pipeline: on_segment_done LoopMode::One — duration is 0; \
                         cannot re-arm SEGMENT seek"
                    );
                    return;
                }
                if let Err(e) =
                    self.arm_segment_seek(pipeline, gst::ClockTime::ZERO, duration, false)
                {
                    log::warn!(
                        "video_pipeline: on_segment_done re-arm SEGMENT seek failed: {e}"
                    );
                }
            }
            LoopMode::None => {
                log::info!(
                    "video_pipeline: on_segment_done LoopMode::None — sending EOS event"
                );
                if !pipeline.send_event(gst::event::Eos::new()) {
                    log::warn!(
                        "video_pipeline: on_segment_done send_event(EOS) returned false"
                    );
                }
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
        // Phase A — clear seekability so a subsequent `load()` re-probes.
        self.is_seekable.store(false, Ordering::SeqCst);
        // I5: drop the cached duration alongside seekability — same lifecycle.
        if let Ok(mut cached) = self.cached_duration.lock() {
            *cached = None;
        }
        // Phase 5 / Track 1 / Task 1 (A1) — drop every cached attached-window
        // handle alongside the pipeline tear-down. After unload(), the
        // pipeline is fully gone so no native sinks remain attached; the
        // map MUST be empty before the next load() rebuilds. Note we do
        // NOT call `detach_native_sink` per entry here because the
        // pipeline transition to NULL below cleans up every child element
        // (queue / conv / sink) atomically.
        if let Ok(mut handles) = self.attached_handles.lock() {
            handles.clear();
        }
        let mut guard = self.pipeline.lock()?;
        if let Some(pipeline) = guard.take() {
            pipeline
                .set_state(gst::State::Null)
                .map_err(|e| AppError::Internal(format!("video_pipeline.unload set_state(NULL): {e}")))?;
            // Wait for NULL transition to complete before dropping the pipeline
            // so uridecodebin finishes tearing down its decoders. 3 s cap —
            // NULL transitions are fast in practice; the bound prevents an IPC
            // hang if a sink is stuck in teardown (rare, seen with GL context
            // destruction on macOS when the window was already closed).
            let (change_result, _current, _pending) =
                pipeline.state(gst::ClockTime::from_seconds(3));
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
        // HP-6: match detach_window's clone-and-drop pattern. Holding
        // self.pipeline.lock() across the full attach (~6s preroll) would
        // block every concurrent play()/pause()/seek(). The race the plan
        // names ("parent_state evaluation wrong") is benign in practice:
        // both PAUSED and PLAYING set needs_preroll=true (pipeline.rs:719),
        // and sync_state_with_parent honors the parent's then-current state
        // at call time, so the element transitions correctly even if the
        // parent flipped mid-attach. The remaining mitigation is keeping
        // `attach_mutex` (above) which serializes attach + detach across
        // windows.
        let pipeline = self.get_or_init_pipeline()?;

        log::info!(
            "attach_window: '{window_label}' (pipeline state = {:?})",
            pipeline.current_state()
        );

        // CD-5: propagate the detach error instead of swallowing it. Pre-fix
        // a `let _ = ...` here masked any structural issue (NULL transition
        // failure, unowned tee request pad, queue stuck on async preroll)
        // and the subsequent attach would then fail loud with a confusing
        // "name already exists" error from `make_element` — burying the
        // real root cause. With error propagation, the dogfood log clearly
        // points at the half-disposed previous attach.
        //
        // Idempotency invariant preserved: when there's nothing to detach
        // (no `{label}_queue` / `{label}_conv` / `{label}` elements found
        // in the pipeline), `detach_native_sink` is a clean no-op — every
        // step is gated on `pipeline.by_name(...)` returning `Some`.
        pipeline::detach_native_sink(&pipeline, window_label).map_err(|e| {
            log::warn!(
                "attach_window: previous detach for '{window_label}' failed: {e} \
                 (refusing to re-attach over half-disposed state)"
            );
            AppError::Internal(format!(
                "attach_window('{window_label}'): previous detach failed: {e}"
            ))
        })?;

        // Hot-attach: pipeline keeps running. The BLOCK_DOWNSTREAM probe
        // inside `attach_native_sink` ensures the new branch transitions
        // through PAUSED preroll cleanly without disturbing other branches
        // (audio, already-attached video sinks). The new branch may show
        // black until its decoder receives the next KEY_UNIT (IDR) frame
        // from the upstream stream — typically 1-4 s for standard GOP
        // sizes. This is the canonical GStreamer hot-attach pattern.
        pipeline::attach_native_sink(&pipeline, window_label, window_handle).map(|_| ())?;

        // Phase 5 / Track 1 / Task 1 (A1) — record the successful attach
        // so `load_full` (cross-URI rebuild) can detach + reattach all
        // sinks around the NULL transition. Insert is the LAST action so
        // a partial-attach failure above doesn't leave a phantom entry
        // pointing at a half-attached sink.
        if let Ok(mut handles) = self.attached_handles.lock() {
            handles.insert(window_label.to_string(), window_handle);
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
        // Phase 5 / Track 1 / Task 1 (A1) — drop the cached handle whether
        // or not the pipeline was built. detach_window is the canonical
        // "this window is no longer attached" signal; cross-URI rebuilds
        // (load_full) must not try to reattach a label the user explicitly
        // detached.
        if let Ok(mut handles) = self.attached_handles.lock() {
            handles.remove(window_label);
        }
        Ok(())
    }

    /// Phase 5 / Track 1 / Task 4 — recover from a per-sink GL/D3D11
    /// failure without forcing a full pipeline rebuild.
    ///
    /// Snapshots the currently-attached windows, detaches each native
    /// sink, then re-attaches via the [`pipeline::attach_native_sink_or_fakesink`]
    /// helper so a single window's GL recovery failure can fall back to
    /// `fakesink` instead of poisoning the rest of the pipeline.
    /// `VideoPipelineSinkDegraded` is emitted for any window that lands
    /// on the fakesink fallback so the frontend classifier (Batch 3) can
    /// surface it pastorally.
    ///
    /// Returns the count of windows that successfully re-attached on the
    /// **native** path. Fallback attaches and outright failures are
    /// excluded from this count but still reflected in
    /// `attached_handles` (fallback) or removed from it (failure) so the
    /// invariant "every entry in `attached_handles` corresponds to a
    /// live tee branch" holds across recovery cycles.
    ///
    /// Intended call site: the Batch 3 error classifier when it observes
    /// the `gl_color_convert` bucket. NOT called from anywhere yet — the
    /// IPC command is wired in this batch; the recovery loop is wired in
    /// Batch 3.
    pub fn refresh_sinks(&self) -> Result<usize, AppError> {
        let _attach_guard = self
            .attach_mutex
            .lock()
            .map_err(|e| AppError::Internal(format!("attach_mutex poisoned: {e}")))?;

        let pipeline = {
            let guard = self.pipeline.lock()?;
            match guard.as_ref() {
                Some(p) => p.clone(),
                None => {
                    log::info!("video_pipeline.refresh_sinks: no pipeline built — nothing to refresh");
                    return Ok(0);
                }
            }
        };

        let snapshot: Vec<(String, usize)> = self
            .attached_handles
            .lock()
            .map(|h| h.iter().map(|(k, v)| (k.clone(), *v)).collect())
            .unwrap_or_default();
        if snapshot.is_empty() {
            log::info!("video_pipeline.refresh_sinks: no attached sinks — nothing to refresh");
            return Ok(0);
        }

        log::info!(
            "video_pipeline.refresh_sinks: refreshing {} sink(s): {:?}",
            snapshot.len(),
            snapshot.iter().map(|(l, _)| l).collect::<Vec<_>>()
        );

        // Detach pass — best-effort so a stuck sink can't block recovery
        // for healthy ones.
        for (label, _) in &snapshot {
            if let Err(e) = pipeline::detach_native_sink(&pipeline, label) {
                log::warn!(
                    "video_pipeline.refresh_sinks: detach for '{label}' failed: {e} \
                     (continuing — re-attach will best-effort rebuild)"
                );
            }
        }

        // Reattach pass — re-fetch fresh handles where possible; emit the
        // typed degraded event for any fallback / failure so Batch 3's
        // classifier can drive UX recovery.
        let mut native_count: usize = 0;
        for (label, cached_handle) in &snapshot {
            let resolved = if let Some(app) = self.app.as_ref() {
                resolve_window_handle(app, label).unwrap_or_else(|e| {
                    log::warn!(
                        "video_pipeline.refresh_sinks: re-resolve handle for '{label}' \
                         failed ({e}); falling back to cached value 0x{:x}",
                        cached_handle
                    );
                    *cached_handle
                })
            } else {
                *cached_handle
            };

            match pipeline::attach_native_sink_or_fakesink(&pipeline, label, resolved) {
                Ok(AttachResult::Native) => {
                    native_count += 1;
                    if let Ok(mut handles) = self.attached_handles.lock() {
                        handles.insert(label.clone(), resolved);
                    }
                }
                Ok(AttachResult::Fakesink { reason }) => {
                    log::warn!(
                        "video_pipeline.refresh_sinks: '{label}' fell back to fakesink ({reason})"
                    );
                    if let Ok(mut handles) = self.attached_handles.lock() {
                        handles.insert(label.clone(), resolved);
                    }
                    if let Some(app) = self.app.as_ref() {
                        let event = VideoPipelineSinkDegraded {
                            window_label: label.clone(),
                            reason,
                        };
                        if let Err(emit_err) = event.emit(app) {
                            log::warn!(
                                "video_pipeline.refresh_sinks: emit \
                                 VideoPipelineSinkDegraded for '{label}' failed: {emit_err}"
                            );
                        }
                    }
                }
                Err(e) => {
                    log::warn!(
                        "video_pipeline.refresh_sinks: '{label}' failed entirely ({e}); \
                         dropping from attached_handles"
                    );
                    if let Ok(mut handles) = self.attached_handles.lock() {
                        handles.remove(label);
                    }
                    if let Some(app) = self.app.as_ref() {
                        let event = VideoPipelineSinkDegraded {
                            window_label: label.clone(),
                            reason: format!("refresh failed (no fakesink fallback): {e}"),
                        };
                        if let Err(emit_err) = event.emit(app) {
                            log::warn!(
                                "video_pipeline.refresh_sinks: emit \
                                 VideoPipelineSinkDegraded for '{label}' failed: {emit_err}"
                            );
                        }
                    }
                }
            }
        }

        log::info!(
            "video_pipeline.refresh_sinks: complete — {} native, {} fallback/failed",
            native_count,
            snapshot.len() - native_count
        );
        Ok(native_count)
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
            // RT-1: same RAII pattern as the bus watcher — panic-safe release
            // of `broadcaster_running` so the next play() can spawn a fresh
            // broadcaster instead of being CAS-blocked forever.
            let _running_guard = RunningFlagGuard::new(running_flag);
            loop {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }

                // Snapshot pipeline + volume by re-borrowing the runtime.
                let runtime = match runtime_from_app(&app_for_thread) {
                    Some(rt) => rt,
                    None => break,
                };

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
            // _running_guard drops here, releasing broadcaster_running.
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
            // RT-1: RAII-release the running flag so a panic anywhere in the
            // loop body still un-sticks `bus_watcher_running` for the next
            // spawn attempt.
            let _running_guard = RunningFlagGuard::new(running_flag);
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
                        gst::MessageView::SegmentDone(_) => runtime.on_segment_done(),
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
            // _running_guard drops here, releasing bus_watcher_running.
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

/// Phase 5 / Track 1 / Task 1 (A1) — re-resolve a window's opaque OS handle
/// (NSView*/HWND/X Window XID/wl_surface*) as a `usize`.
///
/// Mirrors the main-thread hop pattern used by
/// `commands::video_pipeline::video_pipeline_attach_window` so platform
/// surface accessors (which aren't safe to call off the main thread on
/// macOS) run on the right thread; only an opaque `usize` crosses back
/// over the channel so nothing `!Send` escapes.
///
/// Used by [`VideoPipelineRuntime::load_full`] and the
/// `video_pipeline_refresh_sinks` IPC to obtain the current handle on
/// reattach — the cached value in `attached_handles` may be stale if
/// Tauri reallocated the window's underlying surface between detach and
/// reattach.
fn resolve_window_handle(
    app: &tauri::AppHandle,
    label: &str,
) -> Result<usize, AppError> {
    use tauri::Manager;
    if app.get_webview_window(label).is_none() {
        return Err(AppError::NotFound(format!(
            "resolve_window_handle: window '{label}' not found"
        )));
    }
    let (tx, rx) = std::sync::mpsc::channel::<Result<usize, AppError>>();
    let app_for_main = app.clone();
    let label_for_main = label.to_string();
    app.run_on_main_thread(move || {
        let result = (|| -> Result<usize, AppError> {
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            let window = app_for_main
                .get_webview_window(&label_for_main)
                .ok_or_else(|| {
                    AppError::NotFound(format!(
                        "resolve_window_handle: window '{label_for_main}' not found"
                    ))
                })?;
            let handle = window
                .window_handle()
                .map_err(|e| AppError::Internal(format!("window_handle() failed: {e}")))?;
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
    rx.recv()
        .map_err(|e| AppError::Internal(format!("main-thread channel closed: {e}")))?
}

/// CD-4 — RAII guard that releases the `loop_op` CAS gate on drop.
///
/// Acquisition happens at the EOS handler (synchronously, before spawn);
/// the spawned reload thread instantiates this guard so any early-return
/// path — `state.snapshot()` failure, missing URI, `load()` error, `play()`
/// error — still restores `LOOP_OP_IDLE`. Without RAII a panic OR an early
/// `return` after the lock-acquiring CAS would permanently leak the gate
/// and silently break every subsequent loop wrap-around.
///
/// Leaking via `mem::forget` would permanently block reload — guard must
/// be dropped to release.
struct LoopOpGuard<'a> {
    flag: &'a AtomicU8,
}

impl<'a> LoopOpGuard<'a> {
    fn new(flag: &'a AtomicU8) -> Self {
        Self { flag }
    }
}

impl Drop for LoopOpGuard<'_> {
    fn drop(&mut self) {
        self.flag.store(LOOP_OP_IDLE, Ordering::SeqCst);
    }
}

/// RT-1 — RAII guard that releases the `bus_watcher_running` CAS gate on
/// drop, including panic unwinds inside the watcher thread. Without this,
/// any panic between the CAS-acquire and the explicit `store(false)` at
/// the bottom of the watcher loop would leave the flag stuck `true` and
/// permanently block `spawn_bus_watcher` from starting a new thread —
/// silently breaking every subsequent EOS/SegmentDone notification.
struct RunningFlagGuard {
    flag: Arc<AtomicBool>,
}

impl RunningFlagGuard {
    fn new(flag: Arc<AtomicBool>) -> Self {
        Self { flag }
    }
}

impl Drop for RunningFlagGuard {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::SeqCst);
    }
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

    /// Phase A — `is_seekable` flag must default to `false` and `unload()`
    /// must clear it so a subsequent `load()` re-probes the new source.
    #[test]
    fn is_seekable_defaults_false_and_unload_clears() {
        let rt = runtime();
        assert!(!rt.is_seekable.load(Ordering::SeqCst));
        // Force-set as if a load() had probed a seekable source.
        rt.is_seekable.store(true, Ordering::SeqCst);
        rt.unload().expect("unload");
        assert!(
            !rt.is_seekable.load(Ordering::SeqCst),
            "unload must clear is_seekable so a re-load re-probes"
        );
    }

    /// I5 — `cached_duration` must default to `None` and `unload()` must
    /// clear it so a subsequent `load()` re-populates from the new source.
    /// Pre-fix `seek()` and `on_segment_done` re-queried the pipeline; the
    /// cache eliminates that and must not leak across loads.
    #[test]
    fn cached_duration_defaults_none_and_unload_clears() {
        let rt = runtime();
        assert!(rt.cached_duration.lock().expect("lock").is_none());
        // Simulate a successful seekable load.
        *rt.cached_duration.lock().expect("lock") =
            Some(gst::ClockTime::from_seconds(42));
        rt.is_seekable.store(true, Ordering::SeqCst);
        rt.unload().expect("unload");
        assert!(
            rt.cached_duration.lock().expect("lock").is_none(),
            "unload must clear cached_duration"
        );
    }

    /// M1-rev — without a real GStreamer pipeline this test cannot actually
    /// observe the C1 branching (seek_simple vs arm_segment_seek). It only
    /// verifies that `seek()` is well-behaved without a pipeline: the state
    /// snapshot is updated so the UI mirror stays in sync, and the GStreamer
    /// path is silently skipped (the `guard.as_ref()` arm short-circuits).
    ///
    /// TODO (deferred integration test): a deeper test under
    /// `tests/video_pipeline_integration.rs` should drive a real
    /// `videotestsrc`-fed pipeline through load → seek → wait_segment_done →
    /// assert position wraps. The existing fixture machinery (`ensure_fixture`)
    /// only generates a 1-second MP4 which is too short to reliably observe a
    /// SEGMENT_DONE round-trip on slow CI runners — needs a longer fixture or
    /// an artificial `videotestsrc num-buffers=N` source first.
    #[test]
    fn seek_without_pipeline_updates_snapshot_only() {
        let rt = runtime();
        rt.set_loop(LoopMode::One).expect("set_loop");
        rt.is_seekable.store(true, Ordering::SeqCst);
        // No pipeline built — seek() should still no-op cleanly (the GStreamer
        // branch is gated on `guard.as_ref()`).
        rt.seek(1.5).expect("seek with no pipeline is a no-op");
        // Snapshot still updates so the UI position reflects intent.
        assert_eq!(rt.snapshot().expect("snapshot").position_secs, 1.5);
    }

    /// Phase A — `on_segment_done` is a defensive no-op when
    /// `is_seekable=false` (the canonical SEGMENT path was never armed, so
    /// SEGMENT_DONE shouldn't fire — but we don't want a stray seek if the
    /// bus surfaces a stale message during a NULL→PAUSED cycle).
    #[test]
    fn on_segment_done_is_noop_when_not_seekable() {
        let rt = runtime();
        // is_seekable defaults to false; calling the handler must not panic
        // or attempt to take the (uninitialized) pipeline lock for a seek.
        rt.on_segment_done();
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

    /// CD-4 — the `loop_op` gate must default to IDLE, accept exactly one
    /// CAS-acquire, refuse the second concurrent acquire, and return to IDLE
    /// when the RAII guard drops. Encodes the single-flight contract that
    /// keeps two near-simultaneous EOS reload threads from racing the
    /// pipeline lock.
    #[test]
    fn loop_op_gate_is_single_flight() {
        let rt = runtime();
        assert_eq!(rt.loop_op.load(Ordering::SeqCst), LOOP_OP_IDLE);
        let first = rt.loop_op.compare_exchange(
            LOOP_OP_IDLE,
            LOOP_OP_RELOADING,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
        assert!(first.is_ok(), "first CAS must succeed");
        let second = rt.loop_op.compare_exchange(
            LOOP_OP_IDLE,
            LOOP_OP_RELOADING,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
        assert!(second.is_err(), "second CAS must fail (single-flight)");
        // RAII release.
        {
            let _g = LoopOpGuard::new(&rt.loop_op);
            assert_eq!(rt.loop_op.load(Ordering::SeqCst), LOOP_OP_RELOADING);
        }
        assert_eq!(
            rt.loop_op.load(Ordering::SeqCst),
            LOOP_OP_IDLE,
            "guard drop must restore IDLE so a future EOS can re-acquire"
        );
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
