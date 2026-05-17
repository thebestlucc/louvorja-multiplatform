use super::state::{Alert, OverlayMode};
use crate::db::models::SlideContent;

/// Caller intent. Never serialized — Mutations never cross IPC.
/// Every projection state change enters the Hub through `apply(Mutation)`
/// or `apply_batch(Vec<Mutation>)`.
pub enum Mutation {
    SetSlide(Option<SlideContent>),
    SetOverlay(OverlayMode),
    SetFreeze(bool),
    SetAlert(Option<Alert>),
    /// Composite: fans into SetSlide(None) + SetOverlay(None) + SetAlert(None).
    #[allow(dead_code)] // Phase 2 — invoked by clear_current_slide once shadow→primary.
    ClearAll,
}
