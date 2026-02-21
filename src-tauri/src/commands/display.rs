use crate::db::models::{MonitorConfig, MonitorInfo, OverlayState, SlideContent, SlideContext};
use crate::error::AppError;
use crate::projection::stop_live_utility_projection;
use crate::state::{AppState, StreamingState};
use display_info::DisplayInfo as ExternalDisplayInfo;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::Duration;
use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::{AppHandle, Emitter, Manager};

const MONITORS_CHANGED_EVENT: &str = "monitors-changed";
const MONITOR_POLL_INTERVAL: Duration = Duration::from_secs(2);

fn streaming_slide_title(slide: &SlideContent) -> String {
    slide
        .title
        .clone()
        .or_else(|| slide.label.clone())
        .unwrap_or_default()
}

fn is_live_utility_slide(slide: &SlideContent) -> bool {
    slide.slide_type == "cover" && matches!(slide.label.as_deref(), Some("timer" | "clock"))
}

fn streaming_slide_payload(slide: &SlideContent) -> serde_json::Value {
    let is_image = slide.slide_type == "image";
    let text_value = slide.text.as_deref().unwrap_or("");
    let video_path = slide.video_path.as_deref().unwrap_or("");
    let background_image = slide.background_image.as_deref().unwrap_or("");
    let background_color = slide.background_color.as_deref().unwrap_or("");
    let text_color = slide.text_color.as_deref().unwrap_or("");
    let audio_path = slide.audio_path.as_deref().unwrap_or("");
    let text_size = slide.text_size.unwrap_or(0);

    serde_json::json!({
        "slideType": slide.slide_type,
        "slide_type": slide.slide_type,
        "type": slide.slide_type,
        "videoPath": video_path,
        "video_path": video_path,
        "label": slide.label.as_deref().unwrap_or(""),
        "text": text_value,
        "title": slide.title.as_deref().unwrap_or(""),
        "subtitle": slide.subtitle.as_deref().unwrap_or(""),
        "backgroundImage": background_image,
        "background_image": background_image,
        "backgroundColor": background_color,
        "background_color": background_color,
        "textColor": text_color,
        "text_color": text_color,
        "textSize": text_size,
        "text_size": text_size,
        "fontSize": text_size,
        "audioPath": audio_path,
        "audio_path": audio_path,
        "src": if is_image { text_value } else { "" },
    })
}

fn empty_streaming_music_payload() -> serde_json::Value {
    serde_json::json!({
        "slideType": "",
        "slide_type": "",
        "type": "",
        "videoPath": "",
        "video_path": "",
        "label": "",
        "text": "",
        "title": "",
        "subtitle": "",
        "backgroundImage": "",
        "background_image": "",
        "backgroundColor": "",
        "background_color": "",
        "textColor": "",
        "text_color": "",
        "textSize": 0,
        "text_size": 0,
        "fontSize": 0,
        "audioPath": "",
        "audio_path": "",
        "src": "",
    })
}

fn build_return_stream_payload(
    current: &SlideContent,
    context: Option<&SlideContext>,
) -> serde_json::Value {
    let current_title = streaming_slide_title(current);
    if let Some(ctx) = context {
        if !ctx.title.is_empty() && ctx.title == current_title {
            return serde_json::json!({
                "current": streaming_slide_payload(current),
                "next": ctx.next.as_ref().map(streaming_slide_payload),
                "index": ctx.index,
                "total": ctx.total,
                "title": ctx.title,
            });
        }
    }

    serde_json::json!({
        "current": streaming_slide_payload(current),
        "next": null,
        "index": 0,
        "total": 1,
        "title": current_title,
    })
}

pub fn stable_monitor_id(monitor: &tauri::Monitor) -> String {
    let size = monitor.size();
    let position = monitor.position();
    let scale_factor = (monitor.scale_factor() * 1000.0).round() as i64;
    let name = monitor
        .name()
        .map(|value| value.to_string())
        .unwrap_or_default();

    let mut hasher = DefaultHasher::new();
    name.hash(&mut hasher);
    position.x.hash(&mut hasher);
    position.y.hash(&mut hasher);
    size.width.hash(&mut hasher);
    size.height.hash(&mut hasher);
    scale_factor.hash(&mut hasher);

    format!("monitor-{:016x}", hasher.finish())
}

