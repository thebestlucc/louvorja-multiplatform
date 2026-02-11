use crate::db::models::{MonitorInfo, SlideContent};
use crate::error::AppError;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager};

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

#[tauri::command]
pub fn open_projector_window(
    monitor_index: usize,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
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

    // Convert physical pixels to logical pixels for Tauri window API
    let logical_width = size.width as f64 / scale;
    let logical_height = size.height as f64 / scale;
    let logical_x = position.x as f64 / scale;
    let logical_y = position.y as f64 / scale;

    // Close existing projector window if open
    if let Some(existing) = app.get_webview_window("projector") {
        let _ = existing.close();
    }

    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "projector",
        tauri::WebviewUrl::App("/projector".into()),
    )
    .title("LouvorJA - Projector")
    .visible(false)
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .inner_size(logical_width, logical_height)
    .position(logical_x, logical_y)
    .build()
    .map_err(|e| AppError::Tauri(e.to_string()))?;

    // Small delay then show + set fullscreen.
    // We use OS fullscreen for proper display coverage (covers menu bar/dock on macOS).
    // ESC handling is done in the frontend JS before the OS can intercept it.
    std::thread::sleep(std::time::Duration::from_millis(150));
    window.show().map_err(|e| AppError::Tauri(e.to_string()))?;
    window
        .set_fullscreen(true)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

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
    // Notify all windows so frontend state stays in sync
    let _ = app.emit("projector-state-changed", false);
    Ok(())
}

#[tauri::command]
pub fn set_current_slide(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
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
pub fn open_return_window() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn close_return_window() -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

#[tauri::command]
pub fn set_monitor_config(_monitor_id: String, _role: String) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
