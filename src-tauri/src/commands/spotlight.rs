use crate::error::AppError;
use tauri::{AppHandle, Emitter, Manager};

const SPOTLIGHT_W: f64 = 680.0;
const SPOTLIGHT_H: f64 = 480.0;

#[cfg(target_os = "macos")]
#[allow(clippy::unused_unit)]
mod macos {
    use super::*;
    use monitor::get_monitor_with_cursor;
    use tauri_nspanel::{
        tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
    };

    // Define the spotlight panel class and its resign-key event handler.
    tauri_panel! {
        panel!(SpotlightPanel {
            config: {
                can_become_key_window: true,
                is_floating_panel: true,
            }
        })
        panel_event!(SpotlightEventHandler {
            window_did_resign_key(notification: &objc2_foundation::NSNotification) -> ()
        })
    }

    /// Center the window on the monitor currently under the cursor, then show it as key.
    /// Returns the (x, y) logical position used, or falls back to primary monitor / hardcoded default.
    fn center_at_cursor_monitor(win: &tauri::WebviewWindow) {
        // monitor::Monitor::size/position return PhysicalSize<f64>/PhysicalPosition<f64> (already f64).
        // tauri::Monitor returns PhysicalSize<u32>/PhysicalPosition<i32> — cast needed.
        let bounds: Option<(f64, f64, f64, f64)> = get_monitor_with_cursor()
            .map(|m| {
                let pos = m.position();
                let size = m.size();
                let scale = m.scale_factor();
                (
                    size.width / scale,
                    size.height / scale,
                    pos.x / scale,
                    pos.y / scale,
                )
            })
            .or_else(|| {
                win.app_handle().primary_monitor().ok().flatten().map(|m| {
                    let pos = m.position();
                    let size = m.size();
                    let scale = m.scale_factor();
                    (
                        size.width as f64 / scale,
                        size.height as f64 / scale,
                        pos.x as f64 / scale,
                        pos.y as f64 / scale,
                    )
                })
            });

        let (screen_w, screen_h, screen_x, screen_y) = bounds.unwrap_or((1440.0, 900.0, 0.0, 0.0));
        let x = screen_x + (screen_w - SPOTLIGHT_W) / 2.0;
        let y = screen_y + (screen_h - SPOTLIGHT_H) / 2.0;
        let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
    }

    /// Convert the pre-created spotlight window to an NSPanel with auto-hide on focus loss.
    /// Called once at startup immediately after the window is built.
    pub fn setup_spotlight_panel(app: &AppHandle) -> Result<(), AppError> {
        let win = match app.get_webview_window("spotlight") {
            Some(w) => w,
            None => return Ok(()),
        };

        // Convert the Tauri window to our SpotlightPanel NSPanel subclass.
        let panel = win
            .to_panel::<SpotlightPanel>()
            .map_err(|e| AppError::Internal(format!("nspanel to_panel: {e}")))?;

        // PopUpMenu level (101) floats above fullscreen app content.
        panel.set_level(PanelLevel::PopUpMenu.value());


        // CanJoinAllSpaces: visible on every Space including fullscreen/Split View.
        // FullScreenAuxiliary: allowed inside a fullscreen Space.
        // Transient: macOS treats this as ephemeral UI — won't switch Spaces for it.
        panel.set_collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .transient()
                .into(),
        );

        // NonactivatingPanel: accepts key events without stealing app-level focus.
        panel.set_style_mask(
            StyleMask::empty()
                .nonactivating_panel()
                .full_size_content_view()
                .into(),
        );

        // Hide panel when it loses key (user clicked elsewhere or space switch).
        // Space switches also trigger this, but the user can re-invoke the shortcut
        // to bring it back — the shortcut preserves search state on re-show.
        let panel_for_hide = panel.clone();
        let handler = SpotlightEventHandler::new();
        handler.window_did_resign_key(move |_notification| {
            panel_for_hide.hide();
        });
        panel.set_event_handler(Some(handler.as_ref()));

