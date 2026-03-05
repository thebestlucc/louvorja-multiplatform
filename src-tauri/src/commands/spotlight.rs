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

/// Compute the centered position for the spotlight window (in logical pixels).
/// Targets the monitor whose bounds contain the current cursor position.
/// Falls back to the primary monitor, then to a hardcoded default.
///
/// cursor_position() and monitor position/size are all in physical pixels.
/// We compare in physical space, then convert the result to logical for use
/// with Position::Logical and WebviewWindowBuilder::position().
fn spotlight_position(app: &AppHandle) -> (f64, f64) {
    // Try to find which monitor the cursor is on — compare in physical space.
    let cursor_monitor: Option<tauri::Monitor> = (|| {
        let cursor = app.cursor_position().ok()?; // physical pixels
        let monitors = app.available_monitors().ok()?;
        monitors.into_iter().find(|m| {
            let pos = m.position(); // physical pixels
            let size = m.size(); // physical pixels
            let px = cursor.x;
            let py = cursor.y;
            let mx = pos.x as f64;
            let my = pos.y as f64;
            let mw = size.width as f64;
            let mh = size.height as f64;
            px >= mx && px < mx + mw && py >= my && py < my + mh
        })
    })();

    let monitor = cursor_monitor
        .or_else(|| app.primary_monitor().ok().flatten());

    // Convert monitor bounds to logical pixels for positioning.
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

    // Center of the monitor in logical pixels.
    let x = screen_x + (screen_w - SPOTLIGHT_W) / 2.0;
    let y = screen_y + (screen_h - SPOTLIGHT_H) / 2.0;
    (x, y)
}

/// Opens or shows the spotlight window, always recentering it on the monitor
/// under the cursor. Safe to call from the IPC thread — no blocking operations.
///
/// On macOS, toggles ActivationPolicy to Accessory while the spotlight is
/// visible so it can float above fullscreen spaces. Reverts to Regular on hide.
pub fn open_spotlight_window(app: &AppHandle) -> Result<(), AppError> {
    let (x, y) = spotlight_position(app);

    // Switch to Accessory so the spotlight floats above fullscreen apps.
    // The Dock icon disappears momentarily but returns when we revert on hide.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);

    // If window already exists, recenter and show it.
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
        #[cfg(target_os = "macos")]
        set_macos_collection_behavior(&win);
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("spotlight-shown", ());
        return Ok(());
    }

    // Position and inner_size both accept logical pixels.
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

/// Hides the spotlight window and reverts to Regular activation policy
/// so the main app's Dock icon is restored.
fn hide_spotlight(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.hide();
    }
    // Restore Dock icon now that the spotlight is gone.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
}

/// Called from the spotlight window when the user selects a result.
/// - kind = "navigate": focuses main window, emits spotlight-navigated event with route
/// - kind = "action": emits spotlight-action to main window for execution
/// - kind = "hide": just hides the spotlight window
#[tauri::command]
#[specta::specta]
pub fn spotlight_select(kind: String, payload: String, app: AppHandle) -> Result<(), AppError> {
    hide_spotlight(&app);

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
#[specta::specta]
pub fn spotlight_hide(app: AppHandle) -> Result<(), AppError> {
    hide_spotlight(&app);
    Ok(())
}
