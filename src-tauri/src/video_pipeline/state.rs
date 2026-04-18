//! Scaffolded for the Rust Video Pipeline migration
//! (see `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 1.1).
//! Pipeline construction lands in Task 1.2; commands wire in Task 4.1.
#![allow(dead_code)]

use crate::error::AppError;
use gstreamer as gst;
use std::sync::Mutex;

/// Serializable snapshot of the current playback state, mirrored to the frontend.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStateSnapshot {
    pub uri: Option<String>,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub paused: bool,
    pub volume: f32,
    pub ready: bool,
}

impl Default for PlaybackStateSnapshot {
    fn default() -> Self {
        Self {
            uri: None,
            position_secs: 0.0,
            duration_secs: 0.0,
            paused: false,
            volume: 0.0,
            ready: false,
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

    /// Set the active URI and reset transient playback fields.
    pub fn load(&self, uri: String) -> Result<(), AppError> {
        let mut inner = self.inner.lock()?;
        inner.snapshot.uri = Some(uri);
        inner.snapshot.position_secs = 0.0;
        inner.snapshot.duration_secs = 0.0;
        inner.snapshot.paused = true;
        inner.snapshot.ready = false;
        Ok(())
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

    /// Drop any pipeline and reset the snapshot to its default values.
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
        assert_eq!(snap.volume, 0.0);
        assert!(!snap.ready);
    }

    #[test]
    fn load_sets_uri_and_resets_position() {
        let state = PlaybackState::new();
        state.seek(42.0).expect("seek");
        state.load("file:///foo.mp4".into()).expect("load");
        let snap = state.snapshot().expect("snapshot");
        assert_eq!(snap.uri.as_deref(), Some("file:///foo.mp4"));
        assert_eq!(snap.position_secs, 0.0);
        assert_eq!(snap.duration_secs, 0.0);
        assert!(snap.paused);
        assert!(!snap.ready);
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
        state.load("file:///foo.mp4".into()).expect("load");
        state.play().expect("play");
        state.seek(12.0).expect("seek");
        state.set_volume(0.7).expect("set_volume");
        state.unload().expect("unload");
        let snap = state.snapshot().expect("snapshot");
        let default = PlaybackStateSnapshot::default();
        assert_eq!(snap.uri, default.uri);
        assert_eq!(snap.position_secs, default.position_secs);
        assert_eq!(snap.duration_secs, default.duration_secs);
        assert_eq!(snap.paused, default.paused);
        assert_eq!(snap.volume, default.volume);
        assert_eq!(snap.ready, default.ready);
    }

    #[test]
    fn snapshot_returns_clone_not_reference() {
        let state = PlaybackState::new();
        state.load("file:///foo.mp4".into()).expect("load");
        let mut snap = state.snapshot().expect("snapshot");
        snap.uri = Some("mutated".into());
        snap.position_secs = 99.0;
        let fresh = state.snapshot().expect("snapshot");
        assert_eq!(fresh.uri.as_deref(), Some("file:///foo.mp4"));
        assert_eq!(fresh.position_secs, 0.0);
    }
}
