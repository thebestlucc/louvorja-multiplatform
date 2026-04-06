use crate::db::models::{
    Collection, CollectionSearchResult, CollectionSong, CollectionSongSyncStatus,
    CollectionWithSongs, Hymn,
};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use crate::utils::paths::resolve_content_path;
use rusqlite::params;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

/// Gets a PooledConnection from content_dbs for the first selected language.
/// Returns None if no content DB is available.
fn get_content_db_conn(
    state: &AppState,
    conn: &rusqlite::Connection,
) -> Option<(
    r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>,
    String,
)> {
    let langs = crate::db::queries::content_sync::get_selected_languages(conn);
    let lang = langs.into_iter().next()?;
    let map = state.content_dbs.read().ok()?;
    let pool = map.get(&lang)?.clone(); // clone pool before dropping lock
    drop(map); // release lock before .get()
    let pooled = pool.get().ok()?;
    Some((pooled, lang))
}

fn resolve_hymn_paths(
    mut hymns: Vec<Hymn>,
    app_data_dir: &std::path::Path,
) -> Vec<Hymn> {
    for h in &mut hymns {
        if let Some(ref p) = h.audio_path {
            h.audio_path = Some(resolve_content_path(app_data_dir, p));
        }
        if let Some(ref p) = h.playback_path {
            h.playback_path = Some(resolve_content_path(app_data_dir, p));
        }
        if let Some(ref p) = h.cover_path {
            h.cover_path = Some(resolve_content_path(app_data_dir, p));
        }
    }
    hymns
}

fn resolve_collection_paths(
    mut collections: Vec<Collection>,
    app_data_dir: &std::path::Path,
) -> Vec<Collection> {
    for c in &mut collections {
        if let Some(ref p) = c.cover_path {
            c.cover_path = Some(resolve_content_path(app_data_dir, p));
        }
    }
    collections
}

#[tauri::command]
#[specta::specta]
pub fn get_collections(
    app: AppHandle,
    query: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Collection>, AppError> {
    let conn = state.db.get()?;

    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let mut collections =
            crate::db::queries::music::get_collections_from_content_db(&content_conn, &lang)?;
        // Apply query filter if provided (simple case-insensitive name match)
        if let Some(ref q) = query {
            let q_lower = q.to_lowercase();
            collections.retain(|c| c.name.to_lowercase().contains(&q_lower));
        }
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_collection_paths(collections, &app_data));
    }

    // Fallback to main DB
    crate::db::queries::collections::get_collections(&conn, query.as_deref())
}

#[tauri::command]
#[specta::specta]
pub fn search_collections(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<CollectionSearchResult>, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::collections::search_collections(&conn, &query, 8)
}

#[tauri::command]
#[specta::specta]
pub fn search_collections_content(
    query: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<CollectionSearchResult>, AppError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let dbs = state
        .content_dbs
        .read()
        .map_err(|e| AppError::Internal(format!("content_dbs lock poisoned: {e}")))?;
    let mut results = Vec::new();
    for (lang, pool) in dbs.iter() {
        let remaining = 8_usize.saturating_sub(results.len());
        if remaining == 0 {
            break;
        }
        let content_conn = match pool.get() {
            Ok(c) => c,
            Err(_) => continue,
        };
        let content_results = match crate::db::queries::music::search_collections_content_db(
            &content_conn, &query, lang, remaining,
        ) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[search_collections_content] content DB '{lang}' search failed: {e}");
                continue;
            }
        };
        for mut r in content_results {
            if let Some(ref p) = r.cover_path {
                r.cover_path = Some(
                    app_data
                        .join(p.trim_start_matches('/'))
                        .to_string_lossy()
                        .replace('\\', "/"),
                );
            }
            results.push(r);
        }
    }
    results.truncate(8);
    Ok(results)
}

