use crate::db::models::{SlideContent, SlideContext};
use crate::error::AppError;
use crate::projection::{
    emit_utility_projection_event, new_projection_session_id,
    register_live_utility_projection_sender, stop_live_utility_projection,
    UtilityProjectionEventPayload,
};
use crate::state::{AppState, StreamingState, TimerMode, TimerStateData};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

fn normalize_timer_runtime(timer: &mut crate::state::TimerRuntimeState) {
    if matches!(timer.mode, TimerMode::Countdown)
        && timer.is_running()
        && timer.current_time_ms() == 0
    {
        timer.pause();
        if let Some(duration_ms) = timer.duration_ms {
            timer.accumulated_ms = duration_ms;
        }
    }
}

fn has_live_timer_value(data: &TimerStateData) -> bool {
    data.is_running
        || data.current_time_ms > 0
        || (matches!(data.mode, TimerMode::Countdown) && data.duration_ms.is_some())
}

fn format_timer_value(milliseconds: u64, mode: &TimerMode) -> String {
    let total_seconds = milliseconds / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;

    if matches!(mode, TimerMode::Stopwatch) {
        let milliseconds_part = milliseconds % 1000;
        if hours > 0 {
            return format!(
                "{:02}:{:02}:{:02}.{:03}",
                hours, minutes, seconds, milliseconds_part
            );
        }

        return format!("{:02}:{:02}.{:03}", minutes, seconds, milliseconds_part);
    }

    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
    } else {
        format!("{:02}:{:02}", minutes, seconds)
    }
}

fn snapshot_timer_state_from_app(app: &AppHandle) -> Result<TimerStateData, AppError> {
    let state = app.state::<AppState>();
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    normalize_timer_runtime(&mut timer);
    Ok(timer.to_data())
}

fn project_utility_cover(
    app: &AppHandle,
    label: &str,
    title: String,
    subtitle: String,
    context_title: String,
) -> Result<(), AppError> {
    let slide = SlideContent {
        slide_type: "cover".to_string(),
        text: None,
        title: Some(title),
        subtitle: Some(subtitle),
        label: Some(label.to_string()),
        video_path: None,
        background_image: None,
        background_color: None,
        audio_path: None,
        auto_play: None,
        r#loop: None,
        muted: None,
        mode: None,
        text_color: None,
        text_size: None,
    };

    let context = SlideContext {
        next: None,
        index: 0,
        total: 1,
        title: context_title,
    };

    crate::commands::display::set_current_slide(
        slide,
        app.clone(),
        app.state::<AppState>(),
        app.state::<StreamingState>(),
    )?;
    crate::commands::display::set_slide_context(
        context,
        app.clone(),
        app.state::<AppState>(),
        app.state::<StreamingState>(),
    )?;

    Ok(())
}

fn emit_projection_phase(
    app: &AppHandle,
    phase: &str,
    session_id: &str,
    kind: &str,
    value_ms: u64,
    use_24_hour: bool,
    show_date: bool,
) -> Result<(), AppError> {
    emit_utility_projection_event(
        app,
        &UtilityProjectionEventPayload {
            phase: phase.to_string(),
            session_id: session_id.to_string(),
            kind: kind.to_string(),
            value_ms,
            use_24_hour,
            show_date,
        },
    )
}

