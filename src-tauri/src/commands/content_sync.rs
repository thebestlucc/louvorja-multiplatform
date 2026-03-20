use crate::content_sync::{self, snapshot::SnapshotManifest, ContentSyncRunState};
use crate::db::models::{
    ContentSyncMetadataSource, ContentSyncPlan, ContentSyncPlanItemAction,
    ContentSyncProgress, ContentSyncRemoteEntityInput, ContentSyncReport,
    ContentSyncRunStatus, ContentSyncSummary, FtpDownloadProgress, FtpFileEntry,
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

enum PreparedRemoteMetadata {
    Snapshot {
        remote_version: Option<i64>,
        manifest: SnapshotManifest,
    },
    ApiFallback {
        remote_version: Option<i64>,
        hymn_inputs: Vec<ContentSyncRemoteEntityInput>,
        album_inputs: Vec<ContentSyncRemoteEntityInput>,
    },
    Degraded {
        remote_version: Option<i64>,
        reason: Option<String>,
    },
}

async fn fetch_content_sync_remote_metadata(
    app: &AppHandle,
) -> Result<PreparedRemoteMetadata, AppError> {
    let params_res = legacy_fetch::fetcher::fetch_params().await;
    let remote_version = params_res.as_ref().ok().and_then(|params| params.db_version);
    let lang = get_app_lang(app);
    let api_lang = lang_to_api_language(&lang);
    let mut degraded_reason = None::<String>;

    if let Ok(params) = &params_res {
        if let Some(conn_ftp_url) = params.conn_ftp.as_deref() {
            match ftp_sync::credentials::fetch_ftp_credentials(conn_ftp_url, &lang).await {
                Ok(ftp_settings) => {
                    let database_snapshot_path = params
                        .database_snapshot_path
                        .clone()
                        .or_else(|| ftp_settings.database_snapshot_path.clone());

                    if let Some(database_snapshot_path) = database_snapshot_path {
                        let ftp_settings = ftp_settings.clone();
                        let lang = lang.clone();
                        let log_snapshot_path = database_snapshot_path.clone();
                        let log_lang = lang.clone();
                        match tauri::async_runtime::spawn_blocking(move || {
                            crate::content_sync::snapshot::load_remote_snapshot_manifest(
                                &ftp_settings,
                                &database_snapshot_path,
                                &lang,
                            )
                        })
                        .await
                        .map_err(|error| {
                            AppError::Internal(format!(
                                "DB snapshot task failed to join: {}",
                                error
                            ))
                        })? {
                            Ok(snapshot_manifest) if snapshot_manifest.has_content() => {
                                return Ok(PreparedRemoteMetadata::Snapshot {
                                    remote_version,
                                    manifest: snapshot_manifest,
                                });
                            }
                            Ok(_) => {
                                degraded_reason = Some(format!(
                                    "DB snapshot '{}' has no content for language '{}'.",
                                    log_snapshot_path, log_lang
                                ));
                            }
                            Err(error) => {
                                eprintln!("[plan] remote snapshot load failed: {}", error);
                                degraded_reason = Some(format!(
                                    "DB snapshot metadata is unavailable: {}",
                                    error
                                ));
                            }
                        }
                    }
                }
                Err(error) => {
                    eprintln!("[plan] FTP credentials fetch failed: {}", error);
                    degraded_reason = Some(format!("FTP credentials are unavailable: {}", error));
                }
            }
        }
    }

    let hymns_res = fetch_all_hymnal_pages(api_lang).await;
    let albums_res = fetch_all_album_pages(api_lang).await;

    match (hymns_res, albums_res) {
        (Ok(hymns), Ok(albums)) => {
            let hymn_inputs: Vec<ContentSyncRemoteEntityInput> =
                hymns.iter().map(api_music_to_entity_input).collect();
            let album_inputs: Vec<ContentSyncRemoteEntityInput> =
                albums.iter().map(api_album_to_entity_input).collect();
            Ok(PreparedRemoteMetadata::ApiFallback {
                remote_version,
                hymn_inputs,
                album_inputs,
            })
        }
        (hymns_res, albums_res) => {
            if let Err(error) = hymns_res {
                eprintln!("[plan] fetch_all_hymnal_pages failed: {}", error);
                if degraded_reason.is_none() {
                    degraded_reason = Some(error.to_string());
                }
            }
            if let Err(error) = albums_res {
                eprintln!("[plan] fetch_all_album_pages failed: {}", error);
                if degraded_reason.is_none() {
                    degraded_reason = Some(error.to_string());
                }
            }
            Ok(PreparedRemoteMetadata::Degraded {
                remote_version,
                reason: degraded_reason,
            })
        }
    }
}

fn finalize_content_sync_plan(
    app: &AppHandle,
    conn: &rusqlite::Connection,
    remote_metadata: PreparedRemoteMetadata,
) -> Result<(ContentSyncPlan, Option<SnapshotManifest>), AppError> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let file_exists = |rel_path: &str| {
        let full_path = app_data_dir.join(rel_path);
        std::fs::metadata(full_path).is_ok()
    };

    match remote_metadata {
        PreparedRemoteMetadata::Snapshot {
            remote_version,
            manifest,
        } => {
            let hymn_inputs = manifest.hymn_inputs();
            let album_inputs = manifest.album_inputs();
            let plan = content_sync::build_manifest_plan_with_source(
                conn,
                remote_version,
                &hymn_inputs,
                &album_inputs,
                &file_exists,
                Some(ContentSyncMetadataSource::DbSnapshot),
            )?;
            let _ = crate::db::queries::content_sync::mark_content_sync_checked(
                conn,
                remote_version,
                None,
            );
            Ok((plan, Some(manifest)))
        }
        PreparedRemoteMetadata::ApiFallback {
            remote_version,
            hymn_inputs,
            album_inputs,
        } => {
            let plan = content_sync::build_manifest_plan_with_source(
                conn,
                remote_version,
                &hymn_inputs,
                &album_inputs,
                &file_exists,
                Some(ContentSyncMetadataSource::ApiFallback),
            )?;
            let _ = crate::db::queries::content_sync::mark_content_sync_checked(
                conn,
                remote_version,
                None,
            );
            Ok((plan, None))
        }
        PreparedRemoteMetadata::Degraded {
            remote_version,
            reason,
        } => {
            let _ = crate::db::queries::content_sync::mark_content_sync_checked(
                conn,
                remote_version,
                reason.as_deref(),
            );
            let summary = content_sync::load_summary(conn, &file_exists)?;
            Ok((content_sync::build_degraded_plan(conn, summary, &file_exists)?, None))
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn plan_content_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncPlan, AppError> {
    let remote_metadata = fetch_content_sync_remote_metadata(&app).await?;
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    finalize_content_sync_plan(&app, &conn, remote_metadata).map(|(plan, _)| plan)
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
    let run_id = content_sync::new_run_id();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let initial_progress = content_sync::pending_progress(&run_id);
    content_sync::begin_pending_runtime_run(&conn, &run_id)?;
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
        prepare_and_run_content_sync_background(app, run_id_clone, cancel_flag);
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
    snapshot_manifest: Option<SnapshotManifest>,
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
    let lang = get_app_lang(&app);
    let api_lang = lang_to_api_language(&lang);

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
            finish_run(&app, &run_id, &plan, ContentSyncRunStatus::Cancelled, applied_count, skipped_count, failed_count, Some("Content sync cancelled before completion.".to_string()));
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
                if item.entity_type == "album" {
                    let normalized_action = ContentSyncPlanItemAction::UpdateAlbum;
                    if let Some(api_id) = item.remote_id {
                        emit_progress(&app, &run_id, "executing", ContentSyncRunStatus::Running, percent, Some(format!("Repairing album media (api_id={})…", api_id)), processed);
                    }
                    match sync_album_item(
                        &app,
                        &run_id,
                        item,
                        &normalized_action,
                        api_lang,
                        &cancel_flag,
                        &mut ftp_settings,
                        &mut ftp_stream,
                        snapshot_manifest.as_ref(),
                        percent,
                        processed,
                    ) {
                        ItemExecutionResult::Applied => applied_count += 1,
                        ItemExecutionResult::Skipped => skipped_count += 1,
                        ItemExecutionResult::Failed => failed_count += 1,
                        ItemExecutionResult::Cancelled => {
                            finish_run(&app, &run_id, &plan, ContentSyncRunStatus::Cancelled, applied_count, skipped_count, failed_count, Some("Content sync cancelled before completion.".to_string()));
                            if let Some(mut stream) = ftp_stream {
                                let _ = stream.quit();
                            }
                            return;
                        }
                    }
                    continue;
                }

                let normalized_action = ContentSyncPlanItemAction::UpdateHymn;
                if let Some(api_id) = item.remote_id {
                    emit_progress(&app, &run_id, "executing", ContentSyncRunStatus::Running, percent, Some(format!("Repairing hymn media (api_id={})…", api_id)), processed);
                }
                match sync_hymn_item(
                    &app,
                    item,
                    &normalized_action,
                    api_lang,
                    &mut ftp_settings,
                    &mut ftp_stream,
                    snapshot_manifest.as_ref(),
                ) {
                    ItemExecutionResult::Applied => applied_count += 1,
                    ItemExecutionResult::Skipped => skipped_count += 1,
                    ItemExecutionResult::Failed => failed_count += 1,
                    ItemExecutionResult::Cancelled => {
                        finish_run(&app, &run_id, &plan, ContentSyncRunStatus::Cancelled, applied_count, skipped_count, failed_count, Some("Content sync cancelled before completion.".to_string()));
                        if let Some(mut stream) = ftp_stream {
                            let _ = stream.quit();
                        }
                        return;
                    }
                }
            }

            ContentSyncPlanItemAction::CreateHymn | ContentSyncPlanItemAction::UpdateHymn => {
                emit_progress(
                    &app,
                    &run_id,
                    "executing",
                    ContentSyncRunStatus::Running,
                    percent,
                    item.remote_id.map(|api_id| {
                        format!(
                            "{} hymn (api_id={})…",
                            if matches!(item.action, ContentSyncPlanItemAction::UpdateHymn) {
                                "Updating"
                            } else {
                                "Creating"
                            },
                            api_id
                        )
                    }),
                    processed,
                );
                match sync_hymn_item(
                    &app,
                    item,
                    &item.action,
                    api_lang,
                    &mut ftp_settings,
                    &mut ftp_stream,
                    snapshot_manifest.as_ref(),
                ) {
                    ItemExecutionResult::Applied => applied_count += 1,
                    ItemExecutionResult::Skipped => skipped_count += 1,
                    ItemExecutionResult::Failed => failed_count += 1,
                    ItemExecutionResult::Cancelled => {
                        finish_run(&app, &run_id, &plan, ContentSyncRunStatus::Cancelled, applied_count, skipped_count, failed_count, Some("Content sync cancelled before completion.".to_string()));
                        if let Some(mut stream) = ftp_stream {
                            let _ = stream.quit();
                        }
                        return;
                    }
                }
            }

            ContentSyncPlanItemAction::CreateAlbum | ContentSyncPlanItemAction::UpdateAlbum => {
                emit_progress(
                    &app,
                    &run_id,
                    "executing",
                    ContentSyncRunStatus::Running,
                    percent,
                    item.remote_id.map(|api_id| {
                        format!(
                            "{} album (api_id={})…",
                            if matches!(item.action, ContentSyncPlanItemAction::UpdateAlbum) {
                                "Updating"
                            } else {
                                "Creating"
                            },
                            api_id
                        )
                    }),
                    processed,
                );
                match sync_album_item(
                    &app,
                    &run_id,
                    item,
                    &item.action,
                    api_lang,
                    &cancel_flag,
                    &mut ftp_settings,
                    &mut ftp_stream,
                    snapshot_manifest.as_ref(),
                    percent,
                    processed,
                ) {
                    ItemExecutionResult::Applied => applied_count += 1,
                    ItemExecutionResult::Skipped => skipped_count += 1,
                    ItemExecutionResult::Failed => failed_count += 1,
                    ItemExecutionResult::Cancelled => {
                        finish_run(&app, &run_id, &plan, ContentSyncRunStatus::Cancelled, applied_count, skipped_count, failed_count, Some("Content sync cancelled before completion.".to_string()));
                        if let Some(mut stream) = ftp_stream {
                            let _ = stream.quit();
                        }
                        return;
                    }
                }
            }

            ContentSyncPlanItemAction::DeleteRemoteManagedHymn => {
                let Some(api_id) = item.remote_id else {
                    eprintln!("[sync] DeleteRemoteManagedHymn: skipping — no remote_id");
                    skipped_count += 1;
                    continue;
                };

                // Do not hard-delete locally — the user may have service items or annotations.
                // Just mark the content_sync_entities row as deleted so future plan runs
                // don't keep emitting this action.
                let conn_res = app
                    .try_state::<AppState>()
                    .ok_or(())
                    .and_then(|s| s.db.get().map_err(|_| ()));
                let Ok(conn) = conn_res else {
                    eprintln!("[sync] DeleteRemoteManagedHymn: DB connection unavailable");
                    failed_count += 1;
                    continue;
                };

                let _ = conn.execute(
                    "UPDATE content_sync_entities SET deleted = 1, updated_local_at = datetime('now')
                     WHERE entity_type = 'hymn' AND remote_id = ?1",
                    rusqlite::params![api_id],
                );
                eprintln!(
                    "[sync] DeleteRemoteManagedHymn: marked api_id={} as deleted in content_sync_entities (not hard-deleted)",
                    api_id
                );
                skipped_count += 1;
            }

            ContentSyncPlanItemAction::DeleteRemoteManagedAlbum => {
                let Some(api_id) = item.remote_id else {
                    eprintln!("[sync] DeleteRemoteManagedAlbum: skipping — no remote_id");
                    skipped_count += 1;
                    continue;
                };

                let conn_res = app
                    .try_state::<AppState>()
                    .ok_or(())
                    .and_then(|s| s.db.get().map_err(|_| ()));
                let Ok(conn) = conn_res else {
                    eprintln!("[sync] DeleteRemoteManagedAlbum: DB connection unavailable");
                    failed_count += 1;
                    continue;
                };

                let _ = conn.execute(
                    "UPDATE content_sync_entities SET deleted = 1, updated_local_at = datetime('now')
                     WHERE entity_type = 'album' AND remote_id = ?1",
                    rusqlite::params![api_id],
                );
                eprintln!(
                    "[sync] DeleteRemoteManagedAlbum: marked api_id={} as deleted in content_sync_entities (not hard-deleted)",
                    api_id
                );
                skipped_count += 1;
            }

            _ => {
                // RelinkCollectionHymn — not yet implemented, treated as skipped
                skipped_count += 1;
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

fn prepare_and_run_content_sync_background(
    app: AppHandle,
    run_id: String,
    cancel_flag: Arc<AtomicBool>,
) {
    emit_progress(
        &app,
        &run_id,
        "planning",
        ContentSyncRunStatus::Running,
        1.0,
        Some("Fetching remote content metadata.".to_string()),
        0,
    );

    if content_sync::is_run_cancelled(&cancel_flag) {
        finish_run_without_plan(
            &app,
            &run_id,
            ContentSyncRunStatus::Cancelled,
            Some("Content sync cancelled before preparation completed.".to_string()),
        );
        return;
    }

    let remote_metadata =
        match tauri::async_runtime::block_on(fetch_content_sync_remote_metadata(&app)) {
            Ok(metadata) => metadata,
            Err(error) => {
                finish_run_without_plan(
                    &app,
                    &run_id,
                    ContentSyncRunStatus::Failed,
                    Some(format!("Failed to prepare content sync: {}", error)),
                );
                return;
            }
        };

    if content_sync::is_run_cancelled(&cancel_flag) {
        finish_run_without_plan(
            &app,
            &run_id,
            ContentSyncRunStatus::Cancelled,
            Some("Content sync cancelled before preparation completed.".to_string()),
        );
        return;
    }

    let Some(state) = app.try_state::<AppState>() else {
        finish_run_without_plan(
            &app,
            &run_id,
            ContentSyncRunStatus::Failed,
            Some("App state is unavailable for content sync.".to_string()),
        );
        return;
    };

    let (conn, err) = catcher(state.db.get());
    if let Some(error) = err {
        finish_run_without_plan(
            &app,
            &run_id,
            ContentSyncRunStatus::Failed,
            Some(format!("Failed to access local database: {}", error)),
        );
        return;
    }
    let conn = conn.unwrap();

    let (plan, snapshot_manifest) = match finalize_content_sync_plan(&app, &conn, remote_metadata) {
        Ok(result) => result,
        Err(error) => {
            finish_run_without_plan(
                &app,
                &run_id,
                ContentSyncRunStatus::Failed,
                Some(format!("Failed to build content sync plan: {}", error)),
            );
            return;
        }
    };

    if let Err(error) = content_sync::prepare_runtime_run(&conn, &run_id, &plan) {
        finish_run_without_plan(
            &app,
            &run_id,
            ContentSyncRunStatus::Failed,
            Some(format!("Failed to persist content sync plan: {}", error)),
        );
        return;
    }
    drop(conn);

    let prepared_progress = content_sync::initial_progress(&run_id, &plan);
    replace_progress(&app, prepared_progress);

    if content_sync::is_run_cancelled(&cancel_flag) {
        finish_run(
            &app,
            &run_id,
            &plan,
            ContentSyncRunStatus::Cancelled,
            0,
            0,
            0,
            Some("Content sync cancelled before execution started.".to_string()),
        );
        return;
    }

    run_content_sync_background(app, run_id, plan, cancel_flag, snapshot_manifest);
}

enum ItemExecutionResult {
    Applied,
    Skipped,
    Failed,
    Cancelled,
}

fn sync_hymn_item(
    app: &AppHandle,
    item: &crate::db::models::ContentSyncPlanItem,
    action: &ContentSyncPlanItemAction,
    api_lang: crate::legacy_fetch::ApiLanguage,
    ftp_settings: &mut Option<ftp_sync::credentials::FtpSettings>,
    ftp_stream: &mut Option<FtpStream>,
    snapshot_manifest: Option<&SnapshotManifest>,
) -> ItemExecutionResult {
    let Some(api_id) = item.remote_id else {
        eprintln!("[sync] {:?}: skipping hymn — no remote_id", action);
        return ItemExecutionResult::Skipped;
    };

    if !ensure_ftp_ready(app, ftp_settings, ftp_stream) {
        eprintln!("[sync] {:?}: FTP unavailable — skipping api_id={}", action, api_id);
        return ItemExecutionResult::Skipped;
    }

    let conn_res = app
        .try_state::<AppState>()
        .ok_or(())
        .and_then(|state| state.db.get().map_err(|_| ()));
    let Ok(conn) = conn_res else {
        eprintln!("[sync] {:?}: DB connection unavailable", action);
        return ItemExecutionResult::Failed;
    };

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let replace_existing = item.local_id.is_some()
        || matches!(
            action,
            ContentSyncPlanItemAction::UpdateHymn | ContentSyncPlanItemAction::RepairMedia
        );

    if let Some(record) = snapshot_manifest.and_then(|manifest| manifest.hymn_by_id(api_id)) {
        let audio_path = download_remote_asset_via_ftp(
            ftp_stream,
            record.audio_remote_path.as_deref(),
            "audio",
            api_id,
            &app_data_dir,
        );
        let playback_path = download_remote_asset_via_ftp(
            ftp_stream,
            record.playback_remote_path.as_deref(),
            "playback",
            api_id,
            &app_data_dir,
        );
        let cover_path = download_remote_asset_via_ftp(
            ftp_stream,
            record.cover_remote_path.as_deref(),
            "images",
            api_id,
            &app_data_dir,
        );

        match crate::content_sync::importer::import_music_to_db(
            &conn,
            &record.music,
            audio_path.as_deref(),
            playback_path.as_deref(),
            cover_path.as_deref(),
            replace_existing,
            record.album_name.as_deref(),
            Some(api_id),
            record.category.as_deref().or(Some("hymnal")),
        ) {
            Ok((_, Some(local_id))) => {
                persist_missing_hymn_asset_sentinels(
                    &conn,
                    local_id,
                    record.audio_remote_path.is_none(),
                    record.playback_remote_path.is_none(),
                    record.cover_remote_path.is_none(),
                );
                let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
                    &conn, "hymn", api_id, local_id,
                );
                ItemExecutionResult::Applied
            }
            Ok((_, None)) => {
                eprintln!(
                    "[sync] {:?}: snapshot hymn import returned no local id for api_id={}",
                    action, api_id
                );
                ItemExecutionResult::Failed
            }
            Err(error) => {
                eprintln!(
                    "[sync] {:?}: snapshot hymn import failed for api_id={}: {}",
                    action, api_id, error
                );
                ItemExecutionResult::Failed
            }
        }
    } else {
        let fallback_track = conn
            .query_row(
                "SELECT remote_version
                 FROM content_sync_entities
                 WHERE entity_type = 'hymn' AND remote_id = ?1",
                rusqlite::params![api_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .ok()
            .flatten();
        let detail_res =
            tauri::async_runtime::block_on(crate::legacy_fetch::fetcher::fetch_music_detail(
                api_lang, api_id,
            ));
        let music = match detail_res {
            Ok(music) => merge_music_track_fallback(music, fallback_track),
            Err(error) => {
                eprintln!(
                    "[sync] {:?}: fetch_music_detail failed for api_id={}: {}",
                    action, api_id, error
                );
                return ItemExecutionResult::Failed;
            }
        };

        let audio_path =
            download_asset_via_ftp(ftp_stream, &music.url_music, "audio", api_id, &app_data_dir);
        let playback_path = download_asset_via_ftp(
            ftp_stream,
            &music.url_instrumental_music,
            "playback",
            api_id,
            &app_data_dir,
        );
        let cover_path =
            download_asset_via_ftp(ftp_stream, &music.url_image, "images", api_id, &app_data_dir);

        match crate::content_sync::importer::import_music_to_db(
            &conn,
            &music,
            audio_path.as_deref(),
            playback_path.as_deref(),
            cover_path.as_deref(),
            replace_existing,
            None,
            Some(api_id),
            Some("hymnal"),
        ) {
            Ok((_, Some(local_id))) => {
                let audio_missing_remote = music
                    .url_music
                    .as_deref()
                    .map(|value| value.is_empty())
                    .unwrap_or(true);
                let playback_missing_remote = music
                    .url_instrumental_music
                    .as_deref()
                    .map(|value| value.is_empty())
                    .unwrap_or(true);
                let cover_missing_remote = music
                    .url_image
                    .as_deref()
                    .map(|value| value.is_empty())
                    .unwrap_or(true);
                persist_missing_hymn_asset_sentinels(
                    &conn,
                    local_id,
                    audio_missing_remote,
                    playback_missing_remote,
                    cover_missing_remote,
                );
                let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
                    &conn, "hymn", api_id, local_id,
                );
                ItemExecutionResult::Applied
            }
            Ok((_, None)) => {
                eprintln!(
                    "[sync] {:?}: import returned no local id for api_id={}",
                    action, api_id
                );
                ItemExecutionResult::Failed
            }
            Err(error) => {
                eprintln!(
                    "[sync] {:?}: import_music_to_db failed for api_id={}: {}",
                    action, api_id, error
                );
                ItemExecutionResult::Failed
            }
        }
    }
}

fn merge_music_track_fallback(
    mut music: crate::legacy_fetch::ApiMusic,
    fallback_track: Option<i64>,
) -> crate::legacy_fetch::ApiMusic {
    if music.track.is_none() {
        music.track = fallback_track;
    }
    music
}

fn sync_album_item(
    app: &AppHandle,
    run_id: &str,
    item: &crate::db::models::ContentSyncPlanItem,
    action: &ContentSyncPlanItemAction,
    api_lang: crate::legacy_fetch::ApiLanguage,
    cancel_flag: &Arc<AtomicBool>,
    ftp_settings: &mut Option<ftp_sync::credentials::FtpSettings>,
    ftp_stream: &mut Option<FtpStream>,
    snapshot_manifest: Option<&SnapshotManifest>,
    percent: f64,
    processed: u64,
) -> ItemExecutionResult {
    let Some(api_id) = item.remote_id else {
        eprintln!("[sync] {:?}: skipping album — no remote_id", action);
        return ItemExecutionResult::Skipped;
    };

    if !ensure_ftp_ready(app, ftp_settings, ftp_stream) {
        eprintln!("[sync] {:?}: FTP unavailable — skipping api_id={}", action, api_id);
        return ItemExecutionResult::Skipped;
    }

    let app_data_dir = app.path().app_data_dir().unwrap_or_default();
    let conn_res = app
        .try_state::<AppState>()
        .ok_or(())
        .and_then(|state| state.db.get().map_err(|_| ()));
    let Ok(conn) = conn_res else {
        eprintln!("[sync] {:?}: DB connection unavailable", action);
        return ItemExecutionResult::Failed;
    };

    let replace_existing = item.local_id.is_some()
        || matches!(
            action,
            ContentSyncPlanItemAction::UpdateAlbum | ContentSyncPlanItemAction::RepairMedia
        );

    if let Some(record) = snapshot_manifest.and_then(|manifest| manifest.album_by_id(api_id)) {
        if record.musics.is_empty() {
            eprintln!(
                "[sync] {:?}: snapshot album {} has no songs; falling back to API",
                action, api_id
            );
        } else {
            let cover_path = download_remote_asset_via_ftp(
                ftp_stream,
                record.cover_remote_path.as_deref(),
                "album_covers",
                api_id,
                &app_data_dir,
            );

            let release_year = record
                .cover_remote_path
                .as_deref()
                .and_then(crate::content_sync::importer::extract_year_from_url);

            let collection_id = match crate::content_sync::importer::upsert_api_album_collection(
                &conn,
                &record.album,
                cover_path.as_deref(),
                release_year,
            ) {
                Ok((collection_id, _)) => collection_id,
                Err(error) => {
                    eprintln!(
                        "[sync] {:?}: snapshot album upsert failed for api_id={}: {}",
                        action, api_id, error
                    );
                    return ItemExecutionResult::Failed;
                }
            };

            let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
                &conn,
                "album",
                api_id,
                collection_id,
            );

            let mut success_count = 0usize;
            for (index, music_record) in record.musics.iter().enumerate() {
                if content_sync::is_run_cancelled(cancel_flag) {
                    emit_progress(
                        app,
                        run_id,
                        "cancelled",
                        ContentSyncRunStatus::Cancelled,
                        percent,
                        Some("Content sync cancelled.".to_string()),
                        processed,
                    );
                    return ItemExecutionResult::Cancelled;
                }

                emit_progress(
                    app,
                    run_id,
                    "downloading",
                    ContentSyncRunStatus::Running,
                    percent,
                    Some(format!(
                        "Syncing album song {} ({}/{})",
                        music_record.music.name,
                        index + 1,
                        record.musics.len()
                    )),
                    processed,
                );

                let media = crate::content_sync::importer::DownloadedMusicMedia {
                    audio_path: download_remote_asset_via_ftp(
                        ftp_stream,
                        music_record.audio_remote_path.as_deref(),
                        "audio",
                        music_record.music.id_music,
                        &app_data_dir,
                    ),
                    playback_path: download_remote_asset_via_ftp(
                        ftp_stream,
                        music_record.playback_remote_path.as_deref(),
                        "playback",
                        music_record.music.id_music,
                        &app_data_dir,
                    ),
                    cover_path: download_remote_asset_via_ftp(
                        ftp_stream,
                        music_record.cover_remote_path.as_deref(),
                        "images",
                        music_record.music.id_music,
                        &app_data_dir,
                    ),
                };

                if crate::content_sync::importer::import_music_and_link_to_collection(
                    &conn,
                    collection_id,
                    &music_record.music,
                    &media,
                    replace_existing,
                    Some(&record.album.name),
                    Some("album"),
                    (index as i64) + 1,
                )
                .is_ok()
                {
                    success_count += 1;
                }
            }

            return if success_count > 0 || record.musics.is_empty() {
                ItemExecutionResult::Applied
            } else {
                ItemExecutionResult::Failed
            };
        }
    }

    let mut all_musics: Vec<crate::legacy_fetch::ApiMusic> = Vec::new();
    let mut page = 1i64;
    loop {
        let page_res = tauri::async_runtime::block_on(
            crate::legacy_fetch::fetcher::fetch_album_musics_page(api_lang, api_id, page),
        );
        match page_res {
            Ok(resp) => {
                let is_last = resp.data.is_empty() || resp.last_page.map_or(true, |last| page >= last);
                all_musics.extend(resp.data);
                if is_last {
                    break;
                }
                page += 1;
            }
            Err(error) => {
                eprintln!(
                    "[sync] {:?}: fetch_album_musics_page failed for api_id={} page={}: {}",
                    action, api_id, page, error
                );
                return ItemExecutionResult::Failed;
            }
        }
    }

    let album_cover_url = tauri::async_runtime::block_on(fetch_all_album_pages(api_lang))
        .ok()
        .and_then(|albums| {
            albums
                .into_iter()
                .find(|album| album.id_album == api_id)
                .and_then(|album| album.url_image)
        });

    let album_name = item
        .label
        .clone()
        .unwrap_or_else(|| format!("Album {}", api_id));
    let api_album = crate::legacy_fetch::ApiAlbum {
        id_album: api_id,
        name: album_name.clone(),
        url_image: album_cover_url.clone(),
        subtitle: None,
        color: None,
        id_file_image: None,
        order: Some(i64::try_from(all_musics.len()).unwrap_or_default()),
        image_version: album_cover_url.clone(),
        musics: Vec::new(),
    };

    let release_year = album_cover_url
        .as_deref()
        .and_then(crate::content_sync::importer::extract_year_from_url);
    let cover_path = download_asset_via_ftp(
        ftp_stream,
        &album_cover_url,
        "album_covers",
        api_id,
        &app_data_dir,
    );

    let collection_id = match crate::content_sync::importer::upsert_api_album_collection(
        &conn,
        &api_album,
        cover_path.as_deref(),
        release_year,
    ) {
        Ok((collection_id, _)) => collection_id,
        Err(error) => {
            eprintln!(
                "[sync] {:?}: upsert_api_album_collection failed for api_id={}: {}",
                action, api_id, error
            );
            return ItemExecutionResult::Failed;
        }
    };

    let _ = crate::db::queries::content_sync::set_content_sync_entity_local_id(
        &conn,
        "album",
        api_id,
        collection_id,
    );

    let mut success_count = 0usize;
    for (index, music_stub) in all_musics.iter().enumerate() {
        if content_sync::is_run_cancelled(cancel_flag) {
            emit_progress(
                app,
                run_id,
                "cancelled",
                ContentSyncRunStatus::Cancelled,
                percent,
                Some("Content sync cancelled.".to_string()),
                processed,
            );
            return ItemExecutionResult::Cancelled;
        }

        let full_music_res = tauri::async_runtime::block_on(
            crate::legacy_fetch::fetcher::fetch_music_detail(api_lang, music_stub.id_music),
        );
        let music = merge_music_track_fallback(full_music_res.unwrap_or_else(|error| {
            eprintln!(
                "[sync] Album {}: fetch_music_detail failed for song id={}: {} — using stub",
                api_id, music_stub.id_music, error
            );
            music_stub.clone()
        }), music_stub.track);

        emit_progress(
            app,
            run_id,
            "downloading",
            ContentSyncRunStatus::Running,
            percent,
            Some(format!(
                "Syncing album song {} ({}/{})",
                music.name,
                index + 1,
                all_musics.len()
            )),
            processed,
        );

        let media = crate::content_sync::importer::DownloadedMusicMedia {
            audio_path: download_asset_via_ftp(
                ftp_stream,
                &music.url_music,
                "audio",
                music.id_music,
                &app_data_dir,
            ),
            playback_path: download_asset_via_ftp(
                ftp_stream,
                &music.url_instrumental_music,
                "playback",
                music.id_music,
                &app_data_dir,
            ),
            cover_path: download_asset_via_ftp(
                ftp_stream,
                &music.url_image,
                "images",
                music.id_music,
                &app_data_dir,
            ),
        };

        if crate::content_sync::importer::import_music_and_link_to_collection(
            &conn,
            collection_id,
            &music,
            &media,
            replace_existing,
            Some(&album_name),
            Some("album"),
            (index as i64) + 1,
        )
        .is_ok()
        {
            success_count += 1;
        }
    }

    if success_count > 0 || all_musics.is_empty() {
        ItemExecutionResult::Applied
    } else {
        ItemExecutionResult::Failed
    }
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

fn finish_run_without_plan(
    app: &AppHandle,
    run_id: &str,
    status: ContentSyncRunStatus,
    message: Option<String>,
) {
    if let Some(state) = app.try_state::<AppState>() {
        let (conn, err) = catcher(state.db.get());
        if err.is_some() {
            return;
        }
        let conn = conn.unwrap();

        let report_result = content_sync::finalize_runtime_run_without_plan(
            &conn,
            run_id,
            status.clone(),
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

fn replace_progress(app: &AppHandle, progress: ContentSyncProgress) {
    if let Some(state) = app.try_state::<AppState>() {
        let (runtime_state, err) = catcher(state.content_sync.lock());
        if err.is_some() {
            return;
        }
        let mut runtime_state = runtime_state.unwrap();

        if let Some(updated) = content_sync::replace_runtime_progress(&mut runtime_state, progress)
        {
            let _ = app.emit("content-sync-progress", &updated);
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

fn persist_missing_hymn_asset_sentinels(
    conn: &rusqlite::Connection,
    hymn_id: i64,
    missing_audio: bool,
    missing_playback: bool,
    missing_cover: bool,
) {
    if missing_audio {
        save_hymn_path(conn, hymn_id, "audio", "_na_");
    }
    if missing_playback {
        save_hymn_path(conn, hymn_id, "playback", "_na_");
    }
    if missing_cover {
        save_hymn_path(conn, hymn_id, "cover", "_na_");
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
        return Some(content_sync::derive_local_media_path(
            remote_path,
            &entry.subfolder,
            entry.api_id,
        ));
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
/// Uses the HTTP-importer local layout: `media/{subfolder}/{api_id}/{filename}`.
/// Returns `None` if the remote path is absent or the download fails.
fn download_remote_asset_via_ftp(
    ftp_stream: &mut Option<FtpStream>,
    remote_path: Option<&str>,
    subfolder: &str,
    api_id: i64,
    app_data_dir: &std::path::Path,
) -> Option<String> {
    let remote_path = remote_path?;
    if remote_path.is_empty() {
        return None;
    }
    let rel_path = content_sync::derive_local_media_path(remote_path, subfolder, api_id);
    let full_path = app_data_dir.join(&rel_path);
    if full_path.exists() {
        return Some(rel_path);
    }
    let stream_result = ftp_stream
        .as_mut()
        .map(|stream| ftp_sync::client::sync_file_on_stream(stream, &remote_path, &full_path));
    match stream_result {
        Some(Ok(())) => return Some(rel_path),
        Some(Err(e)) => {
            eprintln!(
                "[sync] FTP download failed for '{}' -> '{}': {}",
                remote_path,
                full_path.display(),
                e
            );
            *ftp_stream = None;
        }
        None => {}
    }
    None
}

/// Download a single asset file via the already-open FTP stream.
/// Derives the FTP remote path from the API URL and stores the file using the
/// same local layout as the HTTP importer.
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
    let remote_path = content_sync::resolve_remote_path_from_url(url);
    download_remote_asset_via_ftp(
        ftp_stream,
        Some(remote_path.as_str()),
        subfolder,
        api_id,
        app_data_dir,
    )
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

/// Fetch all pages of the hymnal list for a given language.
async fn fetch_all_hymnal_pages(
    lang: crate::legacy_fetch::ApiLanguage,
) -> Result<Vec<crate::legacy_fetch::ApiMusic>, AppError> {
    let mut all = Vec::new();
    let mut page = 1i64;
    loop {
        let resp = crate::legacy_fetch::fetcher::fetch_hymnal_page(lang, page).await?;
        let is_last = resp.data.is_empty()
            || resp.last_page.map_or(true, |lp| page >= lp);
        all.extend(resp.data);
        if is_last {
            break;
        }
        page += 1;
    }
    Ok(all)
}

/// Fetch all pages of the album list for a given language.
async fn fetch_all_album_pages(
    lang: crate::legacy_fetch::ApiLanguage,
) -> Result<Vec<crate::legacy_fetch::ApiAlbum>, AppError> {
    let mut all = Vec::new();
    let mut page = 1i64;
    loop {
        let resp = crate::legacy_fetch::fetcher::fetch_albums_page(lang, page).await?;
        let is_last = resp.data.is_empty()
            || resp.last_page.map_or(true, |lp| page >= lp);
        all.extend(resp.data);
        if is_last {
            break;
        }
        page += 1;
    }
    Ok(all)
}

/// Convert an ApiMusic (from hymnal list) to ContentSyncRemoteEntityInput.
fn api_music_to_entity_input(music: &crate::legacy_fetch::ApiMusic) -> ContentSyncRemoteEntityInput {
    ContentSyncRemoteEntityInput {
        entity_type: "hymn".to_string(),
        remote_id: music.id_music,
        local_id: None,
        remote_version: music.track,
        content_hash: None,
        lyrics_hash: None,
        image_version: music.url_image.clone(),
        audio_version: music.url_music.clone(),
        playback_version: music.url_instrumental_music.clone(),
        updated_at: None,
        deleted: false,
        label: Some(music.name.clone()),
    }
}

/// Convert an ApiAlbum to ContentSyncRemoteEntityInput.
fn api_album_to_entity_input(album: &crate::legacy_fetch::ApiAlbum) -> ContentSyncRemoteEntityInput {
    ContentSyncRemoteEntityInput {
        entity_type: "album".to_string(),
        remote_id: album.id_album,
        local_id: None,
        remote_version: album.order,
        content_hash: None,
        lyrics_hash: None,
        image_version: album.url_image.clone(),
        audio_version: None,
        playback_version: None,
        updated_at: None,
        deleted: false,
        label: Some(album.name.clone()),
    }
}

#[cfg(test)]
mod tests {
    use crate::content_sync::resolve_remote_path_from_url;
    use crate::legacy_fetch::ApiMusic;
    use super::merge_music_track_fallback;

    fn make_api_music(id: i64, name: &str, track: Option<i64>) -> ApiMusic {
        ApiMusic {
            id_music: id,
            name: name.to_string(),
            track,
            id_file_image: None,
            id_file_music: None,
            id_file_instrumental_music: None,
            url_image: None,
            url_music: None,
            url_instrumental_music: None,
            id_language: None,
            lyrics: vec![],
        }
    }

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
    fn resolve_remote_path_decodes_encoded_image_url() {
        let url =
            "https://api.louvorja.com.br/file/images/covers/Hino%2067%20%C3%81rvore.jpg";
        assert_eq!(
            resolve_remote_path_from_url(url),
            "config/imagens/covers/Hino 67 Árvore.jpg"
        );
    }

    #[test]
    fn resolve_remote_path_decodes_encoded_music_url() {
        let url =
            "https://api.louvorja.com.br/file/musics/pt/hinario/Hino%2067%20%C3%81rvore.mp3";
        assert_eq!(
            resolve_remote_path_from_url(url),
            "config/musicas/hinario/Hino 67 Árvore.mp3"
        );
    }

    #[test]
    fn resolve_remote_path_returns_input_unchanged_for_unknown_url() {
        let url = "https://example.com/unknown/path.mp3";
        assert_eq!(resolve_remote_path_from_url(url), url);
    }

    #[test]
    fn merge_music_track_fallback_keeps_track_from_stub_when_detail_is_missing_it() {
        let detail_music = make_api_music(42, "Test Hymn", None);

        let merged = merge_music_track_fallback(detail_music, Some(18));

        assert_eq!(merged.track, Some(18));
    }

    #[test]
    fn merge_music_track_fallback_preserves_detail_track_when_present() {
        let detail_music = make_api_music(42, "Test Hymn", Some(7));

        let merged = merge_music_track_fallback(detail_music, Some(18));

        assert_eq!(merged.track, Some(7));
    }
}
