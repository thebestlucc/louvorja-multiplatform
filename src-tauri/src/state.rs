use crate::audio::{AudioPlayer, SyncTimeline};
use crate::db::models::{SlideContent, SlideContext};
use crate::error::AppError;
use crate::streaming::StreamingServer;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::mpsc::Sender;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerStateData {
    pub mode: TimerMode,
    pub is_running: bool,
    pub current_time_ms: u64,
    pub duration_ms: Option<u64>,
    pub laps: Vec<u64>,
}

#[derive(Debug)]
pub struct TimerRuntimeState {
    pub mode: TimerMode,
    pub duration_ms: Option<u64>,
    pub accumulated_ms: u64,
    pub started_at: Option<Instant>,
    pub laps: Vec<u64>,
}

impl Default for TimerRuntimeState {
    fn default() -> Self {
        Self {
            mode: TimerMode::Stopwatch,
            duration_ms: None,
            accumulated_ms: 0,
            started_at: None,
            laps: Vec::new(),
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
            TimerMode::Countdown => self.duration_ms.unwrap_or(0).saturating_sub(self.elapsed_ms()),
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

pub struct AppState {
    pub db: Mutex<Connection>,
    pub timer: Mutex<TimerRuntimeState>,
    pub utility_projection_stop: Mutex<Option<Sender<()>>>,
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

pub struct StreamingState {
    pub server: Mutex<StreamingServer>,
}

impl StreamingState {
    pub fn new(port: u16) -> Self {
        Self {
            server: Mutex::new(StreamingServer::new(port)),
        }
    }
}

impl AudioState {
    pub fn new() -> Result<Self, AppError> {
        Ok(Self {
            player: Mutex::new(AudioPlayer::new()?),
            sync_timeline: Mutex::new(None),
        })
    }
}
