use crate::content_sync::manifest::ContentManifest;
use crate::error::AppError;
use crate::pack_sync::{self, planner::PackSyncPlan};
use crate::state::AppState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Manager};

const MANIFEST_CACHE_FILE: &str = "manifest_cache.json";

fn manifest_cache_path(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Could not resolve app data dir: {}", e)))?
        .join(MANIFEST_CACHE_FILE))
}

fn load_cached_manifest(app: &AppHandle) -> Option<ContentManifest> {
    let path = manifest_cache_path(app).ok()?;
    let bytes = std::fs::read(&path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn save_manifest_cache(app: &AppHandle, manifest: &ContentManifest) {
    if let Ok(path) = manifest_cache_path(app) {
        let mut buf = Vec::with_capacity(4096);
        if serde_json::to_writer(&mut buf, manifest).is_ok() {
            let _ = std::fs::write(path, buf);
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn plan_pack_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    force_refresh: Option<bool>,
    preview_languages: Option<Vec<String>>,
) -> Result<PackSyncPlan, AppError> {
    if !pack_sync::is_pack_sync_enabled() {
        return Ok(PackSyncPlan {
            manifest_version: 0,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
            available_languages: vec![],
            selected_languages: vec![],
        });
    }

    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;

    let stored_version = crate::db::queries::settings::get_setting(&conn, "pack_sync.manifest_version")
        .ok()
        .and_then(|s| s.value.parse::<i64>().ok())
        .unwrap_or(0);

    let preview = preview_languages.as_deref();
    let force = force_refresh == Some(true);

    // Check whether the CDN has already been fetched this session.
    let already_fetched = state
        .pack_sync
        .lock()
        .map(|r| r.manifest_fetched)
        .unwrap_or(false);

    // If already fetched this session (and not forced), reuse the file cache.
    if !force && already_fetched {
        if let Some(cached) = load_cached_manifest(&app) {
            return pack_sync::planner::build_plan(&conn, &cached, stored_version, preview);
        }
        // Cache file missing — fall through to a fresh fetch below.
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {}", e)))?;

    // First call this session (or force refresh): clear the old file cache so
    // we never serve stale data from a previous launch, then fetch fresh from CDN.
    if let Ok(path) = manifest_cache_path(&app) {
        let _ = std::fs::remove_file(&path);
    }

    let manifest = match crate::content_sync::manifest::fetch_manifest(
        &client, pack_sync::CDN_MANIFEST_URL,
    ).await {
        Ok(m) => {
            save_manifest_cache(&app, &m);
            // Mark as fetched so subsequent calls within this session use the cache.
            if let Ok(mut runtime) = state.pack_sync.lock() {
                runtime.manifest_fetched = true;
            }
            m
        }
        Err(_) => {
            // CDN unreachable — fall back to the (now-cleared) cache only if it
            // survived the delete above (e.g., read-only FS).  Otherwise error.
            match load_cached_manifest(&app) {
                Some(cached) => cached,
                None => return Err(AppError::Internal(
                    "CDN unreachable and no manifest cache available.".into(),
                )),
            }
        }
    };

    pack_sync::planner::build_plan(&conn, &manifest, stored_version, preview)
}

#[tauri::command]
#[specta::specta]
pub fn start_pack_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    items: Option<Vec<crate::pack_sync::planner::PackSyncPlanItem>>,
    selected_languages: Option<Vec<String>>,
) -> Result<String, AppError> {
    if !pack_sync::is_pack_sync_enabled() {
        return Err(AppError::Internal("Pack sync is not configured.".into()));
    }

    // Save language preference before executor builds its plan
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    if let Some(ref langs) = selected_languages {
        crate::db::queries::content_sync::set_selected_languages(&conn, langs)?;
    }

    let run_id = pack_sync::executor::new_run_id();
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut runtime = state.pack_sync.lock()
            .map_err(|e| AppError::Internal(format!("Lock error: {}", e)))?;
        runtime.active_run_id = Some(run_id.clone());
        runtime.cancel_flags.insert(run_id.clone(), cancel_flag.clone());
    }

    let run_id_clone = run_id.clone();
    std::thread::spawn(move || {
        pack_sync::executor::execute_pack_sync(app, run_id_clone, cancel_flag, items);
    });

    Ok(run_id)
}

#[tauri::command]
#[specta::specta]
pub fn clear_manifest_cache(app: AppHandle) -> Result<(), AppError> {
    let path = manifest_cache_path(&app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(AppError::Io)?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn cancel_pack_sync(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let runtime = state.pack_sync.lock()
        .map_err(|e| AppError::Internal(format!("Lock error: {}", e)))?;

    if let Some(flag) = runtime.cancel_flags.get(&run_id) {
        flag.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    Ok(())
}

/// Diagnostic: lists top-level dirs and a sample of files under app_data_dir.
/// Helps verify that pack extraction placed files where resolve_hymn_paths expects.
#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncDiagnostics {
    pub app_data_dir: String,
    pub top_level_entries: Vec<String>,
    pub sample_music_files: Vec<String>,
    pub sample_cover_files: Vec<String>,
    pub content_db_sample_paths: Vec<String>,
}

#[tauri::command]
#[specta::specta]
pub fn diagnose_pack_paths(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<PackSyncDiagnostics, AppError> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Top-level entries
    let top_level_entries: Vec<String> = std::fs::read_dir(&app_data_dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
                    if is_dir { format!("{}/", name) } else { name }
                })
                .collect()
        })
        .unwrap_or_default();

    // Sample music files (first 5)
    let sample_music_files = list_files_sample(&app_data_dir.join("musics"), 5);

    // Sample cover files (first 5)
    let sample_cover_files = list_files_sample(&app_data_dir.join("covers"), 5);

    // Content DB sample paths: raw dir||'/'||name from first 3 hymns
    let conn = state.db.get()?;
    let content_db_sample_paths = if let Some((content_conn, lang)) = get_content_db_conn_for_diag(&state, &conn) {
        let lang_short = crate::db::queries::content_sync::bcp47_to_lang_code(&lang);
        let mut stmt = content_conn
            .prepare(
                "SELECT f.dir || '/' || f.name AS path
                 FROM musics m
                 LEFT JOIN files f ON f.id_file = m.id_file_music
                 WHERE m.id_language = ?1 AND f.dir IS NOT NULL
                 LIMIT 5"
            )
            .ok();
        stmt.as_mut()
            .and_then(|s| {
                s.query_map([lang_short], |row| row.get::<_, String>(0))
                    .ok()
                    .map(|rows| rows.filter_map(|r| r.ok()).collect())
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    Ok(PackSyncDiagnostics {
        app_data_dir: app_data_dir.to_string_lossy().replace('\\', "/"),
        top_level_entries,
        sample_music_files,
        sample_cover_files,
        content_db_sample_paths,
    })
}

fn get_content_db_conn_for_diag(
    state: &AppState,
    conn: &rusqlite::Connection,
) -> Option<(
    r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>,
    String,
)> {
    let langs = crate::db::queries::content_sync::get_selected_languages(conn);
    let lang = langs.into_iter().next()?;
    let map = state.content_dbs.read().ok()?;
    let pool = map.get(&lang)?.clone();
    drop(map);
    let pooled = pool.get().ok()?;
    Some((pooled, lang))
}

fn list_files_sample(dir: &std::path::Path, max: usize) -> Vec<String> {
    let mut result = Vec::new();
    collect_files_recursive(dir, dir, max, &mut result);
    result
}

fn collect_files_recursive(
    root: &std::path::Path,
    current: &std::path::Path,
    max: usize,
    result: &mut Vec<String>,
) {
    if result.len() >= max {
        return;
    }
    let entries = match std::fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if result.len() >= max {
            return;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_files_recursive(root, &path, max, result);
        } else {
            let rel = path.strip_prefix(root).unwrap_or(&path);
            result.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
}
