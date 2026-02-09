use serde::{Deserialize, Serialize};

/// A sync point mapping a slide index to an audio timestamp.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPoint {
    pub slide_index: usize,
    pub timestamp_ms: u64,
}
