use crate::db::models::{Presentation, Slide};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub fn get_presentations(state: tauri::State<'_, AppState>) -> Result<Vec<Presentation>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::slides::get_presentations(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn get_presentation(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Presentation, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::slides::get_presentation_by_id(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn create_presentation(
    title: String,
    aspect_ratio: String,
    state: tauri::State<'_, AppState>,
) -> Result<Presentation, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let id = crate::db::queries::slides::insert_presentation(&conn, &title, &aspect_ratio)?;
    crate::db::queries::slides::get_presentation_by_id(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn update_presentation(
    id: i64,
    title: String,
    aspect_ratio: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::slides::update_presentation(&conn, id, &title, &aspect_ratio)
}

#[tauri::command]
#[specta::specta]
pub fn delete_presentation(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::slides::delete_presentation(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn get_slides(
    presentation_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Slide>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::slides::get_slides(&conn, presentation_id)
}

#[tauri::command]
#[specta::specta]
pub fn create_slide(
    presentation_id: i64,
    content_json: String,
    sort_order: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Slide, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let id = crate::db::queries::slides::insert_slide(
        &conn,
        presentation_id,
        &content_json,
        sort_order,
    )?;
    // Return the created slide
    let slides = crate::db::queries::slides::get_slides(&conn, presentation_id)?;
    slides
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::Internal("Failed to retrieve created slide".into()))
}

#[tauri::command]
#[specta::specta]
pub fn update_slide(
    id: i64,
    content_json: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::slides::update_slide(&conn, id, &content_json)
}

#[tauri::command]
#[specta::specta]
pub fn delete_slide(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let mut conn = conn.unwrap();
    crate::db::queries::slides::delete_slide(&mut conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn reorder_slides(
    presentation_id: i64,
    slide_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let mut conn = conn.unwrap();
    crate::db::queries::slides::update_slide_orders(&mut conn, presentation_id, &slide_ids)
}

#[tauri::command]
#[specta::specta]
pub fn import_slja(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Presentation, AppError> {
    let file_path = Path::new(&path);
    let archive = crate::archive::import_presentation(file_path)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data directory: {}", e)))?;
    let media_root = app_data_dir.join("media");
    std::fs::create_dir_all(&media_root)?;

    let mut media_map: HashMap<String, String> = HashMap::new();
    for media in &archive.media {
        let mapped_relative = write_archive_media_file(&media_root, media)?;
        media_map.insert(media.filename.clone(), mapped_relative.clone());
        if let Some(file_name) = std::path::Path::new(&media.filename)
            .file_name()
            .and_then(|value| value.to_str())
        {
            media_map
                .entry(file_name.to_string())
                .or_insert(mapped_relative);
        }
    }

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let pres_id = crate::db::queries::slides::insert_presentation(
        &conn,
        &archive.manifest.title,
        &archive.manifest.aspect_ratio,
    )?;

    for (i, slide) in archive.slides.iter().enumerate() {
        let remapped_content = remap_video_paths_in_content(&slide.content, &media_map)?;
        crate::db::queries::slides::insert_slide_with_metadata(
            &conn,
            pres_id,
            &remapped_content,
            i as i32,
            slide.notes.as_deref(),
            slide.transition.as_deref(),
        )?;
    }

    crate::db::queries::slides::get_presentation_by_id(&conn, pres_id)
}

#[tauri::command]
#[specta::specta]
pub fn export_slja(
    presentation_id: i64,
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    let presentation = crate::db::queries::slides::get_presentation_by_id(&conn, presentation_id)?;
    let slides = crate::db::queries::slides::get_slides(&conn, presentation_id)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data directory: {}", e)))?;
    let media = collect_video_media_files(&slides, &app_data_dir)?;

    let archive = crate::archive::PresentationArchive {
        manifest: crate::archive::manifest::Manifest {
            title: presentation.title,
            author: presentation.author,
            aspect_ratio: presentation.aspect_ratio,
            slide_count: slides.len(),
            created_at: Some(presentation.created_at),
            updated_at: Some(presentation.updated_at),
        },
        slides: slides
            .into_iter()
            .map(|s| crate::archive::SlideData {
                slide_type: s.slide_type,
                content: s.content,
                notes: s.notes,
                transition: s.transition,
            })
            .collect(),
        media,
    };

    crate::archive::write_slja(Path::new(&path), &archive)
}

fn collect_video_media_files(
    slides: &[Slide],
    app_data_dir: &Path,
) -> Result<Vec<crate::archive::MediaFile>, AppError> {
    let mut seen = HashSet::new();
    let mut files = Vec::new();

    for slide in slides {
        let Some(video_path) = extract_video_path_from_content(&slide.content) else {
            continue;
        };

        let archive_filename = if let Some(path) = video_path.strip_prefix("media/") {
            path.to_string()
        } else {
            continue;
        };

        if !seen.insert(archive_filename.clone()) {
            continue;
        }

        let absolute = app_data_dir.join("media").join(&archive_filename);
        if !absolute.exists() {
            continue;
        }

        let data = std::fs::read(&absolute)?;
        files.push(crate::archive::MediaFile {
            filename: archive_filename,
            data,
        });
    }

    Ok(files)
}

fn extract_video_path_from_content(content_json: &str) -> Option<String> {
    let (value, err) = catcher(serde_json::from_str::<serde_json::Value>(content_json));
    if err.is_some() {
        return None;
    }
    let value = value.unwrap();
    let slide_type = value.get("type")?.as_str()?;
    if slide_type != "video" {
        return None;
    }

    value
        .get("videoPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            value
                .get("src")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
}

fn remap_video_paths_in_content(
    content_json: &str,
    media_map: &HashMap<String, String>,
) -> Result<String, AppError> {
    let (value, err) = catcher(serde_json::from_str::<serde_json::Value>(content_json));
    if err.is_some() {
        return Ok(content_json.to_string());
    }
    let mut value = value.unwrap();

    let slide_type = value
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let remap_media_path = |path: &str| -> Option<String> {
        let normalized = path.replace('\\', "/");
        let key = normalized
            .strip_prefix("media/")
            .unwrap_or(&normalized)
            .to_string();
        media_map.get(&key).cloned().or_else(|| {
            std::path::Path::new(&key)
                .file_name()
                .and_then(|value| value.to_str())
                .and_then(|file_name| media_map.get(file_name).cloned())
        })
    };

    if let Some(background_image) = value.get("backgroundImage").and_then(|v| v.as_str()) {
        if let Some(remapped) = remap_media_path(background_image) {
            value["backgroundImage"] = serde_json::Value::String(format!("media/{}", remapped));
        }
    }

    if let Some(audio_path) = value.get("audioPath").and_then(|v| v.as_str()) {
        if let Some(remapped) = remap_media_path(audio_path) {
            value["audioPath"] = serde_json::Value::String(format!("media/{}", remapped));
        }
    }

    if slide_type == "image" {
        if let Some(current_src) = value.get("src").and_then(|v| v.as_str()) {
            if let Some(remapped) = remap_media_path(current_src) {
                value["src"] = serde_json::Value::String(format!("media/{}", remapped));
            }
        }
        return serde_json::to_string(&value).map_err(AppError::from);
    }

    if slide_type != "video" {
        return serde_json::to_string(&value).map_err(AppError::from);
    }

    let current = value
        .get("videoPath")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            value
                .get("src")
                .and_then(|v| v.as_str())
                .map(str::to_string)
        });

    if let Some(current_path) = current {
        if let Some(remapped) = remap_media_path(&current_path) {
            value["videoPath"] = serde_json::Value::String(format!("media/{}", remapped));
        }
    }

    if value.get("videoPath").is_none() {
        value["videoPath"] = serde_json::Value::String(String::new());
    }

    if let Some(obj) = value.as_object_mut() {
        obj.remove("src");
    }

    serde_json::to_string(&value).map_err(AppError::from)
}

fn write_archive_media_file(
    media_root: &Path,
    media_file: &crate::archive::MediaFile,
) -> Result<String, AppError> {
    let sanitized = crate::video::sanitize_archive_media_path(&media_file.filename);
    if sanitized.as_os_str().is_empty() {
        return Err(AppError::Internal(
            "Archive media file had an invalid path".into(),
        ));
    }

    let mut relative_target = sanitized.clone();
    let mut absolute_target = media_root.join(&relative_target);
    if let Some(parent) = absolute_target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    if absolute_target.exists() {
        let existing = std::fs::read(&absolute_target)?;
        if existing != media_file.data {
            relative_target = uniquify_relative_path(media_root, &sanitized);
            absolute_target = media_root.join(&relative_target);
            if let Some(parent) = absolute_target.parent() {
                std::fs::create_dir_all(parent)?;
            }
        }
    }

    if !absolute_target.exists() {
        std::fs::write(&absolute_target, &media_file.data)?;
    }

    Ok(relative_target.to_string_lossy().replace('\\', "/"))
}

fn uniquify_relative_path(media_root: &Path, original: &Path) -> std::path::PathBuf {
    let parent = original
        .parent()
        .map(std::path::PathBuf::from)
        .unwrap_or_default();
    let stem = original
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("media");
    let ext = original.extension().and_then(|s| s.to_str()).unwrap_or("");

    for idx in 1..=10_000 {
        let filename = if ext.is_empty() {
            format!("{}-{}", stem, idx)
        } else {
            format!("{}-{}.{}", stem, idx, ext)
        };

        let mut candidate = parent.clone();
        candidate.push(filename);
        if !media_root.join(&candidate).exists() {
            return candidate;
        }
    }

    let mut fallback = parent;
    fallback.push(format!("{}-fallback", stem));
    fallback
}
