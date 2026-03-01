mod archive;
mod audio;
mod commands;
mod db;
mod display;
mod error;
mod legacy_fetch;
mod migration;
mod projection;
mod state;
mod streaming;
mod video;

use state::{AppState, AudioState, OverlayRuntimeState, StreamingState, TimerRuntimeState};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};

/// Create the main window dynamically
fn create_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::utils::config::BackgroundThrottlingPolicy;

    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("/".into()))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Normal app initialization
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.unminimize();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        )
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
                legacy_fetch: Mutex::new(crate::legacy_fetch::LegacyFetchRuntimeState::default()),
                utility_projection_stop: Mutex::new(None),
                current_slide: Mutex::new(None),
                projector_open: Mutex::new(false),
                overlay: Mutex::new(OverlayRuntimeState::default()),
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
            // Music
            commands::music::search_hymns,
            commands::music::get_hymn,
            commands::music::get_albums,
            commands::music::get_hymns_by_album,
            commands::music::create_hymn,
            commands::music::update_hymn,
            commands::music::delete_hymn,
            commands::music::get_hymn_audio_path,
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
            commands::collections::get_collection_hymns,
            commands::collections::add_hymn_to_collection,
            commands::collections::remove_hymn_from_collection,
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
            commands::settings::clear_database,
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
            // Legacy Fetch
            commands::legacy_fetch::start_legacy_fetch,
            commands::legacy_fetch::get_legacy_fetch_progress,
            commands::legacy_fetch::cancel_legacy_fetch,
            commands::legacy_fetch::get_legacy_fetch_report,
            commands::legacy_fetch::fetch_legacy_params,
            commands::legacy_fetch::restore_hymn_from_api,
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
