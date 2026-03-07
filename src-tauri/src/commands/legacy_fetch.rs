//! Legacy fetch commands module
//!
//! This module contains Tauri commands and IPC handlers for the legacy fetcher.
//! It manages the separation between the IPC thread (returning immediately) and the
//! background execution thread (running Tokio tasks).
//! 
//! # Side Effects
//!
//! Interacts with `AppState` to store run status and emits progress events to the frontend.

use crate::error::AppError;
use crate::legacy_fetch::{
    fetcher, importer, new_run_id, LegacyFetchError, LegacyFetchOptions,
    LegacyFetchProgress, LegacyFetchReport, LegacyFetchRunState, LegacyFetchStatus, LegacyFetchSubTask,
};
use crate::state::AppState;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

/// Event payload for legacy fetch progress
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFetchProgressEvent {
    pub run_id: String,
    pub step: String,
    pub status: LegacyFetchStatus,
    pub percent: f64,
    pub message: Option<String>,
    pub items_total: u64,
    pub items_processed: u64,
    pub sub_tasks: Vec<LegacyFetchSubTask>,
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
            sub_tasks: p.sub_tasks.clone(),
        }
    }
}

/// Start a legacy fetch operation
///
/// # Errors
/// Returns an error if it fails to acquire a lock on `AppState` to store the run status.
#[tauri::command]
#[specta::specta]
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
        sub_tasks: Vec::new(),
    };

    {
        let mut fetch_state = state
            .legacy_fetch
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // Prune completed/cancelled/failed runs
        fetch_state.runs.retain(|_, run| {
            matches!(
                run.progress.status,
                LegacyFetchStatus::Pending
                    | LegacyFetchStatus::Fetching
                    | LegacyFetchStatus::Importing
                    | LegacyFetchStatus::Downloading
            )
        });

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

    // Spawn background thread
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

/// Get current progress
///
/// # Errors
/// Returns an error if the `run_id` is not found or if the state lock fails.
#[tauri::command]
#[specta::specta]
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

/// Cancel a running operation
///
/// # Errors
/// Returns an error if the `run_id` is not found or if the state lock fails.
#[tauri::command]
#[specta::specta]
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

/// Get the final report
///
/// # Errors
/// Returns an error if the state lock fails.
#[tauri::command]
#[specta::specta]
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

/// Fetch params from the API
#[tauri::command]
#[specta::specta]
pub async fn fetch_legacy_params() -> Result<crate::legacy_fetch::ApiParams, AppError> {
    fetcher::fetch_params().await
}

/// Check if the API has a newer db_version than what we have stored locally.
/// Returns `{ has_new_version: bool, new_version: Option<i64> }`.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DbVersionCheckResult {
    pub has_new_version: bool,
    pub new_version: Option<i64>,
}

#[tauri::command]
#[specta::specta]
pub async fn check_db_version(
    state: tauri::State<'_, AppState>,
) -> Result<DbVersionCheckResult, AppError> {
    let params = fetcher::fetch_params().await?;
    let api_version = match params.db_version {
        Some(v) => v,
        None => return Ok(DbVersionCheckResult { has_new_version: false, new_version: None }),
    };

    let stored_version: Option<i64> = {
        let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
        crate::db::queries::settings::get_setting(&conn, "api.dbVersion")
            .ok()
            .and_then(|s| s.value.parse::<i64>().ok())
    };

    let has_new_version = match stored_version {
        Some(local) => api_version > local,
        None => false, // first time — no stored version means data hasn't been downloaded yet
    };

    Ok(DbVersionCheckResult { has_new_version, new_version: Some(api_version) })
}

fn update_sub_task(
    app: &AppHandle, 
    run_id: &str, 
    id: &str, 
    title: &str, 
    percent: f64, 
    status: &str, 
    processed_count: u64,
    total_items: u64,
) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut fetch_state) = state.legacy_fetch.lock() {
            if let Some(run) = fetch_state.runs.get_mut(run_id) {
                if let Some(st) = run.progress.sub_tasks.iter_mut().find(|s| s.id == id) {
                    st.title = title.to_string();
                    st.percent = percent;
                    st.status = status.to_string();
                } else {
                    run.progress.sub_tasks.push(LegacyFetchSubTask {
                        id: id.to_string(),
                        title: title.to_string(),
                        percent,
                        status: status.to_string(),
                    });
                }
                
                run.progress.items_total = total_items;
                run.progress.items_processed = processed_count;
                
                if total_items > 0 {
                    let ratio = processed_count as f64 / total_items as f64;
                    run.progress.percent = 10.0 + (90.0 * ratio.min(1.0));
                }

                let _ = app.emit("legacy-fetch-progress", LegacyFetchProgressEvent::from(&run.progress));
            }
        }
    }
}

