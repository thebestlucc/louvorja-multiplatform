use crate::audio::AudioPlayer;
use crate::bible::text_split::VerseSplitResult;
use crate::db::models::{SlideContent, SlideContext};
use crate::error::AppError;
use crate::migration::MigrationRuntimeState;
use crate::streaming::StreamingServer;
use crate::video_server::VideoServer;
use cosmic_text::FontSystem;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::Serialize;
use specta::Type;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex, RwLock};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TimerMode {
    Countdown,
    Stopwatch,
}

impl TimerMode {
    pub fn from_input(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "countdown" => Some(Self::Countdown),
            "stopwatch" => Some(Self::Stopwatch),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimerStateData {
    pub mode: TimerMode,
    pub is_running: bool,
    #[specta(type = f64)]
    pub current_time_ms: u64,
    #[specta(type = f64)]
    pub duration_ms: Option<u64>,
    #[specta(type = Vec<f64>)]
    pub laps: Vec<u64>,
}

#[derive(Debug)]
pub struct TimerRuntimeState {
    pub mode: TimerMode,
    pub duration_ms: Option<u64>,
    pub accumulated_ms: u64,
    pub started_at: Option<Instant>,
    pub laps: Vec<u64>,
    /// Pre-calculated current time to avoid Instant::now() calls during serialization
    pub current_time_ms: u64,
}

impl Default for TimerRuntimeState {
    fn default() -> Self {
        Self {
            mode: TimerMode::Stopwatch,
            duration_ms: None,
            accumulated_ms: 0,
            started_at: None,
            laps: Vec::new(),
            current_time_ms: 0,
        }
    }
}

impl TimerRuntimeState {
    fn instant_elapsed_ms(started_at: Instant) -> u64 {
        u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX)
    }

    pub fn is_running(&self) -> bool {
        self.started_at.is_some()
    }

    pub fn elapsed_ms(&self) -> u64 {
        match self.started_at {
            Some(started_at) => self
                .accumulated_ms
                .saturating_add(Self::instant_elapsed_ms(started_at)),
            None => self.accumulated_ms,
        }
    }

    pub fn current_time_ms(&self) -> u64 {
        match self.mode {
            TimerMode::Countdown => self
                .duration_ms
                .unwrap_or(0)
                .saturating_sub(self.elapsed_ms()),
            TimerMode::Stopwatch => self.elapsed_ms(),
        }
    }

    pub fn to_data(&self) -> TimerStateData {
        TimerStateData {
            mode: self.mode.clone(),
            is_running: self.is_running(),
            current_time_ms: self.current_time_ms(),
            duration_ms: self.duration_ms,
            laps: self.laps.clone(),
        }
    }

    pub fn start(&mut self, mode: TimerMode, duration_ms: Option<u64>) {
        self.mode = mode;
        self.duration_ms = duration_ms;
        self.accumulated_ms = 0;
        self.started_at = Some(Instant::now());
        self.laps.clear();
    }

    pub fn pause(&mut self) {
        if let Some(started_at) = self.started_at.take() {
            self.accumulated_ms = self
                .accumulated_ms
                .saturating_add(Self::instant_elapsed_ms(started_at));
        }
    }

    pub fn resume(&mut self) {
        if self.started_at.is_none() {
            self.started_at = Some(Instant::now());
        }
    }

    pub fn adjust_countdown_remaining_ms(&mut self, delta_ms: i64) -> Result<(), String> {
        if !matches!(self.mode, TimerMode::Countdown) {
            return Err("Countdown adjustment is only available in countdown mode.".into());
        }

        let elapsed_ms = self.elapsed_ms();
        let current_duration_ms = self
            .duration_ms
            .ok_or_else(|| "Countdown timer has not been started.".to_string())?;
        let current_remaining_ms = current_duration_ms.saturating_sub(elapsed_ms);

        let next_remaining_ms = if delta_ms >= 0 {
            current_remaining_ms.saturating_add(delta_ms as u64)
        } else {
            let delta_abs = delta_ms
                .checked_abs()
                .map(|value| value as u64)
                .unwrap_or(u64::MAX);
            current_remaining_ms.saturating_sub(delta_abs)
        };

        self.duration_ms = Some(elapsed_ms.saturating_add(next_remaining_ms));

        if next_remaining_ms == 0 {
            self.pause();
            if let Some(duration_ms) = self.duration_ms {
                self.accumulated_ms = duration_ms;
            }
        }

        Ok(())
    }

    pub fn reset(&mut self) {
        self.accumulated_ms = 0;
        self.started_at = None;
        self.laps.clear();
    }
}

#[derive(Debug, Clone, Serialize, serde::Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct AlertState {
    pub text: String,
    pub is_visible: bool,
    pub is_ticker: bool,
}