#[tauri::command]
#[specta::specta]
pub fn get_collection(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionWithSongs, AppError> {
    let conn = state.db.get()?;

    // Try main DB first
    match crate::db::queries::collections::get_collection_with_songs(&conn, id) {
        Ok(result) => return Ok(result),
        Err(AppError::NotFound(_)) => {} // fall through to content DB
        Err(e) => return Err(e),
    }

    // Fall back to content DB (collections from CDN packs are stored there)
    if let Some((content_conn, _lang)) = get_content_db_conn(&state, &conn) {
        if let Some(collection) =
            crate::db::queries::music::get_collection_by_id_from_content_db(&content_conn, id)?
        {
            return Ok(CollectionWithSongs {
                collection,
                songs: vec![],
            });
        }
    }

    Err(AppError::NotFound(format!(
        "Collection with id {} not found",
        id
    )))
}

#[tauri::command]
#[specta::specta]
pub fn create_collection(
    name: String,
    description: Option<String>,
    year: Option<i32>,
    cover_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Collection, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Internal("Collection name is required.".into()));
    }
    if let Some(path) = &cover_path {
        validate_cover_path(path)?;
    }
    validate_collection_year(year)?;

    let conn = state.db.get()?;
    let tx = conn.unchecked_transaction()?;
    let id = crate::db::queries::collections::insert_collection(
        &tx,
        &name,
        description.as_deref(),
        year,
        cover_path.as_deref(),
        "file",
        None,
    )?;
    let collection = crate::db::queries::collections::get_collection_by_id(&tx, id)?;
    tx.commit()?;
    Ok(collection)
}

#[tauri::command]
#[specta::specta]
pub fn update_collection(
    id: i64,
    name: String,
    description: Option<String>,
    year: Option<i32>,
    cover_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Collection, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Internal("Collection name is required.".into()));
    }
    if let Some(path) = &cover_path {
        validate_cover_path(path)?;
    }
    validate_collection_year(year)?;

    let conn = state.db.get()?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::collections::update_collection(
        &tx,
        id,
        &name,
        description.as_deref(),
        year,
        cover_path.as_deref(),
    )?;
    let collection = crate::db::queries::collections::get_collection_by_id(&tx, id)?;
    tx.commit()?;
    Ok(collection)
}