pub fn parse_legacy_monitor_index(monitor_id: &str) -> Option<usize> {
    let value = monitor_id.strip_prefix("monitor-")?;
    if !value.chars().all(|char| char.is_ascii_digit()) {
        return None;
    }
    value.parse::<usize>().ok()
}

fn normalize_name(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
}

fn monitor_display_score(
    monitor: &tauri::Monitor,
    tauri_name: &str,
    monitor_is_primary: bool,
    display: &ExternalDisplayInfo,
) -> i64 {
    let size = monitor.size();
    let position = monitor.position();
    let scale_factor = monitor.scale_factor() as f32;
    let normalized_tauri_name = normalize_name(tauri_name);
    let normalized_friendly_name = normalize_name(&display.friendly_name);
    let normalized_display_name = normalize_name(&display.name);

    let mut score = 0_i64;
    let width_delta = (i64::from(display.width) - i64::from(size.width)).abs();
    let height_delta = (i64::from(display.height) - i64::from(size.height)).abs();
    let x_delta = (i64::from(display.x) - i64::from(position.x)).abs();
    let y_delta = (i64::from(display.y) - i64::from(position.y)).abs();
    let scale_delta = ((display.scale_factor - scale_factor).abs() * 1000.0).round() as i64;

    score += width_delta * 10_000;
    score += height_delta * 10_000;
    score += x_delta * 250;
    score += y_delta * 250;
    score += scale_delta * 100;

    if !normalized_tauri_name.is_empty() {
        if normalized_tauri_name == normalized_friendly_name || normalized_tauri_name == normalized_display_name {
            score -= 20_000_000;
        } else if normalized_friendly_name.contains(&normalized_tauri_name)
            || normalized_display_name.contains(&normalized_tauri_name)
        {
            score -= 5_000_000;
        }
    }

    if display.is_primary == monitor_is_primary {
        score -= 50_000;
    }

    score
}

fn map_external_displays_to_monitors(
    monitors: &[tauri::Monitor],
    tauri_names: &[String],
    monitor_primary_flags: &[bool],
    external_displays: &[ExternalDisplayInfo],
) -> Vec<Option<usize>> {
    if monitors.is_empty() || external_displays.is_empty() {
        return vec![None; monitors.len()];
    }

    let mut candidate_pairs = Vec::with_capacity(monitors.len() * external_displays.len());
    for (monitor_index, monitor) in monitors.iter().enumerate() {
        for (display_index, external_display) in external_displays.iter().enumerate() {
            let score = monitor_display_score(
                monitor,
                tauri_names.get(monitor_index).map_or("", String::as_str),
                *monitor_primary_flags.get(monitor_index).unwrap_or(&false),
                external_display,
            );
            candidate_pairs.push((score, monitor_index, display_index));
        }
    }
    candidate_pairs.sort_unstable_by_key(|(score, _, _)| *score);

    let mut assigned_display_by_monitor = vec![None; monitors.len()];
    let mut used_display = vec![false; external_displays.len()];

    for (_, monitor_index, display_index) in candidate_pairs {
        if assigned_display_by_monitor[monitor_index].is_some() {
            continue;
        }
        if used_display[display_index] {
            continue;
        }
        assigned_display_by_monitor[monitor_index] = Some(display_index);
        used_display[display_index] = true;
    }

    assigned_display_by_monitor
}

fn normalize_monitor_label(raw: &str) -> Option<String> {
    let normalized = raw.trim();
    if normalized.is_empty() {
        return None;
    }
    let lowered = normalized.to_ascii_lowercase();
    if lowered == "generic pnp monitor" || lowered == "unknown display" || lowered == "unknown" {
        return None;
    }
    Some(normalized.to_string())
}