        Ok(())
    }

    pub fn show_spotlight_panel(app: &AppHandle) -> Result<(), AppError> {
        let win = match app.get_webview_window("spotlight") {
            Some(w) => w,
            None => return Ok(()),
        };
        center_at_cursor_monitor(&win);
        if let Ok(panel) = app.get_webview_panel("spotlight") {
            panel.show_and_make_key();
        }
        let _ = win.emit("spotlight-shown", ());
        Ok(())
    }

    pub fn hide_spotlight_panel(app: &AppHandle) {
        if let Ok(panel) = app.get_webview_panel("spotlight") {
            panel.hide();
        }
    }
}

/// Pre-creates the spotlight window at app startup, hidden, so it is ready
/// to show instantly when the user triggers the shortcut.
///
/// This is an internal helper — do NOT register it as a Tauri command.
pub fn create_spotlight_window(app: &AppHandle) -> Result<(), AppError> {
    let builder = tauri::WebviewWindowBuilder::new(
        app,
        "spotlight",
        tauri::WebviewUrl::App("/spotlight".into()),
    )
    .title("LouvorJA Search")
    .inner_size(SPOTLIGHT_W, SPOTLIGHT_H)
    .min_inner_size(SPOTLIGHT_W, SPOTLIGHT_H)
    .max_inner_size(SPOTLIGHT_W, SPOTLIGHT_H)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .transparent(true)
    .visible(false);

    // visible_on_all_workspaces is macOS/Linux only — skip on Windows to avoid unsupported API calls.
    #[cfg(not(target_os = "windows"))]
    let builder = builder.visible_on_all_workspaces(true);

    builder
    .build()
    .map_err(|e| AppError::Internal(format!("Failed to pre-create spotlight window: {e}")))?;

    // Convert to NSPanel immediately after build (macOS only).
    #[cfg(target_os = "macos")]
    macos::setup_spotlight_panel(app)?;

    Ok(())
}

/// Opens or shows the spotlight window, recentering it on the monitor under the cursor.
pub fn open_spotlight_window(app: &AppHandle) -> Result<(), AppError> {
    if app.get_webview_window("spotlight").is_none() {
        create_spotlight_window(app)?;
    }

    #[cfg(target_os = "macos")]
    return macos::show_spotlight_panel(app);

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(win) = app.get_webview_window("spotlight") {
            // Center on the primary monitor before showing.
            if let Ok(Some(monitor)) = app.primary_monitor() {
                let pos = monitor.position();
                let size = monitor.size();
                let scale = monitor.scale_factor();
                let screen_w = size.width as f64 / scale;
                let screen_h = size.height as f64 / scale;
                let screen_x = pos.x as f64 / scale;
                let screen_y = pos.y as f64 / scale;
                let x = screen_x + (screen_w - SPOTLIGHT_W) / 2.0;
                let y = screen_y + (screen_h - SPOTLIGHT_H) / 2.0;
                let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
            }

            // On Windows, show() + set_focus() must be on a background thread and
            // require a short settle delay — calling set_focus() immediately after
            // show() from the IPC thread fails silently due to Windows focus-stealing
            // prevention (SetForegroundWindow is blocked on non-foreground threads).
            std::thread::spawn(move || {
                let _ = win.show();
                std::thread::sleep(std::time::Duration::from_millis(50));
                let _ = win.set_focus();
                let _ = win.emit("spotlight-shown", ());
            });
        }
        Ok(())
    }
}

#[tauri::command]
#[specta::specta]
pub fn spotlight_open(app: AppHandle) -> Result<(), AppError> {
    open_spotlight_window(&app)
}

/// Hides the spotlight window.
fn hide_spotlight(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    macos::hide_spotlight_panel(app);

    #[cfg(not(target_os = "macos"))]
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.hide();
    }
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
