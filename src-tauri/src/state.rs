use std::sync::Mutex;
use rusqlite::Connection;
use crate::audio::{AudioPlayer, SyncTimeline};
use crate::db::models::SlideContent;
use crate::error::AppError;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub current_slide: Mutex<Option<SlideContent>>,
    pub projector_open: Mutex<bool>,
}

pub struct AudioState {
    pub player: Mutex<AudioPlayer>,
    pub sync_timeline: Mutex<Option<SyncTimeline>>,
}

impl AudioState {
    pub fn new() -> Result<Self, AppError> {
        Ok(Self {
            player: Mutex::new(AudioPlayer::new()?),
            sync_timeline: Mutex::new(None),
        })
    }
}
