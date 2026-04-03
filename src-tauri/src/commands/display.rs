use crate::db::models::{MonitorConfig, MonitorInfo, OverlayState, SlideContent, SlideContext};
use crate::display::{
    current_monitors_signature, map_external_displays_to_monitors, normalize_monitor_label,
    detect_manufacturer, extract_model, infer_connection_type, stable_monitor_id,
    parse_monitor_id, open_fullscreen_window, update_current_slide, update_slide_context,
};
use crate::error::AppError;
use crate::projection::stop_live_utility_projection;
use crate::state::{AppState, StreamingState};
use crate::utils::catcher::catcher;
use display_info::DisplayInfo as ExternalDisplayInfo;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use crate::commands::streaming::{
    build_return_stream_payload,
    empty_return_stream_payload,
    empty_streaming_music_payload,
};

const MONITORS_CHANGED_EVENT: &str = "monitors-changed";
const MONITOR_POLL_INTERVAL: Duration = Duration::from_secs(2);

fn is_live_utility_slide(slide: &SlideContent) -> bool {
    slide.slide_type() == "cover" && matches!(slide.label(), Some("timer" | "clock"))
}

pub fn start_monitor_hotplug_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut previous_signature = current_monitors_signature(&app).unwrap_or_default();

        loop {
            std::thread::sleep(MONITOR_POLL_INTERVAL);

            let Some(current_signature) = current_monitors_signature(&app) else {
                continue;
            };

            if current_signature == previous_signature {
                continue;
            }

            previous_signature = current_signature;
            let _ = app.emit(MONITORS_CHANGED_EVENT, ());
        }
    });
}

#[tauri::command]
#[specta::specta]
pub fn get_available_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, AppError> {
    let (monitors, err) = catcher(app.available_monitors());
    if let Some(e) = err {
        return Err(e);
    }
    let monitors = monitors.unwrap();
    let external_displays = ExternalDisplayInfo::all().unwrap_or_default();
    let primary_monitor_id = app
        .primary_monitor()
        .map_err(|e| AppError::Tauri(e.to_string()))?
        .as_ref()
        .map(stable_monitor_id);
    let tauri_names = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            monitor
                .name()
                .unwrap_or(&format!("Monitor {}", index + 1))
                .to_string()
        })
        .collect::<Vec<_>>();
    let monitor_primary_flags = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let monitor_id = stable_monitor_id(monitor);
            primary_monitor_id
                .as_ref()
                .map_or(index == 0, |primary_id| primary_id == &monitor_id)
        })
        .collect::<Vec<_>>();
    let external_display_mapping = map_external_displays_to_monitors(
        &monitors,
        &tauri_names,
        &monitor_primary_flags,
        &external_displays,
    );
    let infos: Vec<MonitorInfo> = monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let size = m.size();
            let position = m.position();
            let monitor_id = stable_monitor_id(m);
            let is_primary = primary_monitor_id
                .as_ref()
                .map_or(i == 0, |primary_id| primary_id == &monitor_id);
            let external_display_info = external_display_mapping.get(i).and_then(|mapped_index| {
                mapped_index.and_then(|index| external_displays.get(index))
            });
            let tauri_name = tauri_names
                .get(i)
                .cloned()
                .unwrap_or_else(|| format!("Monitor {}", i + 1));
            let friendly_name = external_display_info
                .and_then(|display| normalize_monitor_label(&display.friendly_name));
            let name = friendly_name.clone().unwrap_or_else(|| tauri_name.clone());
            let manufacturer = friendly_name
                .as_deref()
                .and_then(detect_manufacturer)
                .or_else(|| detect_manufacturer(&tauri_name));
            let model = extract_model(
                friendly_name.as_deref(),
                manufacturer.as_deref(),
            );
            let connection_type =
                infer_connection_type(Some(&tauri_name), friendly_name.as_deref());
            MonitorInfo {
                id: monitor_id,
                name,
                friendly_name: friendly_name.clone(),
                manufacturer,
                model,
                connection_type,
                width: size.width,
                height: size.height,
                is_primary,
                x: position.x,
                y: position.y,
                scale_factor: m.scale_factor(),
            }
        })
        .collect();
    Ok(infos)
}

