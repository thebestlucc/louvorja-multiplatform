use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncPoint {
    #[specta(type = i32)]
    pub slide_index: usize,
    #[specta(type = f64)]
    pub timestamp_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[specta(type = Option<f64>)]
    pub instrumental_timestamp_ms: Option<u64>,
}
