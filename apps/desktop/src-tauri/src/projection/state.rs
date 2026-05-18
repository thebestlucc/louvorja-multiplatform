use crate::db::models::{SlideContent, SlideContext};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default, Type)]
#[serde(rename_all = "camelCase")]
pub enum OverlayMode {
    #[default]
    None,
    Black,
    Logo,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub text: String,
    pub is_ticker: bool,
}

pub(super) struct ProjectionState {
    pub version: u64,
    pub current_slide: Option<SlideContent>,
    pub context: Option<SlideContext>,
    pub overlay: OverlayMode,
    pub frozen: bool,
    pub alert: Option<Alert>,
    /// Snapshot of the 4 broadcastable fields at the moment freeze flipped
    /// false→true. Used to compute the coalesced unfreeze Delta: any field
    /// that differs from this snapshot is included as one event. `None` while
    /// not frozen.
    pub pre_freeze: Option<PreFreezeFields>,
}

pub(super) struct PreFreezeFields {
    pub current_slide: Option<SlideContent>,
    pub context: Option<SlideContext>,
    pub overlay: OverlayMode,
    pub alert: Option<Alert>,
}

impl ProjectionState {
    pub(super) fn new() -> Self {
        Self {
            version: 0,
            current_slide: None,
            context: None,
            overlay: OverlayMode::None,
            frozen: false,
            alert: None,
            pre_freeze: None,
        }
    }
}
