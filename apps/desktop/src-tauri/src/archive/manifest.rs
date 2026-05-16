use crate::error::AppError;
use serde::{Deserialize, Serialize};

/// Manifest for .slja presentation archive files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub title: String,
    pub author: Option<String>,
    pub aspect_ratio: String,
    pub slide_count: usize,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl Manifest {
    pub fn from_json(json: &str) -> Result<Self, AppError> {
        serde_json::from_str(json).map_err(AppError::SerdeJson)
    }

    pub fn to_json(&self) -> Result<String, AppError> {
        serde_json::to_string_pretty(self).map_err(AppError::SerdeJson)
    }
}
