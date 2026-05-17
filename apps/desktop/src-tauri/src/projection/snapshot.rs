use super::state::{Alert, OverlayMode, ProjectionState};
use crate::db::models::SlideContent;
use serde::{Deserialize, Serialize};

#[allow(dead_code)] // Phase 2 — consumed by Surface::hydrate.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionSnapshot {
    pub version: u64,
    pub current_slide: Option<SlideContent>,
    pub overlay: OverlayMode,
    pub frozen: bool,
    pub alert: Option<Alert>,
}

impl ProjectionSnapshot {
    #[allow(dead_code)] // Phase 2 — called by Hub::attach.
    pub(super) fn from_state(state: &ProjectionState) -> Self {
        Self {
            version: state.version,
            current_slide: state.current_slide.clone(),
            overlay: state.overlay.clone(),
            frozen: state.frozen,
            alert: state.alert.clone(),
        }
    }
}
