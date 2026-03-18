use crate::content_sync::{self, ContentSyncRunState};
use crate::db::models::{
    ContentSyncPlan, ContentSyncProgress, ContentSyncReport, ContentSyncRunStatus,
    ContentSyncSummary, ContentSyncPlanItemAction, FtpFileEntry, FtpDownloadProgress,
};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use crate::ftp_sync;
use crate::legacy_fetch;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use suppaftp::{list::File as FtpListFile, FtpStream};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
#[specta::specta]
pub fn get_content_sync_summary(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncSummary, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let file_exists = |rel_path: &str| {
        let full_path = app_data_dir.join(rel_path);
        std::fs::metadata(full_path).is_ok()
    };

    content_sync::load_summary(&conn, file_exists)
}

#[tauri::command]
#[specta::specta]
pub async fn plan_content_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncPlan, AppError> {
    // Fetch remote version first
    let params_res = legacy_fetch::fetcher::fetch_params().await;
    let remote_version = match params_res {
        Ok(p) => p.db_version,
        Err(_) => None,
    };

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    // Mark as checked in the database
    let _ = crate::db::queries::content_sync::mark_content_sync_checked(&conn, remote_version, None);

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let file_exists = |rel_path: &str| {
        let full_path = app_data_dir.join(rel_path);
        std::fs::metadata(full_path).is_ok()
    };

    let summary = content_sync::load_summary(&conn, &file_exists)?;
    content_sync::build_degraded_plan(&conn, summary, &file_exists)
}

