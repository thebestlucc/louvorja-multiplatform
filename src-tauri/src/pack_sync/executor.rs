use crate::db::queries::{content_sync, settings};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const MAX_CONCURRENT_DOWNLOADS: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncProgress {
    pub run_id: String,
    pub status: String, // "pending" | "running" | "completed" | "failed" | "cancelled"
    pub percent: f64,
    pub message: Option<String>,
    pub packs_total: usize,
    pub packs_processed: usize,
    /// Per-pack download/extract status keyed by pack_id.
    /// Values: "pending" | "downloading" | "verifying" | "ready" | "extracting" | "db_update" | "done" | "failed" | "skipped" | "retrying"
    pub pack_statuses: HashMap<String, String>,
}

pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

/// Sets the current thread to Windows background mode, lowering both CPU and I/O priority.
/// This prevents pack sync from saturating disk on low-end devices (HDD/eMMC).
#[cfg(target_os = "windows")]
fn set_background_io_priority() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentThread, SetThreadPriority, THREAD_MODE_BACKGROUND_BEGIN,
    };
    let result = unsafe {
        SetThreadPriority(GetCurrentThread(), THREAD_MODE_BACKGROUND_BEGIN as i32)
    };
    if result == 0 {
        log::warn!("[pack-sync] Failed to set background I/O priority (Windows)");
    }
}

#[cfg(target_os = "windows")]
fn clear_background_io_priority() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentThread, SetThreadPriority, THREAD_MODE_BACKGROUND_END,
    };
    let result = unsafe {
        SetThreadPriority(GetCurrentThread(), THREAD_MODE_BACKGROUND_END as i32)
    };
    if result == 0 {
        log::warn!("[pack-sync] Failed to clear background I/O priority (Windows)");
    }
}

#[cfg(target_os = "linux")]
fn set_background_io_priority() {
    use ioprio::{Class, Priority, Target};
    if let Err(e) = ioprio::set_priority(
        Target::Process(ioprio::Pid::this()),
        Priority::new(Class::Idle),
    ) {
        log::warn!("[pack-sync] Failed to set background I/O priority (Linux): {e}");
    }
}

#[cfg(target_os = "linux")]
fn clear_background_io_priority() {
    use ioprio::{BePriorityLevel, Class, Priority, Target};
    if let Err(e) = ioprio::set_priority(
        Target::Process(ioprio::Pid::this()),
        Priority::new(Class::BestEffort(BePriorityLevel::lowest())),
    ) {
        log::warn!("[pack-sync] Failed to clear background I/O priority (Linux): {e}");
    }
}

#[cfg(target_os = "macos")]
fn set_background_io_priority() {
    let result = unsafe { libc::setpriority(libc::PRIO_PROCESS, 0, 19) };
    if result != 0 {
        log::warn!("[pack-sync] Failed to set background I/O priority (macOS): errno={}", std::io::Error::last_os_error());
    }
}

