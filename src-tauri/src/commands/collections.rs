use crate::db::models::{Collection, CollectionSong, CollectionSongSyncStatus, CollectionWithSongs};
use crate::error::AppError;
use crate::state::AppState;
use rusqlite::params;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn get_collections(state: tauri::State<'_, AppState>) -> Result<Vec<Collection>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::collections::get_collections(&conn)
}

#[tauri::command]
pub fn get_collection(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionWithSongs, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::collections::get_collection_with_songs(&conn, id)
}

#[tauri::command]
pub fn create_collection(
    name: String,
    description: Option<String>,
    cover_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Collection, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Internal("Collection name is required.".into()));
    }
    if let Some(path) = &cover_path {
        validate_cover_path(path)?;
    }

    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    let id = crate::db::queries::collections::insert_collection(
        &tx,
        &name,
        description.as_deref(),
        cover_path.as_deref(),
    )?;
    let collection = crate::db::queries::collections::get_collection_by_id(&tx, id)?;
    tx.commit()?;
    Ok(collection)
}

#[tauri::command]
pub fn update_collection(
    id: i64,
    name: String,
    description: Option<String>,
    cover_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Collection, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Internal("Collection name is required.".into()));
    }
    if let Some(path) = &cover_path {
        validate_cover_path(path)?;
    }

    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::collections::update_collection(
        &tx,
        id,
        &name,
        description.as_deref(),
        cover_path.as_deref(),
    )?;
    let collection = crate::db::queries::collections::get_collection_by_id(&tx, id)?;
    tx.commit()?;
    Ok(collection)
}

#[tauri::command]
pub fn delete_collection(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    let collection = crate::db::queries::collections::get_collection_with_songs(&tx, id)?;
    for song in &collection.songs {
        if let Some(cache_id) = song.cache_presentation_id {
            let _ = crate::db::queries::slides::delete_presentation(&tx, cache_id);
        }
    }
    crate::db::queries::collections::delete_collection(&tx, id)?;
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn import_collection_song(
    collection_id: i64,
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionSong, AppError> {
    import_or_resync_collection_song(collection_id, None, &path, &app, &state)
}

#[tauri::command]
pub fn check_collection_song_sync(
    song_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionSongSyncStatus, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    let song = crate::db::queries::collections::get_collection_song_by_id(&tx, song_id)?;

    let source = PathBuf::from(&song.source_path);
    let status = if !source.exists() {
        CollectionSongSyncStatus::MissingSource
    } else {
        let hash = hash_file(&source)?;
        let mtime_ms = source_mtime_ms(&source)?;
        if song.source_hash.as_deref() == Some(hash.as_str()) && song.source_mtime_ms == Some(mtime_ms) {
            CollectionSongSyncStatus::InSync
        } else {
            CollectionSongSyncStatus::Stale
        }
    };

    crate::db::queries::collections::update_collection_song_status(&tx, song_id, status.clone())?;
    tx.commit()?;
    Ok(status)
}

#[tauri::command]
pub fn resync_collection_song(
    song_id: i64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionSong, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let existing = crate::db::queries::collections::get_collection_song_by_id(&conn, song_id)?;
    drop(conn);
    import_or_resync_collection_song(
        existing.collection_id,
        Some(song_id),
        &existing.source_path,
        &app,
        &state,
    )
}

#[tauri::command]
pub fn remove_collection_song(
    song_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    let existing = crate::db::queries::collections::get_collection_song_by_id(&tx, song_id)?;
    crate::db::queries::collections::remove_collection_song(&tx, song_id)?;
    if let Some(cache_id) = existing.cache_presentation_id {
        let _ = crate::db::queries::slides::delete_presentation(&tx, cache_id);
    }
    refresh_collection_auto_cover(&tx, existing.collection_id)?;
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn reorder_collection_songs(
    collection_id: i64,
    song_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::collections::reorder_collection_songs(&tx, collection_id, &song_ids)?;
    refresh_collection_auto_cover(&tx, collection_id)?;
    tx.commit()?;
    Ok(())
}

fn import_or_resync_collection_song(
    collection_id: i64,
    existing_song_id: Option<i64>,
    path: &str,
    app: &AppHandle,
    state: &tauri::State<'_, AppState>,
) -> Result<CollectionSong, AppError> {
    let file_path = PathBuf::from(path);
    if !file_path.exists() {
        return Err(AppError::NotFound(format!(
            "Collection song source '{}' not found",
            file_path.display()
        )));
    }
    let canonical = file_path
        .canonicalize()
        .map_err(|e| AppError::Internal(format!("Failed to resolve source path: {}", e)))?;
    let source_format = source_format(&canonical)?;
    let source_hash = hash_file(&canonical)?;
    let source_mtime_ms = source_mtime_ms(&canonical)?;

    let archive = crate::archive::import_presentation(&canonical)?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data directory: {}", e)))?;
    let media_root = app_data_dir.join("media");
    std::fs::create_dir_all(&media_root)?;

    let mut media_map: HashMap<String, String> = HashMap::new();
    for media in &archive.media {
        let mapped_relative = write_archive_media_file(&media_root, media)?;
        media_map.insert(media.filename.clone(), mapped_relative);
    }

    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::collections::get_collection_by_id(&tx, collection_id)?;

    let presentation_id = crate::db::queries::slides::insert_presentation_with_kind(
        &tx,
        &archive.manifest.title,
        &archive.manifest.aspect_ratio,
        "collection_song",
    )?;
    for (index, slide) in archive.slides.iter().enumerate() {
        let remapped_content = remap_video_paths_in_content(&slide.content, &media_map)?;
        crate::db::queries::slides::insert_slide(&tx, presentation_id, &remapped_content, index as i32)?;
    }

    let song_id = if let Some(song_id) = existing_song_id {
        let old_song = crate::db::queries::collections::get_collection_song_by_id(&tx, song_id)?;
        crate::db::queries::collections::update_collection_song_sync(
            &tx,
            song_id,
            Some(&source_hash),
            Some(source_mtime_ms),
            Some(presentation_id),
            CollectionSongSyncStatus::InSync,
        )?;
        if let Some(old_cache_id) = old_song.cache_presentation_id {
            if old_cache_id != presentation_id {
                let _ = crate::db::queries::slides::delete_presentation(&tx, old_cache_id);
            }
        }
        song_id
    } else {
        let order = crate::db::queries::collections::next_collection_song_order(&tx, collection_id)?;
        crate::db::queries::collections::insert_collection_song(
            &tx,
            collection_id,
            &canonical.to_string_lossy(),
            &source_format,
            Some(&source_hash),
            Some(source_mtime_ms),
            Some(presentation_id),
            CollectionSongSyncStatus::InSync,
            order,
        )?
    };

    refresh_collection_auto_cover(&tx, collection_id)?;
    let song = crate::db::queries::collections::get_collection_song_by_id(&tx, song_id)?;
    tx.commit()?;
    Ok(song)
}

fn refresh_collection_auto_cover(conn: &rusqlite::Transaction<'_>, collection_id: i64) -> Result<(), AppError> {
    let songs = crate::db::queries::collections::get_collection_songs(conn, collection_id)?;
    let mut cover: Option<String> = None;

    for song in songs {
        let Some(presentation_id) = song.cache_presentation_id else {
            continue;
        };
        if let Some(path) = derive_cover_from_presentation(conn, presentation_id)? {
            cover = Some(path);
            break;
        }
    }

    crate::db::queries::collections::set_collection_auto_cover_path(conn, collection_id, cover.as_deref())?;
    Ok(())
}

fn derive_cover_from_presentation(
    conn: &rusqlite::Transaction<'_>,
    presentation_id: i64,
) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT content FROM slides WHERE presentation_id = ?1 ORDER BY slide_index ASC",
    )?;
    let contents = stmt
        .query_map(params![presentation_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for content in contents {
        let value = match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let slide_type = value.get("type").and_then(|v| v.as_str()).unwrap_or_default();
        match slide_type {
            "image" => {
                if let Some(src) = value.get("src").and_then(|v| v.as_str()) {
                    if !src.trim().is_empty() {
                        return Ok(Some(src.to_string()));
                    }
                }
            }
            "video" => {
                if let Some(path) = value
                    .get("videoPath")
                    .and_then(|v| v.as_str())
                    .or_else(|| value.get("src").and_then(|v| v.as_str()))
                {
                    if !path.trim().is_empty() {
                        return Ok(Some(path.to_string()));
                    }
                }
            }
            _ => {}
        }
    }

    Ok(None)
}

fn source_format(path: &Path) -> Result<String, AppError> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|v| v.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "slja" | "pptx" => Ok(ext),
        _ => Err(AppError::Internal(
            "Only .slja and .pptx files are supported in collections.".into(),
        )),
    }
}

fn hash_file(path: &Path) -> Result<String, AppError> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

fn source_mtime_ms(path: &Path) -> Result<i64, AppError> {
    let modified = std::fs::metadata(path)?.modified().map_err(|e| {
        AppError::Internal(format!("Failed to read source modified timestamp: {}", e))
    })?;
    let millis = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| AppError::Internal(format!("Invalid source modified timestamp: {}", e)))?
        .as_millis();
    Ok(i64::try_from(millis).unwrap_or(i64::MAX))
}

