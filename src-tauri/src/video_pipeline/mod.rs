//! Rust Video Pipeline scaffold (see `docs/plans/2026-04-17-rust-video-pipeline.md`).
//! Re-exports are wired here ahead of consumers landing in Tasks 1.2-4.1.
#![allow(unused_imports)]

pub mod consumer;
pub mod pipeline;
pub mod signaling;
pub mod state;
pub use consumer::{Consumer, ConsumerRegistry};
pub use signaling::{
    AnswerPayload, IcePayload, MpscSignalingChannel, NoopSignalingChannel, OfferPayload,
    SignalingChannel, SignalingEvent,
};
pub use state::{PlaybackState, PlaybackStateSnapshot};