fn detect_manufacturer(value: &str) -> Option<String> {
    let lowered = value.to_ascii_lowercase();
    const KNOWN: [(&str, &str); 15] = [
        ("apple", "Apple"),
        ("dell", "Dell"),
        ("samsung", "Samsung"),
        ("lg", "LG"),
        ("asus", "ASUS"),
        ("acer", "Acer"),
        ("aoc", "AOC"),
        ("benq", "BenQ"),
        ("msi", "MSI"),
        ("philips", "Philips"),
        ("hp", "HP"),
        ("lenovo", "Lenovo"),
        ("gigabyte", "Gigabyte"),
        ("viewsonic", "ViewSonic"),
        ("sony", "Sony"),
    ];

    KNOWN
        .iter()
        .find_map(|(needle, label)| lowered.contains(needle).then(|| (*label).to_string()))
}

fn extract_model(value: Option<&str>, manufacturer: Option<&str>) -> Option<String> {
    let raw = value?.trim();
    if raw.is_empty() {
        return None;
    }

    let Some(manufacturer) = manufacturer else {
        return Some(raw.to_string());
    };

    let mut tokens = raw.split_whitespace();
    let Some(first_token) = tokens.next() else {
        return None;
    };

    if first_token.eq_ignore_ascii_case(manufacturer) {
        let remainder = tokens.collect::<Vec<_>>().join(" ");
        return (!remainder.is_empty()).then_some(remainder);
    }

    Some(raw.to_string())
}

fn infer_connection_type(name: Option<&str>, friendly_name: Option<&str>) -> Option<String> {
    let mut combined = String::new();
    if let Some(value) = name {
        combined.push_str(value);
        combined.push(' ');
    }
    if let Some(value) = friendly_name {
        combined.push_str(value);
    }

    if combined.trim().is_empty() {
        return Some("unknown".to_string());
    }

    let lowered = combined.to_ascii_lowercase();
    if lowered.contains("built-in")
        || lowered.contains("color lcd")
        || lowered.contains("retina")
        || lowered.contains("internal")
        || lowered.contains("integrated")
    {
        return Some("integrated".to_string());
    }

    if lowered.contains("hdmi")
        || lowered.contains("displayport")
        || lowered.contains("dp-")
        || lowered.contains("dvi")
        || lowered.contains("vga")
        || lowered.contains("thunderbolt")
        || lowered.contains("usb-c")
    {
        return Some("external".to_string());
    }

    Some("unknown".to_string())
}

fn monitor_signature(monitor: &tauri::Monitor, fallback_index: usize) -> String {
    let size = monitor.size();
    let position = monitor.position();
    let scale_factor = (monitor.scale_factor() * 1000.0).round() as i64;
    let name = monitor
        .name()
        .unwrap_or(&format!("Monitor {}", fallback_index + 1))
        .to_string();

    format!(
        "{}|{}|{}|{}|{}|{}|{}",
        stable_monitor_id(monitor),
        name,
        size.width,
        size.height,
        position.x,
        position.y,
        scale_factor
    )
}

