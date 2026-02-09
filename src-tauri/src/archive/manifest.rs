use serde::{Deserialize, Serialize};

/// Manifest for .slja presentation archive files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
    pub slide_count: usize,
}
