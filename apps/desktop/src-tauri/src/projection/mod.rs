pub mod utility;
pub use utility::*;

mod delta;
mod hub;
mod mutation;
mod snapshot;
mod state;

// Phase 1: only Hub + Mutation + Alert + OverlayMode are consumed by shadow
// writes. Snapshot/Delta/attach/ClearAll are Phase 2 entry points wired in
// when SseSurface lands. See `.scratch/arch-projection-hub/PRD.md`.
#[allow(unused_imports)]
pub use delta::{DeltaEvent, ProjectionDelta};
pub use hub::ProjectionHub;
pub use mutation::Mutation;
#[allow(unused_imports)]
pub use snapshot::ProjectionSnapshot;
pub use state::{Alert, OverlayMode};
