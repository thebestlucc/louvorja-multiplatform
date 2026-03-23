use serde::{Deserialize, Serialize};
use specta::Type;

use crate::state::AlertState;
use super::slides::SlideContent;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    pub black_screen: bool,
    pub logo_screen: bool,
    pub alert: Option<AlertState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlideContext {
    pub next: Option<SlideContent>,
    pub index: i32,
    pub total: i32,
    pub title: String,
    #[specta(type = Option<f64>)]
    pub current_slide_start_ms: Option<u64>,
    #[specta(type = Option<f64>)]
    pub next_slide_start_ms: Option<u64>,
    #[specta(type = Option<f64>)]
    pub audio_duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    #[specta(type = f64)]
    pub duration_ms: i64,
    pub width: i32,
    pub height: i32,
    #[specta(type = f64)]
    pub file_size: i64,
    pub format: String,
}
