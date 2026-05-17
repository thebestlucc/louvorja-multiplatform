use crate::db::models::SlideContent;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum OverlayMode {
    #[default]
    None,
    Black,
    Logo,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub text: String,
    pub is_ticker: bool,
}

pub(super) struct ProjectionState {
    pub version: u64,
    pub current_slide: Option<SlideContent>,
    pub overlay: OverlayMode,
    pub frozen: bool,
    pub alert: Option<Alert>,
}

impl ProjectionState {
    pub(super) fn new() -> Self {
        Self {
            version: 0,
            current_slide: None,
            overlay: OverlayMode::None,
            frozen: false,
            alert: None,
        }
    }
}
