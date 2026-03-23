use std::fs;
use std::path::Path;
use reqwest::blocking::Client;
use crate::error::AppError;

/// Downloads a thumbnail from a URL and saves it to media/covers/youtube/.
/// Returns the relative path (e.g., "media/covers/youtube/{id}.jpg").
/// MUST be called from a spawned thread — uses blocking HTTP.
pub fn download_thumbnail(
    app_data_dir: &Path,
    url: &str,
    filename: &str,
) -> Result<String, AppError> {
    if url.is_empty() {
        return Err(AppError::Internal("Empty thumbnail URL".into()));
    }

    let covers_dir = app_data_dir
        .join("media")
        .join("covers")
        .join("youtube");
    fs::create_dir_all(&covers_dir)?;

    let ext = if url.contains(".webp") {
        "webp"
    } else if url.contains(".png") {
        "png"
    } else {
        "jpg"
    };

    let file_name = format!("{}.{}", filename, ext);
    let full_path = covers_dir.join(&file_name);
    let relative_path = format!("media/covers/youtube/{}", file_name);

    let client = Client::new();
    let bytes = client
        .get(url)
        .send()
        .map_err(|e| AppError::Internal(format!("Failed to download thumbnail: {}", e)))?
        .bytes()
        .map_err(|e| AppError::Internal(format!("Failed to read thumbnail bytes: {}", e)))?;

    fs::write(&full_path, &bytes)?;

    Ok(relative_path)
}