#[tauri::command]
#[specta::specta]
pub fn start_content_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    {
        let (runtime_state, err) = catcher(state.content_sync.lock());
        if let Some(e) = err {
            return Err(e);
        }
        let runtime_state = runtime_state.unwrap();

        if let Some(active_run_id) = runtime_state.active_run_id.as_deref() {
            if let Some(active_run) = runtime_state.runs.get(active_run_id) {
                if matches!(
                    active_run.progress.status,
                    ContentSyncRunStatus::Pending | ContentSyncRunStatus::Running
                ) {
                    return Err(AppError::Internal(
                        "Another content sync run is already active.".to_string(),
                    ));
                }
            }
        }
    }

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    // Fetch current remote version so the plan matches what plan_content_sync computed
    let params_res = tauri::async_runtime::block_on(legacy_fetch::fetcher::fetch_params());
    let remote_version = params_res.ok().and_then(|p| p.db_version);
    let _ = crate::db::queries::content_sync::mark_content_sync_checked(&conn, remote_version, None);

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let file_exists = |rel_path: &str| {
        let full_path = app_data_dir.join(rel_path);
        std::fs::metadata(full_path).is_ok()
    };

    let summary = content_sync::load_summary(&conn, &file_exists)?;
    let plan = content_sync::build_degraded_plan(&conn, summary, &file_exists)?;
    let run_id = content_sync::new_run_id();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let initial_progress = content_sync::initial_progress(&run_id, &plan);
    content_sync::begin_runtime_run(&conn, &run_id, &plan)?;
    drop(conn);

    {
        let (runtime_state, err) = catcher(state.content_sync.lock());
        if let Some(e) = err {
            return Err(e);
        }
        let mut runtime_state = runtime_state.unwrap();

        runtime_state.active_run_id = Some(run_id.clone());
        runtime_state.runs.insert(
            run_id.clone(),
            ContentSyncRunState {
                progress: initial_progress.clone(),
                report: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    let _ = app.emit("content-sync-progress", &initial_progress);

    let run_id_clone = run_id.clone();
    std::thread::spawn(move || {
        run_content_sync_background(app, run_id_clone, plan, cancel_flag);
    });

    Ok(run_id)
}

#[tauri::command]
#[specta::specta]
pub fn get_content_sync_progress(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncProgress, AppError> {
    let (runtime_state, err) = catcher(state.content_sync.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let runtime_state = runtime_state.unwrap();

    let run = runtime_state.runs.get(&run_id).ok_or_else(|| {
        AppError::NotFound(format!("Content sync run '{}' was not found.", run_id))
    })?;

    Ok(run.progress.clone())
}

#[tauri::command]
#[specta::specta]
pub fn cancel_content_sync(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (runtime_state, err) = catcher(state.content_sync.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let runtime_state = runtime_state.unwrap();

    let run = runtime_state.runs.get(&run_id).ok_or_else(|| {
        AppError::NotFound(format!("Content sync run '{}' was not found.", run_id))
    })?;

    content_sync::mark_run_cancelled(&run.cancel_flag);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_content_sync_report(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<ContentSyncReport>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();

    content_sync::load_report(&conn, &run_id)
}

fn emit_progress(
    app: &AppHandle,
    run_id: &str,
    step: &str,
    status: ContentSyncRunStatus,
    percent: f64,
    message: Option<String>,
    items_processed: u64,
) {
    if let Some(state) = app.try_state::<AppState>() {
        let (runtime_state, err) = catcher(state.content_sync.lock());
        if err.is_some() {
            return;
        }
        let mut runtime_state = runtime_state.unwrap();

        if let Some(progress) = content_sync::update_runtime_progress(
            &mut runtime_state,
            run_id,
            step,
            status,
            percent,
            message,
            items_processed,
        ) {
            let _ = app.emit("content-sync-progress", &progress);
        }
    }
}

fn run_content_sync_background(
    app: AppHandle,
    run_id: String,
    plan: ContentSyncPlan,
    cancel_flag: Arc<AtomicBool>,
) {
    emit_progress(
        &app,
        &run_id,
        "starting",
        ContentSyncRunStatus::Running,
        5.0,
        Some("Starting content sync run.".to_string()),
        0,
    );

    let total_items = plan.items.len() as u64;
    let mut applied_count = 0i32;
    let mut skipped_count = 0i32;
    let mut failed_count = 0i32;

    // FTP state — lazily initialized on first RepairMedia item
    let mut ftp_settings: Option<ftp_sync::credentials::FtpSettings> = None;
    let mut ftp_stream: Option<FtpStream> = None;

    for (index, item) in plan.items.iter().enumerate() {
        if content_sync::is_run_cancelled(&cancel_flag) {
            let processed = index as u64;
            emit_progress(
                &app,
                &run_id,
                "cancelled",
                ContentSyncRunStatus::Cancelled,
                if total_items == 0 { 100.0 } else { processed as f64 / total_items as f64 * 100.0 },
                Some("Content sync cancelled.".to_string()),
                processed,
            );
            finish_run(
                &app,
                &run_id,
                &plan,
                ContentSyncRunStatus::Cancelled,
                applied_count,
                skipped_count,
                failed_count,
                Some("Content sync cancelled before completion.".to_string()),
            );
            if let Some(mut stream) = ftp_stream {
                let _ = stream.quit();
            }
            return;
        }

        let processed = (index + 1) as u64;
        let percent = if total_items == 0 { 100.0 } else { processed as f64 / total_items as f64 * 100.0 };

        match item.action {
            ContentSyncPlanItemAction::FullSyncFallback => {
                // This is a marker item only — it signals the frontend that a full API sync
                // is also needed to get new content. Local media repair continues below.
                emit_progress(
                    &app,
                    &run_id,
                    "fallback-noted",
                    ContentSyncRunStatus::Running,
                    percent,
                    Some("Note: a full API sync is recommended to get newly added content. Repairing local missing files now.".to_string()),
                    processed,
                );
                skipped_count += 1;
            }

            ContentSyncPlanItemAction::RepairMedia => {
                emit_progress(
                    &app,
                    &run_id,
                    "executing",
                    ContentSyncRunStatus::Running,
                    percent,
                    item.reason.clone(),
                    processed,
                );

                // Lazy-fetch FTP credentials (once per run)
                if ftp_settings.is_none() {
                    let lang = get_app_lang(&app);
                    let params_res = tauri::async_runtime::block_on(legacy_fetch::fetcher::fetch_params());
                    if let Ok(params) = params_res {
                        if let Some(conn_ftp_url) = params.conn_ftp {
                            let creds_res = tauri::async_runtime::block_on(
                                ftp_sync::credentials::fetch_ftp_credentials(&conn_ftp_url, &lang)
                            );
                            match creds_res {
                                Ok(settings) => ftp_settings = Some(settings),
                                Err(e) => {
                                    eprintln!("[sync] Failed to fetch FTP credentials: {}", e);
                                }
                            }
                        }
                    }
                }

                let Some(ref settings) = ftp_settings else {
                    eprintln!("[sync] Skipping RepairMedia item — FTP credentials unavailable");
                    skipped_count += 1;
                    continue;
                };

                // Lazy-connect FTP stream (once per run, reused for all files)
                if ftp_stream.is_none() {
                    match ftp_sync::client::get_ftp_client(settings) {
                        Ok(stream) => ftp_stream = Some(stream),
                        Err(e) => {
                            eprintln!("[sync] FTP connect failed: {}", e);
                            failed_count += 1;
                            continue;
                        }
                    }
                }

                let Some(ref mut stream) = ftp_stream else {
                    failed_count += 1;
                    continue;
                };

                let local_id = item.local_id.unwrap_or(0);

                // Load media paths for this item from the DB
                let media = {
                    let Ok(conn) = app.try_state::<AppState>()
                        .ok_or(())
                        .and_then(|s| s.db.get().map_err(|_| ()))
                    else {
                        failed_count += 1;
                        continue;
                    };

                    match item.entity_type.as_str() {
                        "hymn" => crate::db::queries::content_sync::get_hymn_media_paths(&conn, local_id),
                        "album" => crate::db::queries::content_sync::get_album_media_paths(&conn, local_id),
                        _ => Ok(None),
                    }.unwrap_or(None)
                };

                let Some(media) = media else {
                    skipped_count += 1;
                    continue;
                };

                let app_data_dir = app.path().app_data_dir().unwrap_or_default();

                // Re-fetch music detail for hymns to get accurate remote URLs
                let music_detail: Option<crate::legacy_fetch::ApiMusic> =
                    if item.entity_type == "hymn" {
                        item.remote_id.and_then(|api_id| {
                            tauri::async_runtime::block_on(
                                crate::legacy_fetch::fetcher::fetch_music_detail(
                                    crate::legacy_fetch::ApiLanguage::Pt,
                                    api_id,
                                )
                            ).ok()
                        })
                    } else {
                        None
                    };

                let mut item_success = true;

                // Download each missing asset — (column, local_rel_path, remote_url).
                // local_rel_path may be None for managed hymns never downloaded before;
                // in that case, derive the local path from the remote URL and update the DB after download.
                let assets: Vec<(&str, Option<String>, Option<String>)> = vec![
                    ("audio", media.audio_path.clone(), music_detail.as_ref().and_then(|d| d.url_music.clone())),
                    ("playback", media.playback_path.clone(), music_detail.as_ref().and_then(|d| d.url_instrumental_music.clone())),
                    ("cover", media.cover_path.clone(), music_detail.as_ref().and_then(|d| d.url_image.clone())),
                ];

                let api_id = item.remote_id.unwrap_or(local_id);

                for (col, local_rel_path, remote_url) in &assets {
                    // Determine effective local path:
                    // - If already in DB, use existing path (preserves HTTP-importer layout).
                    // - If null (never downloaded), derive using HTTP-importer path format
                    //   (media/{subfolder}/{api_id}/{filename}) so FTP and HTTP files are co-located.
                    let effective_path = match (local_rel_path, remote_url) {
                        (Some(p), _) => p.clone(),
                        (None, Some(url)) => {
                            let subfolder = match *col {
                                "audio" => "audio",
                                "playback" => "playback",
                                "cover" => "images",
                                _ => "misc",
                            };
                            content_sync::derive_local_media_path(url, subfolder, api_id)
                        }
                        (None, None) => {
                            // No local path and no remote URL — asset is unavailable on the server.
                            // Write a sentinel so future load_summary counts stop flagging this hymn.
                            // The sentinel is non-NULL so the managed_null_count query ignores it,
                            // and media_paths_missing() skips "_na_" paths explicitly.
                            if item.entity_type == "hymn" {
                                if let Ok(conn) = app.try_state::<AppState>().ok_or(()).and_then(|s| s.db.get().map_err(|_| ())) {
                                    save_hymn_path(&conn, local_id, col, "_na_");
                                }
                            }
                            continue;
                        }
                    };

                    let full_path = app_data_dir.join(&effective_path);
                    if full_path.exists() {
                        // File already present; if path was never saved to DB, record it now
                        if local_rel_path.is_none() && item.entity_type == "hymn" {
                            if let Ok(conn) = app.try_state::<AppState>().ok_or(()).and_then(|s| s.db.get().map_err(|_| ())) {
                                save_hymn_path(&conn, local_id, col, &effective_path);
                            }
                        }
                        continue;
                    }

                    // Resolve FTP remote path — requires a remote URL
                    let Some(ref url) = remote_url else {
                        eprintln!("[sync] Skipping asset '{}': no remote URL to resolve FTP path", effective_path);
                        continue;
                    };

                    let remote_path = content_sync::resolve_remote_path_from_url(url);

                    emit_progress(
                        &app,
                        &run_id,
                        "downloading",
                        ContentSyncRunStatus::Running,
                        percent,
                        Some(format!("Downloading: {}", remote_path)),
                        processed,
                    );

                    match ftp_sync::client::sync_file_on_stream(stream, &remote_path, &full_path) {
                        Ok(()) => {
                            // If this was a never-before-downloaded path, persist it in the DB
                            if local_rel_path.is_none() && item.entity_type == "hymn" {
                                if let Ok(conn) = app.try_state::<AppState>().ok_or(()).and_then(|s| s.db.get().map_err(|_| ())) {
                                    save_hymn_path(&conn, local_id, col, &effective_path);
                                }
                            }
                        }
                        Err(e) => {
                            let err_msg = format!("FTP error for '{}': {}", remote_path, e);
                            eprintln!("[sync] {}", err_msg);
                            emit_progress(
                                &app,
                                &run_id,
                                "downloading",
                                ContentSyncRunStatus::Running,
                                percent,
                                Some(err_msg),
                                processed,
                            );
                            item_success = false;
                        }
                    }
                }

                if item_success {
                    applied_count += 1;
                } else {
                    failed_count += 1;
                }
            }

            ContentSyncPlanItemAction::CreateHymn | ContentSyncPlanItemAction::UpdateHymn => {
                let is_update =
                    matches!(item.action, ContentSyncPlanItemAction::UpdateHymn);
                let Some(api_id) = item.remote_id else {
                    eprintln!("[sync] {:?}: skipping — no remote_id", item.action);
                    skipped_count += 1;
                    continue;
                };

                emit_progress(
                    &app,
                    &run_id,
                    "executing",
                    ContentSyncRunStatus::Running,
                    percent,
                    Some(format!(
                        "{} hymn (api_id={})…",
                        if is_update { "Updating" } else { "Creating" },
                        api_id
                    )),
                    processed,
                );

                // Ensure FTP is ready (credentials + connection)
                if !ensure_ftp_ready(&app, &mut ftp_settings, &mut ftp_stream) {
                    eprintln!("[sync] {:?}: FTP unavailable — skipping api_id={}", item.action, api_id);
                    skipped_count += 1;
                    continue;
                }

                // Fetch full hymn detail (includes lyrics)
                let lang = get_app_lang(&app);
                let api_lang = lang_to_api_language(&lang);
                let detail_res = tauri::async_runtime::block_on(
                    crate::legacy_fetch::fetcher::fetch_music_detail(api_lang, api_id),
                );
                let music = match detail_res {
                    Ok(m) => m,
                    Err(e) => {
                        eprintln!(
                            "[sync] {:?}: fetch_music_detail failed for api_id={}: {}",
                            item.action, api_id, e
                        );
                        failed_count += 1;
                        continue;
                    }
                };

                let app_data_dir = app.path().app_data_dir().unwrap_or_default();

                // Download assets via FTP
                let audio_path = download_asset_via_ftp(
                    &mut ftp_stream,
                    &music.url_music,
                    "audio",
                    api_id,
                    &app_data_dir,
                );
                let playback_path = download_asset_via_ftp(
                    &mut ftp_stream,
                    &music.url_instrumental_music,
                    "playback",
                    api_id,
                    &app_data_dir,
                );
                let cover_path = download_asset_via_ftp(
                    &mut ftp_stream,
                    &music.url_image,
                    "images",
                    api_id,
                    &app_data_dir,
                );

                // Import (upsert) into DB
                let conn_res = app
                    .try_state::<AppState>()
                    .ok_or(())
                    .and_then(|s| s.db.get().map_err(|_| ()));
                let Ok(conn) = conn_res else {
                    eprintln!("[sync] {:?}: DB connection unavailable", item.action);
                    failed_count += 1;
                    continue;
                };

                match crate::content_sync::importer::import_music_to_db(
                    &conn,
                    &music,
                    audio_path.as_deref(),
                    playback_path.as_deref(),
                    cover_path.as_deref(),
                    is_update, // replace_existing = true for UpdateHymn
                    None,       // album_name — not known at hymn level
                    Some(api_id),
                    Some("hymnal"),
                ) {
                    Ok((_, Some(local_id))) => {
                        // Persist the local_id into content_sync_entities so future plan
                        // runs can resolve this entity without re-creating it.
                        let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
                            &conn,
                            "hymn",
                            api_id,
                            local_id,
                        );
                        applied_count += 1;
                    }
                    Ok((_, None)) => {
                        eprintln!(
                            "[sync] {:?}: import returned no local id for api_id={}",
                            item.action, api_id
                        );
                        failed_count += 1;
                    }
                    Err(e) => {
                        eprintln!(
                            "[sync] {:?}: import_music_to_db failed for api_id={}: {}",
                            item.action, api_id, e
                        );
                        failed_count += 1;
                    }
                }
            }

            ContentSyncPlanItemAction::CreateAlbum | ContentSyncPlanItemAction::UpdateAlbum => {
                // Implemented in next task
                applied_count += 1;
            }

            ContentSyncPlanItemAction::DeleteRemoteManagedHymn
            | ContentSyncPlanItemAction::DeleteRemoteManagedAlbum => {
                // Implemented in next task
                skipped_count += 1;
            }

            _ => {
                // Remaining unhandled variants
                applied_count += 1;
            }
        }
    }

    // Cleanly close the FTP connection
    if let Some(mut stream) = ftp_stream {
        let _ = stream.quit();
    }

    finish_run(
        &app,
        &run_id,
        &plan,
        ContentSyncRunStatus::Completed,
        applied_count,
        skipped_count,
        failed_count,
        Some("Content sync runtime completed.".to_string()),
    );
}

fn finish_run(
    app: &AppHandle,
    run_id: &str,
    plan: &ContentSyncPlan,
    status: ContentSyncRunStatus,
    applied_count: i32,
    skipped_count: i32,
    failed_count: i32,
    message: Option<String>,
) {
    if let Some(state) = app.try_state::<AppState>() {
        let (conn, err) = catcher(state.db.get());
        if err.is_some() {
            return;
        }
        let conn = conn.unwrap();

        let report_result = content_sync::finalize_runtime_run(
            &conn,
            run_id,
            plan,
            status.clone(),
            applied_count,
            skipped_count,
            failed_count,
            message.clone(),
        );

        if let Ok(report) = report_result {
            let (runtime_state, err) = catcher(state.content_sync.lock());
            if err.is_some() {
                return;
            }
            let mut runtime_state = runtime_state.unwrap();

            if let Some(run) = runtime_state.runs.get_mut(run_id) {
                run.report = Some(report.clone());
                run.progress.status = status.clone();
                run.progress.percent = 100.0;
                run.progress.message = message.clone();
                run.progress.items_processed = run.progress.items_total;
            }
            if runtime_state.active_run_id.as_deref() == Some(run_id) {
                runtime_state.active_run_id = None;
            }
            if let Some(run) = runtime_state.runs.get(run_id) {
                let _ = app.emit("content-sync-progress", &run.progress);
            }

            let _ = app.emit("content-sync-report", &report);
        }
    }
}

/// Persist a downloaded media path into the hymn row for future file-existence checks.
/// Called only when the DB path was previously NULL (managed hymn, never downloaded before).
fn save_hymn_path(conn: &rusqlite::Connection, hymn_id: i64, col: &str, path: &str) {
    let result = match col {
        "audio" => crate::db::queries::content_sync::set_hymn_audio_path(conn, hymn_id, path),
        "playback" => crate::db::queries::content_sync::set_hymn_playback_path(conn, hymn_id, path),
        "cover" => crate::db::queries::content_sync::set_hymn_cover_path(conn, hymn_id, path),
        _ => return,
    };
    if let Err(e) = result {
        eprintln!("[sync] Failed to persist hymn path '{}' for col '{}': {}", path, col, e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FTP File Browser commands
// ─────────────────────────────────────────────────────────────────────────────

/// Data needed to map an FTP remote path back to a structured local path
/// (media/{subfolder}/{api_id}/{filename})
struct FtpPathMapEntry {
    api_id: i64,
    subfolder: String,
}

/// Load a mapping of known FTP remote paths to their respective API IDs and subfolders.
/// This allows the FTP browser to co-locate files in the same folders as the HTTP fetcher.
fn get_ftp_path_mapping(conn: &rusqlite::Connection) -> HashMap<String, FtpPathMapEntry> {
    let mut map = HashMap::new();

    // Mapping for hymns
    let stmt = conn.prepare(
        "SELECT api_music_id, url_music, url_instrumental_music, url_image FROM hymns WHERE api_music_id IS NOT NULL"
    ).ok();

    if let Some(mut stmt) = stmt {
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        }).ok();

        if let Some(rows) = rows {
            for row in rows.flatten() {
                let api_id = row.0;
                if let Some(url) = row.1 {
                    map.insert(content_sync::resolve_remote_path_from_url(&url), FtpPathMapEntry { api_id, subfolder: "audio".to_string() });
                }
                if let Some(url) = row.2 {
                    map.insert(content_sync::resolve_remote_path_from_url(&url), FtpPathMapEntry { api_id, subfolder: "playback".to_string() });
                }
                if let Some(url) = row.3 {
                    map.insert(content_sync::resolve_remote_path_from_url(&url), FtpPathMapEntry { api_id, subfolder: "images".to_string() });
                }
            }
        }
    }

    // Mapping for albums (collections)
    let stmt = conn.prepare(
        "SELECT api_album_id, url_image FROM collections WHERE api_album_id IS NOT NULL"
    ).ok();

    if let Some(mut stmt) = stmt {
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        }).ok();

        if let Some(rows) = rows {
            for row in rows.flatten() {
                let api_id = row.0;
                if let Some(url) = row.1 {
                    map.insert(content_sync::resolve_remote_path_from_url(&url), FtpPathMapEntry { api_id, subfolder: "album_covers".to_string() });
                }
            }
        }
    }

    map
}

/// List all files on the FTP server (walking known content directories) and
/// compare each against local disk.  Returns `Vec<FtpFileEntry>`.
///
/// Known directories walked:
///   config/musicas  — audio / playback files
///   config/imagens  — cover images
///
/// For each remote file we derive the expected local path via
/// `resolve_local_path_for_remote` and check whether it exists under
/// `app_data_dir`.

/// Recursively walk `dir` on the FTP server, collecting file entries.
/// Directories are descended into (up to `MAX_DEPTH` levels to avoid
/// infinite loops on symlink cycles or malformed server responses).
fn collect_ftp_files_recursive(
    stream: &mut FtpStream,
    dir: &str,
    app_data_dir: &std::path::Path,
    path_map: &HashMap<String, FtpPathMapEntry>,
    out: &mut Vec<FtpFileEntry>,
) -> Result<(), AppError> {
    const MAX_DEPTH: usize = 8;

    fn walk(
        stream: &mut FtpStream,
        dir: &str,
        app_data_dir: &std::path::Path,
        path_map: &HashMap<String, FtpPathMapEntry>,
        out: &mut Vec<FtpFileEntry>,
        depth: usize,
    ) -> Result<(), AppError> {
        if depth > MAX_DEPTH {
            return Ok(());
        }

        let lines = match stream.list(Some(dir)) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[ftp-browser] list failed for '{}': {}", dir, e);
                return Ok(()); // skip unreadable dirs, don't abort the whole walk
            }
        };

        for line in lines {
            let parsed = match FtpListFile::try_from(line.as_str()) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let name = parsed.name();
            // Ignore UNIX navigation entries
            if name == "." || name == ".." {
                continue;
            }

            let remote_path = format!("{}/{}", dir, name);

            if parsed.is_directory() {
                walk(stream, &remote_path, app_data_dir, path_map, out, depth + 1)?;
            } else {
                let file_size = Some(parsed.size() as u64);
                let local_path = resolve_local_path_for_remote(&remote_path, path_map);
                let exists_locally = local_path
                    .as_ref()
                    .is_some_and(|rel| app_data_dir.join(rel).exists());

                out.push(FtpFileEntry {
                    remote_path,
                    local_path,
                    exists_locally,
                    file_size,
                });
            }
        }
        Ok(())
    }

    walk(stream, dir, app_data_dir, path_map, out, 0)
}
#[tauri::command]
#[specta::specta]
pub fn list_ftp_files(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let lang = get_app_lang(&app);
    let app_clone = app.clone();
    
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err { return Err(e); }
    let conn = conn.unwrap();
    let path_map = get_ftp_path_mapping(&conn);
    drop(conn);

    std::thread::spawn(move || {
        match list_ftp_files_background(&app_clone, &lang, path_map) {
            Ok(entries) => { let _ = app_clone.emit("ftp-files-loaded", entries); }
            Err(e) => { let _ = app_clone.emit("ftp-files-error", e.to_string()); }
        }
    });
    Ok(())
}

fn list_ftp_files_background(
    app: &AppHandle, 
    lang: &str,
    path_map: HashMap<String, FtpPathMapEntry>,
) -> Result<Vec<FtpFileEntry>, AppError> {
    // Fetch FTP credentials
    let params = tauri::async_runtime::block_on(crate::legacy_fetch::fetcher::fetch_params())
        .map_err(|e| AppError::Internal(format!("Failed to fetch API params: {}", e)))?;

    let conn_ftp_url = params.conn_ftp.ok_or_else(|| {
        AppError::Internal("FTP URL not available from API params".to_string())
    })?;

    let settings = tauri::async_runtime::block_on(
        ftp_sync::credentials::fetch_ftp_credentials(&conn_ftp_url, lang),
    )?;

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();

    // Connect once and reuse
    let mut stream = ftp_sync::client::get_ftp_client(&settings)?;

    // Directories to walk on the FTP server
    let dirs = [
        "config/musicas",
        "config/imagens",
    ];

    let mut entries: Vec<FtpFileEntry> = Vec::new();

    for dir in &dirs {
        collect_ftp_files_recursive(&mut stream, dir, &app_data_dir, &path_map, &mut entries)?;
    }

    let _ = stream.quit();
    Ok(entries)
}

/// Download a list of remote FTP paths to their corresponding local locations.
///
/// Runs in a background thread and returns immediately.
/// Progress is emitted as `"ftp-file-download-progress"` events with
/// `FtpDownloadProgress` payload.
#[tauri::command]
#[specta::specta]
pub fn download_ftp_files(
    remote_paths: Vec<String>, 
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let lang = get_app_lang(&app);
    let app_clone = app.clone();

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err { return Err(e); }
    let conn = conn.unwrap();
    let path_map = get_ftp_path_mapping(&conn);
    drop(conn);

    std::thread::spawn(move || {
        let result = download_ftp_files_background(app_clone, remote_paths, &lang, path_map);
        if let Err(e) = result {
            eprintln!("[ftp-browser] Background download failed: {}", e);
        }
    });

    Ok(())
}

fn download_ftp_files_background(
    app: AppHandle,
    remote_paths: Vec<String>,
    lang: &str,
    path_map: HashMap<String, FtpPathMapEntry>,
) -> Result<(), AppError> {
    let params = tauri::async_runtime::block_on(crate::legacy_fetch::fetcher::fetch_params())
        .map_err(|e| AppError::Internal(format!("Failed to fetch API params: {}", e)))?;

    let conn_ftp_url = params.conn_ftp.ok_or_else(|| {
        AppError::Internal("FTP URL not available from API params".to_string())
    })?;

    let settings = tauri::async_runtime::block_on(
        ftp_sync::credentials::fetch_ftp_credentials(&conn_ftp_url, lang),
    )?;

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let total = remote_paths.len();

    let mut stream = ftp_sync::client::get_ftp_client(&settings)?;

    for (index, remote_path) in remote_paths.iter().enumerate() {
        let local_path = resolve_local_path_for_remote(remote_path, &path_map);

        let Some(local_rel) = local_path else {
            let _ = app.emit(
                "ftp-file-download-progress",
                &FtpDownloadProgress {
                    remote_path: remote_path.clone(),
                    done: index + 1,
                    total,
                    success: false,
                    error: Some("Cannot derive local path for this remote path".to_string()),
                },
            );
            continue;
        };

        let full_local = app_data_dir.join(&local_rel);

        match ftp_sync::client::sync_file_on_stream(&mut stream, remote_path, &full_local) {
            Ok(()) => {
                let _ = app.emit(
                    "ftp-file-download-progress",
                    &FtpDownloadProgress {
                        remote_path: remote_path.clone(),
                        done: index + 1,
                        total,
                        success: true,
                        error: None,
                    },
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "ftp-file-download-progress",
                    &FtpDownloadProgress {
                        remote_path: remote_path.clone(),
                        done: index + 1,
                        total,
                        success: false,
                        error: Some(e.to_string()),
                    },
                );
            }
        }
    }

    let _ = stream.quit();
    Ok(())
}

/// Derive a local relative path from an FTP remote path.
///
/// Mapping rules (mirrors what the sync executor does):
///   config/musicas/...   → media/audio/{api_id}/{filename} (if known)
///   config/imagens/...   → media/images/{api_id}/{filename} (if known)
///
/// Returns `None` if the remote path doesn't match any known pattern.
fn resolve_local_path_for_remote(
    remote_path: &str,
    path_map: &HashMap<String, FtpPathMapEntry>,
) -> Option<String> {
    let filename = remote_path.rsplit('/').next()?;
    if filename.is_empty() || !filename.contains('.') {
        return None; // Looks like a directory entry — skip
    }

    // Try to find a mapping to a structured path used by the HTTP fetcher
    if let Some(entry) = path_map.get(remote_path) {
        return Some(format!("media/{}/{}/{}", entry.subfolder, entry.api_id, filename));
    }

    // Fallback: use the "browser" subfolder if mapping is unknown, 
    // but still group by remote category.
    if remote_path.starts_with("config/musicas/") {
        let subpath = remote_path.trim_start_matches("config/musicas/");
        let sanitized_subpath: String = subpath
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '/' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        Some(format!("media/audio/browser/{}", sanitized_subpath))
    } else if remote_path.starts_with("config/imagens/") {
        let subpath = remote_path.trim_start_matches("config/imagens/");
        let sanitized_subpath: String = subpath
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '/' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        Some(format!("media/images/browser/{}", sanitized_subpath))
    } else {
        // Generic fallback: store under media/ftp-browser/ mirroring the remote path
        let sanitized_full: String = remote_path
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '/' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        Some(format!("media/ftp-browser/{}", sanitized_full))
    }
}

/// Read the active language from app settings, defaulting to "pt".
fn get_app_lang(app: &AppHandle) -> String {
    app.try_state::<AppState>()
        .and_then(|state| state.db.get().ok())
        .and_then(|conn| {
            crate::db::queries::settings::get_setting(&conn, "app.language")
                .ok()
                .map(|s| s.value)
        })
        .unwrap_or_else(|| "pt".to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync execution helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Convert a language string (from app settings) to the API language enum.
fn lang_to_api_language(lang: &str) -> crate::legacy_fetch::ApiLanguage {
    match lang {
        "en" => crate::legacy_fetch::ApiLanguage::En,
        "es" => crate::legacy_fetch::ApiLanguage::Es,
        _ => crate::legacy_fetch::ApiLanguage::Pt,
    }
}

/// Download a single asset file via the already-open FTP stream.
/// Derives the local relative path from the HTTP URL (same layout as the HTTP importer:
/// `media/{subfolder}/{api_id}/{filename}`), skips if the file already exists locally,
/// and returns the relative path on success.
///
/// Returns `None` if the URL is absent, the FTP stream is not available,
/// or the download fails (errors are logged, not propagated).
fn download_asset_via_ftp(
    ftp_stream: &mut Option<FtpStream>,
    url: &Option<String>,
    subfolder: &str,
    api_id: i64,
    app_data_dir: &std::path::Path,
) -> Option<String> {
    let url = url.as_ref()?;
    if url.is_empty() {
        return None;
    }
    let rel_path = content_sync::derive_local_media_path(url, subfolder, api_id);
    let full_path = app_data_dir.join(&rel_path);
    if full_path.exists() {
        return Some(rel_path);
    }
    let remote_path = content_sync::resolve_remote_path_from_url(url);
    if let Some(stream) = ftp_stream {
        match ftp_sync::client::sync_file_on_stream(stream, &remote_path, &full_path) {
            Ok(()) => return Some(rel_path),
            Err(e) => {
                eprintln!(
                    "[sync] FTP download failed for '{}' -> '{}': {}",
                    remote_path,
                    full_path.display(),
                    e
                );
            }
        }
    }
    None
}

/// Ensure FTP credentials and stream are initialized.
/// Both `ftp_settings` and `ftp_stream` are lazily populated once per run and reused.
/// Returns `true` if the stream is ready after this call, `false` if unavailable.
fn ensure_ftp_ready(
    app: &AppHandle,
    ftp_settings: &mut Option<ftp_sync::credentials::FtpSettings>,
    ftp_stream: &mut Option<FtpStream>,
) -> bool {
    // Lazy-fetch credentials
    if ftp_settings.is_none() {
        let lang = get_app_lang(app);
        let params_res =
            tauri::async_runtime::block_on(legacy_fetch::fetcher::fetch_params());
        if let Ok(params) = params_res {
            if let Some(conn_ftp_url) = params.conn_ftp {
                let creds_res = tauri::async_runtime::block_on(
                    ftp_sync::credentials::fetch_ftp_credentials(&conn_ftp_url, &lang),
                );
                match creds_res {
                    Ok(settings) => *ftp_settings = Some(settings),
                    Err(e) => {
                        eprintln!("[sync] Failed to fetch FTP credentials: {}", e);
                        return false;
                    }
                }
            }
        }
    }

    let Some(ref settings) = ftp_settings else {
        return false;
    };

    // Lazy-connect stream
    if ftp_stream.is_none() {
        match ftp_sync::client::get_ftp_client(settings) {
            Ok(stream) => *ftp_stream = Some(stream),
            Err(e) => {
                eprintln!("[sync] FTP connect failed: {}", e);
                return false;
            }
        }
    }

    ftp_stream.is_some()
}

#[cfg(test)]
mod tests {
    use crate::content_sync::resolve_remote_path_from_url;

    #[test]
    fn resolve_remote_path_pt_music_url() {
        let url = "https://api.louvorja.com.br/file/musics/pt/colecao/song.mp3";
        assert_eq!(resolve_remote_path_from_url(url), "config/musicas/colecao/song.mp3");
    }

    #[test]
    fn resolve_remote_path_en_music_url() {
        let url = "https://api.louvorja.com.br/file/musics/en/collection/song.mp3";
        assert_eq!(resolve_remote_path_from_url(url), "EN/config/musicas/collection/song.mp3");
    }

    #[test]
    fn resolve_remote_path_image_url() {
        let url = "https://api.louvorja.com.br/file/images/covers/album.jpg";
        assert_eq!(resolve_remote_path_from_url(url), "config/imagens/covers/album.jpg");
    }

    #[test]
    fn resolve_remote_path_returns_input_unchanged_for_unknown_url() {
        let url = "https://example.com/unknown/path.mp3";
        assert_eq!(resolve_remote_path_from_url(url), url);
    }
}