/// Combined overlay state — single mutex eliminates the ABBA deadlock
/// that occurred when toggle_black_screen and toggle_logo_screen acquired
/// is_black_screen and is_logo_screen in opposite order simultaneously.
#[derive(Debug, Default)]
pub struct OverlayRuntimeState {
    pub is_black_screen: bool,
    pub is_logo_screen: bool,
    pub alert: AlertState,
}

#[derive(Default)]
pub struct PackSyncRuntimeState {
    pub active_run_id: Option<String>,
    pub cancel_flags: std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>,
    /// True once the CDN manifest has been successfully fetched this session.
    /// Subsequent non-forced calls within the same launch reuse the file cache.
    pub manifest_fetched: bool,
}

#[derive(Default)]
pub struct YtdlpRuntimeState {
    pub active_run_id: Option<String>,
    pub cancel_flags: std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>,
}

/// Cached schema capabilities for a content DB.
/// Probed once at open time so per-search sqlite_master queries are eliminated.
#[derive(Debug, Clone)]
pub struct ContentDbCapabilities {
    pub has_fts: bool,
    pub has_lyrics_table: bool,
    pub has_categories: bool,
    pub has_time_column: bool,
    pub has_instrumental_time_column: bool,
}

pub struct BibleNavContext {
    pub version_id: i64,
    pub book: String,
    pub chapter: i32,
    pub verse: i32,
}

pub struct BibleProjectionState {
    pub font_system: FontSystem,
    pub current: Option<VerseSplitResult>,
    pub next: Option<VerseSplitResult>,
    pub prev: Option<VerseSplitResult>,
    pub context: Option<BibleNavContext>,
    pub projector_size: Option<(u32, u32)>,
    pub part_index: usize,
}

pub struct AppState {
    pub db: Pool<SqliteConnectionManager>,
    pub bible_db: Pool<SqliteConnectionManager>, // dedicated bible database
    /// Content DBs keyed by BCP 47 language tag (e.g. "pt-BR").
    /// Populated on startup (scan for content-*.db) and after each content sync.
    pub content_dbs: Arc<RwLock<HashMap<String, Pool<SqliteConnectionManager>>>>,
    /// Cached capabilities for each content DB, keyed by the same BCP 47 tag.
    /// Populated alongside `content_dbs`; read-only after insertion.
    pub content_db_capabilities: Arc<RwLock<HashMap<String, ContentDbCapabilities>>>,
    pub timer: RwLock<TimerRuntimeState>,
    pub migration: Mutex<MigrationRuntimeState>,
    pub pack_sync: Mutex<PackSyncRuntimeState>,
    pub ytdlp: Mutex<YtdlpRuntimeState>,
    pub utility_projection_stop: Mutex<Option<Sender<()>>>,
    pub timer_update_stop: Mutex<Option<Sender<()>>>,
    pub current_slide: RwLock<Option<SlideContent>>,
    pub projector_open: AtomicBool,
    pub overlay: RwLock<OverlayRuntimeState>,
    pub return_open: AtomicBool,
    pub slide_context: RwLock<Option<SlideContext>>,
    /// Maps action IDs to their currently registered global shortcut string.
    /// Used by update_global_shortcut to unregister before re-registering.
    pub global_shortcuts: RwLock<HashMap<String, String>>,
    pub bible_projection: Mutex<BibleProjectionState>,
}

pub struct AudioState {
    pub player: RwLock<AudioPlayer>,
    pub audio_status_stream_stop: Mutex<Option<Sender<()>>>,
}

impl Default for AudioState {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self::disabled())
    }
}

pub struct StreamingState {
    pub server: Mutex<StreamingServer>,
}

impl Default for StreamingState {
    fn default() -> Self {
        Self::new(7070)
    }
}

impl StreamingState {
    pub fn new(port: u16) -> Self {
        Self {
            server: Mutex::new(StreamingServer::new(port)),
        }
    }
}

pub struct VideoServerState {
    pub server: Mutex<VideoServer>,
}

impl Default for VideoServerState {
    fn default() -> Self {
        Self {
            server: Mutex::new(VideoServer::new()),
        }
    }
}

impl AudioState {
    pub fn new() -> Result<Self, AppError> {
        Ok(Self {
            player: RwLock::new(AudioPlayer::new()?),
            audio_status_stream_stop: Mutex::new(None),
        })
    }

    /// Creates a disabled AudioState when no audio output device is available.
    pub fn disabled() -> Self {
        Self {
            player: RwLock::new(AudioPlayer::disabled()),
            audio_status_stream_stop: Mutex::new(None),
        }
    }
}
