use crate::content_sync::{self, ContentSyncRunState};
use crate::db::models::{
    ContentSyncPlan, ContentSyncProgress, ContentSyncReport, ContentSyncRunStatus,
    ContentSyncSummary, ContentSyncPlanItemAction,
};
use crate::error::AppError;
use crate::state::AppState;
use crate::utils::catcher::catcher;
use crate::ftp_sync;
use crate::legacy_fetch;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use suppaftp::FtpStream;
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

                // Load media paths for this item from the DB
                let media = {
                    let Ok(conn) = app.try_state::<AppState>()
                        .ok_or(())
                        .and_then(|s| s.db.get().map_err(|_| ()))
                    else {
                        failed_count += 1;
                        continue;
                    };

                    let local_id = item.local_id.unwrap_or(0);
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

                // Download each missing asset — skipping those without a resolvable remote URL
                let assets: &[(Option<String>, Option<String>)] = &[
                    (media.audio_path.clone(), music_detail.as_ref().and_then(|d| d.url_music.clone())),
                    (media.playback_path.clone(), music_detail.as_ref().and_then(|d| d.url_instrumental_music.clone())),
                    (media.cover_path.clone(), music_detail.as_ref().and_then(|d| d.url_image.clone())),
                ];

                for (local_rel_path, remote_url) in assets {
                    let Some(ref path) = local_rel_path else { continue; };

                    let full_path = app_data_dir.join(path);
                    if full_path.exists() { continue; } // already present

                    // Resolve FTP remote path from the remote URL.
                    // If URL is unavailable, we cannot safely determine the FTP path — skip.
                    let Some(ref url) = remote_url else {
                        eprintln!("[sync] Skipping asset '{}': no remote URL available to resolve FTP path", path);
                        continue; // Skip this asset — don't fail the whole item
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

                    if let Err(e) = ftp_sync::client::sync_file_on_stream(stream, &remote_path, &full_path) {
                        eprintln!("[sync] FTP error for '{}': {}", remote_path, e);
                        item_success = false;
                    }
                }

                if item_success {
                    applied_count += 1;
                } else {
                    failed_count += 1;
                }
            }

            _ => {
                // Placeholder for other actions (CreateHymn, UpdateHymn, etc.)
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
