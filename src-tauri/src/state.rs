use std::sync::Mutex;
use rusqlite::Connection;

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub struct AudioState {
    // Placeholder for Phase 2 — will hold rodio sink, stream, etc.
}
