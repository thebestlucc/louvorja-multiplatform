use crate::error::AppError;
use crate::utils::catcher::catcher;
use crate::video;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MAX_COVER_SIZE_BYTES: u64 = 16 * 1024 * 1024;

#[tauri::command]
#[specta::specta]
pub async fn copy_image_to_media(image_path: String, app: AppHandle) -> Result<String, AppError> {
    let source = PathBuf::from(&image_path);
    if !source.exists() {
        return Err(AppError::NotFound(format!(
            "Image file '{}' does not exist",
            source.display()
        )));
    }
    let (canonical_source, err) = catcher(source.canonicalize());
    if let Some(e) = err {
        return Err(e);
    }
    let canonical_source = canonical_source.unwrap();
    let extension = ensure_supported_cover_image(&canonical_source)?;
    let (metadata, err) = catcher(std::fs::metadata(&canonical_source));
    if let Some(e) = err {
        return Err(e);
    }
    let file_size = metadata.unwrap().len();
    if file_size > MAX_COVER_SIZE_BYTES {
        return Err(AppError::Internal(format!(
            "Cover image is too large ({} bytes). Maximum size is {} bytes.",
            file_size, MAX_COVER_SIZE_BYTES
        )));
    }
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    // Offload hash + copy to a blocking thread — image files can be up to 16 MB
    // and blocking the IPC thread hangs all invoke() calls on Windows.
    tokio::task::spawn_blocking(move || {
        let mut hasher = blake3::Hasher::new();
        let mut input = File::open(&canonical_source)?;
        let mut buf = [0u8; 8192];
        loop {
            let read = input.read(&mut buf)?;
            if read == 0 {
                break;
            }
            hasher.update(&buf[..read]);
        }
        let digest = hasher.finalize().to_hex().to_string();
        let filename = format!("{}.{}", &digest[..24], extension);

        let media_dir = app_data_dir.join("media").join("covers");
        std::fs::create_dir_all(&media_dir)?;

        let destination = media_dir.join(&filename);
        if destination != canonical_source && !destination.exists() {
            std::fs::copy(&canonical_source, &destination).map_err(|e| {
                AppError::Internal(format!(
                    "Failed to copy image to managed media directory: {}",
                    e
                ))
            })?;
        }

        Ok::<String, AppError>(format!("media/covers/{}.{}", &digest[..24], extension))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Image copy task panicked: {}", e)))?
}

#[tauri::command]
#[specta::specta]
pub async fn copy_video_to_media(video_path: String, app: AppHandle) -> Result<String, AppError> {
    let source = PathBuf::from(&video_path);
    if !source.exists() {
        return Err(AppError::NotFound(format!(
            "Video file '{}' does not exist",
            source.display()
        )));
    }
    let (canonical_source, err) = catcher(source.canonicalize());
    if let Some(e) = err {
        return Err(e);
    }
    let canonical_source = canonical_source.unwrap();
    let extension = video::ensure_supported_video(&canonical_source)?;
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    // Offload hash + copy to a blocking thread — video files can be hundreds of MB
    // and blocking the IPC thread hangs all invoke() calls on Windows.
    tokio::task::spawn_blocking(move || {
        let mut hasher = blake3::Hasher::new();
        let mut input = File::open(&canonical_source)?;
        let mut buf = [0u8; 65536]; // 64 KB chunks for large files
        loop {
            let read = input.read(&mut buf)?;
            if read == 0 {
                break;
            }
            hasher.update(&buf[..read]);
        }
        let digest = hasher.finalize().to_hex().to_string();
        let filename = format!("{}.{}", &digest[..24], extension);

        let media_dir = app_data_dir.join("media").join("videos");
        std::fs::create_dir_all(&media_dir)?;

        let destination = media_dir.join(&filename);
        if destination != canonical_source && !destination.exists() {
            std::fs::copy(&canonical_source, &destination).map_err(|e| {
                AppError::Internal(format!(
                    "Failed to copy video to managed media directory: {}",
                    e
                ))
            })?;
        }

        Ok::<String, AppError>(format!("media/videos/{}.{}", &digest[..24], extension))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Video copy task panicked: {}", e)))?
}

pub(crate) fn ensure_supported_cover_image(path: &Path) -> Result<&'static str, AppError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "png" => Ok("png"),
        "jpg" => Ok("jpg"),
        "jpeg" => Ok("jpeg"),
        "webp" => Ok("webp"),
        "gif" => Ok("gif"),
        "svg" => Ok("svg"),
        "bmp" => Ok("bmp"),
        "avif" => Ok("avif"),
        "tif" | "tiff" => Ok("tiff"),
        "ico" => Ok("ico"),
        _ => Err(AppError::Internal(
            "Unsupported image format. Supported: png, jpg, jpeg, webp, gif, svg, bmp, avif, tiff, ico.".into(),
        )),
    }
}