#[cfg(target_os = "macos")]
fn clear_background_io_priority() {
    let result = unsafe { libc::setpriority(libc::PRIO_PROCESS, 0, 0) };
    if result != 0 {
        log::warn!("[pack-sync] Failed to clear background I/O priority (macOS): errno={}", std::io::Error::last_os_error());
    }
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn set_background_io_priority() {}
#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn clear_background_io_priority() {}

pub fn execute_pack_sync(
    app: AppHandle,
    run_id: String,
    cancel_flag: Arc<AtomicBool>,
    // When Some, skip manifest fetch and execute only these items.
    // When None, fetch the manifest and build the full plan.
    preset_items: Option<Vec<super::planner::PackSyncPlanItem>>,
) {
    set_background_io_priority();

    // Emit helper — snapshots current statuses into every event.
    let emit = {
        let app = app.clone();
        let run_id = run_id.clone();
        move |status: &str, percent: f64, message: &str, processed: usize, total: usize,
              statuses: HashMap<String, String>| {
            let _ = app.emit("pack-sync-progress", PackSyncProgress {
                run_id: run_id.clone(),
                status: status.to_string(),
                percent,
                message: if message.is_empty() { None } else { Some(message.to_string()) },
                packs_total: total,
                packs_processed: processed,
                pack_statuses: statuses,
            });
        }
    };

    let (client, err) = catcher(
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| AppError::Internal(format!("HTTP client error: {}", e))),
    );
    if let Some(e) = err {
        emit("failed", 100.0, &e.to_string(), 0, 0, HashMap::new());
        return;
    }
    let client = client.unwrap();

    let Some(state) = app.try_state::<AppState>() else {
        emit("failed", 100.0, "App state unavailable.", 0, 0, HashMap::new());
        return;
    };
    let (conn, err) = catcher(
        state.db.get().map_err(|e| AppError::Internal(format!("DB unavailable: {}", e))),
    );
    if let Some(e) = err {
        emit("failed", 100.0, &e.to_string(), 0, 0, HashMap::new());
        return;
    }
    let conn = conn.unwrap();

    // If items were provided directly (per-pack download), skip the manifest fetch.
    // If not, fetch the manifest and build the full plan.
    let (plan_items, manifest_version_to_save) = if let Some(items) = preset_items {
        (items, None)
    } else {
        let manifest_url = super::CDN_MANIFEST_URL;
        if manifest_url.is_empty() {
            emit("failed", 100.0, "CDN manifest URL not configured.", 0, 0, HashMap::new());
            return;
        }

        emit("running", 0.0, "Buscando manifesto…", 0, 0, HashMap::new());

        let (manifest, err) = catcher(
            tauri::async_runtime::block_on(
                crate::content_sync::manifest::fetch_manifest(&client, manifest_url),
            )
            .map_err(|e| AppError::Internal(format!("Manifesto falhou: {}", e))),
        );
        if let Some(e) = err {
            emit("failed", 100.0, &e.to_string(), 0, 0, HashMap::new());
            return;
        }
        let manifest = manifest.unwrap();

        let stored_version = settings::get_setting(&conn, "pack_sync.manifest_version")
            .ok()
            .and_then(|s| s.value.parse::<i64>().ok())
            .unwrap_or(0);

        let (plan, err) = catcher(super::planner::build_plan(&conn, &manifest, stored_version, None));
        if let Some(e) = err {
            emit("failed", 100.0, &e.to_string(), 0, 0, HashMap::new());
            return;
        }
        let plan = plan.unwrap();

        (plan.items, Some(manifest.manifest_version.to_string()))
    };

    if plan_items.is_empty() {
        emit("completed", 100.0, "Já está atualizado.", 0, 0, HashMap::new());
        if let Some(v) = manifest_version_to_save {
            let _ = settings::set_setting(&conn, "pack_sync.manifest_version", &v);
        }
        return;
    }

    // Release the main DB connection before downloads start.
    // During concurrent downloads, each completed pack briefly acquires its own
    // connection via spawn_blocking.  Holding one here permanently would reduce
    // the pool by 25 % and — when combined with download-completion writes —
    // could exhaust the pool, blocking ALL IPC commands (settings reads, plan
    // queries, etc.) and freezing the UI for up to connection_timeout seconds.
    drop(conn);

    // Shadow with the resolved items vec for the rest of the function.
    let total = plan_items.len();
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => {
            log::error!("[pack-sync] Failed to resolve app data directory: {e}");
            return;
        }
    };
    log::info!("[pack-sync] Extraction target: {:?}", app_data_dir);

    // Initialize per-pack statuses.
    let pack_statuses: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(
        plan_items
            .iter()
            .map(|i| {
                let s = if i.needs_download {
                    "pending"
                } else {
                    "skipped"
                };
                (i.pack_id.clone(), s.to_string())
            })
            .collect(),
    ));

    let snapshot = || pack_statuses.lock().unwrap().clone();

    emit("running", 0.0, "Iniciando downloads…", 0, total, snapshot());

    // ── Phase 1: Concurrent downloads (up to MAX_CONCURRENT_DOWNLOADS) ──────

    let items_to_download: Vec<_> = plan_items
        .iter()
        .filter(|i| i.needs_download)
        .cloned()
        .collect();

    let download_total = items_to_download.len();
    let completed_count = Arc::new(AtomicUsize::new(0));

    tauri::async_runtime::block_on(async {
        use tokio::sync::Semaphore;
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
        let mut handles = Vec::new();

        for item in items_to_download {
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let client = client.clone();
            let app_data = app_data_dir.clone();
            let statuses = pack_statuses.clone();
            let count = completed_count.clone();
            let app_clone = app.clone();
            let run_id_clone = run_id.clone();
            let cancel = cancel_flag.clone();

            statuses
                .lock()
                .unwrap()
                .insert(item.pack_id.clone(), "downloading".to_string());

            let handle = tokio::spawn(async move {
                const MAX_RETRIES: u32 = 3;

                let _permit = permit;
                let is_content_db = item.pack_id.starts_with("content-db-");

                // Content-DB packs still use the temp-file path (no extraction needed).
                let tmp_filename = format!("{}.db.tmp", item.pack_id);
                let db_tmp_path = app_data.join(&tmp_filename);

                let mut succeeded = false;

                for attempt in 0..=MAX_RETRIES {
                    // Check cancel flag before each attempt.
                    if cancel.load(Ordering::Relaxed) {
                        break;
                    }

                    // Before retry: emit retrying status (and clean up any content-db tmp).
                    if attempt > 0 {
                        if is_content_db {
                            let _ = std::fs::remove_file(&db_tmp_path);
                        }

                        statuses
                            .lock()
                            .unwrap()
                            .insert(item.pack_id.clone(), "retrying".to_string());

                        let statuses_snap = statuses.lock().unwrap().clone();
                        let _ = app_clone.emit(
                            "pack-sync-progress",
                            PackSyncProgress {
                                run_id: run_id_clone.clone(),
                                status: "running".into(),
                                percent: 0.0,
                                message: Some(format!(
                                    "Retrying {} (attempt {}/{})",
                                    item.pack_id,
                                    attempt + 1,
                                    MAX_RETRIES + 1
                                )),
                                packs_total: download_total,
                                packs_processed: 0,
                                pack_statuses: statuses_snap,
                            },
                        );

                        // Exponential backoff: 2s, 4s, 8s
                        let backoff = std::time::Duration::from_secs(2u64.pow(attempt));
                        tokio::time::sleep(backoff).await;

                        // Re-check cancel after sleeping.
                        if cancel.load(Ordering::Relaxed) {
                            break;
                        }

                        statuses
                            .lock()
                            .unwrap()
                            .insert(item.pack_id.clone(), "downloading".to_string());
                    }

                    if is_content_db {
                        // ── Content-DB path: download to temp file, then rename ──────────
                        let dl = crate::http_sync::downloader::download_file_http(
                            &client,
                            &item.pack_url,
                            &db_tmp_path,
                            Some(item.pack_size),
                        )
                        .await;

                        match dl {
                            Err(e) => {
                                let _ = std::fs::remove_file(&db_tmp_path);
                                log::warn!(
                                    "[pack-sync] Download failed for {} (attempt {}/{}): {}",
                                    item.pack_id,
                                    attempt + 1,
                                    MAX_RETRIES + 1,
                                    e
                                );
                                continue;
                            }
                            Ok(_) => {
                                succeeded = true;
                                break;
                            }
                        }
                    } else {
                        // ── ZIP pack path: stream download + extract + SHA-256 inline ────
                        match crate::http_sync::downloader::stream_extract_zip(
                            &client,
                            &item.pack_url,
                            &app_data,
                            &item.pack_sha256,
                        )
                        .await
                        {
                            Ok(()) => {
                                // Save extracted version immediately so cancellation mid-sync
                                // does not force a full re-download of already-completed packs.
                                // Uses spawn_blocking so the r2d2 pool.get() call (which can
                                // block up to connection_timeout) runs on a dedicated blocking
                                // thread instead of starving a tokio async worker.
                                let app_db = app_clone.clone();
                                let pack_id_db = item.pack_id.clone();
                                let pack_ver_db = item.pack_version;
                                let _ = tokio::task::spawn_blocking(move || {
                                    if let Some(st) = app_db.try_state::<AppState>() {
                                        if let Ok(db_conn) = st.db.get() {
                                            let _ = crate::db::queries::content_sync::set_pack_extracted_version(
                                                &db_conn,
                                                &pack_id_db,
                                                pack_ver_db,
                                            );
                                        }
                                    }
                                }).await;
                                statuses
                                    .lock()
                                    .unwrap()
                                    .insert(item.pack_id.clone(), "done".to_string());
                                succeeded = true;
                                break;
                            }
                            Err(e) => {
                                log::warn!(
                                    "[pack-sync] Stream extract failed for {} (attempt {}/{}): {}",
                                    item.pack_id,
                                    attempt + 1,
                                    MAX_RETRIES + 1,
                                    e
                                );
                                // stream_extract_zip already cleaned up extracted files on
                                // SHA mismatch. No temp ZIP file to remove.
                                continue;
                            }
                        }
                    }
                }

                // After all attempts: if not succeeded, mark as failed.
                if !succeeded {
                    if is_content_db {
                        let _ = std::fs::remove_file(&db_tmp_path);
                    }
                    statuses
                        .lock()
                        .unwrap()
                        .insert(item.pack_id.clone(), "failed".to_string());
                }

                let done = count.fetch_add(1, Ordering::Relaxed) + 1;
                let percent = (done as f64 / download_total as f64) * 100.0;
                let statuses_snap = statuses.lock().unwrap().clone();
                let _ = app_clone.emit(
                    "pack-sync-progress",
                    PackSyncProgress {
                        run_id: run_id_clone,
                        status: "running".into(),
                        percent,
                        message: Some(format!("Pacotes ({}/{})", done, download_total)),
                        packs_total: download_total,
                        packs_processed: done,
                        pack_statuses: statuses_snap,
                    },
                );
            });

            handles.push(handle);
        }

        for handle in handles {
            let _ = handle.await;
        }
    });

    if cancel_flag.load(Ordering::Relaxed) {
        clear_background_io_priority();
        emit(
            "cancelled",
            100.0,
            "Sincronização cancelada.",
            total,
            total,
            snapshot(),
        );
        return;
    }

    // ── Phase 3: Save and hot-swap content DB files ─────────────────────────

    // Re-acquire a main DB connection for Phase 3 settings writes.
    let conn = match state.db.get() {
        Ok(c) => c,
        Err(e) => {
            log::error!("[pack-sync] Could not re-acquire DB connection for Phase 3: {}", e);
            clear_background_io_priority();
            emit(
                "completed_with_errors",
                100.0,
                &format!("DB unavailable for post-sync: {}", e),
                total,
                total,
                snapshot(),
            );
            return;
        }
    };

    for item in &plan_items {
        if !item.pack_id.starts_with("content-db-") {
            continue;
        }

        let lang = &item.language;
        let tmp_path = app_data_dir.join(format!("{}.db.tmp", item.pack_id));

        if !tmp_path.exists() {
            continue;
        }

        // Step 1: Remove old pool from state (releases file handles on Windows)
        {
            let mut content_dbs = state.content_dbs.write().unwrap();
            content_dbs.remove(lang);
        }

        // Step 2: Rename tmp -> dest (now safe on Windows since pool is dropped)
        let dest = match content_sync::save_content_db(&tmp_path, lang, &app_data_dir) {
            Ok(p) => p,
            Err(e) => {
                log::warn!("[pack-sync] Failed to save content DB for {}: {}", lang, e);
                pack_statuses
                    .lock()
                    .unwrap()
                    .insert(item.pack_id.clone(), "failed".to_string());
                continue;
            }
        };

        // Step 3: Open new pool and initialise FTS5 index
        match content_sync::open_content_db_pool(&dest) {
            Ok(new_pool) => {
                match new_pool.get() {
                    Ok(content_conn) => {
                        let _ = content_sync::init_content_db_fts(&content_conn, lang);
                    }
                    Err(e) => {
                        log::warn!("[pack-sync] FTS init failed for {}: {}", lang, e);
                    }
                }
                // Step 4: Hot-swap in AppState
                {
                    let mut content_dbs = state.content_dbs.write().unwrap();
                    content_dbs.insert(lang.clone(), new_pool.clone());
                }
                // Step 4b: Refresh cached capabilities for the new DB schema
                if let Ok(cap_conn) = new_pool.get() {
                    let caps = crate::db::queries::music::probe_content_db_capabilities(&cap_conn);
                    if let Ok(mut cap_map) = state.content_db_capabilities.write() {
                        cap_map.insert(lang.clone(), caps);
                    }
                }
                // Record the DB version so the planner knows it's current
                let _ = settings::set_setting(
                    &conn,
                    &format!("pack_sync.db_version.{}", lang),
                    &item.pack_version.to_string(),
                );
            }
            Err(e) => {
                log::warn!("[pack-sync] Pool open failed for {}: {}", lang, e);
                pack_statuses
                    .lock()
                    .unwrap()
                    .insert(item.pack_id.clone(), "failed".to_string());
            }
        }
    }

    // Only save manifest version if all packs succeeded — partial failure
    // must allow the planner to re-detect pending items on next run.
    let any_failed = pack_statuses
        .lock()
        .unwrap()
        .values()
        .any(|s| s == "failed");

    if !any_failed {
        if let Some(v) = manifest_version_to_save {
            let _ = settings::set_setting(&conn, "pack_sync.manifest_version", &v);
        }
    }

    // Notify frontend that content data changed so TanStack Query caches are invalidated.
    let _ = app.emit("data-changed", ());

    // ── Post-sync: Reset manifest cache so next plan_pack_sync re-fetches ───
    // Clear the in-memory flag so the next plan call hits CDN instead of stale cache.
    if let Ok(mut runtime) = state.pack_sync.lock() {
        runtime.manifest_fetched = false;
    }
    // Delete the on-disk manifest cache file.
    if let Ok(data_dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(data_dir.join("manifest_cache.json"));
    }

    clear_background_io_priority();

    let final_statuses = snapshot();
    let failed_count = final_statuses.values().filter(|s| s.as_str() == "failed").count();

    if failed_count > 0 {
        emit(
            "completed_with_errors",
            100.0,
            &format!("{} pacotes falharam.", failed_count),
            total,
            total,
            final_statuses,
        );
    } else {
        emit(
            "completed",
            100.0,
            "Sincronização de pacotes concluída.",
            total,
            total,
            final_statuses,
        );
    }
}

