use crate::db::queries::settings::set_setting;
use crate::error::AppError;
use crate::migration::hymn_importer::import_hymns_domain;
use crate::migration::service_importer::import_services_domain;
use crate::migration::{
    import_bible_domain, import_favorites_domain, import_settings_domain, is_cancellation_error,
    new_run_id, now_iso, open_readonly_source, preflight_source_path, safe_source_label,
    sanitize_error_message, selected_domains, MigrationDomain, MigrationErrorItem,
    MigrationOptions, MigrationProgress, MigrationProgressEvent, MigrationReport, MigrationRunInfo,
    MigrationRunState, CANCELLATION_MESSAGE,
};
use crate::state::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

struct ProgressUpdate<'a> {
    run_id: &'a str,
    step: &'a str,
    completed: u32,
    total: u32,
    status: &'a str,
    message: String,
    started_clock: Instant,
}

struct FinalizeWithErrors<'a> {
    run_id: &'a str,
    source_path: &'a str,
    started_at: &'a str,
    completed: u32,
    total: u32,
    errors: Vec<MigrationErrorItem>,
    domains: Vec<crate::migration::MigrationDomainReport>,
    cancelled: bool,
    started_clock: Instant,
}

#[tauri::command]
pub fn start_migration(
    old_db_path: String,
    options: MigrationOptions,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<MigrationRunInfo, AppError> {
    preflight_source_path(&old_db_path)?;

    let domains = selected_domains(&options);
    if domains.is_empty() {
        return Err(AppError::Internal(
            "At least one migration domain must be enabled.".to_string(),
        ));
    }

    {
        let migration = state
            .migration
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if let Some(active_run_id) = migration.active_run_id.as_deref() {
            if let Some(active_run) = migration.runs.get(active_run_id) {
                if active_run.progress.status == "running" {
                    return Err(AppError::Internal(
                        "Another migration is already running.".to_string(),
                    ));
                }
            }
        }
    }

    let run_id = new_run_id();
    let started_at = now_iso();
    let total_steps = domains.len() as u32;
    let source_path = old_db_path.trim().to_string();
    let initial_progress = MigrationProgress {
        run_id: run_id.clone(),
        step: "queued".to_string(),
        completed: 0,
        total: total_steps,
        percent: 0.0,
        eta_seconds: None,
        message: format!(
            "Queued migration for '{}'.",
            safe_source_label(&source_path)
        ),
        status: "running".to_string(),
        updated_at: now_iso(),
    };

    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut migration = state
            .migration
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        migration.active_run_id = Some(run_id.clone());
        migration.runs.insert(
            run_id.clone(),
            MigrationRunState {
                progress: initial_progress.clone(),
                report: None,
                cancel_flag,
            },
        );
    }

    app.emit(
        "migration-progress",
        MigrationProgressEvent::from(&initial_progress),
    )
    .map_err(|e| AppError::Tauri(e.to_string()))?;

    let run_info = MigrationRunInfo {
        run_id: run_id.clone(),
        started_at: started_at.clone(),
        source_path: source_path.clone(),
    };

    thread::spawn(move || {
        run_migration_background(app, run_id, started_at, source_path, options, domains);
    });

    Ok(run_info)
}

