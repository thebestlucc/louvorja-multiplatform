use crate::audio::{AudioPlayer, SyncTimeline};
use crate::db::models::{SlideContent, SlideContext};
use crate::error::AppError;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub current_slide: Mutex<Option<SlideContent>>,
    pub projector_open: Mutex<bool>,
    pub is_black_screen: Mutex<bool>,
    pub is_logo_screen: Mutex<bool>,
    pub return_open: Mutex<bool>,
    pub slide_context: Mutex<Option<SlideContext>>,
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