#[tauri::command]
#[specta::specta]
pub fn delete_collection(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state.db.get()?;
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
#[specta::specta]
pub fn import_collection_song(
    collection_id: i64,
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionSong, AppError> {
    import_or_resync_collection_song(collection_id, None, &path, &app, &state)
}

#[tauri::command]
#[specta::specta]
pub fn check_collection_song_sync(
    song_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionSongSyncStatus, AppError> {
    let conn = state.db.get()?;
    let tx = conn.unchecked_transaction()?;
    let song = crate::db::queries::collections::get_collection_song_by_id(&tx, song_id)?;

    let source = PathBuf::from(&song.source_path);
    let status = if !source.exists() {
        CollectionSongSyncStatus::MissingSource
    } else {
        let hash = hash_file(&source)?;
        let mtime_ms = source_mtime_ms(&source)?;
        if song.source_hash.as_deref() == Some(hash.as_str())
            && song.source_mtime_ms == Some(mtime_ms)
        {
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
#[specta::specta]
pub fn resync_collection_song(
    song_id: i64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<CollectionSong, AppError> {
    let conn = state.db.get()?;
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
#[specta::specta]
pub fn remove_collection_song(
    song_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state.db.get()?;
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
#[specta::specta]
pub fn reorder_collection_songs(
    collection_id: i64,
    song_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state.db.get()?;
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
        media_map.insert(media.filename.clone(), mapped_relative.clone());
        if let Some(file_name) = Path::new(&media.filename)
            .file_name()
            .and_then(|value| value.to_str())
        {
            media_map
                .entry(file_name.to_string())
                .or_insert(mapped_relative);
        }
    }

    let conn = state.db.get()?;
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
        crate::db::queries::slides::insert_slide_with_metadata(
            &tx,
            presentation_id,
            &remapped_content,
            index as i32,
            slide.notes.as_deref(),
            slide.transition.as_deref(),
        )?;
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
        let order =
            crate::db::queries::collections::next_collection_song_order(&tx, collection_id)?;
        crate::db::queries::collections::insert_collection_song(
            &tx,
            crate::db::queries::collections::InsertCollectionSongInput {
                collection_id,
                source_path: &canonical.to_string_lossy().replace('\\', "/"),
                source_format: &source_format,
                source_hash: Some(&source_hash),
                source_mtime_ms: Some(source_mtime_ms),
                cache_presentation_id: Some(presentation_id),
                sync_status: CollectionSongSyncStatus::InSync,
                item_order: order,
            },
        )?
    };

    refresh_collection_auto_cover(&tx, collection_id)?;
    let song = crate::db::queries::collections::get_collection_song_by_id(&tx, song_id)?;
    tx.commit()?;
    Ok(song)
}

fn refresh_collection_auto_cover(
    conn: &rusqlite::Transaction<'_>,
    collection_id: i64,
) -> Result<(), AppError> {
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

    crate::db::queries::collections::set_collection_auto_cover_path(
        conn,
        collection_id,
        cover.as_deref(),
    )?;
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
        let (value, err) = catcher(serde_json::from_str::<serde_json::Value>(&content));
        if err.is_some() {
            continue;
        }
        let value = value.unwrap();
        let slide_type = value
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
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

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use crate::db::models::Collection;

    fn make_collection(cover: Option<&str>) -> Collection {
        Collection {
            id: 1,
            name: "Test Collection".to_string(),
            description: None,
            year: None,
            cover_path: cover.map(str::to_string),
            auto_cover_path: None,
            song_count: 0,
            source_type: "api".to_string(),
            api_album_id: Some(1),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        }
    }

    #[test]
    fn resolve_collection_paths_strips_leading_slash() {
        let app_dir = PathBuf::from("/app/data");
        let collections = vec![make_collection(Some("/covers/album1.jpg"))];
        let resolved = super::resolve_collection_paths(collections, &app_dir);
        assert_eq!(
            resolved[0].cover_path.as_deref(),
            Some("/app/data/covers/album1.jpg")
        );
    }

    #[test]
    fn resolve_collection_paths_none_cover_remains_none() {
        let app_dir = PathBuf::from("/app/data");
        let collections = vec![make_collection(None)];
        let resolved = super::resolve_collection_paths(collections, &app_dir);
        assert_eq!(resolved[0].cover_path, None);
    }
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

fn validate_collection_year(year: Option<i32>) -> Result<(), AppError> {
    if let Some(value) = year {
        if !(1900..=2200).contains(&value) {
            return Err(AppError::Internal(
                "Collection year must be between 1900 and 2200.".into(),
            ));
        }
    }
    Ok(())
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
            Path::new(&key)
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

// --- Collection-Hymn commands (for API-imported album collections) ---

#[tauri::command]
#[specta::specta]
pub fn get_collection_hymns(
    app: AppHandle,
    collection_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state.db.get()?;

    if let Some((content_conn, lang)) = get_content_db_conn(&state, &conn) {
        let hymns = crate::db::queries::music::get_collection_hymns_from_content_db(
            &content_conn,
            collection_id,
            &lang,
        )?;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data));
    }

    // Fallback to main DB
    crate::db::queries::collections::get_collection_hymns(&conn, collection_id)
}

#[tauri::command]
#[specta::specta]
pub fn add_hymn_to_collection(
    collection_id: i64,
    hymn_id: i64,
    item_order: i64,
    state: tauri::State<'_, AppState>,
) -> Result<bool, AppError> {
    let conn = state.db.get()?;
    crate::db::queries::collections::insert_collection_hymn(
        &conn,
        collection_id,
        hymn_id,
        item_order,
    )
}

#[tauri::command]
#[specta::specta]
pub fn remove_hymn_from_collection(
    collection_id: i64,
    hymn_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state.db.get()?;
    crate::db::queries::collections::delete_collection_hymn(&conn, collection_id, hymn_id)
}
