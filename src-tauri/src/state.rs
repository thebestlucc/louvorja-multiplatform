use std::sync::Mutex;
use rusqlite::Connection;
use crate::db::models::SlideContent;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub current_slide: Mutex<Option<SlideContent>>,
    pub projector_open: Mutex<bool>,
}

pub struct AudioState {
    // Placeholder for Phase 2 — will hold rodio sink, stream, etc.
}
