//! Per-domain WS command handlers.
//! Each submodule handles a group of ops and delegates to existing Tauri commands.
pub mod audio;
pub mod display;
pub mod overlay;
pub mod presence;
pub mod search;
pub mod service;
pub mod slide;
pub mod sync;
pub mod video;
