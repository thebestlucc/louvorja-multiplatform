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
    pipeline,
    signaling::{AnswerPayload, IcePayload, SignalingChannel},
    state::{PlaybackState, PlaybackStateSnapshot},
};
use gstreamer::{self as gst, prelude::*};
use std::sync::{Arc, Mutex};

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
}

impl VideoPipelineRuntime {
    /// Create a new runtime with the supplied signaling channel.
    pub fn new(signaling: Arc<dyn SignalingChannel>) -> Self {
        Self {
            pipeline: Mutex::new(None),
            state: PlaybackState::new(),
            consumers: ConsumerRegistry::new(),
            signaling,
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::video_pipeline::signaling::NoopSignalingChannel;

    fn runtime() -> VideoPipelineRuntime {
        let signaling: Arc<dyn SignalingChannel> = Arc::new(NoopSignalingChannel);
        VideoPipelineRuntime::new(signaling)
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
}
