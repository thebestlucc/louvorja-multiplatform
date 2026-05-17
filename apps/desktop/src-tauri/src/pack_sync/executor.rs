use crate::db::queries::{content_sync, settings};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use rusqlite;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

/// Per-language FTS background thread handles.
/// Joined before any Phase 3 file rename to prevent Windows file-in-use errors.
static FTS_HANDLES: LazyLock<Mutex<HashMap<String, JoinHandle<()>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

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

                // ── Pre-check: skip download if files already exist locally ──────
                // Handles the case where DB records were cleared but extracted files
                // survived (e.g., remove_dir_all failed silently on Windows due to
                // file locking). Verifies presence + size instead of re-downloading.
                let skip_download = if is_content_db {
                    // Content-DB: dest file already on disk → Phase 3 will reuse it.
                    app_data.join(format!("content-{}.db", item.language)).exists()
                } else if !item.files.is_empty() {
                    // ZIP pack: every manifest file must exist at the correct size.
                    item.files.iter().all(|f| {
                        let rel = f.path.trim_start_matches('/').replace('/', std::path::MAIN_SEPARATOR_STR);
                        let local = app_data.join(&rel);
                        if f.size > 0 {
                            local.metadata().map(|m| m.len() == f.size).unwrap_or(false)
                        } else {
                            local.exists()
                        }
                    })
                } else {
                    false
                };

                if skip_download {
                    log::info!("[pack-sync] {} already on disk — skipping download", item.pack_id);
                    if !is_content_db {
                        // ZIP pack: persist the extracted version so the planner
                        // won't re-schedule this pack on the next check.
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
                    }
                    // Content-DB: Phase 3 detects no tmp file but dest exists → reuses it.
                    statuses.lock().unwrap().insert(item.pack_id.clone(), "done".to_string());
                } else { for attempt in 0..=MAX_RETRIES {
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
                } // close else (download path)

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
        let dest_path = app_data_dir.join(format!("content-{}.db", lang));

        // Skip if neither the tmp file nor the final dest exists.
        if !tmp_path.exists() && !dest_path.exists() {
            continue;
        }

        // Join any pending FTS background thread for this language before renaming.
        // On Windows, open file handles block rename — the background thread from
        // a previous sync must finish before we replace the DB file.
        if let Ok(mut handles) = FTS_HANDLES.lock() {
            if let Some(handle) = handles.remove(lang) {
                let _ = handle.join();
            }
        }

        // Step 1: Remove old pool AND old caps from state (releases file handles on Windows).
        // Caps are removed alongside the pool so no concurrent reader encounters
        // (pool gone, stale caps still present).
        {
            match state.content_dbs.write() {
                Ok(mut content_dbs) => {
                    content_dbs.remove(lang);
                }
                Err(e) => {
                    log::error!(
                        "[pack-sync] content_dbs lock poisoned on remove for {}: {}",
                        lang,
                        e
                    );
                    continue;
                }
            }
        }
        if let Ok(mut cap_map) = state.content_db_capabilities.write() {
            cap_map.remove(lang);
        }

        // Step 2: Rename tmp -> dest (now safe on Windows since pool is dropped).
        // If no tmp file exists the DB was already on disk (skip_download path) — reuse it.
        let dest = if tmp_path.exists() {
            match content_sync::save_content_db(&tmp_path, lang, &app_data_dir) {
                Ok(p) => p,
                Err(e) => {
                    log::warn!("[pack-sync] Failed to save content DB for {}: {}", lang, e);
                    pack_statuses
                        .lock()
                        .unwrap()
                        .insert(item.pack_id.clone(), "failed".to_string());
                    continue;
                }
            }
        } else {
            log::info!("[pack-sync] Content DB {} already on disk — reusing existing file", lang);
            dest_path
        };

        // Step 3: Open new pool and make it available for queries immediately.
        // FTS init and index creation run in a background thread so they don't
        // delay the "sync completed" event — data is queryable (with LIKE fallback)
        // while FTS is building.
        match content_sync::open_content_db_pool(&dest) {
            Ok(new_pool) => {
                // Step 4: Probe capabilities from new pool before inserting it into content_dbs.
                // Mirrors startup ordering invariant: caps inserted before pool so any concurrent
                // reader that sees the pool will already find a capability entry.
                if let Ok(cap_conn) = new_pool.get() {
                    let caps = crate::db::queries::music::probe_content_db_capabilities(&cap_conn);
                    if let Ok(mut cap_map) = state.content_db_capabilities.write() {
                        cap_map.insert(lang.clone(), caps);
                    }
                }
                // Step 4b: Insert new pool into content_dbs (caps are already up-to-date).
                {
                    match state.content_dbs.write() {
                        Ok(mut content_dbs) => {
                            content_dbs.insert(lang.clone(), new_pool.clone());
                        }
                        Err(e) => {
                            log::error!(
                                "[pack-sync] content_dbs lock poisoned on insert for {}: {}",
                                lang,
                                e
                            );
                            // New pool exists but never registered — mark pack as failed.
                            if let Ok(mut statuses) = pack_statuses.lock() {
                                statuses.insert(item.pack_id.clone(), "failed".to_string());
                            }
                            continue;
                        }
                    }
                }
                // Record the DB version so the planner knows it's current
                let _ = settings::set_setting(
                    &conn,
                    &format!("pack_sync.db_version.{}", lang),
                    &item.pack_version.to_string(),
                );

                // Step 5: Background FTS init — runs after pool is live so hymn list
                // queries work immediately.  Uses a dedicated connection with
                // synchronous=OFF so WAL fsyncs don't stall the bulk INSERT + OPTIMIZE
                // on HDD/eMMC devices.
                let dest_fts = dest.clone();
                let lang_fts = lang.clone();
                let app_fts = app.clone();
                let fts_handle = std::thread::spawn(move || {
                    match rusqlite::Connection::open(&dest_fts) {
                        Ok(fts_conn) => {
                            if let Err(e) = content_sync::init_content_db_fts(&fts_conn, &lang_fts) {
                                log::warn!("[pack-sync] Background FTS init failed for {}: {}", lang_fts, e);
                                return;
                            }
                            // Ensure column indexes via pool connection (no sync=OFF needed).
                            if let Some(st) = app_fts.try_state::<AppState>() {
                                if let Ok(dbs) = st.content_dbs.read() {
                                    if let Some(pool) = dbs.get(&lang_fts).cloned() {
                                        drop(dbs);
                                        if let Ok(idx_conn) = pool.get() {
                                            content_sync::ensure_content_db_indexes(&idx_conn);
                                        }
                                    }
                                }
                            }
                            let _ = app_fts.emit("fts-ready", &lang_fts);
                            log::info!("[pack-sync] FTS background init complete for {}", lang_fts);
                        }
                        Err(e) => {
                            log::warn!("[pack-sync] FTS background: could not open DB for {}: {}", lang_fts, e);
                        }
                    }
                });
                if let Ok(mut handles) = FTS_HANDLES.lock() {
                    handles.insert(lang.clone(), fts_handle);
                }
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