fn update_global_progress(
    app: &AppHandle,
    run_id: &str,
    step: &str,
    status: LegacyFetchStatus,
    percent: f64,
    message: &str,
    items_total: u64,
    items_processed: u64,
) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut fetch_state) = state.legacy_fetch.lock() {
            if let Some(run) = fetch_state.runs.get_mut(run_id) {
                run.progress.step = step.to_string();
                run.progress.status = status;
                run.progress.percent = percent;
                run.progress.message = Some(message.to_string());
                run.progress.items_total = items_total;
                run.progress.items_processed = items_processed;
                
                let _ = app.emit("legacy-fetch-progress", LegacyFetchProgressEvent::from(&run.progress));
            }
        }
    }
}

fn extract_year_from_url(url: &str) -> Option<i32> {
    let filename = url.split('/').last()?.split('.').next()?;
    if filename.len() == 4 && filename.chars().all(|c| c.is_ascii_digit()) {
        filename.parse::<i32>().ok()
    } else {
        None
    }
}

async fn run_legacy_fetch_background(
    app: AppHandle,
    run_id: String,
    options: LegacyFetchOptions,
    cancel_flag: Arc<AtomicBool>,
) {
    let started = Instant::now();
    let total_hymns = Arc::new(AtomicU64::new(0));
    let total_albums = Arc::new(AtomicU64::new(0));
    let total_album_songs = Arc::new(AtomicU64::new(0));
    
    let hymns_imported = Arc::new(AtomicU64::new(0));
    let hymns_skipped = Arc::new(AtomicU64::new(0));
    let albums_created = Arc::new(AtomicU64::new(0));
    let collection_hymns_linked = Arc::new(AtomicU64::new(0));
    let audio_downloaded = Arc::new(AtomicU64::new(0));
    let images_downloaded = Arc::new(AtomicU64::new(0));
    let processed_count = Arc::new(AtomicU64::new(0));
    
    let errors = Arc::new(std::sync::Mutex::new(Vec::<LegacyFetchError>::new()));
    let api_semaphore = Arc::new(tokio::sync::Semaphore::new(10));
    let db_semaphore = Arc::new(tokio::sync::Semaphore::new(1));

    // Check cancellation
    let check_cancelled = || cancel_flag.load(Ordering::SeqCst);

    let fetching_msg = match options.language {
        crate::legacy_fetch::ApiLanguage::Pt => "Buscando metadados...",
        crate::legacy_fetch::ApiLanguage::Es => "Buscando metadatos...",
        crate::legacy_fetch::ApiLanguage::En => "Fetching metadata...",
    };

    update_global_progress(&app, &run_id, "fetching", LegacyFetchStatus::Fetching, 10.0, fetching_msg, 0, 0);

    let media_dir: PathBuf = match app.path().app_data_dir() {
        Ok(dir) => dir.join("media"),
        Err(_) => return,
    };
    let _ = std::fs::create_dir_all(&media_dir);

    // Fetch params to get db_version and persist it on successful completion
    let api_db_version: Option<i64> = fetcher::fetch_params().await.ok().and_then(|p| p.db_version);

    // --- Task 1: Hymnal ---
    let app_h = app.clone();
    let run_id_h = run_id.clone();
    let options_h = options.clone();
    let cancel_h = cancel_flag.clone();
    let media_dir_h = media_dir.clone();
    let total_hymns_h = total_hymns.clone();
    let total_albums_h = total_albums.clone();
    let total_album_songs_h = total_album_songs.clone();
    let hymns_imported_h = hymns_imported.clone();
    let hymns_skipped_h = hymns_skipped.clone();
    let processed_h = processed_count.clone();
    let audio_h = audio_downloaded.clone();
    let images_h = images_downloaded.clone();
    let errors_h = errors.clone();
    let sem_h = api_semaphore.clone();
    let dsem_h = db_semaphore.clone();

    let hymnal_task = tokio::spawn(async move {
        let db_state = app_h.state::<AppState>();
        let mut last_hymn_number: i64 = 0;
        if !options_h.replace_existing {
            if let Ok(db) = db_state.db.get() {
                last_hymn_number = db.query_row(
                    "SELECT MAX(number) FROM hymns WHERE category = 'hymnal'",
                    [],
                    |row| row.get::<_, Option<i64>>(0)
                ).unwrap_or(Some(0)).unwrap_or(0);
            }
        }

        let mut page = 1;
        let mut queue = Vec::new();
        let mut current_index = 0;
        let mut last_page_num;

        match fetcher::fetch_hymnal_page(options_h.language, 1).await {
            Ok(resp) => {
                let total = resp.total.unwrap_or(resp.data.len() as i64);
                last_page_num = resp.last_page;
                total_hymns_h.store(total as u64, Ordering::Relaxed);
                
                if !options_h.replace_existing && last_hymn_number > 0 && last_hymn_number < total {
                    page = (last_hymn_number / 15).max(0) + 1;
                    if page >= 1 && page <= last_page_num.unwrap_or(page) {
                        if let Ok(p_resp) = fetcher::fetch_hymnal_page(options_h.language, page).await {
                            let mut items = p_resp.data;
                            items.retain(|m| m.track.unwrap_or(0) > last_hymn_number || m.id_music > last_hymn_number);
                            queue.extend(items);
                            if let Some(new_lp) = p_resp.last_page { last_page_num = Some(new_lp); }
                        }
                    } else {
                        queue.extend(resp.data);
                    }
                } else {
                    queue.extend(resp.data);
                }
            }
            Err(e) => {
                let mut errs = errors_h.lock().unwrap();
                errs.push(LegacyFetchError { item_type: "fetch_hymns".to_string(), item_id: None, message: e.to_string() });
                return;
            }
        }

        let mut db_batch = Vec::new();
        let batch_size = 15;

        loop {
            if cancel_h.load(Ordering::SeqCst) { break; }

            if (queue.len() - current_index <= 5 || queue.is_empty()) && page < last_page_num.unwrap_or(0) {
                page += 1;
                if let Ok(next_resp) = fetcher::fetch_hymnal_page(options_h.language, page).await {
                    let mut items = next_resp.data;
                    if !options_h.replace_existing {
                        items.retain(|m| m.track.unwrap_or(0) > last_hymn_number || m.id_music > last_hymn_number);
                    }
                    queue.extend(items);
                    if let Some(new_lp) = next_resp.last_page { last_page_num = Some(new_lp); }
                    if let Some(total) = next_resp.total { total_hymns_h.store(total as u64, Ordering::Relaxed); }
                }
            }

            if current_index >= queue.len() {
                if page >= last_page_num.unwrap_or(0) { break; }
                else { continue; }
            }

            let music = queue[current_index].clone();
            let music_name = music.name.clone();
            let total_items = total_hymns_h.load(Ordering::Relaxed) + total_albums_h.load(Ordering::Relaxed) + total_album_songs_h.load(Ordering::Relaxed);
            update_sub_task(&app_h, &run_id_h, "hymnal", &music_name, (current_index as f64 / queue.len().max(1) as f64) * 100.0, "subtaskDownloading", processed_h.load(Ordering::Relaxed), total_items);

            let detailed_item = {
                let _permit = sem_h.acquire().await.ok();
                let mut d = fetcher::fetch_music_detail(options_h.language, music.id_music).await.unwrap_or_else(|_| music.clone());
                if d.track.is_none() && music.track.is_some() { d.track = music.track; }
                d
            };

            let (audio_res, playback_res, cover_res) = {
                let _permit = sem_h.acquire().await.ok();
                tokio::join!(
                    async { if options_h.download_audio { importer::download_media_file(detailed_item.url_music.as_ref(), &media_dir_h, "audio", detailed_item.id_music, "mp3").await } else { None } },
                    async { if options_h.download_audio { importer::download_media_file(detailed_item.url_instrumental_music.as_ref(), &media_dir_h, "playback", detailed_item.id_music, "mp3").await } else { None } },
                    async { if options_h.download_images { importer::download_media_file(detailed_item.url_image.as_ref(), &media_dir_h, "images", detailed_item.id_music, "jpg").await } else { None } }
                )
            };

            if audio_res.is_some() { audio_h.fetch_add(1, Ordering::Relaxed); }
            if playback_res.is_some() { audio_h.fetch_add(1, Ordering::Relaxed); }
            if cover_res.is_some() { images_h.fetch_add(1, Ordering::Relaxed); }

            db_batch.push((detailed_item, audio_res, playback_res, cover_res));

            let is_last_item = current_index + 1 >= queue.len() && page >= last_page_num.unwrap_or(0);
            
            if db_batch.len() >= batch_size || is_last_item {
                let state = app_h.state::<AppState>();
                let _d_permit = dsem_h.acquire().await.ok();
                if let Ok(mut db) = state.db.get() {
                    if let Ok(tx) = db.transaction() {
                        let mut db_changed = false;
                        for (item, a, p, c) in db_batch.drain(..) {
                            let db_res = importer::import_music_to_db(
                                &tx, &item, a.as_deref(), p.as_deref(), c.as_deref(),
                                options_h.replace_existing, Some(options_h.language.to_hymnal_name()), Some(item.id_music), Some("hymnal")
                            );
                            match db_res {
                                Ok((imported, _)) => {
                                    if imported { hymns_imported_h.fetch_add(1, Ordering::Relaxed); db_changed = true; }
                                    else { hymns_skipped_h.fetch_add(1, Ordering::Relaxed); }
                                }
                                Err(e) => {
                                    log::error!("Failed to import hymn {}: {}", item.id_music, e);
                                    let mut errs = errors_h.lock().unwrap();
                                    errs.push(LegacyFetchError { item_type: "hymn".to_string(), item_id: Some(item.id_music.to_string()), message: e.to_string() });
                                }
                            }
                        }
                        if let Err(e) = tx.commit() {
                            log::error!("Failed to commit batch: {}", e);
                        } else if db_changed {
                            let _ = app_h.emit("data-changed", ());
                        }
                    } else {
                        db_batch.clear(); // Clear to prevent infinite loop on tx error
                    }
                } else {
                    db_batch.clear();
                }
            }

            processed_h.fetch_add(1, Ordering::Relaxed);
            current_index += 1;
        }
        let total_items = total_hymns_h.load(Ordering::Relaxed) + total_albums_h.load(Ordering::Relaxed) + total_album_songs_h.load(Ordering::Relaxed);
        update_sub_task(&app_h, &run_id_h, "hymnal", "Hinário", 100.0, "subtaskDone", processed_h.load(Ordering::Relaxed), total_items);
    });

    // --- Task 2: Albums ---
    let app_a = app.clone();
    let run_id_a = run_id.clone();
    let options_a = options.clone();
    let cancel_a = cancel_flag.clone();
    let media_dir_a = media_dir.clone();
    let total_hymns_a = total_hymns.clone();
    let total_albums_a = total_albums.clone();
    let total_album_songs_a = total_album_songs.clone();
    let albums_created_a = albums_created.clone();
    let linked_a = collection_hymns_linked.clone();
    let processed_a = processed_count.clone();
    let audio_a = audio_downloaded.clone();
    let images_a = images_downloaded.clone();
    let errors_a = errors.clone();
    let sem_a = api_semaphore.clone();
    let dsem_a = db_semaphore.clone();

    let albums_task = tokio::spawn(async move {
        let mut page = 1;
        let mut queue = Vec::new();
        let mut current_index = 0;
        let mut last_page_num;

        match fetcher::fetch_albums_page(options_a.language, page).await {
            Ok(resp) => {
                queue.extend(resp.data);
                last_page_num = resp.last_page;
                total_albums_a.store(resp.total.unwrap_or(queue.len() as i64) as u64, Ordering::Relaxed);
            }
            Err(e) => {
                let mut errs = errors_a.lock().unwrap();
                errs.push(LegacyFetchError { item_type: "fetch_albums".to_string(), item_id: None, message: e.to_string() });
                return;
            }
        }

        while current_index < queue.len() {
            if cancel_a.load(Ordering::SeqCst) { break; }

            if queue.len() - current_index <= 5 && page < last_page_num.unwrap_or(0) {
                page += 1;
                if let Ok(next_resp) = fetcher::fetch_albums_page(options_a.language, page).await {
                    queue.extend(next_resp.data);
                    if let Some(new_lp) = next_resp.last_page { last_page_num = Some(new_lp); }
                    if let Some(total) = next_resp.total { total_albums_a.store(total as u64, Ordering::Relaxed); }
                }
            }

            let album = queue[current_index].clone();
            let hymnal_name = options_a.language.to_hymnal_name().to_lowercase();
            if album.name.to_lowercase().contains(&hymnal_name) {
                processed_a.fetch_add(1, Ordering::Relaxed);
                current_index += 1;
                continue;
            }

            let total_items = total_hymns_a.load(Ordering::Relaxed) + total_albums_a.load(Ordering::Relaxed) + total_album_songs_a.load(Ordering::Relaxed);
            update_sub_task(&app_a, &run_id_a, "albums", &album.name, (current_index as f64 / queue.len().max(1) as f64) * 100.0, "subtaskProcessing", processed_a.load(Ordering::Relaxed), total_items);

            let state = app_a.state::<AppState>();
            let mut collection_id_opt = None;

            if let Ok(g) = state.db.get() {
                if let Some(cid) = crate::db::queries::collections::find_collection_by_api_album_id(&g, album.id_album) {
                    collection_id_opt = Some(cid);
                } else {
                    let cover = if options_a.download_images { 
                        let _permit = sem_a.acquire().await.ok();
                        importer::download_media_file(album.url_image.as_ref(), &media_dir_a, "album_covers", album.id_album, "jpg").await 
                    } else { None };
                    let release_year = extract_year_from_url(album.url_image.as_deref().unwrap_or(""));
                    let _d_permit = dsem_a.acquire().await.ok();
                    if let Ok(cid) = crate::db::queries::collections::insert_collection(&g, &album.name, None, release_year, cover.as_deref(), "api", Some(album.id_album)) {
                        albums_created_a.fetch_add(1, Ordering::Relaxed);
                        let _ = app_a.emit("data-changed", ());
                        collection_id_opt = Some(cid);
                    }
                }
            }

            if let Some(collection_id) = collection_id_opt {
                let mut m_page = 1;
                let mut m_queue = Vec::new();
                let mut m_last_page_num = None;

                if !album.musics.is_empty() {
                    m_queue.extend(album.musics.clone());
                    m_last_page_num = Some(1); 
                } else {
                    let initial_m_res = {
                        let _permit = sem_a.acquire().await.ok();
                        fetcher::fetch_album_musics_page(options_a.language, album.id_album, m_page).await
                    };
                    if let Ok(resp) = initial_m_res {
                        m_queue.extend(resp.data);
                        m_last_page_num = resp.last_page;
                    }
                }

                if !m_queue.is_empty() {
                    total_album_songs_a.fetch_add(m_queue.len() as u64, Ordering::Relaxed);
                }

                let mut m_current_index = 0;
                let mut song_tasks = tokio::task::JoinSet::new();

                while m_current_index < m_queue.len() {
                    if cancel_a.load(Ordering::SeqCst) { break; }

                    if m_queue.len() - m_current_index <= 5 && m_page < m_last_page_num.unwrap_or(0) {
                        m_page += 1;
                        if let Ok(next_resp) = fetcher::fetch_album_musics_page(options_a.language, album.id_album, m_page).await {
                            total_album_songs_a.fetch_add(next_resp.data.len() as u64, Ordering::Relaxed);
                            m_queue.extend(next_resp.data);
                            if let Some(new_lp) = next_resp.last_page { m_last_page_num = Some(new_lp); }
                        }
                    }

                    let music = m_queue[m_current_index].clone();
                    let mi = m_current_index;
                    let m_queue_len = m_queue.len();
                    let album_name = album.name.clone();
                    let app_clone = app_a.clone();
                    let run_id_clone = run_id_a.clone();
                    let options_clone = options_a.clone();
                    let media_dir_clone = media_dir_a.clone();
                    let processed_clone = processed_a.clone();
                    let audio_clone = audio_a.clone();
                    let images_clone = images_a.clone();
                    let sem_clone = sem_a.clone();
                    let total_hymns_clone = total_hymns_a.clone();
                    let total_albums_clone = total_albums_a.clone();
                    let total_songs_clone = total_album_songs_a.clone();

                    song_tasks.spawn(async move {
                        let total_items = total_hymns_clone.load(Ordering::Relaxed) + total_albums_clone.load(Ordering::Relaxed) + total_songs_clone.load(Ordering::Relaxed);
                        update_sub_task(&app_clone, &run_id_clone, "albums", &format!("{}: {}", album_name, music.name), mi as f64 / m_queue_len.max(1) as f64 * 100.0, "subtaskDownloading", processed_clone.load(Ordering::Relaxed), total_items);

                        let detailed_item = {
                            let _permit = sem_clone.acquire().await.ok();
                            let mut d = fetcher::fetch_music_detail(options_clone.language, music.id_music).await.unwrap_or_else(|_| music.clone());
                            if d.track.is_none() && music.track.is_some() { d.track = music.track; }
                            d
                        };

                        let (audio_res, playback_res, cover_res) = {
                            let _permit = sem_clone.acquire().await.ok();
                            tokio::join!(
                                async { if options_clone.download_audio { importer::download_media_file(detailed_item.url_music.as_ref(), &media_dir_clone, "audio", detailed_item.id_music, "mp3").await } else { None } },
                                async { if options_clone.download_audio { importer::download_media_file(detailed_item.url_instrumental_music.as_ref(), &media_dir_clone, "playback", detailed_item.id_music, "mp3").await } else { None } },
                                async { if options_clone.download_images { importer::download_media_file(detailed_item.url_image.as_ref(), &media_dir_clone, "images", detailed_item.id_music, "jpg").await } else { None } }
                            )
                        };

                        if audio_res.is_some() { audio_clone.fetch_add(1, Ordering::Relaxed); }
                        if playback_res.is_some() { audio_clone.fetch_add(1, Ordering::Relaxed); }
                        if cover_res.is_some() { images_clone.fetch_add(1, Ordering::Relaxed); }

                        processed_clone.fetch_add(1, Ordering::Relaxed);
                        (detailed_item, audio_res, playback_res, cover_res, mi as i64)
                    });
                    m_current_index += 1;
                }
                
                let mut song_results = Vec::new();
                while let Some(res) = song_tasks.join_next().await {
                    if let Ok(data) = res {
                        song_results.push(data);
                    }
                }
                
                let db_state = app_a.state::<AppState>();
                let _d_permit = dsem_a.acquire().await.ok();
                if let Ok(mut g) = db_state.db.get() {
                    if let Ok(tx) = g.transaction() {
                        let mut db_changed = false;
                        for (detailed_item, audio_res, playback_res, cover_res, mi) in song_results {
                            let hymn_id_res = importer::import_music_to_db(
                                &tx, &detailed_item, audio_res.as_deref(), playback_res.as_deref(), cover_res.as_deref(),
                                options_a.replace_existing, Some(&album.name), Some(detailed_item.id_music), Some("album")
                            );
                            match hymn_id_res {
                                Ok((imported, Some(hymn_id))) => {
                                    if imported { db_changed = true; }
                                    let track_order = detailed_item.track.unwrap_or(mi);
                                    if let Ok(true) = crate::db::queries::collections::insert_collection_hymn(&tx, collection_id, hymn_id, track_order) {
                                        linked_a.fetch_add(1, Ordering::Relaxed);
                                        db_changed = true;
                                    }
                                }
                                Ok((_, None)) => {
                                    log::error!("Failed to import album song {}: db returned None", detailed_item.id_music);
                                }
                                Err(e) => {
                                    log::error!("Failed to import album song {}: {}", detailed_item.id_music, e);
                                    let mut errs = errors_a.lock().unwrap();
                                    errs.push(LegacyFetchError { item_type: "album_song".to_string(), item_id: Some(detailed_item.id_music.to_string()), message: e.to_string() });
                                }
                            }
                        }
                        if let Err(e) = tx.commit() {
                            log::error!("Failed to commit album songs: {}", e);
                        } else if db_changed {
                            let _ = app_a.emit("data-changed", ());
                        }
                    }
                }
            }
            processed_a.fetch_add(1, Ordering::Relaxed);
            current_index += 1;
        }
        let total_items = total_hymns_a.load(Ordering::Relaxed) + total_albums_a.load(Ordering::Relaxed) + total_album_songs_a.load(Ordering::Relaxed);
        update_sub_task(&app_a, &run_id_a, "albums", "Coletâneas", 100.0, "subtaskDone", processed_a.load(Ordering::Relaxed), total_items);
    });

    // Hymnal has priority: complete it fully before starting albums
    let _ = hymnal_task.await;
    let _ = albums_task.await;

    let final_status = if check_cancelled() { LegacyFetchStatus::Cancelled } else { LegacyFetchStatus::Completed };

    // Persist api db_version to settings so we can detect future updates
    if final_status == LegacyFetchStatus::Completed {
        if let Some(ver) = api_db_version {
            if let Some(state) = app.try_state::<AppState>() {
                if let Ok(conn) = state.db.get() {
                    let _ = crate::db::queries::settings::set_setting(&conn, "api.dbVersion", &ver.to_string());
                }
            }
        }
    }
    let total_items = total_hymns.load(Ordering::Relaxed) + total_albums.load(Ordering::Relaxed) + total_album_songs.load(Ordering::Relaxed);
    finalize_fetch_sync(
        &app, &run_id, final_status, errors.lock().unwrap().clone(),
        total_hymns.load(Ordering::Relaxed), hymns_imported.load(Ordering::Relaxed), hymns_skipped.load(Ordering::Relaxed),
        total_albums.load(Ordering::Relaxed) + total_album_songs.load(Ordering::Relaxed), albums_created.load(Ordering::Relaxed), collection_hymns_linked.load(Ordering::Relaxed),
        audio_downloaded.load(Ordering::Relaxed), images_downloaded.load(Ordering::Relaxed), started, 
        total_items, processed_count.load(Ordering::Relaxed)
    );
}

