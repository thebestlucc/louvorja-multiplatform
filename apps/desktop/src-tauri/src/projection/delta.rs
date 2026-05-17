use super::state::{Alert, OverlayMode};
use crate::db::models::SlideContent;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionDelta {
    pub from_version: u64,
    pub to_version: u64,
    pub events: Vec<DeltaEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DeltaEvent {
    SlideChanged { slide: Option<SlideContent> },
    OverlayChanged { overlay: OverlayMode },
    FreezeChanged { frozen: bool },
    AlertChanged { alert: Option<Alert> },
}
