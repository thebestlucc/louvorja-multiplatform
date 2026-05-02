mod archive;
mod audio;
mod bible;
pub mod bible_builder;
mod commands;
mod content_sync;
mod db;
mod display;
mod error;
mod http_sync;
mod pack_sync;
mod migration;
pub mod net;
mod projection;
pub mod remote;
mod state;
mod streaming;
mod utils;
mod video;
pub mod video_pipeline;
mod video_server;
mod youtube;
mod ytdlp;

use state::{AppState, AudioState, OverlayRuntimeState, StreamingState, TimerRuntimeState, VideoServerState};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
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
    // Cap Tokio thread pool for low-memory systems (≤8GB target).
    // Default spawns num_cpus threads (~8MB stack each); 2 is sufficient
    // for this app's async workload (HTTP fetches, pack sync).
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");
    tauri::async_runtime::set(rt.handle().clone());

    // Specta builder
    let specta_builder =
        tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
            // Music
            commands::music::get_hymn,
            commands::music::search_hymns,
            commands::music::search_hymns_list,
            commands::music::search_all_hymns,
            commands::music::search_all_music,
            commands::music::get_albums,
            commands::music::get_hymns_by_album,
            commands::music::create_hymn,
            commands::music::update_hymn,
            commands::music::delete_hymn,
            commands::music::get_hymn_audio_path,
            // Collections
            commands::collections::get_collections,
            commands::collections::search_collections,
            commands::collections::search_collections_content,
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
            commands::bible::search_bible_global,
            commands::bible::project_bible_verse,
            commands::bible::import_bible_version,
            commands::bible::navigate_bible_verse,
            commands::bible::navigate_bible,
            commands::bible::clear_bible_projection,
            // Favorites
            commands::favorites::toggle_favorite,
            commands::favorites::get_favorites,
            commands::favorites::get_favorite_hymns,
            commands::favorites::get_favorite_collections,
            commands::favorites::is_favorite,
            commands::favorites::get_all_favorite_ids,
            // Slides
            commands::slides::get_presentations,
            commands::slides::get_presentation,
            commands::slides::create_presentation,
            commands::slides::update_presentation,
            commands::slides::delete_presentation,
            commands::slides::get_slides,
            commands::slides::get_slides_batch,
            commands::slides::create_slide,
            commands::slides::update_slide,
            commands::slides::delete_slide,
            commands::slides::reorder_slides,
            commands::slides::import_slja,
            commands::slides::export_slja,
            commands::slides::update_slide_notes,
            commands::slides::update_slide_transition,
            commands::slides::import_pptx,
            commands::slides::export_pptx,
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
            commands::liturgy::set_service_week_day,
            commands::liturgy::move_service_item_to_parent,
            commands::liturgy::delete_categories_by_title,
            commands::liturgy::count_category_usages,
            // Media Library
            commands::media_library::get_media_library_categories,
            commands::media_library::upsert_media_library_category,
            commands::media_library::delete_media_library_category,
            commands::media_library::get_media_library_items,
            commands::media_library::get_media_library_items_by_date,
            commands::media_library::get_media_library_item_dates,
            commands::media_library::upsert_media_library_item,
            commands::media_library::delete_media_library_item,
            commands::media_library::search_media_library_items,
            commands::media_library::get_scheduled_media_item,
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
            commands::display::set_slide_on_projector,
            commands::display::set_slide_on_return,
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
            commands::streaming::broadcast_video_state_to_streaming,
            // Remote
            commands::remote::start_remote_server,
            commands::remote::stop_remote_server,
            commands::remote::get_remote_status,
            commands::remote::begin_pairing,
            commands::remote::cancel_pairing,
            commands::remote::list_paired_devices,
            commands::remote::revoke_paired_device,
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
            // Updater
            commands::updater::check_for_updates,
            commands::updater::install_update,
            commands::settings::broadcast_projection_display,
            commands::settings::broadcast_projection_display_full,
            // Utility
            commands::text_tools::run_lottery,
            commands::text_tools::format_text,
            commands::video_copy::copy_image_to_media,
            commands::video_copy::copy_video_to_media,
            commands::utility::get_video_metadata,
            commands::utility::open_app_data_folder,
            // Spotlight
            commands::spotlight::spotlight_open,
            commands::spotlight::spotlight_select,
            commands::spotlight::spotlight_hide,
            // Pack Sync
            commands::pack_sync::plan_pack_sync,
            commands::pack_sync::start_pack_sync,
            commands::pack_sync::cancel_pack_sync,
            commands::pack_sync::clear_manifest_cache,
            commands::pack_sync::diagnose_pack_paths,
            // YouTube
            commands::youtube::validate_youtube_api_key,
            commands::youtube::fetch_youtube_channel,
            commands::youtube::add_youtube_playlist,
            commands::youtube::get_youtube_playlists,
            commands::youtube::get_youtube_playlist_videos,
            commands::youtube::refresh_youtube_playlist,
            commands::youtube::delete_youtube_playlist,
            commands::youtube::delete_video_local_file,
            // yt-dlp
            commands::youtube::ensure_ytdlp,
            commands::youtube::update_ytdlp,
            commands::youtube::download_online_video,
            commands::youtube::cancel_download,
            // Online Playlists search
            commands::youtube::search_online_playlists,
            commands::youtube::find_online_video_by_yt_id,
            commands::youtube::create_custom_playlist,
            commands::youtube::update_online_playlist_cover,
            // Video Server
            commands::video_server::start_video_server,
            commands::video_server::get_video_server_status,
            // Slide Passer
            commands::slide_passer::send_keystroke,
            commands::slide_passer::check_accessibility_permission,
            // Video Pipeline (Rust GStreamer pipeline)
            commands::video_pipeline::video_pipeline_load,
            commands::video_pipeline::video_pipeline_play,
            commands::video_pipeline::video_pipeline_pause,
            commands::video_pipeline::video_pipeline_seek,
            commands::video_pipeline::video_pipeline_set_volume,
            commands::video_pipeline::video_pipeline_set_loop,
            commands::video_pipeline::video_pipeline_restart,
            commands::video_pipeline::video_pipeline_subscribe,
            commands::video_pipeline::video_pipeline_unsubscribe,
            commands::video_pipeline::video_pipeline_answer,
            commands::video_pipeline::video_pipeline_ice,
            commands::video_pipeline::video_pipeline_unload,
            commands::video_pipeline::video_pipeline_attach_window,
            commands::video_pipeline::video_pipeline_detach_window,
            commands::video_pipeline::video_pipeline_refresh_sinks,
            commands::video_pipeline::set_video_pipeline_flag,
        ])
        .events(tauri_specta::collect_events![
            crate::video_pipeline::events::VideoPipelineOffer,
            crate::video_pipeline::events::VideoPipelineIce,
            crate::video_pipeline::events::VideoPipelineState,
            crate::video_pipeline::events::VideoPipelineEnded,
            crate::video_pipeline::events::VideoPipelineSinkDegraded,
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
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["spotlight", "projector", "return", "identify"])
                .build(),
        )
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

            // Point GStreamer at the bundled plugin directory BEFORE any
            // video_pipeline command can run `gst::init()`. Release builds
            // ship `Resources/gstreamer-runtime/gstreamer-1.0/` via build.rs
            // (see Phase 5 in docs/plans/2026-04-17-rust-video-pipeline.md).
            //
            // Dev builds intentionally skip this: `cargo build` doesn't
            // repopulate the runtime dir (build.rs clears it in debug), but
            // stale files from a prior release build can linger in
            // `target/debug/gstreamer-runtime/`. Those stale plugins have
            // @rpath references to core libs that aren't co-located, and
            // `gst-plugin-scanner` logs a scary dlopen failure for each. The
            // system Homebrew install (/opt/homebrew, /usr/local) or the
            // framework install at /Library/Frameworks handles dev fine.
            #[cfg(all(
                not(debug_assertions),
                any(target_os = "macos", target_os = "windows"),
            ))]
            {
                if let Ok(resource_dir) = app.path().resource_dir() {
                    let runtime = resource_dir.join("gstreamer-runtime");
                    let plugin_path = runtime.join("gstreamer-1.0");
                    if plugin_path.exists() {
                        // Safety: single-threaded setup phase — no other
                        // threads observe env vars concurrently here.
                        unsafe {
                            std::env::set_var("GST_PLUGIN_PATH", &plugin_path);
                        }
                    }
                    // Windows: `LoadLibrary` searches the exe dir, system dirs,
                    // current dir, and PATH — but NOT `bundle.resources`
                    // subdirectories. Core DLLs (gstreamer-1.0-0.dll, etc.)
                    // land at `gstreamer-runtime/bin/`, so prepend that dir
                    // to PATH before any gst::init() runs.
                    // macOS core dylibs live at `gstreamer-runtime/lib/` and
                    // are found via dyld's @rpath / fallback paths, so no
                    // equivalent is needed there.
                    #[cfg(target_os = "windows")]
                    {
                        let bin_dir = runtime.join("bin");
                        if bin_dir.exists() {
                            let current_path = std::env::var("PATH").unwrap_or_default();
                            let new_path =
                                format!("{};{}", bin_dir.display(), current_path);
                            unsafe {
                                std::env::set_var("PATH", new_path);
                            }
                        }
                    }
                }
            }

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {e}"))?;

            let pool = db::init_db(&app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;

            // Initialize dedicated bible.db.
            // Platform installer hooks (NSIS, deb, rpm) generate bible.db during
            // installation. On macOS/AppImage (no install hooks) or if the installer
            // hook failed, generate on first launch from bundled .sqlite sources.
            let bible_db_path = app_data_dir.join("bible.db");
            if !bible_db_path.exists() {
                // In dev, resources live at {CARGO_MANIFEST_DIR}/resources/.
                // In release, tauri.conf.json `"resources/bible/*.sqlite"` places
                // files at {resource_dir}/resources/bible/*.sqlite (path preserved).
                let bible_source_dir = if cfg!(debug_assertions) {
                    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("resources")
                        .join("bible")
                } else {
                    app.path().resource_dir()?.join("resources").join("bible")
                };

                // Linux deb/rpm postinst generates bible.db next to the source dir
                let resource_bible_db = bible_source_dir.with_file_name("bible.db");
                if resource_bible_db.exists() {
                    eprintln!("[app] Copying bible.db from install directory...");
                    let tmp_path = bible_db_path.with_extension("db.tmp");
                    std::fs::copy(&resource_bible_db, &tmp_path)
                        .map_err(|e| format!("Failed to copy bible.db: {e}"))?;
                    std::fs::rename(&tmp_path, &bible_db_path)
                        .map_err(|e| format!("Failed to install bible.db: {e}"))?;
                } else if bible_source_dir.exists() {
                    // macOS / AppImage / fallback: generate from bundled .sqlite files
                    eprintln!("[app] Generating bible.db from bundled sources (first launch)...");
                    match bible_builder::build_bible_db(&bible_source_dir, &bible_db_path) {
                        Ok(_) => eprintln!("[app] bible.db generated successfully"),
                        Err(e) => eprintln!("[app] Failed to generate bible.db: {e} — bible features will be unavailable"),
                    }
                } else {
                    eprintln!("[app] Bible source files not found at {} — bible features will be unavailable", bible_source_dir.display());
                }
            }
            let bible_pool = db::init_bible_db(&bible_db_path)
                .map_err(|e| format!("Failed to initialize bible database: {e}"))?;

            let mut font_system = cosmic_text::FontSystem::new();
            if let Ok(resource_dir) = app.path().resource_dir() {
                let fonts_dir = resource_dir.join("fonts");
                if fonts_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(&fonts_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.extension().map(|e| e == "ttf").unwrap_or(false) {
                                if let Ok(data) = std::fs::read(&path) {
                                    font_system.db_mut().load_font_data(data);
                                }
                            }
                        }
                    }
                }
            }

            // Build the video pipeline runtime singleton up front so it can
            // be moved into AppState. Signaling channel forwards offers/ICE
            // through the typed `VideoPipeline*` events to the frontend.
            // The AppHandle is also passed to the runtime so its 10 Hz state
            // broadcaster (Task 2.3) can emit `VideoPipelineState` events.
            let video_signaling: std::sync::Arc<dyn crate::video_pipeline::SignalingChannel> =
                std::sync::Arc::new(crate::video_pipeline::TauriSignalingChannel::new(
                    app.handle().clone(),
                ));
            let video_pipeline_runtime = std::sync::Arc::new(
                crate::video_pipeline::VideoPipelineRuntime::new(
                    Some(app.handle().clone()),
                    video_signaling,
                ),
            );

            app.manage(AppState {
                db: pool.clone(),
                bible_db: bible_pool,
                content_dbs: std::sync::Arc::new(std::sync::RwLock::new(
                    std::collections::HashMap::new(),
                )),
                content_db_capabilities: std::sync::Arc::new(std::sync::RwLock::new(
                    std::collections::HashMap::new(),
                )),
                timer: RwLock::new(TimerRuntimeState::default()),
                migration: Mutex::new(crate::migration::MigrationRuntimeState::default()),
                pack_sync: Mutex::new(crate::state::PackSyncRuntimeState::default()),
                ytdlp: Mutex::new(crate::state::YtdlpRuntimeState::default()),
                utility_projection_stop: Mutex::new(None),
                timer_update_stop: Mutex::new(None),
                current_slide: RwLock::new(None),
                current_slide_version: AtomicU64::new(0),
                projector_open: AtomicBool::new(false),
                overlay: RwLock::new(OverlayRuntimeState::default()),
                return_open: AtomicBool::new(false),
                slide_context: RwLock::new(None),
                global_shortcuts: RwLock::new(std::collections::HashMap::new()),
                bible_projection: Mutex::new(state::BibleProjectionState {
                    font_system,
                    current: None,
                    next: None,
                    prev: None,
                    context: None,
                    projector_size: None,
                    part_index: 0,
                }),
                remote: crate::remote::state::RemoteServerState::default(),
                video_pipeline: Some(video_pipeline_runtime),
            });

            // Manage a disabled AudioState immediately (non-blocking).
            // A background thread attempts real audio init with a 5s timeout;
            // on success it swaps in the real AudioPlayer.
            app.manage(AudioState::disabled());
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let (tx, rx) = std::sync::mpsc::channel::<Result<crate::audio::AudioPlayer, crate::error::AppError>>();
                    std::thread::spawn(move || {
                        tx.send(crate::audio::AudioPlayer::new()).ok();
                    });
                    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
                        Ok(Ok(player)) => {
                            let state = handle.state::<AudioState>();
                            match state.player.write() {
                                Ok(mut guard) => *guard = player,
                                Err(e) => eprintln!("[audio] failed to swap in player: {e}"),
                            };
                        }
                        Ok(Err(e)) => eprintln!("[audio] init failed: {e}"),
                        Err(_) => eprintln!("[audio] init timed out — staying disabled"),
                    }
                });
            }

            // Initialize Streaming Server State
            app.manage(StreamingState::default());

            // Initialize Video Server State (loopback-only, for serving local video files)
            app.manage(VideoServerState::default());

            // Background thread for non-critical startup tasks:
            // content DB scan + global shortcut registration
            {
                let bg_handle = app.handle().clone();
                let bg_app_data_dir = app_data_dir.clone();
                std::thread::spawn(move || {
                    // Startup scan: open existing content-*.db files
                    let state = bg_handle.state::<AppState>();
                    let mut loaded_any = false;
                    if let Ok(entries) = std::fs::read_dir(&bg_app_data_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            let name = path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_string();
                            if name.starts_with("content-") && name.ends_with(".db") {
                                let lang = name
                                    .strip_prefix("content-")
                                    .unwrap_or("")
                                    .strip_suffix(".db")
                                    .unwrap_or("")
                                    .to_string();
                                if !lang.is_empty() {
                                    if let Ok(p) =
                                        crate::db::queries::content_sync::open_content_db_pool(&path)
                                    {
                                        if let Ok(conn) = p.get() {
                                            let _ = crate::db::queries::content_sync::init_content_db_fts(&conn, &lang);
                                            crate::db::queries::content_sync::ensure_content_db_indexes(&conn);
                                        }
                                        // Capabilities inserted before pool so any concurrent reader that sees the pool
                                        // will also find a capability entry. If this write fails, the pool is still inserted
                                        // below and callers fall back to live sqlite_master probes (correct, slower).
                                        if let Ok(cap_conn) = p.get() {
                                            let caps = crate::db::queries::music::probe_content_db_capabilities(&cap_conn);
                                            if let Ok(mut cap_map) = state.content_db_capabilities.write() {
                                                cap_map.insert(lang.clone(), caps);
                                            }
                                        }
                                        if let Ok(mut map) = state.content_dbs.write() {
                                            map.insert(lang, p);
                                            loaded_any = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // Notify frontend so it refetches hymn/collection queries
                    // that may have returned empty before DBs were ready.
                    if loaded_any {
                        let _ = bg_handle.emit("data-changed", ());
                    }

                    // Register global shortcuts from settings
                    let global_defaults = [
                        ("app-command-palette", "CmdOrCtrl+Shift+K"),
                        ("app-shortcuts-help", "Alt+H"),
                    ];

                    if let Ok(conn) = state.db.get() {
                        if let Ok(mut shortcuts_map) = state.global_shortcuts.write() {
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
                                        &bg_handle,
                                    ) {
                                        shortcuts_map.insert(action.to_string(), normalized);
                                    }
                                }
                            }
                        }
                    }
                });
            }

            commands::display::start_monitor_hotplug_watcher(app.handle().clone());

            // Create main window after setup
            create_main_window(app.handle())?;

            // Pre-create spotlight window hidden so its webview is prewarmed.
            // This ensures the React event listener for "spotlight-shown" is
            // registered before the user first opens the palette (first-open
            // race condition fix, especially on Windows).
            if let Err(e) = commands::spotlight::create_spotlight_window(app.handle()) {
                eprintln!("[spotlight] Failed to pre-create window: {e}");
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
                        // CD-1: a closed projector window leaves both the
                        // legacy WebRTC consumer (peer connection) AND the
                        // native sink branch (tee request pad + queue + conv +
                        // glimagesink/d3d11videosink) attached to the shared
                        // pipeline. WebView teardown skips the React
                        // useEffect cleanup on abrupt close, so without this
                        // both ends leak — the WebRTC peer holds a dead
                        // window's NSView and the tee branch keeps copying
                        // frames into nothing, eventually backpressuring the
                        // tee. Detach BOTH so neither path is left dangling
                        // regardless of which one was active for this window.
                        if let Some(vp) = &state.video_pipeline {
                            if let Err(e) = vp.unsubscribe("projector") {
                                log::warn!(
                                    "close handler: unsubscribe('projector') failed: {e}"
                                );
                            }
                            if let Err(e) = vp.detach_window("projector") {
                                log::warn!(
                                    "close handler: detach_window('projector') failed: {e}"
                                );
                            }
                        }
                    }
                    "return" => {
                        let state = window.state::<AppState>();
                        state.return_open.store(false, Ordering::Relaxed);
                        let _ = window.emit("return-state-changed", false);
                        if let Some(vp) = &state.video_pipeline {
                            if let Err(e) = vp.unsubscribe("return") {
                                log::warn!(
                                    "close handler: unsubscribe('return') failed: {e}"
                                );
                            }
                            if let Err(e) = vp.detach_window("return") {
                                log::warn!(
                                    "close handler: detach_window('return') failed: {e}"
                                );
                            }
                        }
                    }
                    "main" => {
                        let state = window.state::<AppState>();
                        if let Ok(conn) = state.db.get() {
                            let _ = conn.execute_batch("PRAGMA optimize;");
                        }

                        let app = window.app_handle();

                        if let Some(audio) = app.try_state::<AudioState>() {
                            if let Ok(mut player) = audio.player.write() {
                                player.stop();
                            }
                        }

                        if let Ok(pack_sync) = state.pack_sync.lock() {
                            for flag in pack_sync.cancel_flags.values() {
                                flag.store(true, Ordering::Relaxed);
                            }
                        }

                        if let Ok(ytdlp) = state.ytdlp.lock() {
                            for flag in ytdlp.cancel_flags.values() {
                                flag.store(true, Ordering::Relaxed);
                            }
                        }

                        if let Some(w) = app.get_webview_window("projector") {
                            state.projector_open.store(false, Ordering::Relaxed);
                            let _ = w.emit("projector-state-changed", false);
                            let _ = w.close();
                        }
                        if let Some(w) = app.get_webview_window("return") {
                            state.return_open.store(false, Ordering::Relaxed);
                            let _ = w.emit("return-state-changed", false);
                            let _ = w.close();
                        }
                        if let Some(w) = app.get_webview_window("spotlight") {
                            let _ = w.close();
                        }
                        for w in app.webview_windows().values() {
                            if w.label().starts_with("identity") {
                                let _ = w.close();
                            }
                        }

                        // server.stop() joins background threads — run off the event loop
                        // to avoid blocking the main thread on shutdown.
                        let app_for_shutdown = app.clone();
                        std::thread::spawn(move || {
                            if let Some(streaming) = app_for_shutdown.try_state::<StreamingState>() {
                                if let Ok(mut server) = streaming.server.lock() {
                                    server.stop();
                                }
                            }
                            if let Some(video_server) = app_for_shutdown.try_state::<VideoServerState>() {
                                if let Ok(mut server) = video_server.server.lock() {
                                    server.stop();
                                }
                            }
                            // Phase I4: stop remote server and join its thread.
                            // stop() signals the axum shutdown channel then joins the tokio
                            // runtime thread, so remote tasks terminate before process exit.
                            if let Some(app_state) = app_for_shutdown.try_state::<AppState>() {
                                if let Ok(mut srv_opt) = app_state.remote.server_handle.lock() {
                                    if let Some(srv) = srv_opt.as_mut() {
                                        srv.stop();
                                    }
                                }
                            }
                            app_for_shutdown.exit(0);
                        });
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
