use super::state::{Alert, OverlayMode, ProjectionState};
use crate::db::models::{SlideContent, SlideContext};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionSnapshot {
    pub version: u64,
    pub current_slide: Option<SlideContent>,
    pub context: Option<SlideContext>,
    pub overlay: OverlayMode,
    pub frozen: bool,
    pub alert: Option<Alert>,
}

impl ProjectionSnapshot {
    pub(super) fn from_state(state: &ProjectionState) -> Self {
        Self {
            version: state.version,
            current_slide: state.current_slide.clone(),
            context: state.context.clone(),
            overlay: state.overlay.clone(),
            frozen: state.frozen,
            alert: state.alert.clone(),
        }
    }
}
