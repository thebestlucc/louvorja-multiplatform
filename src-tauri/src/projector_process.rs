/// Projector process module
/// Handles initialization and running of separate projector/return monitor processes
use crate::error::AppError;
use crate::state::AppState;
use std::sync::Mutex;
use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::Manager;

/// Initialize and run a projector-only process for fullscreen display
pub fn run_projector_process(
    window_type: ProjectorWindowType,
    monitor_id: String,
) -> Result<(), String> {
    let window_type_clone = window_type;
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // For projector processes, we skip most initialization
            // Just set up minimal state needed for display
            
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {e}"))?;

            // Initialize minimal state for projector
            let empty_state = AppState {
                db: Mutex::new(
                    crate::db::init_db(&app_data_dir)
                        .map_err(|e| format!("Failed to initialize database: {e}"))?,
                ),
                timer: Mutex::new(crate::state::TimerRuntimeState::default()),
                migration: Mutex::new(crate::migration::MigrationRuntimeState::default()),
                utility_projection_stop: Mutex::new(None),
                current_slide: Mutex::new(None),
                projector_open: Mutex::new(window_type == ProjectorWindowType::Projector),
                is_black_screen: Mutex::new(false),
                is_logo_screen: Mutex::new(false),
                return_open: Mutex::new(window_type == ProjectorWindowType::Return),
                slide_context: Mutex::new(None),
            };

            app.manage(empty_state);
            app.manage(crate::state::AudioState::disabled());
            app.manage(crate::state::StreamingState::new(7070));

            // Create the fullscreen window
            let label = match window_type {
                ProjectorWindowType::Projector => "projector",
                ProjectorWindowType::Return => "return",
            };
            let url = match window_type {
                ProjectorWindowType::Projector => "/projector",
                ProjectorWindowType::Return => "/return",
            };
            let title = match window_type {
                ProjectorWindowType::Projector => "LouvorJA - Projector",
                ProjectorWindowType::Return => "LouvorJA - Return Monitor",
            };

            // Open the fullscreen window
            open_fullscreen_window_in_process(
                label,
                url,
                title,
                &monitor_id,
                app.handle(),
            )
            .map_err(|e| format!("Failed to open projector window: {}", e))?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let label = window.label();
                
                // Check if this is the projector or return window we're managing
                let is_our_window = match window_type_clone {
                    ProjectorWindowType::Projector => label == "projector",
                    ProjectorWindowType::Return => label == "return",
                };
                
                if is_our_window {
                    // Update the state to reflect that the window is closed
                    if let Some(state) = window.app_handle().try_state::<AppState>() {
                        match window_type_clone {
                            ProjectorWindowType::Projector => {
                                if let Ok(mut open) = state.projector_open.lock() {
                                    *open = false;
                                }
                            }
                            ProjectorWindowType::Return => {
                                if let Ok(mut open) = state.return_open.lock() {
                                    *open = false;
                                }
                            }
                        }
                    }
                    
                    eprintln!("[louvorja] Projector window closed, exiting child process");
                    // Exit the child process cleanly when the window is closed
                    std::process::exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .map_err(|e| format!("Failed to run projector process: {e}"))?;

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectorWindowType {
    Projector,
    Return,
}

/// Open a fullscreen window within a projector process
fn open_fullscreen_window_in_process(
    label: &str,
    url: &str,
    title: &str,
    target_monitor_id: &str,
    app: &tauri::AppHandle,
) -> Result<(), AppError> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    let monitor = monitors
        .iter()
        .find(|monitor| {
            crate::commands::display::stable_monitor_id(monitor) == target_monitor_id
        })
        .or_else(|| {
            crate::commands::display::parse_legacy_monitor_index(target_monitor_id)
                .and_then(|legacy_index| monitors.get(legacy_index))
        })
        .ok_or_else(|| AppError::NotFound(format!("Monitor id {} not found", target_monitor_id)))?;

    let position = monitor.position();
    let size = monitor.size();

    // Create the window
    let window = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(url.into()))
        .title(title)
        .visible(false)
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        .fullscreen(true)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    window
        .set_size(tauri::Size::Physical(*size))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    window
        .set_position(tauri::Position::Physical(*position))
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    std::thread::sleep(std::time::Duration::from_millis(150));
    window.show().map_err(|e| AppError::Tauri(e.to_string()))?;

    // Apply fullscreen with retries
    let mut fullscreen_applied = false;
    for _ in 0..6 {
        window
            .set_fullscreen(true)
            .map_err(|e| AppError::Tauri(e.to_string()))?;
        std::thread::sleep(std::time::Duration::from_millis(120));
        let is_fullscreen = window
            .is_fullscreen()
            .map_err(|e| AppError::Tauri(e.to_string()))?;
        if is_fullscreen {
            fullscreen_applied = true;
            break;
        }
    }

    if !fullscreen_applied {
        let _ = window.maximize();
    }

    Ok(())
}
