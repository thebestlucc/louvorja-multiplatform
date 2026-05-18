use super::state::{Alert, OverlayMode};
use crate::db::models::{SlideContent, SlideContext};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionDelta {
    #[specta(type = f64)]
    pub from_version: u64,
    #[specta(type = f64)]
    pub to_version: u64,
    pub events: Vec<DeltaEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DeltaEvent {
    SlideChanged { slide: Option<SlideContent> },
    ContextChanged { context: Option<SlideContext> },
    OverlayChanged { overlay: OverlayMode },
    FreezeChanged { frozen: bool },
    AlertChanged { alert: Option<Alert> },
}