fn current_monitors_signature(app: &AppHandle) -> Option<Vec<String>> {
    let monitors = app.available_monitors().ok()?;
    Some(
        monitors
            .iter()
            .enumerate()
            .map(|(index, monitor)| monitor_signature(monitor, index))
            .collect(),
    )
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
pub fn get_available_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, AppError> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
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
            let external_display_info = external_display_mapping
                .get(i)
                .and_then(|mapped_index| mapped_index.and_then(|index| external_displays.get(index)));
            let tauri_name = tauri_names
                .get(i)
                .cloned()
                .unwrap_or_else(|| format!("Monitor {}", i + 1));
            let friendly_name = external_display_info
                .and_then(|display| normalize_monitor_label(&display.friendly_name));
            let name = friendly_name
                .clone()
                .unwrap_or_else(|| tauri_name.clone());
            let manufacturer = friendly_name
                .as_deref()
                .and_then(detect_manufacturer)
                .or_else(|| detect_manufacturer(&tauri_name));
            let model = extract_model(friendly_name.as_ref().map(|s| s.as_str()), manufacturer.as_deref());
            let connection_type = infer_connection_type(Some(&tauri_name), friendly_name.as_deref());
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

/// Opens a fullscreen window on the specified monitor.
/// MUST be called from a background thread — sleep() and fullscreen retries
/// block the calling thread and would hang IPC on all OSes.
fn open_fullscreen_window(
    app: &AppHandle,
    label: &str,
    url: &str,
    title: &str,
    target_monitor_id: &str,
) -> Result<(), AppError> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let monitor = monitors
        .iter()
        .find(|m| stable_monitor_id(m) == target_monitor_id)
        .or_else(|| {
            parse_legacy_monitor_index(target_monitor_id)
                .and_then(|i| monitors.get(i))
        })
        .ok_or_else(|| AppError::NotFound(
            format!("Monitor {} not found", target_monitor_id)
        ))?;

    let position = monitor.position();
    let size = monitor.size();

    let window = tauri::WebviewWindowBuilder::new(
        app,
        label,
        tauri::WebviewUrl::App(url.into()),
    )
    .title(title)
    .visible(false)
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .fullscreen(true)
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(false)
    .build()
    .map_err(|e| AppError::Tauri(e.to_string()))?;

    window.set_size(tauri::Size::Physical(*size))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    window.set_position(tauri::Position::Physical(*position))
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    std::thread::sleep(std::time::Duration::from_millis(150));
    window.show().map_err(|e| AppError::Tauri(e.to_string()))?;

    for _ in 0..6 {
        let _ = window.set_fullscreen(true);
        std::thread::sleep(std::time::Duration::from_millis(120));
        if window.is_fullscreen().unwrap_or(false) {
            return Ok(());
        }
    }
    let _ = window.maximize();
    Ok(())
}

#[tauri::command]
pub fn open_projector_window(
    monitor_id: String,
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    // If window already exists, just show and focus it
    if let Some(win) = app.get_webview_window("projector") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    // Mark as open optimistically before thread runs
    if let Ok(mut open) = state.projector_open.lock() {
        *open = true;
    }
    let _ = app.emit("projector-state-changed", true);
    // Spawn on background thread — window creation with sleep/retries blocks
    std::thread::spawn(move || {
        if let Err(e) = open_fullscreen_window(
            &app, "projector", "/projector", "LouvorJA - Projector", &monitor_id,
        ) {
            eprintln!("[display] Failed to open projector window: {e}");
        }
    });
    Ok(())
}

#[tauri::command]
pub fn close_projector_window(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("projector") {
        win.close().map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    if let Ok(mut open) = state.projector_open.lock() {
        *open = false;
    }
    let _ = app.emit("projector-state-changed", false);
    Ok(())
}

#[tauri::command]
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
    if let Ok(mut open) = state.return_open.lock() {
        *open = true;
    }
    let _ = app.emit("return-state-changed", true);
    std::thread::spawn(move || {
        if let Err(e) = open_fullscreen_window(
            &app, "return", "/return", "LouvorJA - Return Monitor", &monitor_id,
        ) {
            eprintln!("[display] Failed to open return window: {e}");
        }
    });
    Ok(())
}

