use serde::Serialize;
use crate::audio::SyncPoint;
use crate::error::AppError;
use crate::state::{AppState, AudioState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatusPayload {
    pub position_ms: u64,
    pub duration_ms: Option<u64>,
    pub is_playing: bool,
    pub is_paused: bool,
    pub volume: f32,
    pub current_file: Option<String>,
}

#[tauri::command]
pub fn audio_play(file_path: String, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let mut player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    player.play(&file_path)
}

#[tauri::command]
pub fn audio_pause(state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    player.pause();
    Ok(())
}

#[tauri::command]
pub fn audio_resume(state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    player.resume();
    Ok(())
}

#[tauri::command]
pub fn audio_stop(state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let mut player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    player.stop();
    Ok(())
}

#[tauri::command]
pub fn audio_seek(position_ms: u64, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    player.seek(position_ms)
}

#[tauri::command]
pub fn audio_set_volume(volume: f32, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let mut player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    player.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub fn audio_get_position(state: tauri::State<'_, AudioState>) -> Result<u64, AppError> {
    let player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(player.position_ms())
}

#[tauri::command]
pub fn audio_get_status(state: tauri::State<'_, AudioState>) -> Result<AudioStatusPayload, AppError> {
    let player = state.player.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(AudioStatusPayload {
        position_ms: player.position_ms(),
        duration_ms: player.duration_ms(),
        is_playing: player.is_playing(),
        is_paused: player.is_paused(),
        volume: player.volume(),
        current_file: player.current_file(),
    })
}

#[tauri::command]
pub fn get_sync_points(hymn_id: i64, state: tauri::State<'_, AppState>) -> Result<Vec<SyncPoint>, AppError> {
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_sync_points(&conn, hymn_id)
}

#[tauri::command]
pub fn save_sync_points(hymn_id: i64, points: Vec<SyncPoint>, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::save_sync_points(&conn, hymn_id, &points)
}
