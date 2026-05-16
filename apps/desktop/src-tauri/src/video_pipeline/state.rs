//! Scaffolded for the Rust Video Pipeline migration
//! (see `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 1.1).
//! Pipeline construction lands in Task 1.2; commands wire in Task 4.1.
#![allow(dead_code)]

use crate::error::AppError;
use gstreamer as gst;
use std::sync::Mutex;

/// Loop mode for the active media (Task 3.1).
///
/// `None` lets the pipeline reach EOS and emits [`VideoPipelineEnded`]
/// (`crate::video_pipeline::events::VideoPipelineEnded`). `One` re-seeks to 0
/// on EOS and stays in PLAYING.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type,
)]
#[serde(rename_all = "lowercase")]
pub enum LoopMode {
    None,
    One,
}

impl Default for LoopMode {
    fn default() -> Self {
        Self::None
    }
}

/// Serializable snapshot of the current playback state, mirrored to the frontend.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStateSnapshot {
    /// Last RESOLVED URI handed to GStreamer (e.g. `https://...` for YouTube
    /// signed URL, `file:///...` for local). Used by `set_source_uri` calls
    /// and recovery paths that need to re-feed the same URI to uridecodebin.
    /// **MUST NOT** be used for same-source dispatch dedup — for YouTube
    /// sources this string rotates on every `resolve_uri()` call. See
    /// `source_key` instead and
    /// `docs/plans/2026-04-26-phase5-hotfix-source-identity-dedup.md`.
    pub uri: Option<String>,
    /// Stable source-identity key for the dispatch matrix in
    /// `VideoPipelineRuntime::load`. Format:
    /// `"local:{absolute_path}"` or `"youtube:{video_id}"` —
    /// see [`crate::video_pipeline::source::MediaSource::identity_key`].
    /// Deterministic per `MediaSource` value, unlike `uri` which can rotate
    /// for YouTube. Used to route repeat loads of the same logical source
    /// into in-place `restart()` instead of a full `load_full()` rebuild.
    pub source_key: Option<String>,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub paused: bool,
    pub volume: f32,
    pub ready: bool,
    pub loop_mode: LoopMode,
}

impl Default for PlaybackStateSnapshot {
    fn default() -> Self {
        Self {
            uri: None,
            source_key: None,
            position_secs: 0.0,
            duration_secs: 0.0,
            paused: false,
            // GStreamer `volume` element defaults to 1.0. Match so the UI slider
            // reflects unattenuated output on first paint rather than "muted".
            volume: 1.0,
            ready: false,
            loop_mode: LoopMode::None,
        }
    }
}

struct Inner {
    pipeline: Option<gst::Pipeline>,
    snapshot: PlaybackStateSnapshot,
}

/// In-memory container for playback state. The GStreamer pipeline is wired in Task 1.2.
pub struct PlaybackState {
    inner: Mutex<Inner>,
}

