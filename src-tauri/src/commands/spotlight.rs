use crate::error::AppError;
use tauri::{AppHandle, Emitter, Manager};

const SPOTLIGHT_W: f64 = 680.0;
const SPOTLIGHT_H: f64 = 480.0;

/// On macOS, configure the spotlight window so it:
/// - appears on every Space (CanJoinAllSpaces)
/// - floats above fullscreen apps (FullScreenAuxiliary + NSPopUpMenuWindowLevel)
/// - hides automatically when the app loses focus (setHidesOnDeactivate)
/// - survives Cmd+W without being deallocated (setReleasedWhenClosed)
///
/// IMPORTANT: setLevel must be the LAST call. Changing the style mask or
/// other properties before setLevel can cause macOS to internally reset the
/// window level to its default, placing the spotlight behind fullscreen apps.
#[cfg(target_os = "macos")]
fn set_macos_collection_behavior(win: &tauri::WebviewWindow) {
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSPopUpMenuWindowLevel, NSWindowCollectionBehavior};

    if let Ok(ns_win_ptr) = win.ns_window() {
        // SAFETY: Tauri gives us the raw NSWindow pointer; we only call methods
        // that are safe on any NSWindow from the main thread.
        unsafe {
            let ns_win = &*(ns_win_ptr as *const AnyObject as *const objc2_app_kit::NSWindow);
            // CanJoinAllSpaces: visible on every Space
            // FullScreenAuxiliary: allowed to enter a fullscreen Space
            let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary;
            ns_win.setCollectionBehavior(behavior);
            // Hide automatically when the app loses focus (no IPC round-trip needed)
            ns_win.setHidesOnDeactivate(true);
            // Prevent NSWindow deallocation on close — keep alive for hide/show cycling
            ns_win.setReleasedWhenClosed(false);
            // NSPopUpMenuWindowLevel (101) floats above fullscreen app content.
            // Must be set LAST — any setStyleMask call after this resets the level.
            ns_win.setLevel(NSPopUpMenuWindowLevel);
        }
    }
}

/// Compute the centered position for the spotlight window.
/// Targets the monitor whose bounds contain the current cursor position.
/// Falls back to the primary monitor, then to a hardcoded default.
fn spotlight_position(app: &AppHandle) -> (f64, f64) {
    // Try to find which monitor the cursor is on
    let cursor_monitor: Option<tauri::Monitor> = (|| {
        let cursor = app.cursor_position().ok()?;
        let monitors = app.available_monitors().ok()?;
        monitors.into_iter().find(|m| {
            let pos = m.position();
            let size = m.size();
            let scale = m.scale_factor();
            let lx = cursor.x;
            let ly = cursor.y;
            let mx = pos.x as f64 / scale;
            let my = pos.y as f64 / scale;
            let mw = size.width as f64 / scale;
            let mh = size.height as f64 / scale;
            lx >= mx && lx < mx + mw && ly >= my && ly < my + mh
        })
    })();

    let monitor = cursor_monitor
        .or_else(|| app.primary_monitor().ok().flatten());

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

    let x = screen_x + (screen_w - SPOTLIGHT_W) / 2.0;
    let y = screen_y + (screen_h - SPOTLIGHT_H) / 2.0;
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
        let _ = win.emit("spotlight-shown", ());
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        app,
        "spotlight",
        tauri::WebviewUrl::App("/spotlight".into()),
    )
    .title("LouvorJA Search")
    .inner_size(SPOTLIGHT_W, SPOTLIGHT_H)
    .min_inner_size(SPOTLIGHT_W, SPOTLIGHT_H)
    .max_inner_size(SPOTLIGHT_W, SPOTLIGHT_H)
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

    // Show/focus/emit on all platforms; macOS collection behavior is applied
    // only on macOS so the window floats above fullscreen apps on the active Space.
    if let Some(win) = app.get_webview_window("spotlight") {
        #[cfg(target_os = "macos")]
        set_macos_collection_behavior(&win);
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("spotlight-shown", ());
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