#[tauri::command]
pub fn get_migration_progress(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<MigrationProgress, AppError> {
    let migration = state
        .migration
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let run = migration
        .runs
        .get(&run_id)
        .ok_or_else(|| AppError::NotFound(format!("Migration run '{}' was not found.", run_id)))?;

    Ok(run.progress.clone())
}

#[tauri::command]
pub fn cancel_migration(run_id: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mut migration = state
        .migration
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let run = migration
        .runs
        .get_mut(&run_id)
        .ok_or_else(|| AppError::NotFound(format!("Migration run '{}' was not found.", run_id)))?;

    run.cancel_flag.store(true, Ordering::Relaxed);
    run.progress.message = "Cancellation requested.".to_string();
    run.progress.updated_at = now_iso();
    if run.progress.status == "running" {
        run.progress.status = "cancelling".to_string();
    }

    Ok(())
}

#[tauri::command]
pub fn get_migration_report(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<MigrationReport, AppError> {
    let migration = state
        .migration
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let run = migration
        .runs
        .get(&run_id)
        .ok_or_else(|| AppError::NotFound(format!("Migration run '{}' was not found.", run_id)))?;

    run.report.clone().ok_or_else(|| {
        AppError::NotFound(format!(
            "Migration report for '{}' is not ready yet.",
            run_id
        ))
    })
}

fn run_migration_background(
    app: AppHandle,
    run_id: String,
    started_at: String,
    source_path: String,
    options: MigrationOptions,
    domains: Vec<MigrationDomain>,
) {
    let source_label = safe_source_label(&source_path);
    let started_clock = Instant::now();
    let total_steps = domains.len() as u32;
    let mut completed_steps = 0u32;
    let mut errors: Vec<MigrationErrorItem> = Vec::new();
    let mut domain_reports = Vec::new();
    let mut cancelled = false;

    if let Err(error) = update_progress(
        &app,
        ProgressUpdate {
            run_id: &run_id,
            step: "preflight",
            completed: completed_steps,
            total: total_steps,
            status: "running",
            message: format!("Validating '{}'.", source_label),
            started_clock,
        },
    ) {
        finalize_internal_error(&app, &run_id, &source_path, &started_at, error);
        return;
    }

    let source_conn = match open_readonly_source(&source_path) {
        Ok(conn) => conn,
        Err(error) => {
            finalize_with_errors(
                &app,
                FinalizeWithErrors {
                    run_id: &run_id,
                    source_path: &source_path,
                    started_at: &started_at,
                    completed: completed_steps,
                    total: total_steps,
                    errors: vec![MigrationErrorItem {
                        domain: "preflight".to_string(),
                        code: "SOURCE_OPEN_FAILED".to_string(),
                        message: sanitize_error_message(&error.to_string()),
                        context: None,
                    }],
                    domains: Vec::new(),
                    cancelled: false,
                    started_clock,
                },
            );
            return;
        }
    };

    for domain in domains {
        if is_cancel_requested(&app, &run_id) {
            cancelled = true;
            break;
        }

        if let Err(error) = update_progress(
            &app,
            ProgressUpdate {
                run_id: &run_id,
                step: domain.id(),
                completed: completed_steps,
                total: total_steps,
                status: "running",
                message: domain.label().to_string(),
                started_clock,
            },
        ) {
            finalize_internal_error(&app, &run_id, &source_path, &started_at, error);
            return;
        }

        let result = execute_domain_import(
            &app,
            &run_id,
            &source_conn,
            domain,
            options.replace_existing,
        );

        match result {
            Ok(report) => {
                domain_reports.push(report);
            }
            Err(error) => {
                if is_cancellation_error(&error) || is_cancel_requested(&app, &run_id) {
                    cancelled = true;
                    break;
                }
                errors.push(MigrationErrorItem {
                    domain: domain.id().to_string(),
                    code: "DOMAIN_IMPORT_FAILED".to_string(),
                    message: sanitize_error_message(&error.to_string()),
                    context: None,
                });
            }
        }

        completed_steps = completed_steps.saturating_add(1);
    }

    if cancelled {
        errors.push(MigrationErrorItem {
            domain: "migration".to_string(),
            code: "CANCELLED".to_string(),
            message: CANCELLATION_MESSAGE.to_string(),
            context: None,
        });
    }

    finalize_with_errors(
        &app,
        FinalizeWithErrors {
            run_id: &run_id,
            source_path: &source_path,
            started_at: &started_at,
            completed: completed_steps,
            total: total_steps,
            errors,
            domains: domain_reports,
            cancelled,
            started_clock,
        },
    );
}

fn execute_domain_import(
    app: &AppHandle,
    run_id: &str,
    source_conn: &rusqlite::Connection,
    domain: MigrationDomain,
    replace_existing: bool,
) -> Result<crate::migration::MigrationDomainReport, AppError> {
    let cancel_flag = get_cancel_flag(app, run_id)?;
    let app_state = app.state::<AppState>();
    let mut target_conn = app_state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    match domain {
        MigrationDomain::Hymns => import_hymns_domain(
            source_conn,
            &mut target_conn,
            replace_existing,
            cancel_flag.as_ref(),
        ),
        MigrationDomain::Bible => import_bible_domain(
            source_conn,
            &mut target_conn,
            replace_existing,
            cancel_flag.as_ref(),
        ),
        MigrationDomain::Favorites => import_favorites_domain(
            source_conn,
            &mut target_conn,
            replace_existing,
            cancel_flag.as_ref(),
        ),
        MigrationDomain::Services => import_services_domain(
            source_conn,
            &mut target_conn,
            replace_existing,
            cancel_flag.as_ref(),
        ),
        MigrationDomain::Settings => import_settings_domain(
            source_conn,
            &mut target_conn,
            replace_existing,
            cancel_flag.as_ref(),
        ),
    }
}

fn update_progress(app: &AppHandle, update: ProgressUpdate<'_>) -> Result<(), AppError> {
    let percent = if update.total == 0 {
        100.0
    } else {
        ((update.completed as f64 / update.total as f64) * 100.0 * 10.0).round() / 10.0
    };

    let eta_seconds = if update.completed == 0 || update.completed >= update.total {
        None
    } else {
        let elapsed = update.started_clock.elapsed().as_secs_f64();
        if elapsed <= 0.0 {
            None
        } else {
            let per_step = elapsed / update.completed as f64;
            let remaining_steps = (update.total - update.completed) as f64;
            Some((per_step * remaining_steps).round() as u64)
        }
    };

    let progress = MigrationProgress {
        run_id: update.run_id.to_string(),
        step: update.step.to_string(),
        completed: update.completed,
        total: update.total,
        percent,
        eta_seconds,
        message: update.message,
        status: update.status.to_string(),
        updated_at: now_iso(),
    };

    {
        let app_state = app.state::<AppState>();
        let mut migration = app_state
            .migration
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let run = migration.runs.get_mut(update.run_id).ok_or_else(|| {
            AppError::NotFound(format!("Migration run '{}' was not found.", update.run_id))
        })?;
        run.progress = progress.clone();
    }

    app.emit(
        "migration-progress",
        MigrationProgressEvent::from(&progress),
    )
    .map_err(|e| AppError::Tauri(e.to_string()))
}

fn finalize_with_errors(app: &AppHandle, summary: FinalizeWithErrors<'_>) {
    let status = if summary.cancelled {
        "cancelled"
    } else if summary.errors.is_empty() {
        "completed"
    } else {
        "failed"
    };

    let report = MigrationReport {
        run_id: summary.run_id.to_string(),
        status: status.to_string(),
        started_at: summary.started_at.to_string(),
        finished_at: Some(now_iso()),
        source_path: summary.source_path.to_string(),
        domains: summary.domains,
        errors: summary.errors,
    };

    let message = if status == "completed" {
        "Migration completed successfully.".to_string()
    } else if status == "cancelled" {
        "Migration cancelled.".to_string()
    } else {
        "Migration finished with errors.".to_string()
    };

    let final_completed = if status == "completed" {
        summary.total
    } else {
        summary.completed
    };

    let _ = update_progress(
        app,
        ProgressUpdate {
            run_id: summary.run_id,
            step: "finalize",
            completed: final_completed,
            total: summary.total,
            status,
            message,
            started_clock: summary.started_clock,
        },
    );

    {
        let app_state = app.state::<AppState>();
        let maybe_guard = app_state.migration.lock();
        if let Ok(mut migration) = maybe_guard {
            if let Some(run) = migration.runs.get_mut(summary.run_id) {
                run.report = Some(report.clone());
                run.progress.status = status.to_string();
                run.progress.updated_at = now_iso();
            }
            if migration.active_run_id.as_deref() == Some(summary.run_id) {
                migration.active_run_id = None;
            }
        }
    }

    persist_migration_metadata(app, summary.source_path, status, &report);
}

fn finalize_internal_error(
    app: &AppHandle,
    run_id: &str,
    source_path: &str,
    started_at: &str,
    error: AppError,
) {
    finalize_with_errors(
        app,
        FinalizeWithErrors {
            run_id,
            source_path,
            started_at,
            completed: 0,
            total: 1,
            errors: vec![MigrationErrorItem {
                domain: "migration".to_string(),
                code: "INTERNAL_ERROR".to_string(),
                message: sanitize_error_message(&error.to_string()),
                context: None,
            }],
            domains: Vec::new(),
            cancelled: false,
            started_clock: Instant::now(),
        },
    );
}

fn persist_migration_metadata(
    app: &AppHandle,
    source_path: &str,
    status: &str,
    report: &MigrationReport,
) {
    let report_json = serde_json::to_string(report).unwrap_or_else(|_| "{}".to_string());
    let report_json = truncate(&report_json, 48_000);
    let finished_at = report.finished_at.clone().unwrap_or_else(now_iso);

    let app_state = app.state::<AppState>();
    let maybe_conn = app_state.db.lock();
    if let Ok(conn) = maybe_conn {
        let _ = set_setting(&conn, "migration.lastSourcePath", source_path);
        let _ = set_setting(&conn, "migration.lastRunStatus", status);
        let _ = set_setting(&conn, "migration.lastRunAt", &finished_at);
        let _ = set_setting(&conn, "migration.lastReport", &report_json);
    }
}

fn get_cancel_flag(app: &AppHandle, run_id: &str) -> Result<Arc<AtomicBool>, AppError> {
    let app_state = app.state::<AppState>();
    let migration = app_state
        .migration
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let run = migration
        .runs
        .get(run_id)
        .ok_or_else(|| AppError::NotFound(format!("Migration run '{}' was not found.", run_id)))?;
    Ok(Arc::clone(&run.cancel_flag))
}

fn is_cancel_requested(app: &AppHandle, run_id: &str) -> bool {
    get_cancel_flag(app, run_id)
        .map(|flag| flag.load(Ordering::Relaxed))
        .unwrap_or(false)
}

fn truncate(value: &str, max_len: usize) -> String {
    if value.len() <= max_len {
        return value.to_string();
    }

    let mut output = value[..max_len].to_string();
    output.push_str("...");
    output
}
