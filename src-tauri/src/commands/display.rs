use crate::db::models::{MonitorConfig, MonitorInfo, OverlayState, SlideContent, SlideContext};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use tauri::{AppHandle, Emitter, Manager};

fn streaming_slide_title(slide: &SlideContent) -> String {
    slide
        .title
        .clone()
        .or_else(|| slide.label.clone())
        .unwrap_or_default()
}

fn streaming_slide_payload(slide: &SlideContent) -> serde_json::Value {
    serde_json::json!({
        "label": slide.label.as_deref().unwrap_or(""),
        "text": slide.text.as_deref().unwrap_or(""),
        "title": slide.title.as_deref().unwrap_or(""),
    })
}

fn build_return_stream_payload(
    current: &SlideContent,
    context: Option<&SlideContext>,
) -> serde_json::Value {
    let current_title = streaming_slide_title(current);
    if let Some(ctx) = context {
        if !ctx.title.is_empty() && ctx.title == current_title {
            return serde_json::json!({
                "current": streaming_slide_payload(current),
                "next": ctx.next.as_ref().map(streaming_slide_payload),
                "index": ctx.index,
                "total": ctx.total,
                "title": ctx.title,
            });
        }
    }

    serde_json::json!({
        "current": streaming_slide_payload(current),
        "next": null,
        "index": 0,
        "total": 1,
        "title": current_title,
    })
}

#[tauri::command]
pub fn get_available_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, AppError> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    let infos: Vec<MonitorInfo> = monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let size = m.size();
            let position = m.position();
            MonitorInfo {
                id: format!("monitor-{}", i),
                name: m
                    .name()
                    .unwrap_or(&format!("Monitor {}", i + 1))
                    .to_string(),
                width: size.width,
                height: size.height,
                is_primary: i == 0,
                x: position.x,
                y: position.y,
                scale_factor: m.scale_factor(),
            }
        })
        .collect();
    Ok(infos)
}

/// Helper: open a fullscreen window on the given monitor
fn open_fullscreen_window(
    label: &str,
    url: &str,
    title: &str,
    monitor_index: usize,
    app: &AppHandle,
) -> Result<(), AppError> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    let monitor = monitors
        .get(monitor_index)
        .ok_or_else(|| AppError::NotFound(format!("Monitor index {} not found", monitor_index)))?;

    let position = monitor.position();
    let size = monitor.size();
    let scale = monitor.scale_factor();

    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let logical_x = position.x as f64 / scale;
    let logical_y = position.y as f64 / scale;

    // Close existing window if open
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.close();
    }

    let window = tauri::WebviewWindowBuilder::new(
        app,
        label,
        tauri::WebviewUrl::App(url.into()),
    )
    .title(title)
    .visible(false)
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .inner_size(logical_width, logical_height)
    .position(logical_x, logical_y)
    .build()
    .map_err(|e| AppError::Tauri(e.to_string()))?;

    std::thread::sleep(std::time::Duration::from_millis(150));
    window.show().map_err(|e| AppError::Tauri(e.to_string()))?;
    window
        .set_fullscreen(true)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn open_projector_window(
    monitor_index: usize,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    open_fullscreen_window("projector", "/projector", "LouvorJA - Projector", monitor_index, &app)?;

    let mut projector_open = state
        .projector_open
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *projector_open = true;
    let _ = app.emit("projector-state-changed", true);

    Ok(())
}

