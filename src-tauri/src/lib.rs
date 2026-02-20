mod archive;
mod audio;
mod commands;
mod db;
mod display;
mod error;
mod migration;
mod projection;
mod projector_process;
mod state;
mod streaming;
mod video;

use state::{AppState, AudioState, StreamingState, TimerRuntimeState};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};

/// Check if we should run in projector mode instead of normal app
fn should_run_projector_process() -> Option<(projector_process::ProjectorWindowType, String)> {
    let args: Vec<String> = std::env::args().collect();
    
    for (i, arg) in args.iter().enumerate() {
        match arg.as_str() {
            "--projector" | "--louvorja-projector" => {
                if i + 1 < args.len() {
                    let monitor_id = args[i + 1].clone();
                    return Some((projector_process::ProjectorWindowType::Projector, monitor_id));
                }
            }
            "--return" | "--louvorja-return" => {
                if i + 1 < args.len() {
                    let monitor_id = args[i + 1].clone();
                    return Some((projector_process::ProjectorWindowType::Return, monitor_id));
                }
            }
            _ => {}
        }
    }
    None
}

/// Create the main window dynamically
fn create_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::utils::config::BackgroundThrottlingPolicy;
    
    tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("/".into()),
    )
    .title("LouvorJA")
    .inner_size(1200.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .resizable(true)
    .fullscreen(false)
    .build()
    .map_err(|e| format!("Failed to create main window: {e}"))?;
    
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!(
        "Hello, {}! welcome to the new multiplatform LouvorJA!",
        name
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if we should run in projector/return mode (separate process)
    if let Some((window_type, monitor_id)) = should_run_projector_process() {
        match projector_process::run_projector_process(window_type, monitor_id) {
            Ok(_) => return,
            Err(e) => {
                eprintln!("[louvorja] Failed to run projector process: {}", e);
                std::process::exit(1);
            }
        }
    }

    // Normal app initialization
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {e}"))?;

            let conn = db::init_db(&app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;

            app.manage(AppState {
                db: Mutex::new(conn),
                timer: Mutex::new(TimerRuntimeState::default()),
                migration: Mutex::new(crate::migration::MigrationRuntimeState::default()),
                utility_projection_stop: Mutex::new(None),
                current_slide: Mutex::new(None),
                projector_open: Mutex::new(false),
                is_black_screen: Mutex::new(false),
                is_logo_screen: Mutex::new(false),
                return_open: Mutex::new(false),
                slide_context: Mutex::new(None),
            });

            // Initialize audio in a background thread with a timeout.
            // On Windows, WASAPI (rodio's backend) can block the calling thread
            // indefinitely when no audio device is available or a driver issue is
            // present. Running in a background thread ensures setup() completes
            // and the Tauri event loop is never blocked, preventing all invoke()
            // calls from being stuck in pending status.
            let audio_state = {
                let (tx, rx) = mpsc::channel::<Result<AudioState, String>>();
                std::thread::spawn(move || {
                    let result = AudioState::new().map_err(|e| e.to_string());
                    let _ = tx.send(result);
                });
                match rx.recv_timeout(Duration::from_secs(5)) {
                    Ok(Ok(state)) => state,
                    Ok(Err(e)) => {
                        eprintln!("[louvorja] Audio device unavailable: {e}. Audio features disabled.");
                        AudioState::disabled()
                    }
                    Err(_) => {
                        eprintln!("[louvorja] Audio initialization timed out (WASAPI hang). Audio features disabled.");
                        AudioState::disabled()
                    }
                }
            };
            app.manage(audio_state);

            app.manage(StreamingState::new(7070));
            commands::display::start_monitor_hotplug_watcher(app.handle().clone());

            // Auto-start streaming server if configured
            {
                let db_state = app.state::<AppState>();
                let conn = db_state.db.lock().map_err(|e| e.to_string())?;
                let auto_start =
                    crate::db::queries::settings::get_setting(&conn, "streaming.autoStart")
                        .ok()
                        .map(|s| s.value == "true")
                        .unwrap_or(false);
                let port = crate::db::queries::settings::get_setting(&conn, "streaming.port")
                    .ok()
                    .and_then(|s| s.value.parse::<u16>().ok())
                    .unwrap_or(7070);
                let language = crate::db::queries::settings::get_setting(&conn, "app.language")
                    .ok()
                    .map(|s| s.value)
                    .unwrap_or_else(|| "pt".to_string());
                drop(conn); // release db lock before locking streaming state

                let streaming = app.state::<StreamingState>();
                let server_result = streaming.server.lock();
                if let Ok(mut server) = server_result {
                    server.set_ui_language(&language);
                    if auto_start {
                        let _ = server.start(Some(port));
                    }
                }
            }

            // Create the main window dynamically for normal mode
            create_main_window(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // Music
            commands::music::search_hymns,
            commands::music::get_hymn,
            commands::music::get_albums,
            commands::music::get_hymns_by_album,
            commands::music::create_hymn,
            commands::music::update_hymn,
            commands::music::delete_hymn,
            // Collections
            commands::collections::get_collections,
            commands::collections::search_collections,
            commands::collections::get_collection,
            commands::collections::create_collection,
            commands::collections::update_collection,
            commands::collections::delete_collection,
            commands::collections::import_collection_song,
            commands::collections::check_collection_song_sync,
            commands::collections::resync_collection_song,
            commands::collections::remove_collection_song,
            commands::collections::reorder_collection_songs,
            // Bible
            commands::bible::get_bible_versions,
            commands::bible::get_books,
            commands::bible::get_verses,
            commands::bible::get_verse_range,
            commands::bible::search_bible,
            commands::bible::project_bible_verse,
            commands::bible::import_bible_version,
            commands::bible::navigate_bible_verse,
            // Slides
            commands::slides::get_presentations,
            commands::slides::get_presentation,
            commands::slides::create_presentation,
            commands::slides::update_presentation,
            commands::slides::delete_presentation,
            commands::slides::get_slides,
            commands::slides::create_slide,
            commands::slides::update_slide,
            commands::slides::delete_slide,
            commands::slides::reorder_slides,
            commands::slides::import_slja,
            commands::slides::export_slja,
            // Liturgy
            commands::liturgy::get_services,
            commands::liturgy::get_service,
            commands::liturgy::create_service,
            commands::liturgy::update_service,
            commands::liturgy::delete_service,
            commands::liturgy::add_service_item,
            commands::liturgy::remove_service_item,
            commands::liturgy::reorder_service_items,
            commands::liturgy::duplicate_service,
            commands::liturgy::update_service_item,
            // Audio
            commands::audio::audio_play,
            commands::audio::audio_play_alert,
            commands::audio::audio_pause,
            commands::audio::audio_resume,
            commands::audio::audio_stop,
            commands::audio::audio_seek,
            commands::audio::audio_set_volume,
            commands::audio::audio_get_position,
            commands::audio::audio_get_status,
            commands::audio::get_sync_points,
            commands::audio::save_sync_points,
            // Display
            commands::display::get_available_monitors,
            commands::display::open_projector_window,
            commands::display::close_projector_window,
            commands::display::open_return_window,
            commands::display::close_return_window,
            commands::display::set_current_slide,
            commands::display::get_current_slide,
            commands::display::clear_current_slide,
            commands::display::set_slide_context,
            commands::display::get_slide_context,
            commands::display::toggle_black_screen,
            commands::display::toggle_logo_screen,
            commands::display::get_overlay_state,
            commands::display::set_monitor_config,
            commands::display::get_monitor_configs,
            // Streaming
            commands::streaming::start_streaming_server,
            commands::streaming::stop_streaming_server,
            commands::streaming::get_streaming_status,
            commands::streaming::set_streaming_broadcast,
            // Settings
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            // Timer
            commands::timer::start_timer,
            commands::timer::pause_timer,
            commands::timer::resume_timer,
            commands::timer::reset_timer,
            commands::timer::adjust_countdown_timer,
            commands::timer::get_timer_state,
            commands::timer::add_lap,
            commands::timer::start_countdown_projection,
            commands::timer::start_stopwatch_projection,
            commands::timer::stop_utility_projection,
            commands::clock::start_clock_projection,
            // Migration
            commands::migration::start_migration,
            commands::migration::get_migration_progress,
            commands::migration::cancel_migration,
            commands::migration::get_migration_report,
            // Updater
            commands::updater::check_for_updates,
            commands::updater::install_update,
            // Utility
            commands::utility::run_lottery,
            commands::utility::format_text,
            commands::utility::copy_video_to_media,
            commands::utility::copy_image_to_media,
            commands::utility::get_video_metadata,
            commands::utility::resolve_media_path,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let label = window.label();
                let app = window.app_handle();
                match label {
                    "projector" => {
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(mut open) = state.projector_open.lock() {
                                *open = false;
                            }
                        }
                        let _ = app.emit("projector-state-changed", false);
                    }
                    "return" => {
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(mut open) = state.return_open.lock() {
                                *open = false;
                            }
                        }
                        let _ = app.emit("return-state-changed", false);
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
