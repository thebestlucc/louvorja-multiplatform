use crate::db::queries::{content_sync, settings};
use crate::error::AppError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncProgress {
    pub run_id: String,
    pub status: String, // "pending" | "running" | "completed" | "failed" | "cancelled"
    pub percent: f64,
    pub message: Option<String>,
    pub packs_total: usize,
    pub packs_processed: usize,
}

pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn execute_pack_sync(
    app: AppHandle,
    run_id: String,
    cancel_flag: Arc<AtomicBool>,
) {
    let emit = |status: &str, percent: f64, message: &str, processed: usize, total: usize| {
        let _ = app.emit("pack-sync-progress", PackSyncProgress {
            run_id: run_id.clone(),
            status: status.to_string(),
            percent,
            message: Some(message.to_string()),
            packs_total: total,
            packs_processed: processed,
        });
    };

    emit("running", 0.0, "Fetching manifest…", 0, 0);

    let manifest_url = super::CDN_MANIFEST_URL;
    if manifest_url.is_empty() {
        emit("failed", 100.0, "CDN manifest URL not configured.", 0, 0);
        return;
    }

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build() {
        Ok(c) => c,
        Err(e) => {
            emit("failed", 100.0, &format!("HTTP client error: {}", e), 0, 0);
            return;
        }
    };

    let manifest = match tauri::async_runtime::block_on(
        crate::content_sync::manifest::fetch_manifest(&client, manifest_url)
    ) {
        Ok(m) => m,
        Err(e) => {
            emit("failed", 100.0, &format!("Manifest fetch failed: {}", e), 0, 0);
            return;
        }
    };

    let Some(state) = app.try_state::<AppState>() else {
        emit("failed", 100.0, "App state unavailable.", 0, 0);
        return;
    };
    let conn = match state.db.get() {
        Ok(c) => c,
        Err(e) => {
            emit("failed", 100.0, &format!("DB unavailable: {}", e), 0, 0);
            return;
        }
    };

    let stored_version = settings::get_setting(&conn, "pack_sync.manifest_version")
        .ok()
        .and_then(|s| s.value.parse::<i64>().ok())
        .unwrap_or(0);

    let plan = match super::planner::build_plan(&conn, &manifest, stored_version) {
        Ok(p) => p,
        Err(e) => {
            emit("failed", 100.0, &format!("Plan failed: {}", e), 0, 0);
            return;
        }
    };

    if plan.items.is_empty() {
        emit("completed", 100.0, "Already up to date.", 0, 0);
        let _ = settings::set_setting(&conn, "pack_sync.manifest_version",
            &manifest.manifest_version.to_string());
        return;
    }

    let total = plan.items.len();
    let app_data_dir = app.path().app_data_dir().unwrap_or_default();

    for (index, item) in plan.items.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            emit("cancelled", (index as f64 / total as f64) * 100.0,
                "Pack sync cancelled.", index, total);
            return;
        }

        let percent = ((index + 1) as f64 / total as f64) * 100.0;

        if item.needs_download {
            emit("running", percent,
                &format!("Downloading pack {} ({}/{})…", item.pack_id, index + 1, total),
                index, total);

            let zip_path = app_data_dir.join(format!("pack_{}.zip.tmp", item.pack_id));

            let dl_result = tauri::async_runtime::block_on(
                crate::http_sync::downloader::download_file_http(
                    &client, &item.pack_url, &zip_path, Some(item.pack_size),
                )
            );

            match dl_result {
                Ok(_) => {}
                Err(e) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] Download failed for {}: {}", item.pack_id, e);
                    emit("running", percent,
                        &format!("Download failed for {}: {}", item.pack_id, e),
                        index + 1, total);
                    continue;
                }
            }

            emit("running", percent,
                &format!("Verifying pack {}…", item.pack_id), index, total);
            match verify_sha256(&zip_path, &item.pack_sha256) {
                Ok(true) => {}
                Ok(false) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] SHA-256 mismatch for {}", item.pack_id);
                    emit("running", percent,
                        &format!("SHA-256 mismatch for {}. Skipped.", item.pack_id),
                        index + 1, total);
                    continue;
                }
                Err(e) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] SHA-256 check failed for {}: {}", item.pack_id, e);
                    continue;
                }
            }

            emit("running", percent,
                &format!("Extracting pack {}…", item.pack_id), index, total);
            match crate::http_sync::downloader::extract_zip_to(&zip_path, &app_data_dir) {
                Ok(_) => {
                    let _ = std::fs::remove_file(&zip_path);
                }
                Err(e) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] Extract failed for {}: {}", item.pack_id, e);
                    continue;
                }
            }

            let _ = content_sync::set_pack_extracted_version(&conn, &item.pack_id, item.pack_version);
        }

        if item.needs_db_update {
            emit("running", percent,
                &format!("Updating database for pack {}…", item.pack_id), index, total);

            for file in &item.files {
                if let Some(hymn_api_id) = file.hymn_api_id {
                    let _ = content_sync::update_hymn_path_by_api_id(
                        &conn, hymn_api_id, &file.file_type, &file.path,
                    );
                }
                if let Some(album_api_id) = file.album_api_id {
                    let _ = content_sync::update_collection_cover_by_api_id(
                        &conn, album_api_id, &file.path,
                    );
                }
            }

            let _ = content_sync::set_pack_db_version(&conn, &item.pack_id, item.pack_version);
        }
    }

    let _ = settings::set_setting(&conn, "pack_sync.manifest_version",
        &manifest.manifest_version.to_string());

    emit("completed", 100.0, "Pack sync complete.", total, total);
}

fn verify_sha256(path: &Path, expected: &str) -> Result<bool, AppError> {
    use std::io::Read;
    use sha2::Digest;
    let mut file = std::fs::File::open(path).map_err(AppError::Io)?;
    let mut hasher = sha2::Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(AppError::Io)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let result = format!("{:x}", hasher.finalize());
    Ok(result == expected)
}
