use crate::db::queries::{content_sync, settings};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const MAX_CONCURRENT_DOWNLOADS: usize = 10;

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
    /// Values: "pending" | "downloading" | "verifying" | "ready" | "extracting" | "db_update" | "done" | "failed" | "skipped"
    pub pack_statuses: HashMap<String, String>,
}

pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn execute_pack_sync(
    app: AppHandle,
    run_id: String,
    cancel_flag: Arc<AtomicBool>,
    // When Some, skip manifest fetch and execute only these items.
    // When None, fetch the manifest and build the full plan.
    preset_items: Option<Vec<super::planner::PackSyncPlanItem>>,
) {
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

    // Shadow with the resolved items vec for the rest of the function.
    let total = plan_items.len();
    let app_data_dir = app.path().app_data_dir().unwrap_or_default();

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
    let downloaded_ok: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
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
            let ok_set = downloaded_ok.clone();
            let count = completed_count.clone();
            let app_clone = app.clone();
            let run_id_clone = run_id.clone();

            statuses
                .lock()
                .unwrap()
                .insert(item.pack_id.clone(), "downloading".to_string());

            let handle = tokio::spawn(async move {
                let _permit = permit;
                let is_content_db = item.pack_id.starts_with("content-db-");
                let tmp_filename = if is_content_db {
                    format!("{}.db.tmp", item.pack_id)
                } else {
                    format!("pack_{}.zip.tmp", item.pack_id)
                };
                let zip_path = app_data.join(&tmp_filename);

                let dl = crate::http_sync::downloader::download_file_http(
                    &client,
                    &item.pack_url,
                    &zip_path,
                    Some(item.pack_size),
                )
                .await;

                match dl {
                    Err(e) => {
                        let _ = std::fs::remove_file(&zip_path);
                        eprintln!("[pack-sync] Download failed for {}: {}", item.pack_id, e);
                        statuses
                            .lock()
                            .unwrap()
                            .insert(item.pack_id.clone(), "failed".to_string());
                    }
                    Ok(_) => {
                        statuses
                            .lock()
                            .unwrap()
                            .insert(item.pack_id.clone(), "verifying".to_string());

                        let zip_path_clone = zip_path.clone();
                        let expected_sha = item.pack_sha256.clone();
                        let verify_result = tokio::task::spawn_blocking(move || {
                            verify_sha256(&zip_path_clone, &expected_sha)
                        }).await;
                        let verify_result = match verify_result {
                            Ok(r) => r,
                            Err(e) => Err(AppError::Internal(format!("SHA verify task panicked: {}", e))),
                        };
                        match verify_result {
                            Ok(true) => {
                                statuses
                                    .lock()
                                    .unwrap()
                                    .insert(item.pack_id.clone(), "ready".to_string());
                                ok_set.lock().unwrap().insert(item.pack_id.clone());
                            }
                            _ => {
                                let _ = std::fs::remove_file(&zip_path);
                                eprintln!(
                                    "[pack-sync] SHA-256 mismatch for {}",
                                    item.pack_id
                                );
                                statuses
                                    .lock()
                                    .unwrap()
                                    .insert(item.pack_id.clone(), "failed".to_string());
                            }
                        }
                    }
                }

                let done = count.fetch_add(1, Ordering::Relaxed) + 1;
                let percent = (done as f64 / download_total as f64) * 70.0;
                let statuses_snap = statuses.lock().unwrap().clone();
                let _ = app_clone.emit(
                    "pack-sync-progress",
                    PackSyncProgress {
                        run_id: run_id_clone,
                        status: "running".into(),
                        percent,
                        message: Some(format!("Baixando pacotes ({}/{})", done, download_total)),
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

    // ── Phase 2: Sequential extract ─────────────────────────────────────────

    let ok_set = downloaded_ok.lock().unwrap().clone();

    // Collect successfully extracted ZIP packs; version writes are batched in Phase 2b.
    let mut extracted_zip_versions: Vec<(String, u32)> = Vec::new();

    for (index, item) in plan_items.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            emit(
                "cancelled",
                70.0 + (index as f64 / total as f64) * 30.0,
                "Sincronização cancelada.",
                index,
                total,
                snapshot(),
            );
            return;
        }

        let extract_percent = 70.0 + ((index + 1) as f64 / total as f64) * 30.0;

        let is_content_db = item.pack_id.starts_with("content-db-");

        if item.needs_download {
            if ok_set.contains(&item.pack_id) {
                // Content DB items are not ZIPs — skip extraction (handled in Phase 3).
                // Version tracking for content-db packs is done via settings in Phase 3
                // after the .db.tmp file is renamed and hot-swapped.
                if is_content_db {
                    pack_statuses
                        .lock()
                        .unwrap()
                        .insert(item.pack_id.clone(), "ready".to_string());
                } else {
                    let zip_path =
                        app_data_dir.join(format!("pack_{}.zip.tmp", item.pack_id));

                    pack_statuses
                        .lock()
                        .unwrap()
                        .insert(item.pack_id.clone(), "extracting".to_string());
                    emit(
                        "running",
                        extract_percent,
                        &format!("Extraindo {}…", item.pack_id),
                        index,
                        total,
                        snapshot(),
                    );

                    match crate::http_sync::downloader::extract_zip_to(
                        &zip_path,
                        &app_data_dir,
                    ) {
                        Ok(_) => {
                            let _ = std::fs::remove_file(&zip_path);
                            extracted_zip_versions.push((item.pack_id.clone(), item.pack_version));
                        }
                        Err(e) => {
                            let _ = std::fs::remove_file(&zip_path);
                            eprintln!("[pack-sync] Extract failed for {}: {}", item.pack_id, e);
                            pack_statuses
                                .lock()
                                .unwrap()
                                .insert(item.pack_id.clone(), "failed".to_string());
                            emit(
                                "running",
                                extract_percent,
                                &format!("Extração falhou para {}: {}", item.pack_id, e),
                                index + 1,
                                total,
                                snapshot(),
                            );
                            continue;
                        }
                    }
                }
            } else {
                // Download failed — already marked, skip.
                continue;
            }
        }

        pack_statuses
            .lock()
            .unwrap()
            .insert(item.pack_id.clone(), "done".to_string());

        emit(
            "running",
            extract_percent,
            "",
            index + 1,
            total,
            snapshot(),
        );
    }

    // ── Phase 2b: Batch DB version writes for successfully extracted ZIP packs ─
    for (pack_id, version) in &extracted_zip_versions {
        let _ = content_sync::set_pack_extracted_version(&conn, pack_id, *version);
    }

    // ── Phase 3: Save and hot-swap content DB files ─────────────────────────

    for item in &plan_items {
        if !item.pack_id.starts_with("content-db-") {
            continue;
        }

        let lang = &item.language;
        let tmp_path = app_data_dir.join(format!("{}.db.tmp", item.pack_id));

        if !tmp_path.exists() {
            continue;
        }

        let dest = match content_sync::save_content_db(&tmp_path, lang, &app_data_dir) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[pack-sync] Failed to save content DB for {}: {}", lang, e);
                continue;
            }
        };

        // Open new pool and initialise FTS5 index
        match content_sync::open_content_db_pool(&dest) {
            Ok(new_pool) => {
                match new_pool.get() {
                    Ok(content_conn) => {
                        let _ = content_sync::init_content_db_fts(&content_conn, lang);
                    }
                    Err(e) => {
                        eprintln!("[pack-sync] FTS init failed for {}: {}", lang, e);
                    }
                }
                // Hot-swap in AppState
                {
                    let mut content_dbs = state.content_dbs.lock().unwrap();
                    content_dbs.insert(lang.clone(), new_pool);
                }
                // Record the DB version so the planner knows it's current
                let _ = settings::set_setting(
                    &conn,
                    &format!("pack_sync.db_version.{}", lang),
                    &item.pack_version.to_string(),
                );
            }
            Err(e) => {
                eprintln!("[pack-sync] Pool open failed for {}: {}", lang, e);
            }
        }
    }

    if let Some(v) = manifest_version_to_save {
        let _ = settings::set_setting(&conn, "pack_sync.manifest_version", &v);
    }

    // ── Post-sync: Reset manifest cache so next plan_pack_sync re-fetches ───
    // Clear the in-memory flag so the next plan call hits CDN instead of stale cache.
    if let Ok(mut runtime) = state.pack_sync.lock() {
        runtime.manifest_fetched = false;
    }
    // Delete the on-disk manifest cache file.
    if let Ok(data_dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(data_dir.join("manifest_cache.json"));
    }

    emit(
        "completed",
        100.0,
        "Sincronização de pacotes concluída.",
        total,
        total,
        snapshot(),
    );
}

fn verify_sha256(path: &Path, expected: &str) -> Result<bool, AppError> {
    // No checksum provided (e.g. content-DB entries in manifest) — skip verification.
    if expected.is_empty() {
        return Ok(true);
    }
    use sha2::Digest;
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(AppError::Io)?;
    let mut hasher = sha2::Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(AppError::Io)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let result = format!("{:x}", hasher.finalize());
    Ok(result == expected)
}
