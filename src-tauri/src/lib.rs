mod archive;
mod audio;
mod commands;
mod content_sync;
mod db;
mod display;
mod error;
mod ftp_sync;
mod legacy_fetch;
mod migration;
mod projection;
mod state;
mod streaming;
mod utils;
mod video;

use state::{AppState, AudioState, OverlayRuntimeState, StreamingState, TimerRuntimeState};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock};
use tauri::{Emitter, Manager};

/// Create the main window dynamically
fn create_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::utils::config::BackgroundThrottlingPolicy;

    let window =
        tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
            .title("LouvorJA Multiplatform")
            .inner_size(1200.0, 800.0)
            .min_inner_size(1000.0, 700.0)
            .background_throttling(BackgroundThrottlingPolicy::Disabled)
            .resizable(true)
            .visible(false) // Start invisible, show after setup
            .build()
            .map_err(|e| format!("Failed to create main window: {e}"))?;

    // On macOS, we might want to hide the window title bar for a more modern look
    #[cfg(target_os = "macos")]
    {
        // let _ = window.set_title_bar_style(tauri::TitleBarStyle::Overlay);
    }

    window
        .show()
        .map_err(|e| format!("Failed to show main window: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Specta builder
    let specta_builder =
        tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
            // Music
            commands::music::get_hymn,
            commands::music::search_hymns,
            commands::music::search_all_hymns,
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
            // Content Sync
            commands::content_sync::get_content_sync_summary,
            commands::content_sync::plan_content_sync,
            commands::content_sync::start_content_sync,
            commands::content_sync::get_content_sync_progress,
            commands::content_sync::cancel_content_sync,
            commands::content_sync::get_content_sync_report,
            commands::content_sync::list_ftp_files,
            commands::content_sync::download_ftp_files,
            // Bible
            commands::bible::get_bible_versions,
            commands::bible::get_books,
            commands::bible::get_verses,
            commands::bible::get_verse_range,
            commands::bible::search_bible,
            commands::bible::project_bible_verse,
            commands::bible::import_bible_version,
            commands::bible::navigate_bible_verse,
            // Favorites
            commands::favorites::toggle_favorite,
            commands::favorites::get_favorites,
            commands::favorites::get_favorite_hymns,
            commands::favorites::get_favorite_collections,
            commands::favorites::is_favorite,
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
            // Media Library
            commands::media_library::get_media_library_categories,
            commands::media_library::upsert_media_library_category,
            commands::media_library::delete_media_library_category,
            commands::media_library::get_media_library_items,
            commands::media_library::upsert_media_library_item,
            commands::media_library::delete_media_library_item,
            commands::media_library::search_media_library_items,
            // Schedules
            commands::schedules::list_schedule_departments,
            commands::schedules::save_schedule_department,
            commands::schedules::delete_schedule_department,
            commands::schedules::reorder_schedule_departments,
            commands::schedules::replace_schedule_department_members,
            commands::schedules::get_schedule_month,
            commands::schedules::save_schedule_month_days,
            commands::schedules::generate_schedule_month,
            commands::schedules::set_schedule_day_responsible_department,
            commands::schedules::save_schedule_day_assignments,
            commands::schedules::update_schedule_day_department_people_per_day,
            commands::schedules::reset_schedule_day_department_manual_override,
            // Audio
            commands::audio::audio_play,
            commands::audio::audio_play_variants,
            commands::audio::audio_play_alert,
            commands::audio::audio_pause,
            commands::audio::audio_resume,
            commands::audio::audio_set_output_muted,
            commands::audio::audio_switch_variant,
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
            commands::display::set_alert,
            commands::display::clear_alert,
            commands::display::identify_monitors,
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
            commands::settings::update_global_shortcut,
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
            commands::legacy_fetch::check_db_version,
            commands::legacy_fetch::restore_hymn_from_api,
            commands::legacy_fetch::restore_album_from_api,
            // Updater
            commands::updater::check_for_updates,
            commands::updater::install_update,
            // Utility
            commands::utility::run_lottery,
            commands::utility::format_text,
            commands::utility::scan_media_integrity,
            commands::utility::delete_excess_media,
            commands::utility::copy_video_to_media,
            commands::utility::copy_image_to_media,
            commands::utility::get_video_metadata,
            commands::utility::resolve_media_path,
            // Spotlight
            commands::spotlight::spotlight_open,
            commands::spotlight::spotlight_select,
            commands::spotlight::spotlight_hide,
        ]);

    #[cfg(debug_assertions)]
    specta_builder
        .export(
            specta_typescript::Typescript::default()
                .header(
                    "// @ts-nocheck\n// tauri-specta currently emits unused event/channel globals for this app shape.",
                )
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/lib/bindings.ts",
        )
        .expect("Failed to export specta bindings");

    // Normal app initialization
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }
    builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            specta_builder.mount_events(app);

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {e}"))?;

            let pool = db::init_db(&app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;

            app.manage(AppState {
                db: pool.clone(),
                timer: RwLock::new(TimerRuntimeState::default()),
                migration: Mutex::new(crate::migration::MigrationRuntimeState::default()),
                legacy_fetch: Mutex::new(crate::legacy_fetch::LegacyFetchRuntimeState::default()),
                content_sync: Mutex::new(crate::content_sync::ContentSyncRuntimeState::default()),
                utility_projection_stop: Mutex::new(None),
                current_slide: RwLock::new(None),
                projector_open: AtomicBool::new(false),
                overlay: RwLock::new(OverlayRuntimeState::default()),
                return_open: AtomicBool::new(false),
                slide_context: RwLock::new(None),
                global_shortcuts: RwLock::new(std::collections::HashMap::new()),
            });

            app.manage(AudioState::default());

            // Initialize Streaming Server State
            app.manage(StreamingState::default());

            commands::display::start_monitor_hotplug_watcher(app.handle().clone());

            // Create main window after setup
            create_main_window(app.handle())?;

            // Pre-create the spotlight window hidden so it lives on the current
            // OS Space. When the user triggers the shortcut, open_spotlight_window()
            // simply repositions and shows it — no Space switch occurs.
            if let Err(e) = commands::spotlight::create_spotlight_window(app.handle()) {
                eprintln!("[spotlight] Failed to pre-create spotlight window: {e}");
            }

            // Auto-start streaming server if configured
            {
                let db_state = app.state::<AppState>();
                let conn = db_state.db.get().map_err(|e| e.to_string())?;
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
                drop(conn); // release connection back to pool before locking streaming state

                if auto_start {
                    let streaming = app.state::<StreamingState>();
                    let server_result = streaming.server.lock();
                    if let Ok(mut server) = server_result {
                        server.set_ui_language(&language);
                        if let Err(e) = server.start(Some(port)) {
                            eprintln!("[streaming] Failed to auto-start: {e}");
                        } else {
                            println!("[streaming] Auto-started on port {port}");
                        }
                    }
                }
            }

            // Register global shortcuts from settings
            {
                let global_defaults = [
                    ("app-command-palette", "CmdOrCtrl+Shift+K"),
                    ("app-shortcuts-help", "Alt+H"),
                ];

                let db_state = app.state::<AppState>();
                let conn = db_state.db.get().map_err(|e| e.to_string())?;
                let mut shortcuts_map = db_state
                    .global_shortcuts
                    .write()
                    .map_err(|e| e.to_string())?;

                for (action, default_str) in global_defaults {
                    let key = format!("shortcut.{}.global", action);
                    let combo_str = crate::db::queries::settings::get_setting(&conn, &key)
                        .ok()
                        .map(|s| s.value)
                        .filter(|v| !v.is_empty())
                        .unwrap_or_else(|| default_str.to_string());

                    if !combo_str.is_empty() {
                        if let Ok(normalized) = commands::settings::register_global_shortcut(
                            action,
                            &combo_str,
                            app.handle(),
                        ) {
                            shortcuts_map.insert(action.to_string(), normalized);
                        }
                    }
                }
                drop(conn);
                drop(shortcuts_map);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                match window.label() {
                    "projector" => {
                        let state = window.state::<AppState>();
                        state.projector_open.store(false, Ordering::Relaxed);
                        let _ = window.emit("projector-state-changed", false);
                    }
                    "return" => {
                        let state = window.state::<AppState>();
                        state.return_open.store(false, Ordering::Relaxed);
                        let _ = window.emit("return-state-changed", false);
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