impl PlaybackState {
    /// Create a new state container with default snapshot and no pipeline.
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                pipeline: None,
                snapshot: PlaybackStateSnapshot::default(),
            }),
        }
    }

    /// Set the active source (resolved URI + stable identity key) and
    /// reset transient playback fields.
    ///
    /// `uri` is the resolved URI handed to GStreamer (rotates per call for
    /// YouTube). `source_key` is the stable identity key from
    /// [`crate::video_pipeline::source::MediaSource::identity_key`] used
    /// by the runtime's same-source dispatch matrix. Both are mirrored
    /// onto the snapshot so the broadcaster + dispatch logic can read
    /// either consistently.
    ///
    /// Preserves `loop_mode` across media swaps so the user's toggle
    /// survives queue advances (Task 3.1).
    ///
    /// See `docs/plans/2026-04-26-phase5-hotfix-source-identity-dedup.md`.
    pub fn set_source(&self, uri: String, source_key: String) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.uri = Some(uri);
        inner.snapshot.source_key = Some(source_key);
        inner.snapshot.position_secs = 0.0;
        inner.snapshot.duration_secs = 0.0;
        inner.snapshot.paused = true;
        inner.snapshot.ready = false;
        Ok(())
    }

    /// Read the current source identity key (None when no source has been
    /// loaded since construction or last `unload()`).
    ///
    /// See [`crate::video_pipeline::source::MediaSource::identity_key`] for
    /// the format.
    pub fn source_key(&self) -> Result<Option<String>, AppError> {
        let inner = self.inner.lock()?;
        Ok(inner.snapshot.source_key.clone())
    }

    /// Mark playback as playing.
    pub fn play(&self) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.paused = false;
        Ok(())
    }

    /// Mark playback as paused.
    pub fn pause(&self) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.paused = true;
        Ok(())
    }

    /// Update the seek position, clamping negatives to zero.
    pub fn seek(&self, secs: f64) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.position_secs = secs.max(0.0);
        Ok(())
    }

    /// Update the volume, clamping to the unit range [0.0, 1.0].
    pub fn set_volume(&self, vol: f32) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.volume = vol.clamp(0.0, 1.0);
        Ok(())
    }

    /// Update the loop mode (Task 3.1).
    pub fn set_loop(&self, mode: LoopMode) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.loop_mode = mode;
        Ok(())
    }

    /// Read the current loop mode (Task 3.1).
    pub fn loop_mode(&self) -> Result<LoopMode, AppError> {
        let inner = self.inner.lock()?;
        Ok(inner.snapshot.loop_mode)
    }

    /// Drop any pipeline and reset the snapshot to its default values.
    ///
    /// Resets `loop_mode` back to [`LoopMode::None`] — the loop toggle is
    /// scoped to a single active media.
    pub fn unload(&self) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.pipeline = None;
        inner.snapshot = PlaybackStateSnapshot::default();
        Ok(())
    }

    /// Return a clone of the current snapshot.
    pub fn snapshot(&self) -> Result<PlaybackStateSnapshot, AppError> {
        let inner = self.inner.lock()?;
        Ok(inner.snapshot.clone())
    }
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_returns_default_snapshot() {
        let state = PlaybackState::new();
        let snap = state.snapshot().expect("snapshot");
        assert_eq!(snap.uri, None);
        assert_eq!(snap.position_secs, 0.0);
        assert_eq!(snap.duration_secs, 0.0);
        assert!(!snap.paused);
        assert_eq!(snap.volume, 1.0);
        assert!(!snap.ready);
    }

    #[test]
    fn set_source_sets_uri_and_resets_position() {
        let state = PlaybackState::new();
        state.seek(42.0).expect("seek");
        state
            .set_source("file:///foo.mp4".into(), "local:/foo.mp4".into())
            .expect("set_source");
        let snap = state.snapshot().expect("snapshot");
        assert_eq!(snap.uri.as_deref(), Some("file:///foo.mp4"));
        assert_eq!(snap.source_key.as_deref(), Some("local:/foo.mp4"));
        assert_eq!(snap.position_secs, 0.0);
        assert_eq!(snap.duration_secs, 0.0);
        assert!(snap.paused);
        assert!(!snap.ready);
    }

    #[test]
    fn source_key_defaults_to_none_and_clears_on_unload() {
        let state = PlaybackState::new();
        assert_eq!(state.source_key().expect("source_key"), None);
        state
            .set_source("https://example/x".into(), "youtube:X".into())
            .expect("set_source");
        assert_eq!(
            state.source_key().expect("source_key"),
            Some("youtube:X".into())
        );
        state.unload().expect("unload");
        assert_eq!(state.source_key().expect("source_key"), None);
        assert_eq!(state.snapshot().expect("snapshot").source_key, None);
    }

    #[test]
    fn play_clears_paused() {
        let state = PlaybackState::new();
        state.pause().expect("pause");
        assert!(state.snapshot().expect("snapshot").paused);
        state.play().expect("play");
        assert!(!state.snapshot().expect("snapshot").paused);
    }

    #[test]
    fn pause_sets_paused() {
        let state = PlaybackState::new();
        state.play().expect("play");
        assert!(!state.snapshot().expect("snapshot").paused);
        state.pause().expect("pause");
        assert!(state.snapshot().expect("snapshot").paused);
    }

    #[test]
    fn seek_clamps_negative_to_zero() {
        let state = PlaybackState::new();
        state.seek(-5.0).expect("seek");
        assert_eq!(state.snapshot().expect("snapshot").position_secs, 0.0);
        state.seek(10.5).expect("seek");
        assert_eq!(state.snapshot().expect("snapshot").position_secs, 10.5);
    }

    #[test]
    fn set_volume_clamps_to_unit_range() {
        let state = PlaybackState::new();
        state.set_volume(2.0).expect("set_volume");
        assert_eq!(state.snapshot().expect("snapshot").volume, 1.0);
        state.set_volume(-0.5).expect("set_volume");
        assert_eq!(state.snapshot().expect("snapshot").volume, 0.0);
        state.set_volume(0.42).expect("set_volume");
        assert_eq!(state.snapshot().expect("snapshot").volume, 0.42);
    }

    #[test]
    fn unload_resets_to_default() {
        let state = PlaybackState::new();
        state
            .set_source("file:///foo.mp4".into(), "local:/foo.mp4".into())
            .expect("set_source");
        state.play().expect("play");
        state.seek(12.0).expect("seek");
        state.set_volume(0.7).expect("set_volume");
        state.unload().expect("unload");
        let snap = state.snapshot().expect("snapshot");
        let default = PlaybackStateSnapshot::default();
        assert_eq!(snap.uri, default.uri);
        assert_eq!(snap.source_key, default.source_key);
        assert_eq!(snap.position_secs, default.position_secs);
        assert_eq!(snap.duration_secs, default.duration_secs);
        assert_eq!(snap.paused, default.paused);
        assert_eq!(snap.volume, default.volume);
        assert_eq!(snap.ready, default.ready);
    }

    #[test]
    fn snapshot_returns_clone_not_reference() {
        let state = PlaybackState::new();
        state
            .set_source("file:///foo.mp4".into(), "local:/foo.mp4".into())
            .expect("set_source");
        let mut snap = state.snapshot().expect("snapshot");
        snap.uri = Some("mutated".into());
        snap.position_secs = 99.0;
        let fresh = state.snapshot().expect("snapshot");
        assert_eq!(fresh.uri.as_deref(), Some("file:///foo.mp4"));
        assert_eq!(fresh.position_secs, 0.0);
    }

    #[test]
    fn loop_mode_defaults_to_none() {
        let state = PlaybackState::new();
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::None);
        assert_eq!(
            state.snapshot().expect("snapshot").loop_mode,
            LoopMode::None
        );
    }

    #[test]
    fn set_loop_persists_across_load_and_seek() {
        let state = PlaybackState::new();
        state.set_loop(LoopMode::One).expect("set_loop");
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::One);

        // Swapping media must keep the loop toggle active (user expectation).
        state
            .set_source("file:///foo.mp4".into(), "local:/foo.mp4".into())
            .expect("set_source");
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::One);

        // Seeks must not reset it either.
        state.seek(7.5).expect("seek");
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::One);
    }

    #[test]
    fn unload_resets_loop_mode() {
        let state = PlaybackState::new();
        state.set_loop(LoopMode::One).expect("set_loop");
        state.unload().expect("unload");
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::None);
    }

    #[test]
    fn set_loop_round_trips_between_variants() {
        let state = PlaybackState::new();
        state.set_loop(LoopMode::One).expect("set_loop one");
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::One);
        state.set_loop(LoopMode::None).expect("set_loop none");
        assert_eq!(state.loop_mode().expect("loop_mode"), LoopMode::None);
    }
}
