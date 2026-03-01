use crate::error::AppError;
use tauri::{AppHandle, Emitter, Manager};

/// On macOS, set NSWindowCollectionBehavior so the spotlight window appears above
/// fullscreen apps on whichever Space is currently active.
///
/// Flags used:
///   CanJoinAllSpaces   (1 << 0) — visible on every Space
///   FullScreenAuxiliary (1 << 8) — slides over fullscreen apps instead of hiding
#[cfg(target_os = "macos")]
fn set_macos_collection_behavior(win: &tauri::WebviewWindow) {
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSStatusWindowLevel, NSWindowCollectionBehavior};

    if let Ok(ns_win_ptr) = win.ns_window() {
        // SAFETY: Tauri gives us the raw NSWindow pointer; we only call methods
        // that are safe on any NSWindow from the main thread.
        unsafe {
            let ns_win = &*(ns_win_ptr as *const AnyObject as *const objc2_app_kit::NSWindow);
            // CanJoinAllSpaces: visible on every Space
            // FullScreenAuxiliary: slides over fullscreen apps instead of hiding
            let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary;
            ns_win.setCollectionBehavior(behavior);
            // NSStatusWindowLevel (25) keeps the window above normal app windows
            // AND above fullscreen apps — required for the FullScreenAuxiliary
            // behavior to actually float the window on top.
            ns_win.setLevel(NSStatusWindowLevel);
        }
    }
}

/// Compute the centered position for the spotlight window on the primary monitor.
fn spotlight_position(app: &AppHandle) -> (f64, f64) {
    let monitor = app.primary_monitor().ok().flatten();
    let (screen_w, screen_h, screen_x, screen_y) = if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        (
            size.width as f64 / scale,
            size.height as f64 / scale,
            pos.x as f64 / scale,
            pos.y as f64 / scale,
        )
    } else {
        (1440.0, 900.0, 0.0, 0.0)
    };
    let window_w = 680.0_f64;
    let window_h = 480.0_f64;
    let x = screen_x + (screen_w - window_w) / 2.0;
    let y = screen_y + (screen_h - window_h) / 2.0;
    (x, y)
}

/// Opens or shows the spotlight window, always recentering it on the primary monitor.
/// Safe to call from the IPC thread — no blocking operations.
pub fn open_spotlight_window(app: &AppHandle) -> Result<(), AppError> {
    let (x, y) = spotlight_position(app);

    // If window already exists, recenter, show, and focus it
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        }));
        #[cfg(target_os = "macos")]
        set_macos_collection_behavior(&win);
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let window_w = 680.0_f64;
    let window_h = 480.0_f64;

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
    .transparent(true)
    // macOS: appear on whichever Space is active when shown, not pinned to the
    // Space where the main window lives.
    .visible_on_all_workspaces(true)
    .build()
    .map_err(|e| AppError::Internal(format!("Failed to create spotlight window: {e}")))?;

    // Apply macOS collection behavior after creation so the window floats
    // above fullscreen apps on the currently active Space.
    #[cfg(target_os = "macos")]
    if let Some(win) = app.get_webview_window("spotlight") {
        set_macos_collection_behavior(&win);
    }

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