#[tauri::command]
#[specta::specta]
pub fn open_projector_window(
    monitor_id: String,
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("projector") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    state.projector_open.store(true, Ordering::Relaxed);
    let _ = app.emit("projector-state-changed", true);
    std::thread::spawn(move || {
        let mut final_target_id = monitor_id.clone();
        let mut target_monitor_found = false;
        for _ in 0..10 {
            if let Ok(monitors) = app.available_monitors() {
                if monitors.iter().any(|m| stable_monitor_id(m) == final_target_id) {
                    target_monitor_found = true;
                    break;
                }
                if let Some(parsed) = parse_monitor_id(&final_target_id) {
                    if let Some(m) = monitors.iter().find(|m| {
                        let m_size = m.size();
                        let m_name = m.name().map(|v| v.as_str()).unwrap_or("");
                        let mut h = std::collections::hash_map::DefaultHasher::new();
                        use std::hash::{Hash, Hasher};
                        m_name.hash(&mut h);
                        h.finish() == parsed.name_hash
                            && m_size.width == parsed.width
                            && m_size.height == parsed.height
                    }) {
                        final_target_id = stable_monitor_id(m);
                        target_monitor_found = true;
                        break;
                    }
                }
                let external_monitors: Vec<_> = monitors.iter().filter(|m| {
                    let primary_id = app.primary_monitor().ok().flatten().map(|pm| stable_monitor_id(&pm));
                    primary_id.as_ref() != Some(&stable_monitor_id(m))
                }).collect();
                if !target_monitor_found && external_monitors.len() == 1 {
                    final_target_id = stable_monitor_id(external_monitors[0]);
                    target_monitor_found = true;
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(600));
        }

        if !target_monitor_found {
            let _ = app.emit("projector-state-changed", false);
            if let Some(state) = app.try_state::<crate::state::AppState>() {
                state.projector_open.store(false, Ordering::Relaxed);
            }
            return;
        }

        if let Err(e) = open_fullscreen_window(
            &app,
            "projector",
            "/projector",
            "LouvorJA - Projector",
            &final_target_id,
        ) {
            eprintln!("[display] Failed to open projector window: {e}");
            if let Some(state) = app.try_state::<crate::state::AppState>() {
                state.projector_open.store(false, Ordering::Relaxed);
            }
            let _ = app.emit("projector-state-changed", false);
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn close_projector_window(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("projector") {
        let (_, err) = catcher(win.close());
        if let Some(e) = err {
            return Err(e);
        }
    }
    state.projector_open.store(false, Ordering::Relaxed);
    let _ = app.emit("projector-state-changed", false);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn open_return_window(
    monitor_id: String,
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("return") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    state.return_open.store(true, Ordering::Relaxed);
    let _ = app.emit("return-state-changed", true);
    std::thread::spawn(move || {
        let mut final_target_id = monitor_id.clone();
        let mut target_monitor_found = false;
        for _ in 0..10 {
            if let Ok(monitors) = app.available_monitors() {
                if monitors.iter().any(|m| stable_monitor_id(m) == final_target_id) {
                    target_monitor_found = true;
                    break;
                }
                if let Some(parsed) = parse_monitor_id(&final_target_id) {
                    if let Some(m) = monitors.iter().find(|m| {
                        let m_size = m.size();
                        let m_name = m.name().map(|v| v.as_str()).unwrap_or("");
                        let mut h = std::collections::hash_map::DefaultHasher::new();
                        use std::hash::{Hash, Hasher};
                        m_name.hash(&mut h);
                        h.finish() == parsed.name_hash
                            && m_size.width == parsed.width
                            && m_size.height == parsed.height
                    }) {
                        final_target_id = stable_monitor_id(m);
                        target_monitor_found = true;
                        break;
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(600));
        }

        if !target_monitor_found {
            let _ = app.emit("return-state-changed", false);
            if let Some(state) = app.try_state::<crate::state::AppState>() {
                state.return_open.store(false, Ordering::Relaxed);
            }
            return;
        }

        if let Err(e) = open_fullscreen_window(
            &app,
            "return",
            "/return",
            "LouvorJA - Return Monitor",
            &final_target_id,
        ) {
            eprintln!("[display] Failed to open return window: {e}");
            if let Some(state) = app.try_state::<crate::state::AppState>() {
                state.return_open.store(false, Ordering::Relaxed);
            }
            let _ = app.emit("return-state-changed", false);
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn close_return_window(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("return") {
        let (_, err) = catcher(win.close());
        if let Some(e) = err {
            return Err(e);
        }
    }
    state.return_open.store(false, Ordering::Relaxed);
    let _ = app.emit("return-state-changed", false);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_current_slide(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    if !is_live_utility_slide(&slide_data) {
        stop_live_utility_projection(&state)?;
    }
    update_current_slide(&app, &state, &streaming_state, slide_data)
}

#[tauri::command]
#[specta::specta]
pub fn set_slide_on_projector(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    if !is_live_utility_slide(&slide_data) {
        stop_live_utility_projection(&state)?;
    }
    // Enrich online_video slides with local path if the video has been downloaded
    let mut slide_data = slide_data;
    if let crate::db::models::SlideContent::OnlineVideo { ref video_id, ref mut source, ref mut url, .. } = slide_data {
        let vid = video_id.clone();
        if let Ok(conn) = state.db.get() {
            if let Ok(Some(local_path)) =
                crate::db::queries::online_videos::get_video_local_path(&conn, &vid)
            {
                if !local_path.is_empty() {
                    *source = crate::db::models::slides::VideoSource::Local;
                    *url = local_path;
                }
            }
        }
    }
    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    // Emit only to the projector window — not to all windows, not to SSE
    if let Some(projector_win) = app.get_webview_window("projector") {
        projector_win
            .emit("slide-changed", &slide_data)
            .map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_slide_on_return(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    if !is_live_utility_slide(&slide_data) {
        stop_live_utility_projection(&state)?;
    }
    // Enrich online_video slides with local path if the video has been downloaded
    let mut slide_data = slide_data;
    if let crate::db::models::SlideContent::OnlineVideo { ref video_id, ref mut source, ref mut url, .. } = slide_data {
        let vid = video_id.clone();
        if let Ok(conn) = state.db.get() {
            if let Ok(Some(local_path)) =
                crate::db::queries::online_videos::get_video_local_path(&conn, &vid)
            {
                if !local_path.is_empty() {
                    *source = crate::db::models::slides::VideoSource::Local;
                    *url = local_path;
                }
            }
        }
    }
    {
        let mut current = state
            .current_slide
            .write()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    // Emit only to the return window — not to projector, not to main
    if let Some(return_win) = app.get_webview_window("return") {
        return_win
            .emit("slide-changed", &slide_data)
            .map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    // Broadcast to SSE streaming viewers
    let app_data_dir = app.path().app_data_dir().ok();
    let adr = app_data_dir.as_deref();
    if let Ok(server) = streaming_state.server.lock() {
        let return_payload = build_return_stream_payload(&slide_data, None, adr);
        server.broadcast_return(&return_payload.to_string());
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_current_slide(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SlideContent>, AppError> {
    let (current, err) = catcher(state.current_slide.read());
    if let Some(e) = err {
        return Err(e);
    }
    let current = current.unwrap();
    Ok(current.clone())
}

#[tauri::command]
#[specta::specta]
pub fn clear_current_slide(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    stop_live_utility_projection(&state)?;
    {
        let (current, err) = catcher(state.current_slide.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut current = current.unwrap();
        *current = None;
    }
    {
        let (ctx, err) = catcher(state.slide_context.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut ctx = ctx.unwrap();
        *ctx = None;
    }
    let _ = app.emit("slide-cleared", ());

    if let Ok(server) = streaming_state.server.lock() {
        server.broadcast_music(&empty_streaming_music_payload().to_string());
        server.broadcast_bible(&serde_json::json!({ "reference": "", "text": "" }).to_string());
        server.broadcast_return(&empty_return_stream_payload().to_string());
        // Clear video state on streaming clients
        let video_clear = serde_json::json!({
            "type": "state",
            "action": "clear",
            "currentTime": null,
            "duration": null,
            "paused": true,
            "volume": null,
            "videoId": null,
            "videoSource": null,
        });
        server.broadcast_video_state(&video_clear.to_string());
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn set_slide_context(
    context_data: SlideContext,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    update_slide_context(&app, &state, &streaming_state, context_data)
}

#[tauri::command]
#[specta::specta]
pub fn get_slide_context(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SlideContext>, AppError> {
    let (ctx, err) = catcher(state.slide_context.read());
    if let Some(e) = err {
        return Err(e);
    }
    let ctx = ctx.unwrap();
    Ok(ctx.clone())
}

#[tauri::command]
#[specta::specta]
pub fn toggle_black_screen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let (overlay, err) = catcher(state.overlay.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut overlay = overlay.unwrap();
    overlay.is_black_screen = !overlay.is_black_screen;
    if overlay.is_black_screen {
        overlay.is_logo_screen = false;
    }
    let result = OverlayState {
        black_screen: overlay.is_black_screen,
        logo_screen: overlay.is_logo_screen,
        alert: Some(overlay.alert.clone()),
    };
    let _ = app.emit("overlay-changed", &result);
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn toggle_logo_screen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let (overlay, err) = catcher(state.overlay.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut overlay = overlay.unwrap();
    overlay.is_logo_screen = !overlay.is_logo_screen;
    if overlay.is_logo_screen {
        overlay.is_black_screen = false;
    }
    let result = OverlayState {
        black_screen: overlay.is_black_screen,
        logo_screen: overlay.is_logo_screen,
        alert: Some(overlay.alert.clone()),
    };
    let _ = app.emit("overlay-changed", &result);
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn get_overlay_state(state: tauri::State<'_, AppState>) -> Result<OverlayState, AppError> {
    let (overlay, err) = catcher(state.overlay.read());
    if let Some(e) = err {
        return Err(e);
    }
    let overlay = overlay.unwrap();
    Ok(OverlayState {
        black_screen: overlay.is_black_screen,
        logo_screen: overlay.is_logo_screen,
        alert: Some(overlay.alert.clone()),
    })
}

#[tauri::command]
#[specta::specta]
pub fn set_alert(
    text: String,
    is_ticker: bool,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<OverlayState, AppError> {
    let (overlay, err) = catcher(state.overlay.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut overlay = overlay.unwrap();
    overlay.alert.text = text;
    overlay.alert.is_ticker = is_ticker;
    overlay.alert.is_visible = true;

    let result = OverlayState {
        black_screen: overlay.is_black_screen,
        logo_screen: overlay.is_logo_screen,
        alert: Some(overlay.alert.clone()),
    };
    let _ = app.emit("overlay-changed", &result);

    if let Ok(server) = streaming_state.server.lock() {
        if let Ok(payload) = serde_json::to_string(&overlay.alert) {
            server.broadcast_alert(&payload);
        }
    }

    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn clear_alert(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<OverlayState, AppError> {
    let (overlay, err) = catcher(state.overlay.write());
    if let Some(e) = err {
        return Err(e);
    }
    let mut overlay = overlay.unwrap();
    overlay.alert.is_visible = false;

    let result = OverlayState {
        black_screen: overlay.is_black_screen,
        logo_screen: overlay.is_logo_screen,
        alert: Some(overlay.alert.clone()),
    };
    let _ = app.emit("overlay-changed", &result);

    if let Ok(server) = streaming_state.server.lock() {
        if let Ok(payload) = serde_json::to_string(&overlay.alert) {
            server.broadcast_alert(&payload);
        }
    }

    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn set_monitor_config(
    monitor_id: String,
    role: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::settings::set_monitor_config(
        &conn,
        &MonitorConfig { id: 0, monitor_id, role, enabled: true },
    )
}

const IDENTIFY_W: f64 = 200.0;
const IDENTIFY_H: f64 = 200.0;

#[tauri::command]
#[specta::specta]
pub fn identify_monitors(app: AppHandle) -> Result<(), AppError> {
    let (monitors, err) = catcher(app.available_monitors());
    if let Some(e) = err {
        return Err(e);
    }
    let monitors = monitors.unwrap();

    // Spawn window creation in the background to avoid blocking and stagger them
    for (index, monitor) in monitors.iter().enumerate() {
        let app_handle = app.clone();
        let monitor_clone = monitor.clone();

        tauri::async_runtime::spawn(async move {
            // Stagger window creation to reduce resource spikes
            if index > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(index as u64 * 100)).await;
            }

            let label = format!("identify-{}", index);
            let title = format!("Identify Monitor {}", index + 1);
            let url = format!("/identify?id={}", index + 1);

            // Close existing window if any
            if let Some(existing) = app_handle.get_webview_window(&label) {
                let _ = existing.close();
            }

            let position = monitor_clone.position();
            let size = monitor_clone.size();
            let scale = monitor_clone.scale_factor();

            let logical_x = position.x as f64 / scale;
            let logical_y = position.y as f64 / scale;
            let logical_h = size.height as f64 / scale;

            // Position the window at the bottom-left with a margin
            let margin = 40.0;
            let x = logical_x + margin;
            let y = logical_y + logical_h - IDENTIFY_H - margin;

            let window_result = tauri::WebviewWindowBuilder::new(
                &app_handle,
                &label,
                tauri::WebviewUrl::App(url.into()),
            )
            .title(&title)
            .visible(false)
            .decorations(false)
            .resizable(false)
            .always_on_top(true)
            .transparent(true)
            .shadow(true)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .position(x, y)
            .inner_size(IDENTIFY_W, IDENTIFY_H)
            .build();

            if let Ok(window) = window_result {
                let _ = window.show();

                // Close after 3 seconds
                let window_clone = window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                    let _ = window_clone.close();
                });
            }
        });
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_monitor_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MonitorConfig>, AppError> {
    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err {
        return Err(e);
    }
    let conn = conn.unwrap();
    crate::db::queries::settings::get_monitor_configs(&conn)
}
