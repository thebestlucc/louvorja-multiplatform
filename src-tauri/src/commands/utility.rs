use crate::db::models::{MediaIntegrityReport, MissingFile, VideoMetadata};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use crate::utils::paths::SafePath;
use crate::video;
use rand::rngs::OsRng;
use rand::seq::SliceRandom;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

const MAX_COVER_SIZE_BYTES: u64 = 8 * 1024 * 1024;

#[tauri::command]
#[specta::specta]
pub async fn scan_media_integrity(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<MediaIntegrityReport, AppError> {
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    let mut referenced_paths = HashSet::new();
    let mut missing_files = Vec::new();

    // 1. Scan Hymns (Audio, Playback, Cover)
    let mut stmt = conn.prepare(
        "SELECT id, title, number, audio_path, playback_path, cover_path FROM hymns",
    )?;
    let hymn_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i32>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    })?;

    for row in hymn_rows {
        let (id, title, number, audio, playback, cover) = row?;
        let name = match number {
            Some(n) => format!("{} - {}", n, title),
            None => title,
        };

        for path_opt in [audio, playback, cover] {
            if let Some(p) = path_opt {
                if !p.trim().is_empty() {
                    referenced_paths.insert(p.clone());
                    let full_path = app_data_dir.join(&p);
                    if !full_path.exists() {
                        missing_files.push(MissingFile {
                            path: p,
                            source_type: "hymn".into(),
                            source_id: id,
                            source_name: name.clone(),
                        });
                    }
                }
            }
        }
    }

    // 2. Scan Slides (background_image, video_path)
    let mut stmt = conn.prepare("SELECT id, presentation_id, background_image, video_path FROM slides")?;
    let slide_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    })?;

    for row in slide_rows {
        let (id, pres_id, bg, video) = row?;
        for path_opt in [bg, video] {
            if let Some(p) = path_opt {
                if !p.trim().is_empty() {
                    referenced_paths.insert(p.clone());
                    let full_path = app_data_dir.join(&p);
                    if !full_path.exists() {
                        missing_files.push(MissingFile {
                            path: p,
                            source_type: "slide".into(),
                            source_id: id,
                            source_name: format!("Slide {} (Pres {})", id, pres_id),
                        });
                    }
                }
            }
        }
    }

    // 3. Scan File System for Excess Files
    let mut excess_files = Vec::new();
    let media_root = app_data_dir.join("media");
    if media_root.exists() {
        for entry in walkdir::WalkDir::new(&media_root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let full_path = entry.path();
            if let Ok(rel_path) = full_path.strip_prefix(&app_data_dir) {
                let rel_str = rel_path.to_string_lossy().to_string();
                // Replace backslashes with forward slashes for cross-platform DB consistency
                let normalized_rel = rel_str.replace("\\", "/");
                if !referenced_paths.contains(&normalized_rel) {
                    excess_files.push(normalized_rel);
                }
            }
        }
    }

    Ok(MediaIntegrityReport {
        missing_files,
        excess_files,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn delete_excess_media(
    paths: Vec<String>,
    app: AppHandle,
) -> Result<(), AppError> {
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    for path in paths {
        let full_path = app_data_dir.join(&path);
        // Security: Ensure the path is inside the media directory
        if !full_path.starts_with(app_data_dir.join("media")) {
            return Err(AppError::Internal(format!("Security violation: attempt to delete file outside media directory: {}", path)));
        }
        if full_path.exists() && full_path.is_file() {
            fs::remove_file(full_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn run_lottery(names: Vec<String>) -> Result<String, AppError> {
    let sanitized = sanitize_lottery_names(names);
    if sanitized.is_empty() {
        return Err(AppError::Internal(
            "Lottery requires at least one non-empty name.".into(),
        ));
    }

    let mut rng = OsRng;
    let winner = sanitized
        .choose(&mut rng)
        .ok_or_else(|| AppError::Internal("Failed to select lottery winner.".into()))?;

    Ok(winner.clone())
}

#[tauri::command]
#[specta::specta]
pub fn format_text(text: String, format: String) -> Result<String, AppError> {
    let normalized = format.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "uppercase" => Ok(text.to_uppercase()),
        "lowercase" => Ok(text.to_lowercase()),
        "title_case" => Ok(to_title_case(&text)),
        "sentence_case" => Ok(to_sentence_case(&text)),
        _ => Err(AppError::Internal(format!(
            "Unsupported text format '{}'. Use uppercase, lowercase, title_case, or sentence_case.",
            format
        ))),
    }
}

/// Copy a video file to the managed media directory.
///
/// Returns immediately — heavy work (blake3 hash + fs::copy) runs on a
/// background thread to avoid blocking the IPC bridge on Windows (where a
/// 2 GB file can take 10–30 seconds).
///
/// # Events
/// - `"video-copy-complete"`: `(presentation_id: i64, rel_path: String)` on success
/// - `"video-copy-error"`:    `(presentation_id: i64, error: String)` on failure
#[tauri::command]
#[specta::specta]
pub fn copy_video_to_media(
    video_path: String,
    presentation_id: i64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    // Fast synchronous checks — validate before spawning the thread
    {
        let (conn, err) = catcher(state.db.get());
        if let Some(e) = err {
            return Err(e);
        }
        let conn = conn.unwrap();
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM presentations WHERE id = ?1",
            rusqlite::params![presentation_id],
            |row| row.get(0),
        )?;
        if exists == 0 {
            return Err(AppError::NotFound(format!(
                "Presentation with id {} not found",
                presentation_id
            )));
        }
    }
    let source = PathBuf::from(&video_path);
    if !source.exists() {
        return Err(AppError::NotFound(format!(
            "Video file '{}' does not exist",
            source.display()
        )));
    }

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let (rel_path, err) = catcher(do_copy_video_work(&video_path, &app_clone));
        if let Some(e) = err {
            let _ = app_clone.emit("video-copy-error", (presentation_id, e.to_string()));
        } else {
            let _ = app_clone.emit("video-copy-complete", (presentation_id, rel_path.unwrap()));
        }
    });

    Ok(())
}

/// Performs the blake3 hash + fs::copy work for a video file.
/// Called from a background thread; must not hold AppState references.
fn do_copy_video_work(video_path: &str, app: &AppHandle) -> Result<String, AppError> {
    let source = PathBuf::from(video_path);
    let (canonical_source, err) = catcher(source.canonicalize());
    if let Some(e) = err {
        return Err(e);
    }
    let canonical_source = canonical_source.unwrap();
    let format = video::ensure_supported_video(&canonical_source)?;

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
    let filename = format!("{}.{}", &digest[..24], format);

    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();
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

    Ok(format!("media/videos/{}", filename))
}

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

    // Offload hash + copy to a blocking thread — image files can be up to 8 MB
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
pub fn resolve_media_path(path: String, app: AppHandle) -> Result<String, AppError> {
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    let safe_path = SafePath::new(&app_data_dir);
    let resolved = safe_path.resolve(&path)?;

    video::ensure_supported_video(&resolved)?;

    Ok(resolved.to_string_lossy().to_string())
}

/// Get metadata for a video file.
///
/// The native parser runs synchronously (fast). If it fails and ffprobe is
/// enabled, the ffprobe fallback can block up to 4 seconds — that work is
/// offloaded to `tokio::task::spawn_blocking` so the IPC bridge stays
/// responsive on Windows during the wait.
#[tauri::command]
#[specta::specta]
pub async fn get_video_metadata(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<VideoMetadata, AppError> {
    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    let safe_path = SafePath::new(&app_data_dir);
    let resolved_path = safe_path.resolve(&path)?;

    if !resolved_path.exists() {
        return Err(AppError::NotFound(format!(
            "Video file '{}' not found",
            resolved_path.display()
        )));
    }

    let format = video::ensure_supported_video(&resolved_path)?;
    let (metadata, err) = catcher(std::fs::metadata(&resolved_path));
    if let Some(e) = err {
        return Err(e);
    }
    let file_size = metadata.unwrap().len() as i64;

    // Load ffprobe settings before entering spawn_blocking — tauri::State
    // is not Send and cannot cross the async boundary.
    let (ffprobe_enabled, ffprobe_path) = load_ffprobe_settings(&state)?;

    let resolved_path_clone = resolved_path.clone();
    let parsed = tokio::task::spawn_blocking(move || {
        match video::parse_video_metadata(&resolved_path_clone) {
            Ok(parsed) => Ok(parsed),
            Err(primary_error) => {
                if !ffprobe_enabled {
                    return Err(primary_error);
                }
                video::parse_video_metadata_with_ffprobe(
                    &resolved_path_clone,
                    ffprobe_path.as_deref(),
                    4000,
                )
                .map_err(|fallback_error| {
                    AppError::Internal(format!(
                        "Video metadata parsing failed (native parser error: {}; ffprobe fallback error: {})",
                        primary_error, fallback_error
                    ))
                })
            }
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("Metadata task panicked: {}", e)))??;

    Ok(VideoMetadata {
        duration_ms: parsed.duration_ms,
        width: parsed.width,
        height: parsed.height,
        file_size,
        format: if parsed.format.is_empty() {
            format
        } else {
            parsed.format
        },
    })
}

fn sanitize_lottery_names(names: Vec<String>) -> Vec<String> {
    names
        .into_iter()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect()
}

fn to_title_case(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut is_word_start = true;

    for ch in text.chars() {
        if ch.is_alphabetic() {
            if is_word_start {
                output.extend(ch.to_uppercase());
                is_word_start = false;
            } else {
                output.extend(ch.to_lowercase());
            }
        } else {
            output.push(ch);
            is_word_start = ch.is_whitespace() || matches!(ch, '-' | '_' | '/' | '\\');
        }
    }

    output
}

fn to_sentence_case(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut capitalize_next = true;

    for ch in text.chars() {
        if ch.is_alphabetic() {
            if capitalize_next {
                output.extend(ch.to_uppercase());
                capitalize_next = false;
            } else {
                output.extend(ch.to_lowercase());
            }
        } else {
            output.push(ch);
            if matches!(ch, '.' | '!' | '?') {
                capitalize_next = true;
            }
        }
    }

    output
}

fn load_ffprobe_settings(
    state: &tauri::State<'_, AppState>,
) -> Result<(bool, Option<String>), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    let enabled = crate::db::queries::settings::get_setting(&conn, "video.ffprobeEnabled")
        .ok()
        .map(|s| s.value == "true")
        .unwrap_or(false);

    let path = crate::db::queries::settings::get_setting(&conn, "video.ffprobePath")
        .ok()
        .map(|s| s.value)
        .filter(|v| !v.trim().is_empty());

    Ok((enabled, path))
}

#[tauri::command]
#[specta::specta]
pub fn open_media_folder(app: AppHandle) -> Result<(), AppError> {
    let media_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?
        .join("media");

    // Create the folder if it doesn't exist yet so opener doesn't fail
    if !media_dir.exists() {
        std::fs::create_dir_all(&media_dir)
            .map_err(|e| AppError::Io(e))?;
    }

    tauri_plugin_opener::open_path(media_dir, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Could not open folder: {}", e)))
}

fn ensure_supported_cover_image(path: &Path) -> Result<&'static str, AppError> {
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
        _ => Err(AppError::Internal(
            "Unsupported image format. Allowed formats: png, jpg, jpeg, webp.".into(),
        )),
    }
}