fn validate_cover_path(path: &str) -> Result<(), AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::Internal("Cover path cannot be empty.".into()));
    }
    if trimmed.contains("..") {
        return Err(AppError::Internal(
            "Cover path cannot contain parent path traversal segments.".into(),
        ));
    }
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("data:")
        || trimmed.starts_with("blob:")
    {
        return Err(AppError::Internal(
            "Cover path must reference managed/local media, not remote URLs.".into(),
        ));
    }
    Ok(())
}

fn remap_video_paths_in_content(
    content_json: &str,
    media_map: &HashMap<String, String>,
) -> Result<String, AppError> {
    let mut value: serde_json::Value = match serde_json::from_str(content_json) {
        Ok(value) => value,
        Err(_) => return Ok(content_json.to_string()),
    };

    if value
        .get("type")
        .and_then(|v| v.as_str())
        .map(|slide_type| slide_type != "video")
        .unwrap_or(true)
    {
        return Ok(content_json.to_string());
    }

    let current = value
        .get("videoPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| value.get("src").and_then(|v| v.as_str()).map(|s| s.to_string()));

    if let Some(current_path) = current {
        let key = current_path
            .strip_prefix("media/")
            .unwrap_or(&current_path)
            .to_string();

        if let Some(remapped) = media_map.get(&key) {
            value["videoPath"] = serde_json::Value::String(format!("media/{}", remapped));
        }
    }

    if value.get("videoPath").is_none() {
        value["videoPath"] = serde_json::Value::String(String::new());
    }

    if let Some(object) = value.as_object_mut() {
        object.remove("src");
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

fn uniquify_relative_path(media_root: &Path, original: &Path) -> PathBuf {
    let parent = original.parent().map(PathBuf::from).unwrap_or_default();
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
