use crate::error::AppError;
use crate::legacy_fetch::{
    fetcher, importer, new_run_id, LegacyFetchError, LegacyFetchOptions,
    LegacyFetchProgress, LegacyFetchReport, LegacyFetchRunState, LegacyFetchStatus,
};
use crate::state::AppState;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

/// Event payload for legacy fetch progress
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchProgressEvent {
    pub run_id: String,
    pub step: String,
    pub status: LegacyFetchStatus,
    pub percent: f64,
    pub message: Option<String>,
    pub items_total: u64,
    pub items_processed: u64,
}

impl From<&LegacyFetchProgress> for LegacyFetchProgressEvent {
    fn from(p: &LegacyFetchProgress) -> Self {
        Self {
            run_id: p.run_id.clone(),
            step: p.step.clone(),
            status: p.status.clone(),
            percent: p.percent,
            message: p.message.clone(),
            items_total: p.items_total,
            items_processed: p.items_processed,
        }
    }
}

/// Start a legacy fetch operation
#[tauri::command]
pub fn start_legacy_fetch(
    options: LegacyFetchOptions,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    // Check if another fetch is already running
    {
        let fetch_state = state
            .legacy_fetch
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if let Some(active_run_id) = fetch_state.active_run_id.as_deref() {
            if let Some(active_run) = fetch_state.runs.get(active_run_id) {
                if matches!(
                    active_run.progress.status,
                    LegacyFetchStatus::Pending
                        | LegacyFetchStatus::Fetching
                        | LegacyFetchStatus::Importing
                        | LegacyFetchStatus::Downloading
                ) {
                    return Err(AppError::Internal(
                        "Another legacy fetch is already running.".to_string(),
                    ));
                }
            }
        }
    }

    let run_id = new_run_id();
    let cancel_flag = Arc::new(AtomicBool::new(false));

    let initial_progress = LegacyFetchProgress {
        run_id: run_id.clone(),
        step: "connecting".to_string(),
        status: LegacyFetchStatus::Pending,
        percent: 0.0,
        message: Some("Connecting to LouvorJA server...".to_string()),
        items_total: 0,
        items_processed: 0,
    };

    {
        let mut fetch_state = state
            .legacy_fetch
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        fetch_state.active_run_id = Some(run_id.clone());
        fetch_state.runs.insert(
            run_id.clone(),
            LegacyFetchRunState {
                progress: initial_progress.clone(),
                report: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    // Emit initial progress
    let _ = app.emit(
        "legacy-fetch-progress",
        LegacyFetchProgressEvent::from(&initial_progress),
    );

    // Spawn background thread for the async fetch operation
    let run_id_clone = run_id.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        rt.block_on(run_legacy_fetch_background(
            app,
            run_id_clone,
            options,
            cancel_flag,
        ));
    });

    Ok(run_id)
}

/// Get the current progress of a legacy fetch operation
#[tauri::command]
pub fn get_legacy_fetch_progress(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<LegacyFetchProgress, AppError> {
    let fetch_state = state
        .legacy_fetch
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let run = fetch_state.runs.get(&run_id).ok_or_else(|| {
        AppError::NotFound(format!("Legacy fetch run '{}' was not found.", run_id))
    })?;

    Ok(run.progress.clone())
}

/// Cancel a running legacy fetch operation
#[tauri::command]
pub fn cancel_legacy_fetch(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let fetch_state = state
        .legacy_fetch
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let run = fetch_state.runs.get(&run_id).ok_or_else(|| {
        AppError::NotFound(format!("Legacy fetch run '{}' was not found.", run_id))
    })?;

    run.cancel_flag.store(true, Ordering::SeqCst);
    Ok(())
}

/// Get the final report of a completed legacy fetch operation
#[tauri::command]
pub fn get_legacy_fetch_report(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<LegacyFetchReport>, AppError> {
    let fetch_state = state
        .legacy_fetch
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let run = fetch_state.runs.get(&run_id).ok_or_else(|| {
        AppError::NotFound(format!("Legacy fetch run '{}' was not found.", run_id))
    })?;

    Ok(run.report.clone())
}

/// Fetch params from the API (for checking connectivity)
#[tauri::command]
pub async fn fetch_legacy_params() -> Result<crate::legacy_fetch::ApiParams, AppError> {
    fetcher::fetch_params().await
}

/// Background async function that runs the fetch operation
async fn run_legacy_fetch_background(
    app: AppHandle,
    run_id: String,
    options: LegacyFetchOptions,
    cancel_flag: Arc<AtomicBool>,
) {
    let started = Instant::now();
    let mut errors: Vec<LegacyFetchError> = Vec::new();
    let mut hymns_fetched = 0u64;
    let mut hymns_imported = 0u64;
    let mut hymns_skipped = 0u64;
    let albums_fetched = 0u64;

    // Helper to update progress
    let update_progress = |step: &str,
                           status: LegacyFetchStatus,
                           percent: f64,
                           message: &str,
                           items_total: u64,
                           items_processed: u64| {
        let progress = LegacyFetchProgress {
            run_id: run_id.clone(),
            step: step.to_string(),
            status: status.clone(),
            percent,
            message: Some(message.to_string()),
            items_total,
            items_processed,
        };

        // Update state
        if let Some(state) = app.try_state::<AppState>() {
            if let Ok(mut fetch_state) = state.legacy_fetch.lock() {
                if let Some(run) = fetch_state.runs.get_mut(&run_id) {
                    run.progress = progress.clone();
                }
            }
        }

        // Emit event
        let _ = app.emit(
            "legacy-fetch-progress",
            LegacyFetchProgressEvent::from(&progress),
        );
    };

    // Check cancellation
    let check_cancelled = || cancel_flag.load(Ordering::SeqCst);

    // Step 1: Fetch hymns from API
    update_progress(
        "fetching",
        LegacyFetchStatus::Fetching,
        10.0,
        "Fetching hymns from LouvorJA server...",
        0,
        0,
    );

    if check_cancelled() {
        finalize_fetch(
            &app,
            &run_id,
            LegacyFetchStatus::Cancelled,
            errors,
            hymns_fetched,
            hymns_imported,
            hymns_skipped,
            albums_fetched,
            0,
            0,
            started,
        );
        return;
    }

    // Fetch hymnal or all musics based on option
    let musics_result = if options.include_hymnal {
        fetcher::fetch_hymnal(options.language).await
    } else {
        fetcher::fetch_musics(options.language).await
    };

    let musics = match musics_result {
        Ok(m) => m,
        Err(e) => {
            errors.push(LegacyFetchError {
                item_type: "fetch".to_string(),
                item_id: None,
                message: e.to_string(),
            });
            finalize_fetch(
                &app,
                &run_id,
                LegacyFetchStatus::Failed,
                errors,
                0,
                0,
                0,
                0,
                0,
                0,
                started,
            );
            return;
        }
    };

    // Check if no content is available for the selected language
    if musics.is_empty() {
        errors.push(LegacyFetchError {
            item_type: "fetch".to_string(),
            item_id: None,
            message: format!("NO_CONTENT_AVAILABLE:{}", options.language.as_str()),
        });
        finalize_fetch(
            &app,
            &run_id,
            LegacyFetchStatus::Failed,
            errors,
            0,
            0,
            0,
            0,
            0,
            0,
            started,
        );
        return;
    }

    hymns_fetched = musics.len() as u64;

    update_progress(
        "fetching",
        LegacyFetchStatus::Fetching,
        30.0,
        &format!("Fetched {} hymns from server", hymns_fetched),
        hymns_fetched,
        0,
    );

    if check_cancelled() {
        finalize_fetch(
            &app,
            &run_id,
            LegacyFetchStatus::Cancelled,
            errors,
            hymns_fetched,
            hymns_imported,
            hymns_skipped,
            albums_fetched,
            0,
            0,
            started,
        );
        return;
    }

    // Get media directory for file downloads
    let media_dir: PathBuf = match app.path().app_data_dir() {
        Ok(dir) => dir.join("media"),
        Err(e) => {
            errors.push(LegacyFetchError {
                item_type: "setup".to_string(),
                item_id: None,
                message: format!("Could not get app data directory: {}", e),
            });
            finalize_fetch(
                &app,
                &run_id,
                LegacyFetchStatus::Failed,
                errors,
                hymns_fetched,
                0,
                0,
                0,
                0,
                0,
                started,
            );
            return;
        }
    };

    // Create media directory if needed
    if let Err(e) = std::fs::create_dir_all(&media_dir) {
        errors.push(LegacyFetchError {
            item_type: "setup".to_string(),
            item_id: None,
            message: format!("Could not create media directory: {}", e),
        });
        finalize_fetch(
            &app,
            &run_id,
            LegacyFetchStatus::Failed,
            errors,
            hymns_fetched,
            0,
            0,
            0,
            0,
            0,
            started,
        );
        return;
    }

    // Step 2: Import into local database with file downloads
    update_progress(
        "importing",
        LegacyFetchStatus::Importing,
        40.0,
        "Importing hymns and downloading media files...",
        hymns_fetched,
        0,
    );

    // Get app state for database access
    let state = match app.try_state::<AppState>() {
        Some(s) => s,
        None => {
            errors.push(LegacyFetchError {
                item_type: "import".to_string(),
                item_id: None,
                message: "Could not access application state".to_string(),
            });
            finalize_fetch(
                &app,
                &run_id,
                LegacyFetchStatus::Failed,
                errors,
                hymns_fetched,
                0,
                0,
                0,
                0,
                0,
                started,
            );
            return;
        }
    };

    // Import musics with file downloads
    let total = musics.len();
    let mut audio_downloaded = 0u64;
    let mut images_downloaded = 0u64;

    for (i, music) in musics.iter().enumerate() {
        if check_cancelled() {
            finalize_fetch(
                &app,
                &run_id,
                LegacyFetchStatus::Cancelled,
                errors,
                hymns_fetched,
                hymns_imported,
                hymns_skipped,
                albums_fetched,
                audio_downloaded,
                images_downloaded,
                started,
            );
            return;
        }

        // Step 1: Fetch detailed music info with lyrics
        let music_with_lyrics = match fetcher::fetch_music_detail(options.language, music.id_music).await {
            Ok(mut detailed) => {
                // Preserve track number from hymnal list (detail endpoint may not include it)
                if detailed.track.is_none() && music.track.is_some() {
                    detailed.track = music.track;
                }
                detailed
            }
            Err(e) => {
                log::warn!("Failed to fetch lyrics for '{}': {}", music.name, e);
                // Fall back to music without lyrics
                music.clone()
            }
        };

        // Step 2: Download media files (async, outside db lock)
        let audio_path = if options.download_audio {
            importer::download_media_file(
                music_with_lyrics.url_music.as_ref(),
                &media_dir,
                "audio",
                music_with_lyrics.id_music,
                "mp3",
            ).await
        } else {
            None
        };

        // Download playback/instrumental version
        let playback_path = if options.download_audio {
            importer::download_media_file(
                music_with_lyrics.url_instrumental_music.as_ref(),
                &media_dir,
                "playback",
                music_with_lyrics.id_music,
                "mp3",
            ).await
        } else {
            None
        };

        let cover_path = if options.download_images {
            importer::download_media_file(
                music_with_lyrics.url_image.as_ref(),
                &media_dir,
                "images",
                music_with_lyrics.id_music,
                "jpg",
            ).await
        } else {
            None
        };

        if audio_path.is_some() { audio_downloaded += 1; }
        if playback_path.is_some() { audio_downloaded += 1; }
        if cover_path.is_some() { images_downloaded += 1; }

        // Step 3: Insert/update in database (with db lock)
        let db_result = {
            let db_guard = match state.db.lock() {
                Ok(g) => g,
                Err(e) => {
                    errors.push(LegacyFetchError {
                        item_type: "import".to_string(),
                        item_id: None,
                        message: format!("Could not lock database: {}", e),
                    });
                    continue;
                }
            };

            importer::import_music_to_db(
                &db_guard,
                &music_with_lyrics,
                audio_path.as_deref(),
                playback_path.as_deref(),
                cover_path.as_deref(),
                options.replace_existing,
            )
        };

        match db_result {
            Ok(true) => hymns_imported += 1,
            Ok(false) => hymns_skipped += 1,
            Err(e) => {
                log::warn!("Failed to import hymn '{}': {}", music_with_lyrics.name, e);
                errors.push(LegacyFetchError {
                    item_type: "hymn".to_string(),
                    item_id: Some(music_with_lyrics.id_music.to_string()),
                    message: e.to_string(),
                });
                hymns_skipped += 1;
            }
        }

        // Update progress every 10 items or at the end
        if (i + 1) % 10 == 0 || i + 1 == total {
            let percent = 40.0 + (50.0 * (i + 1) as f64 / total as f64);
            update_progress(
                "importing",
                LegacyFetchStatus::Importing,
                percent,
                &format!("Importing hymn {} of {} - {}", i + 1, total, music_with_lyrics.name),
                hymns_fetched,
                (i + 1) as u64,
            );
        }
    }

    // Finalize
    finalize_fetch(
        &app,
        &run_id,
        LegacyFetchStatus::Completed,
        errors,
        hymns_fetched,
        hymns_imported,
        hymns_skipped,
        albums_fetched,
        audio_downloaded,
        images_downloaded,
        started,
    );
}

fn finalize_fetch(
    app: &AppHandle,
    run_id: &str,
    status: LegacyFetchStatus,
    errors: Vec<LegacyFetchError>,
    hymns_fetched: u64,
    hymns_imported: u64,
    hymns_skipped: u64,
    albums_fetched: u64,
    audio_downloaded: u64,
    images_downloaded: u64,
    started: Instant,
) {
    let duration_ms = started.elapsed().as_millis() as u64;
    let report = LegacyFetchReport {
        run_id: run_id.to_string(),
        hymns_fetched,
        hymns_imported,
        hymns_skipped,
        albums_fetched,
        audio_downloaded,
        images_downloaded,
        errors,
        duration_ms,
    };

    let final_message = match status {
        LegacyFetchStatus::Completed => format!(
            "Completed! Imported {} hymns ({} skipped)",
            hymns_imported, hymns_skipped
        ),
        LegacyFetchStatus::Cancelled => "Operation cancelled by user".to_string(),
        LegacyFetchStatus::Failed => "Operation failed".to_string(),
        _ => "Unknown status".to_string(),
    };

    let progress = LegacyFetchProgress {
        run_id: run_id.to_string(),
        step: "done".to_string(),
        status: status.clone(),
        percent: 100.0,
        message: Some(final_message),
        items_total: hymns_fetched,
        items_processed: hymns_imported + hymns_skipped,
    };

    // Update state with final progress and report
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut fetch_state) = state.legacy_fetch.lock() {
            if let Some(run) = fetch_state.runs.get_mut(run_id) {
                run.progress = progress.clone();
                run.report = Some(report.clone());
            }
        }
    }

    // Emit final progress
    let _ = app.emit(
        "legacy-fetch-progress",
        LegacyFetchProgressEvent::from(&progress),
    );

    // Emit report
    let _ = app.emit("legacy-fetch-report", &report);
}