fn finalize_fetch_sync(
    app: &AppHandle,
    run_id: &str,
    status: LegacyFetchStatus,
    errors: Vec<LegacyFetchError>,
    hymns_fetched: u64,
    hymns_imported: u64,
    hymns_skipped: u64,
    albums_fetched: u64,
    albums_created: u64,
    collection_hymns_linked: u64,
    audio_downloaded: u64,
    images_downloaded: u64,
    started: Instant,
    items_total: u64,
    items_processed: u64,
) {
    let duration_ms = started.elapsed().as_millis() as u64;
    let report = LegacyFetchReport {
        run_id: run_id.to_string(),
        hymns_fetched, hymns_imported, hymns_skipped,
        albums_fetched, albums_created, collection_hymns_linked,
        audio_downloaded, images_downloaded,
        errors, duration_ms,
    };

    let final_message = match status {
        LegacyFetchStatus::Completed => "Completed successfully!".to_string(),
        LegacyFetchStatus::Cancelled => "Operation cancelled by user".to_string(),
        _ => "Operation failed".to_string(),
    };

    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut fetch_state) = state.legacy_fetch.lock() {
            if let Some(run) = fetch_state.runs.get_mut(run_id) {
                run.progress.status = status.clone();
                run.progress.percent = 100.0;
                run.progress.message = Some(final_message);
                run.progress.items_total = items_total;
                run.progress.items_processed = items_processed;
                run.report = Some(report.clone());
            }
            if fetch_state.active_run_id.as_deref() == Some(run_id) {
                fetch_state.active_run_id = None;
            }
        }
    }

    let progress = LegacyFetchProgress {
        run_id: run_id.to_string(),
        step: "done".to_string(),
        status: status.clone(),
        percent: 100.0,
        message: None,
        items_total,
        items_processed,
        sub_tasks: Vec::new(),
    };

    let _ = app.emit("legacy-fetch-progress", LegacyFetchProgressEvent::from(&progress));
    let _ = app.emit("legacy-fetch-report", &report);
}