#[tauri::command]
pub fn close_projector_window(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("projector") {
        window.close().map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    let mut projector_open = state
        .projector_open
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *projector_open = false;
    let _ = app.emit("projector-state-changed", false);
    Ok(())
}

#[tauri::command]
pub fn open_return_window(
    monitor_index: usize,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    open_fullscreen_window("return", "/return", "LouvorJA - Return Monitor", monitor_index, &app)?;

    let mut return_open = state
        .return_open
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *return_open = true;
    let _ = app.emit("return-state-changed", true);

    Ok(())
}

#[tauri::command]
pub fn close_return_window(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("return") {
        window.close().map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    let mut return_open = state
        .return_open
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *return_open = false;
    let _ = app.emit("return-state-changed", false);
    Ok(())
}

// Slide projection

#[tauri::command]
pub fn set_current_slide(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    app.emit("slide-changed", &slide_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let current_title = streaming_slide_title(&slide_data);
    let slide_context = {
        let mut context = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        match context.clone() {
            Some(ctx) if !ctx.title.is_empty() && ctx.title == current_title => ctx,
            _ => {
                let fallback = SlideContext {
                    next: None,
                    index: 0,
                    total: 1,
                    title: current_title,
                };
                *context = Some(fallback.clone());
                fallback
            }
        }
    };

    app.emit("slide-context", &slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    // Broadcast to SSE streaming
    if let Ok(server) = streaming_state.server.lock() {
        if slide_data.slide_type == "bible" {
            let json = serde_json::json!({
                "reference": slide_data
                    .title
                    .as_deref()
                    .or(slide_data.label.as_deref())
                    .unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
            });
            server.broadcast_bible(&json.to_string());

            let clear_music = serde_json::json!({
                "label": "",
                "text": "",
                "title": "",
            });
            server.broadcast_music(&clear_music.to_string());
        } else {
            let json = serde_json::json!({
                "label": slide_data.label.as_deref().unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
                "title": slide_data.title.as_deref().unwrap_or(""),
            });
            server.broadcast_music(&json.to_string());

            let clear_bible = serde_json::json!({
                "reference": "",
                "text": "",
            });
            server.broadcast_bible(&clear_bible.to_string());
        }

        let return_payload = build_return_stream_payload(&slide_data, Some(&slide_context));
        server.broadcast_return(&return_payload.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_current_slide(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SlideContent>, AppError> {
    let current = state
        .current_slide
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(current.clone())
}

#[tauri::command]
pub fn clear_current_slide(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = None;
    }
    {
        let mut ctx = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = None;
    }
    let _ = app.emit("slide-cleared", ());

    // Broadcast empty state to SSE streaming
    if let Ok(server) = streaming_state.server.lock() {
        let music_json = serde_json::json!({
            "label": "",
            "text": "",
            "title": "",
        });
        server.broadcast_music(&music_json.to_string());

        let bible_json = serde_json::json!({
            "reference": "",
            "text": "",
        });
        server.broadcast_bible(&bible_json.to_string());

        let return_json = serde_json::json!({
            "current": null,
            "next": null,
            "index": 0,
            "total": 0,
            "title": "",
        });
        server.broadcast_return(&return_json.to_string());
    }

    Ok(())
}

// Slide context (for return monitor)

#[tauri::command]
pub fn set_slide_context(
    context_data: SlideContext,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    {
        let mut ctx = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = Some(context_data.clone());
    }
    app.emit("slide-context", &context_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    // Broadcast to return monitor SSE
    if let Ok(server) = streaming_state.server.lock() {
        // Get current slide for the "current" panel
        let current_slide = state
            .current_slide
            .lock()
            .ok()
            .and_then(|s| s.clone());

        let json = serde_json::json!({
            "current": current_slide.map(|s| serde_json::json!({
                "label": s.label.as_deref().unwrap_or(""),
                "text": s.text.as_deref().unwrap_or(""),
                "title": s.title.as_deref().unwrap_or(""),
            })),
            "next": context_data.next.map(|s| serde_json::json!({
                "label": s.label.as_deref().unwrap_or(""),
                "text": s.text.as_deref().unwrap_or(""),
            })),
            "index": context_data.index,
            "total": context_data.total,
            "title": context_data.title,
        });
        server.broadcast_return(&json.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_slide_context(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SlideContext>, AppError> {
    let ctx = state
        .slide_context
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(ctx.clone())
}

// Overlay state (black/logo screen)

#[tauri::command]
pub fn toggle_black_screen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let mut black = state
        .is_black_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *black = !*black;
    // If black screen activates, turn off logo screen
    let mut logo = state
        .is_logo_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if *black {
        *logo = false;
    }
    let overlay = OverlayState {
        black_screen: *black,
        logo_screen: *logo,
    };
    let _ = app.emit("overlay-changed", &overlay);
    Ok(overlay)
}

#[tauri::command]
pub fn toggle_logo_screen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let mut logo = state
        .is_logo_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *logo = !*logo;
    // If logo screen activates, turn off black screen
    let mut black = state
        .is_black_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if *logo {
        *black = false;
    }
    let overlay = OverlayState {
        black_screen: *black,
        logo_screen: *logo,
    };
    let _ = app.emit("overlay-changed", &overlay);
    Ok(overlay)
}

#[tauri::command]
pub fn get_overlay_state(
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let black = state
        .is_black_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let logo = state
        .is_logo_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(OverlayState {
        black_screen: *black,
        logo_screen: *logo,
    })
}

// Monitor config persistence

#[tauri::command]
pub fn set_monitor_config(
    monitor_id: String,
    role: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::set_monitor_config(
        &conn,
        &MonitorConfig {
            id: 0,
            monitor_id,
            role,
            enabled: true,
        },
    )
}

#[tauri::command]
pub fn get_monitor_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MonitorConfig>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_monitor_configs(&conn)
}
