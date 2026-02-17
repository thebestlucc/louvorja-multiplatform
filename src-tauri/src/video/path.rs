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

pub fn resolve_video_path(app_data_dir: &Path, input_path: &str) -> Result<PathBuf, AppError> {
    if input_path.trim().is_empty() {
        return Err(AppError::Internal("Video path cannot be empty".into()));
    }

    let raw = PathBuf::from(input_path);
    let is_absolute = raw.is_absolute();
    let resolved = if is_absolute {
        raw.clone()
    } else {
        ensure_relative_path_safe(&raw)?;

        let normalized = input_path.replace('\\', "/");
        if normalized.starts_with("media/") {
            app_data_dir.join(normalized)
        } else {
            app_data_dir.join("media").join(normalized)
        }
    };

    let canonical = resolved.canonicalize().map_err(|e| {
        AppError::Internal(format!(
            "Failed to resolve media path '{}': {}",
            resolved.display(),
            e
        ))
    })?;

    if !is_absolute {
        let canonical_app_data = app_data_dir.canonicalize().map_err(|e| {
            AppError::Internal(format!("Failed to resolve app data directory: {}", e))
        })?;
        if !canonical.starts_with(&canonical_app_data) {
            return Err(AppError::Internal(
                "Resolved video path escapes application data directory".into(),
            ));
        }
    }

    Ok(canonical)
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

fn ensure_relative_path_safe(path: &Path) -> Result<(), AppError> {
    if path.is_absolute() {
        return Ok(());
    }

    for component in path.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::Internal(
                    "Invalid relative path: parent traversal is not allowed".into(),
                ));
            }
            _ => {}
        }
    }

    Ok(())
}
