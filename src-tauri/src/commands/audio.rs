use crate::audio::player::AudioVariant;
use crate::audio::SyncPoint;
use crate::error::AppError;
use crate::state::{AppState, AudioState, StreamingState};
use crate::utils::catcher::catcher;
use crate::utils::paths::SafePath;
use serde::Serialize;
use specta::Type;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const AUDIO_STATUS_EVENT: &str = "audio-status";
const AUDIO_STATUS_EMIT_INTERVAL_MS: u64 = 50;

fn parse_audio_variant(mode: &str) -> Result<AudioVariant, AppError> {
    match mode.trim() {
        "sung" => Ok(AudioVariant::Sung),
        "karaoke" => Ok(AudioVariant::Karaoke),
        other => Err(AppError::Internal(format!(
            "Unsupported playback mode for variant switching: {other}"
        ))),
    }
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatusPayload {
    #[specta(type = f64)]
    pub position_ms: u64,
    #[specta(type = f64)]
    pub duration_ms: Option<u64>,
    pub is_playing: bool,
    pub is_paused: bool,
    pub volume: f32,
    pub current_file: Option<String>,
}

fn snapshot_audio_status(state: &AudioState) -> (Option<AudioStatusPayload>, Option<AppError>) {
    let (player, err) = catcher(state.player.read());
    if let Some(e) = err {
        return (None, Some(e));
    }
    let player = player.unwrap();

    (
        Some(AudioStatusPayload {
            position_ms: player.position_ms(),
            duration_ms: player.duration_ms(),
            is_playing: player.is_playing(),
            is_paused: player.is_paused(),
            volume: player.volume(),
            current_file: player.current_file(),
        }),
        None,
    )
}

fn emit_audio_status(app: &AppHandle, state: &AudioState) -> Result<AudioStatusPayload, AppError> {
    let (payload, err) = snapshot_audio_status(state);
    if let Some(e) = err {
        return Err(e);
    }
    let payload = payload.unwrap();

    app.emit(AUDIO_STATUS_EVENT, &payload)
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    broadcast_streaming_audio_status(app, &payload);
    Ok(payload)
}

fn broadcast_streaming_audio_status(app: &AppHandle, payload: &AudioStatusPayload) {
    let Some(streaming_state) = app.try_state::<StreamingState>() else {
        return;
    };
    let (server, err) = catcher(streaming_state.server.lock());
    if err.is_some() {
        return;
    }
    let server = server.unwrap();

    if let Ok(payload_json) = serde_json::to_string(payload) {
        server.set_audio_status(&payload_json);
    }

    let envelope = serde_json::json!({
        "audioPlayback": payload,
    });
    server.broadcast_music_transient(&envelope.to_string());
    server.broadcast_return_transient(&envelope.to_string());
}

fn stop_audio_status_stream(state: &AudioState) -> Result<(), AppError> {
    let (stream_stop, err) = catcher(state.audio_status_stream_stop.lock());
    if let Some(e) = err {
        return Err(e);
    }
    let mut stream_stop = stream_stop.unwrap();

    if let Some(sender) = stream_stop.take() {
        let _ = sender.send(());
    }
    Ok(())
}

fn start_audio_status_stream(app: &AppHandle, state: &AudioState) -> Result<(), AppError> {
    stop_audio_status_stream(state)?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    {
        let (stream_stop, err) = catcher(state.audio_status_stream_stop.lock());
        if let Some(e) = err {
            return Err(e);
        }
        let mut stream_stop = stream_stop.unwrap();
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
            let (payload, err) = snapshot_audio_status(&audio_state);
            if err.is_some() {
                continue;
            }
            let payload = payload.unwrap();

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
                broadcast_streaming_audio_status(&app_handle, &payload);
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
#[specta::specta]
pub fn audio_play(
    file_path: String,
    position_ms: Option<u64>,
    preserve_live_position: Option<bool>,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let resolved_path = resolve_audio_path(&file_path, &app)?;
    {
        let (player, err) = catcher(state.player.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut player = player.unwrap();
        player.play(
            &resolved_path,
            &file_path,
            position_ms,
            preserve_live_position.unwrap_or(false),
        )?;
    }

    start_audio_status_stream(&app, &state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_play_variants(
    sung_file_path: String,
    karaoke_file_path: String,
    active_mode: String,
    position_ms: Option<u64>,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let sung_resolved_path = resolve_audio_path(&sung_file_path, &app)?;
    let karaoke_resolved_path = resolve_audio_path(&karaoke_file_path, &app)?;
    let active_variant = parse_audio_variant(&active_mode)?;

    {
        let (player, err) = catcher(state.player.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut player = player.unwrap();
        player.play_variants(
            &sung_resolved_path,
            &sung_file_path,
            &karaoke_resolved_path,
            &karaoke_file_path,
            active_variant,
            position_ms,
        )?;
    }

    start_audio_status_stream(&app, &state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_switch_variant(
    active_mode: String,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let active_variant = parse_audio_variant(&active_mode)?;

    {
        let (player, err) = catcher(state.player.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut player = player.unwrap();
        player.switch_variant(active_variant)?;
    }

    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_play_alert(
    file_path: Option<String>,
    volume: Option<f32>,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.read());
    if let Some(e) = err {
        return Err(e);
    }
    let player = player.unwrap();
    player.play_alert(file_path.as_deref(), volume)
}

#[tauri::command]
#[specta::specta]
pub fn audio_pause(app: AppHandle, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.read());
    if let Some(e) = err {
        return Err(e);
    }
    let player = player.unwrap();
    player.pause();
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_resume(app: AppHandle, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.read());
    if let Some(e) = err {
        return Err(e);
    }
    let player = player.unwrap();
    player.resume();
    drop(player);
    start_audio_status_stream(&app, &state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_set_output_muted(
    muted: bool,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut player = player.unwrap();
    player.set_output_muted(muted);
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_stop(app: AppHandle, state: tauri::State<'_, AudioState>) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut player = player.unwrap();
    player.stop();
    drop(player);
    stop_audio_status_stream(&state)?;
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_seek(
    position_ms: u64,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.read());
    if let Some(e) = err {
        return Err(e);
    }
    let player = player.unwrap();
    player.seek(position_ms)?;
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_set_volume(
    volume: f32,
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let (player, err) = catcher(state.player.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut player = player.unwrap();
    player.set_volume(volume);
    drop(player);
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn audio_get_position(state: tauri::State<'_, AudioState>) -> Result<u64, AppError> {
    let (player, err) = catcher(state.player.read());
    if let Some(e) = err {
        return Err(e);
    }
    let player = player.unwrap();
    Ok(player.position_ms())
}

#[tauri::command]
#[specta::specta]
pub fn audio_get_status(
    state: tauri::State<'_, AudioState>,
) -> Result<AudioStatusPayload, AppError> {
    let (payload, err) = snapshot_audio_status(&state);
    if let Some(e) = err {
        return Err(e);
    }
    Ok(payload.unwrap())
}

#[tauri::command]
#[specta::specta]
pub fn get_sync_points(
    hymn_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SyncPoint>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::music::get_sync_points(&conn, hymn_id)
}

#[tauri::command]
#[specta::specta]
pub fn save_sync_points(
    hymn_id: i64,
    points: Vec<SyncPoint>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let mut conn = conn.unwrap();
    crate::db::queries::music::save_sync_points(&mut conn, hymn_id, &points)
}

fn resolve_audio_path(path: &str, app: &AppHandle) -> Result<String, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::Internal("Audio path cannot be empty.".into()));
    }

    let (app_data_dir, err) = catcher(app.path().app_data_dir());
    if let Some(e) = err {
        return Err(e);
    }
    let app_data_dir = app_data_dir.unwrap();

    let safe_path = SafePath::new(&app_data_dir);
    let normalized = trimmed.replace('\\', "/");

    // Absolute paths come from content DB (resolved by resolve_hymn_paths).
    // SafePath validates they're within app_data_dir. Relative paths are
    // user-uploaded files stored under media/.
    let candidate: std::path::PathBuf = if std::path::Path::new(&normalized).is_absolute() {
        std::path::PathBuf::from(&normalized)
    } else if normalized.starts_with("media/") {
        app_data_dir.join(&normalized)
    } else {
        app_data_dir.join(format!("media/{}", normalized))
    };

    let resolved = safe_path.resolve(candidate)?;
    let result = resolved.to_string_lossy().replace('\\', "/");

    if !resolved.exists() {
        log::warn!(
            "[resolve_audio_path] File not found | input='{}' | resolved='{}' | app_data_dir={:?}",
            path, result, app_data_dir
        );
    }

    Ok(result)
}