#[tauri::command]
#[specta::specta]
pub fn start_timer(
    mode: String,
    duration_ms: Option<u64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let timer_mode = TimerMode::from_input(&mode).ok_or_else(|| {
        AppError::Internal("Invalid timer mode. Use 'countdown' or 'stopwatch'.".into())
    })?;

    let normalized_duration = match timer_mode {
        TimerMode::Countdown => match duration_ms {
            Some(value) if value > 0 => Some(value),
            _ => {
                return Err(AppError::Internal(
                    "Countdown mode requires a positive duration in milliseconds.".into(),
                ))
            }
        },
        TimerMode::Stopwatch => None,
    };

    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    timer.start(timer_mode, normalized_duration);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn pause_timer(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    timer.pause();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn resume_timer(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    timer.resume();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn reset_timer(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    timer.reset();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn adjust_countdown_timer(
    delta_ms: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    timer
        .adjust_countdown_remaining_ms(delta_ms)
        .map_err(AppError::Internal)
}

#[tauri::command]
#[specta::specta]
pub fn get_timer_state(state: tauri::State<'_, AppState>) -> Result<TimerStateData, AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    normalize_timer_runtime(&mut timer);

    Ok(timer.to_data())
}

#[tauri::command]
#[specta::specta]
pub fn add_lap(state: tauri::State<'_, AppState>) -> Result<u64, AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !matches!(timer.mode, TimerMode::Stopwatch) {
        return Err(AppError::Internal(
            "Lap capture is only available in stopwatch mode.".into(),
        ));
    }

    if !timer.is_running() {
        return Err(AppError::Internal(
            "Cannot capture lap while timer is paused.".into(),
        ));
    }

    let lap = timer.elapsed_ms();
    timer.laps.push(lap);
    Ok(lap)
}

#[tauri::command]
#[specta::specta]
pub fn start_countdown_projection(
    context_title: String,
    countdown_title: String,
    initial_time_ms: u64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let session_id = new_projection_session_id("countdown");
    let mut fallback_time_ms = (initial_time_ms / 1000) * 1000;
    stop_live_utility_projection(&state)?;

    project_utility_cover(
        &app,
        "timer",
        format_timer_value(fallback_time_ms, &TimerMode::Countdown),
        countdown_title.clone(),
        context_title,
    )?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    register_live_utility_projection_sender(&state, stop_tx)?;
    emit_projection_phase(
        &app,
        "start",
        &session_id,
        "countdown",
        fallback_time_ms,
        true,
        false,
    )?;

    thread::spawn(move || {
        let mut last_value = u64::MAX;

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            let timer_state = match snapshot_timer_state_from_app(&app) {
                Ok(data) => data,
                Err(_) => {
                    thread::sleep(Duration::from_millis(200));
                    continue;
                }
            };

            if matches!(timer_state.mode, TimerMode::Countdown)
                && has_live_timer_value(&timer_state)
            {
                fallback_time_ms = timer_state.current_time_ms;
            }

            let projected_time_ms = (fallback_time_ms / 1000) * 1000;
            if projected_time_ms != last_value {
                last_value = projected_time_ms;
                let _ = emit_projection_phase(
                    &app,
                    "tick",
                    &session_id,
                    "countdown",
                    projected_time_ms,
                    true,
                    false,
                );
            }

            thread::sleep(Duration::from_millis(200));
        }

        let _ = emit_projection_phase(
            &app,
            "stop",
            &session_id,
            "countdown",
            last_value,
            true,
            false,
        );
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn start_stopwatch_projection(
    context_title: String,
    stopwatch_title: String,
    initial_time_ms: u64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let session_id = new_projection_session_id("stopwatch");
    let mut fallback_time_ms = initial_time_ms;
    stop_live_utility_projection(&state)?;

    project_utility_cover(
        &app,
        "timer",
        format_timer_value(fallback_time_ms, &TimerMode::Stopwatch),
        stopwatch_title.clone(),
        context_title,
    )?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    register_live_utility_projection_sender(&state, stop_tx)?;
    emit_projection_phase(
        &app,
        "start",
        &session_id,
        "stopwatch",
        fallback_time_ms,
        true,
        false,
    )?;

    thread::spawn(move || {
        let mut last_value = u64::MAX;

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            let timer_state = match snapshot_timer_state_from_app(&app) {
                Ok(data) => data,
                Err(_) => {
                    thread::sleep(Duration::from_millis(50));
                    continue;
                }
            };

            if matches!(timer_state.mode, TimerMode::Stopwatch)
                && has_live_timer_value(&timer_state)
            {
                fallback_time_ms = timer_state.current_time_ms;
            }

            let projected_time_ms = (fallback_time_ms / 100) * 100;
            if projected_time_ms != last_value {
                last_value = projected_time_ms;
                let _ = emit_projection_phase(
                    &app,
                    "tick",
                    &session_id,
                    "stopwatch",
                    projected_time_ms,
                    true,
                    false,
                );
            }

            thread::sleep(Duration::from_millis(50));
        }

        let _ = emit_projection_phase(
            &app,
            "stop",
            &session_id,
            "stopwatch",
            last_value,
            true,
            false,
        );
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn stop_utility_projection(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    stop_live_utility_projection(&state)
}
