use crate::error::AppError;
use tauri::{AppHandle, Emitter, Manager};

/// Opens or focuses the spotlight window.
/// Safe to call from the IPC thread — window creation is fast (no sleep/fullscreen retry).
pub fn open_spotlight_window(app: &AppHandle) -> Result<(), AppError> {
    // If window already exists, show and focus it
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    // Get primary monitor dimensions for centering
    let monitor = app
        .primary_monitor()
        .map_err(|e| AppError::Internal(format!("Cannot get primary monitor: {e}")))?;

    let (screen_w, screen_x, screen_y) = if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        (size.width as f64, pos.x as f64, pos.y as f64)
    } else {
        (1440.0, 0.0, 0.0)
    };

    let window_w = 640.0_f64;
    let window_h = 440.0_f64;
    let x = screen_x + (screen_w - window_w) / 2.0;
    let y = screen_y + 120.0; // ~18% from top

    tauri::WebviewWindowBuilder::new(
        app,
        "spotlight",
        tauri::WebviewUrl::App("/spotlight".into()),
    )
    .title("LouvorJA Search")
    .inner_size(window_w, window_h)
    .min_inner_size(window_w, window_h)
    .max_inner_size(window_w, window_h)
    .position(x, y)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .build()
    .map_err(|e| AppError::Internal(format!("Failed to create spotlight window: {e}")))?;

    Ok(())
}

/// Called from the spotlight window when the user selects a result.
/// - kind = "navigate": focuses main window, emits spotlight-navigated event with route
/// - kind = "action": emits spotlight-action to main window for execution
/// - kind = "hide": just hides the spotlight window
#[tauri::command]
pub fn spotlight_select(kind: String, payload: String, app: AppHandle) -> Result<(), AppError> {
    // Hide spotlight window
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.hide();
    }

    match kind.as_str() {
        "navigate" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
                let _ = main.emit("spotlight-navigated", &payload);
            }
        }
        "action" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
                let _ = main.emit("spotlight-action", &payload);
            }
        }
        _ => {}
    }

    Ok(())
}

/// Hides the spotlight window. Called when the spotlight loses focus.
#[tauri::command]
pub fn spotlight_hide(app: AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.hide();
    }
    Ok(())
}
