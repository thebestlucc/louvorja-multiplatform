use crate::error::AppError;
use std::path::{Component, Path, PathBuf};

pub const SUPPORTED_VIDEO_EXTENSIONS: [&str; 2] = ["mp4", "webm"];

pub fn format_from_path(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .filter(|ext| SUPPORTED_VIDEO_EXTENSIONS.contains(&ext.as_str()))
}

pub fn ensure_supported_video(path: &Path) -> Result<String, AppError> {
    format_from_path(path).ok_or_else(|| {
        AppError::Internal("Unsupported video format. Only .mp4 and .webm are supported.".into())
    })
}

pub fn sanitize_archive_media_path(path: &str) -> PathBuf {
    let mut clean = PathBuf::new();
    for component in Path::new(path).components() {
        if let Component::Normal(seg) = component {
            clean.push(seg);
        }
    }
    clean
}
