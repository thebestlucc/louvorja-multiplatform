use crate::audio::SyncPoint;
use crate::error::AppError;
use crate::state::{AppState, AudioState};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const AUDIO_STATUS_EVENT: &str = "audio-status";
const AUDIO_STATUS_EMIT_INTERVAL_MS: u64 = 50;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatusPayload {
    pub position_ms: u64,
    pub duration_ms: Option<u64>,
    pub is_playing: bool,
    pub is_paused: bool,
    pub volume: f32,
    pub current_file: Option<String>,
}

fn snapshot_audio_status(state: &AudioState) -> Result<AudioStatusPayload, AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(AudioStatusPayload {
        position_ms: player.position_ms(),
        duration_ms: player.duration_ms(),
        is_playing: player.is_playing(),
        is_paused: player.is_paused(),
        volume: player.volume(),
        current_file: player.current_file(),
    })
}

fn emit_audio_status(app: &AppHandle, state: &AudioState) -> Result<AudioStatusPayload, AppError> {
    let payload = snapshot_audio_status(state)?;
    app.emit(AUDIO_STATUS_EVENT, &payload)
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(payload)
}

fn stop_audio_status_stream(state: &AudioState) -> Result<(), AppError> {
    let mut stream_stop = state
        .audio_status_stream_stop
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if let Some(sender) = stream_stop.take() {
        let _ = sender.send(());
    }
    Ok(())
}

fn start_audio_status_stream(app: &AppHandle, state: &AudioState) -> Result<(), AppError> {
    stop_audio_status_stream(state)?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    {
        let mut stream_stop = state
            .audio_status_stream_stop
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *stream_stop = Some(stop_tx);
    }

    let app_handle = app.clone();
    thread::spawn(move || {
        let mut previous_payload: Option<AudioStatusPayload> = None;

        loop {
            if stop_rx
                .recv_timeout(Duration::from_millis(AUDIO_STATUS_EMIT_INTERVAL_MS))
                .is_ok()
            {
                break;
            }

            let audio_state = app_handle.state::<AudioState>();
            let payload = match snapshot_audio_status(&audio_state) {
                Ok(value) => value,
                Err(_) => continue,
            };

            let should_emit = previous_payload
                .as_ref()
                .map(|previous| {
                    previous.position_ms != payload.position_ms
                        || previous.duration_ms != payload.duration_ms
                        || previous.is_playing != payload.is_playing
                        || previous.is_paused != payload.is_paused
                        || (previous.volume - payload.volume).abs() > f32::EPSILON
                        || previous.current_file != payload.current_file
                })
                .unwrap_or(true);

            if should_emit {
                let _ = app_handle.emit(AUDIO_STATUS_EVENT, &payload);
                previous_payload = Some(payload.clone());
            }

            if !payload.is_playing && !payload.is_paused {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn audio_play(
    file_path: String,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let resolved_path = resolve_audio_path(&file_path, &app)?;
    {
        let mut player = state
            .player
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        player.play(&resolved_path)?;
        // Store the original (unresolved) path so the frontend can identify
        // which file is playing using the same relative path it passed in.
        player.set_input_path(&file_path);
    }

    start_audio_status_stream(&app, &state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn audio_play_alert(
    file_path: Option<String>,
    volume: Option<f32>,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.play_alert(file_path.as_deref(), volume)
}

#[tauri::command]
pub fn audio_pause(app: AppHandle, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.pause();
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn audio_resume(app: AppHandle, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.resume();
    drop(player);
    start_audio_status_stream(&app, &state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn audio_stop(app: AppHandle, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let mut player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.stop();
    drop(player);
    stop_audio_status_stream(&state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn audio_seek(
    position_ms: u64,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.seek(position_ms)?;
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn audio_set_volume(
    volume: f32,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let mut player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.set_volume(volume);
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn audio_get_position(state: tauri::State<'_, AudioState>) -> Result<u64, AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(player.position_ms())
}

#[tauri::command]
pub fn audio_get_status(
    state: tauri::State<'_, AudioState>,
) -> Result<AudioStatusPayload, AppError> {
    snapshot_audio_status(&state)
}

#[tauri::command]
pub fn get_sync_points(
    hymn_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SyncPoint>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_sync_points(&conn, hymn_id)
}

#[tauri::command]
pub fn save_sync_points(
    hymn_id: i64,
    points: Vec<SyncPoint>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::save_sync_points(&mut conn, hymn_id, &points)
}

fn resolve_audio_path(path: &str, app: &AppHandle) -> Result<String, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::Internal("Audio path cannot be empty.".into()));
    }

    let raw = PathBuf::from(trimmed);
    if raw.is_absolute() {
        let canonical = raw.canonicalize().map_err(|e| {
            AppError::Internal(format!("Failed to resolve absolute audio path: {}", e))
        })?;
        return Ok(canonical.to_string_lossy().to_string());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data directory: {}", e)))?;
    let canonical_app_data = app_data_dir
        .canonicalize()
        .map_err(|e| AppError::Internal(format!("Failed to resolve app data directory: {}", e)))?;

    let normalized = trimmed.replace('\\', "/");
    let candidate = if normalized.starts_with("media/") {
        app_data_dir.join(normalized)
    } else {
        app_data_dir.join("media").join(normalized)
    };

    let canonical = candidate
        .canonicalize()
        .map_err(|e| AppError::Internal(format!("Failed to resolve media audio path: {}", e)))?;
    if !canonical.starts_with(&canonical_app_data) {
        return Err(AppError::Internal(
            "Resolved audio path escapes application data directory.".into(),
        ));
    }

    Ok(canonical.to_string_lossy().to_string())
}