/// Restore a single hymn from the LouvorJA API.
///
/// # Errors
/// Returns an error if:
/// - The requested hymn cannot be found in the database.
/// - Fetching the music details from the API fails.
/// - Database connection or insertion fails.
#[tauri::command]
#[specta::specta]
pub async fn restore_hymn_from_api(
    hymn_id: i64,
    language: crate::legacy_fetch::ApiLanguage,
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    use crate::legacy_fetch::fetcher::fetch_music_detail;
    use crate::legacy_fetch::importer::import_music_to_db;

    let (api_music_id, album_name): (i64, Option<String>) = {
        let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
        let row = conn.query_row(
            "SELECT api_music_id, album FROM hymns WHERE id = ?1",
            rusqlite::params![hymn_id],
            |row| Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, Option<String>>(1)?)),
        ).map_err(|e| AppError::Internal(format!("DB query failed: {}", e)))?;
        let amid = row.0.ok_or_else(|| AppError::Internal("Hymn has no api_music_id".into()))?;
        (amid, row.1)
    };

    let detail = fetch_music_detail(language, api_music_id).await
        .map_err(|e| AppError::Internal(format!("API fetch failed: {}", e)))?;

    let data_dir: PathBuf = app.path().app_data_dir().map_err(|e| AppError::Internal(e.to_string()))?.join("media");

    let (audio_res, playback_res, cover_res) = tokio::join!(
        crate::legacy_fetch::importer::download_media_file(detail.url_music.as_ref(), &data_dir, "audio", api_music_id, "mp3"),
        crate::legacy_fetch::importer::download_media_file(detail.url_instrumental_music.as_ref(), &data_dir, "playback", api_music_id, "mp3"),
        crate::legacy_fetch::importer::download_media_file(detail.url_image.as_ref(), &data_dir, "images", api_music_id, "jpg")
    );

    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    import_music_to_db(
        &conn, &detail, audio_res.as_deref(), playback_res.as_deref(), cover_res.as_deref(),
        true, album_name.as_deref(), Some(api_music_id), Some("hymnal")
    )?;

    Ok(())
}

