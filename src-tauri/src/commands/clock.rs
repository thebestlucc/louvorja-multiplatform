use crate::db::models::{SlideContent, SlideContext};
use crate::db::models::slides::BackgroundConfig;
use crate::error::AppError;
use crate::projection::{
    emit_utility_projection_event, new_projection_session_id,
    register_live_utility_projection_sender, stop_live_utility_projection,
    UtilityProjectionEventPayload,
};
use crate::state::{AppState, StreamingState};
use chrono::TimeZone;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

fn format_clock_time(timestamp_ms: u64, use_24_hour: bool) -> String {
    let timestamp = i64::try_from(timestamp_ms)
        .ok()
        .and_then(|value| chrono::Local.timestamp_millis_opt(value).single())
        .unwrap_or_else(chrono::Local::now);

    if use_24_hour {
        timestamp.format("%H:%M:%S").to_string()
    } else {
        timestamp.format("%I:%M:%S %p").to_string()
    }
}

fn format_clock_date(timestamp_ms: u64) -> String {
    let timestamp = i64::try_from(timestamp_ms)
        .ok()
        .and_then(|value| chrono::Local.timestamp_millis_opt(value).single())
        .unwrap_or_else(chrono::Local::now);
    timestamp.format("%Y-%m-%d").to_string()
}

fn project_clock_cover(
    app: &AppHandle,
    context_title: String,
    clock_title: String,
    now_ms: u64,
    use_24_hour: bool,
    show_date: bool,
) -> Result<(), AppError> {
    let slide = SlideContent::Cover {
        title: format_clock_time(now_ms, use_24_hour),
        subtitle: Some(if show_date {
            format_clock_date(now_ms)
        } else {
            clock_title
        }),
        label: Some("clock".to_string()),
        background: BackgroundConfig::default(),
        text_color: None,
        text_size: None,
    };

    let context = SlideContext {
        next: None,
        index: 0,
        total: 1,
        title: context_title,
        current_slide_start_ms: None,
        next_slide_start_ms: None,
        audio_duration_ms: None,
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

fn emit_clock_projection_phase(
    app: &AppHandle,
    phase: &str,
    session_id: &str,
    value_ms: u64,
    use_24_hour: bool,
    show_date: bool,
) -> Result<(), AppError> {
    emit_utility_projection_event(
        app,
        &UtilityProjectionEventPayload {
            phase: phase.to_string(),
            session_id: session_id.to_string(),
            kind: "clock".to_string(),
            value_ms,
            use_24_hour,
            show_date,
        },
    )
}

#[tauri::command]
#[specta::specta]
pub fn start_clock_projection(
    context_title: String,
    clock_title: String,
    use_24_hour: bool,
    show_date: bool,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let session_id = new_projection_session_id("clock");
    let now_ms = u64::try_from(chrono::Utc::now().timestamp_millis()).unwrap_or(0);
    stop_live_utility_projection(&state)?;

    project_clock_cover(
        &app,
        context_title,
        clock_title,
        now_ms,
        use_24_hour,
        show_date,
    )?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    register_live_utility_projection_sender(&state, stop_tx)?;
    emit_clock_projection_phase(&app, "start", &session_id, now_ms, use_24_hour, show_date)?;

    thread::spawn(move || {
        let mut last_second = u64::MAX;
        let mut last_value = now_ms;

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            let tick_ms =
                u64::try_from(chrono::Utc::now().timestamp_millis()).unwrap_or(last_value);
            let tick_second = tick_ms / 1000;
            if tick_second != last_second {
                last_second = tick_second;
                last_value = tick_ms;
                let _ = emit_clock_projection_phase(
                    &app,
                    "tick",
                    &session_id,
                    tick_ms,
                    use_24_hour,
                    show_date,
                );
            }

            thread::sleep(Duration::from_millis(150));
        }

        let _ = emit_clock_projection_phase(
            &app,
            "stop",
            &session_id,
            last_value,
            use_24_hour,
            show_date,
        );
    });

    Ok(())
}
