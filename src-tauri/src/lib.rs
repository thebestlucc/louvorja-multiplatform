mod archive;
mod audio;
mod commands;
mod db;
mod display;
mod error;
mod state;
mod streaming;

use state::{AppState, AudioState};
use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!(
        "Hello, {}! welcome to the new multiplatform LouvorJA!",
        name
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            let conn = db::init_db(&app_data_dir).expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(conn),
                current_slide: Mutex::new(None),
                projector_open: Mutex::new(false),
            });

            let audio_state = AudioState::new().expect("Failed to initialize audio state");
            app.manage(audio_state);

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
            // Bible
            commands::bible::get_bible_versions,
            commands::bible::get_books,
            commands::bible::get_verses,
            commands::bible::get_verse_range,
            commands::bible::search_bible,
            commands::bible::project_bible_verse,
            commands::bible::import_bible_version,
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
            // Audio
            commands::audio::audio_play,
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
            commands::display::set_monitor_config,
            commands::display::set_current_slide,
            commands::display::get_current_slide,
            // Streaming
            commands::streaming::start_streaming_server,
            commands::streaming::stop_streaming_server,
            commands::streaming::get_streaming_status,
            // Settings
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            // Timer
            commands::timer::start_timer,
            commands::timer::stop_timer,
            commands::timer::reset_timer,
            commands::timer::get_timer_state,
            // Utility
            commands::utility::run_lottery,
            commands::utility::format_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
