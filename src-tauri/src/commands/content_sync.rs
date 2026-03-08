use crate::content_sync::{self, ContentSyncRunState};
use crate::db::models::{
    ContentSyncPlan, ContentSyncProgress, ContentSyncReport, ContentSyncRunStatus,
    ContentSyncSummary,
};
use crate::error::AppError;
use crate::state::AppState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
#[specta::specta]
pub fn get_content_sync_summary(
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncSummary, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|error| AppError::Internal(error.to_string()))?;

    content_sync::load_summary(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn plan_content_sync(
    state: tauri::State<'_, AppState>,
) -> Result<ContentSyncPlan, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|error| AppError::Internal(error.to_string()))?;

    let summary = content_sync::load_summary(&conn)?;
    Ok(content_sync::build_degraded_plan(summary))
}

#[tauri::command]
#[specta::specta]
pub fn start_content_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    {
        let runtime_state = state
            .content_sync
            .lock()
            .map_err(|error| AppError::Internal(error.to_string()))?;
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

    let conn = state
        .db
        .get()
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let summary = content_sync::load_summary(&conn)?;
    let plan = content_sync::build_degraded_plan(summary);
    let run_id = content_sync::new_run_id();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let initial_progress = content_sync::initial_progress(&run_id, &plan);
    content_sync::begin_runtime_run(&conn, &run_id, &plan)?;
    drop(conn);

    {
        let mut runtime_state = state
            .content_sync
            .lock()
            .map_err(|error| AppError::Internal(error.to_string()))?;
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
    let runtime_state = state
        .content_sync
        .lock()
        .map_err(|error| AppError::Internal(error.to_string()))?;
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
    let runtime_state = state
        .content_sync
        .lock()
        .map_err(|error| AppError::Internal(error.to_string()))?;
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
    let conn = state
        .db
        .get()
        .map_err(|error| AppError::Internal(error.to_string()))?;

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
        if let Ok(mut runtime_state) = state.content_sync.lock() {
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
    let mut applied_count = 0;
    let mut skipped_count = 0;
    let failed_count = 0;

    let (terminal_status, terminal_message) = if content_sync::plan_requires_full_sync_fallback(&plan)
    {
        skipped_count = total_items as i32;
        emit_progress(
            &app,
            &run_id,
            "fallback",
            ContentSyncRunStatus::Running,
            100.0,
            Some("Selective sync unavailable. Full sync fallback must be used.".to_string()),
            total_items,
        );
        (
            ContentSyncRunStatus::Completed,
            Some("Full sync fallback required.".to_string()),
        )
    } else {
        for (index, item) in plan.items.iter().enumerate() {
            if content_sync::is_run_cancelled(&cancel_flag) {
                let processed = index as u64;
                emit_progress(
                    &app,
                    &run_id,
                    "cancelled",
                    ContentSyncRunStatus::Cancelled,
                    if total_items == 0 {
                        100.0
                    } else {
                        processed as f64 / total_items as f64 * 100.0
                    },
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
                return;
            }

            let processed = (index + 1) as u64;
            emit_progress(
                &app,
                &run_id,
                "executing",
                ContentSyncRunStatus::Running,
                if total_items == 0 {
                    100.0
                } else {
                    processed as f64 / total_items as f64 * 100.0
                },
                item.reason.clone(),
                processed,
            );
            applied_count += 1;
        }

        (
            ContentSyncRunStatus::Completed,
            Some("Content sync runtime completed.".to_string()),
        )
    };

    finish_run(
        &app,
        &run_id,
        &plan,
        terminal_status,
        applied_count,
        skipped_count,
        failed_count,
        terminal_message,
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
        let report_result = state
            .db
            .get()
            .map_err(|error| AppError::Internal(error.to_string()))
            .and_then(|conn| {
                content_sync::finalize_runtime_run(
                    &conn,
                    run_id,
                    plan,
                    status.clone(),
                    applied_count,
                    skipped_count,
                    failed_count,
                    message.clone(),
                )
            });

        if let Ok(report) = report_result {
            if let Ok(mut runtime_state) = state.content_sync.lock() {
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
            }

            let _ = app.emit("content-sync-report", &report);
        }
    }
}