#[tauri::command]
pub fn close_return_window(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("return") {
        win.close().map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    if let Ok(mut open) = state.return_open.lock() {
        *open = false;
    }
    let _ = app.emit("return-state-changed", false);
    Ok(())
}

// Slide projection

#[tauri::command]
pub fn set_current_slide(
    slide_data: SlideContent,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    if !is_live_utility_slide(&slide_data) {
        stop_live_utility_projection(&state)?;
    }

    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }
    app.emit("slide-changed", &slide_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let current_title = streaming_slide_title(&slide_data);
    let slide_context = {
        let mut context = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        match context.clone() {
            Some(ctx) if !ctx.title.is_empty() && ctx.title == current_title => ctx,
            _ => {
                let fallback = SlideContext {
                    next: None,
                    index: 0,
                    total: 1,
                    title: current_title,
                };
                *context = Some(fallback.clone());
                fallback
            }
        }
    };

    app.emit("slide-context", &slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    // Broadcast to SSE streaming
    if let Ok(server) = streaming_state.server.lock() {
        if slide_data.slide_type == "bible" {
            let json = serde_json::json!({
                "reference": slide_data
                    .title
                    .as_deref()
                    .or(slide_data.label.as_deref())
                    .unwrap_or(""),
                "text": slide_data.text.as_deref().unwrap_or(""),
            });
            server.broadcast_bible(&json.to_string());

            server.broadcast_music(&empty_streaming_music_payload().to_string());
        } else {
            server.broadcast_music(&streaming_slide_payload(&slide_data).to_string());

            let clear_bible = serde_json::json!({
                "reference": "",
                "text": "",
            });
            server.broadcast_bible(&clear_bible.to_string());
        }

        let return_payload = build_return_stream_payload(&slide_data, Some(&slide_context));
        server.broadcast_return(&return_payload.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_current_slide(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SlideContent>, AppError> {
    let current = state
        .current_slide
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(current.clone())
}

#[tauri::command]
pub fn clear_current_slide(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    stop_live_utility_projection(&state)?;

    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = None;
    }
    {
        let mut ctx = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = None;
    }
    let _ = app.emit("slide-cleared", ());

    // Broadcast empty state to SSE streaming
    if let Ok(server) = streaming_state.server.lock() {
        let music_json = empty_streaming_music_payload();
        server.broadcast_music(&music_json.to_string());

        let bible_json = serde_json::json!({
            "reference": "",
            "text": "",
        });
        server.broadcast_bible(&bible_json.to_string());

        let return_json = serde_json::json!({
            "current": null,
            "next": null,
            "index": 0,
            "total": 0,
            "title": "",
        });
        server.broadcast_return(&return_json.to_string());
    }

    Ok(())
}

// Slide context (for return monitor)

#[tauri::command]
pub fn set_slide_context(
    context_data: SlideContext,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    {
        let mut ctx = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *ctx = Some(context_data.clone());
    }
    app.emit("slide-context", &context_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    // Broadcast to return monitor SSE
    if let Ok(server) = streaming_state.server.lock() {
        // Get current slide for the "current" panel
        let current_slide = state.current_slide.lock().ok().and_then(|s| s.clone());

        let json = serde_json::json!({
            "current": current_slide.as_ref().map(streaming_slide_payload),
            "next": context_data.next.as_ref().map(streaming_slide_payload),
            "index": context_data.index,
            "total": context_data.total,
            "title": context_data.title,
        });
        server.broadcast_return(&json.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_slide_context(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SlideContext>, AppError> {
    let ctx = state
        .slide_context
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(ctx.clone())
}

// Overlay state (black/logo screen)

#[tauri::command]
pub fn toggle_black_screen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let mut black = state
        .is_black_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *black = !*black;
    // If black screen activates, turn off logo screen
    let mut logo = state
        .is_logo_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if *black {
        *logo = false;
    }
    let overlay = OverlayState {
        black_screen: *black,
        logo_screen: *logo,
    };
    let _ = app.emit("overlay-changed", &overlay);
    Ok(overlay)
}

#[tauri::command]
pub fn toggle_logo_screen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OverlayState, AppError> {
    let mut logo = state
        .is_logo_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *logo = !*logo;
    // If logo screen activates, turn off black screen
    let mut black = state
        .is_black_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if *logo {
        *black = false;
    }
    let overlay = OverlayState {
        black_screen: *black,
        logo_screen: *logo,
    };
    let _ = app.emit("overlay-changed", &overlay);
    Ok(overlay)
}

#[tauri::command]
pub fn get_overlay_state(state: tauri::State<'_, AppState>) -> Result<OverlayState, AppError> {
    let black = state
        .is_black_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let logo = state
        .is_logo_screen
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(OverlayState {
        black_screen: *black,
        logo_screen: *logo,
    })
}

// Monitor config persistence

#[tauri::command]
pub fn set_monitor_config(
    monitor_id: String,
    role: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::set_monitor_config(
        &conn,
        &MonitorConfig {
            id: 0,
            monitor_id,
            role,
            enabled: true,
        },
    )
}

#[tauri::command]
pub fn get_monitor_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MonitorConfig>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::settings::get_monitor_configs(&conn)
}

