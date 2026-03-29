use crate::content_sync::manifest::ContentManifest;
use crate::error::AppError;
use crate::pack_sync::{self, planner::PackSyncPlan};
use crate::state::AppState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
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
