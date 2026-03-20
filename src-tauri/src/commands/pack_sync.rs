use crate::error::AppError;
use crate::pack_sync::{self, executor::PackSyncProgress, planner::PackSyncPlan};
use crate::state::{AppState, PackSyncRuntimeState};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::AppHandle;

#[tauri::command]
#[specta::specta]
pub async fn plan_pack_sync(
    state: tauri::State<'_, AppState>,
) -> Result<PackSyncPlan, AppError> {
    if !pack_sync::is_pack_sync_enabled() {
        return Ok(PackSyncPlan {
            manifest_version: 0,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {}", e)))?;

    let manifest = crate::content_sync::manifest::fetch_manifest(
        &client, pack_sync::CDN_MANIFEST_URL,
    ).await?;

    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;

    let stored_version = crate::db::queries::settings::get_setting(&conn, "pack_sync.manifest_version")
        .ok()
        .and_then(|s| s.value.parse::<i64>().ok())
        .unwrap_or(0);

    pack_sync::planner::build_plan(&conn, &manifest, stored_version)
}

#[tauri::command]
#[specta::specta]
pub fn start_pack_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    if !pack_sync::is_pack_sync_enabled() {
        return Err(AppError::Internal("Pack sync is not configured.".into()));
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
        pack_sync::executor::execute_pack_sync(app, run_id_clone, cancel_flag);
    });

    Ok(run_id)
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