/// Restore an entire album/collection from the LouvorJA API.
///
/// # Errors
/// Returns an error if:
/// - The requested collection cannot be found in the database.
/// - Fetching the album details or songs from the API fails.
/// - Database connection or insertion fails.
#[tauri::command]
#[specta::specta]
pub async fn restore_album_from_api(
    collection_id: i64,
    language: crate::legacy_fetch::ApiLanguage,
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    use crate::legacy_fetch::fetcher::{fetch_album_musics_page, fetch_music_detail};
    use crate::legacy_fetch::importer::import_music_to_db;

    let (api_album_id, album_name): (i64, String) = {
        let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
        let row = conn.query_row(
            "SELECT api_album_id, name FROM collections WHERE id = ?1",
            rusqlite::params![collection_id],
            |row| Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, String>(1)?)),
        ).map_err(|e| AppError::Internal(format!("DB query failed: {}", e)))?;
        let aid = row.0.ok_or_else(|| AppError::Internal("Collection has no api_album_id".into()))?;
        (aid, row.1)
    };

    let mut m_page = 1;
    let mut m_queue = Vec::new();
    let mut m_last_page_num = None;

    if let Ok(resp) = fetch_album_musics_page(language, api_album_id, m_page).await {
        m_queue.extend(resp.data);
        m_last_page_num = resp.last_page;
    }

    let mut current_index = 0;
    while current_index < m_queue.len() {
        if m_queue.len() - current_index <= 5 && m_page < m_last_page_num.unwrap_or(0) {
            m_page += 1;
            if let Ok(next_resp) = fetch_album_musics_page(language, api_album_id, m_page).await {
                m_queue.extend(next_resp.data);
                if let Some(new_lp) = next_resp.last_page { m_last_page_num = Some(new_lp); }
            }
        }
        current_index += 1;
    }

    let data_dir: PathBuf = app.path().app_data_dir().map_err(|e| AppError::Internal(e.to_string()))?.join("media");
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;

    for (mi, music) in m_queue.into_iter().enumerate() {
        let mut detailed_item = fetch_music_detail(language, music.id_music).await.unwrap_or_else(|_| music.clone());
        if detailed_item.track.is_none() && music.track.is_some() { detailed_item.track = music.track; }

        let audio_path = crate::legacy_fetch::importer::download_media_file(detailed_item.url_music.as_ref(), &data_dir, "audio", detailed_item.id_music, "mp3").await;
        let playback_path = crate::legacy_fetch::importer::download_media_file(detailed_item.url_instrumental_music.as_ref(), &data_dir, "playback", detailed_item.id_music, "mp3").await;
        let cover_path = crate::legacy_fetch::importer::download_media_file(detailed_item.url_image.as_ref(), &data_dir, "images", detailed_item.id_music, "jpg").await;

        let _ = import_music_to_db(&conn, &detailed_item, audio_path.as_deref(), playback_path.as_deref(), cover_path.as_deref(), true, Some(&album_name), Some(detailed_item.id_music), Some("album"));
        
        if let Some(hymn_id) = crate::db::queries::music::find_hymn_by_api_music_id(&conn, detailed_item.id_music) {
            let track_order = detailed_item.track.unwrap_or(mi as i64);
            let _ = crate::db::queries::collections::insert_collection_hymn(&conn, collection_id, hymn_id, track_order);
        }
    }

    let _ = app.emit("data-changed", ());
    Ok(())
}
