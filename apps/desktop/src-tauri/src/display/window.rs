use tauri::{AppHandle, Manager};
use crate::error::AppError;
use crate::display::monitor::{stable_monitor_id, parse_monitor_id, parse_legacy_monitor_index};
use tauri::utils::config::BackgroundThrottlingPolicy;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub fn open_fullscreen_window(
    app: &AppHandle,
    label: &str,
    url: &str,
    title: &str,
    target_monitor_id: &str,
) -> Result<(), AppError> {
    eprintln!("[display] Seeking monitor for label {label}: {target_monitor_id}");
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let monitor = monitors
        .iter()
        .find(|m| stable_monitor_id(m) == target_monitor_id)
        .or_else(|| {
            // Fuzzy match for structured IDs (v2) if exact match fails
            if let Some(parsed) = parse_monitor_id(target_monitor_id) {
                let candidates: Vec<_> = monitors
                    .iter()
                    .filter(|m| {
                        let m_size = m.size();
                        let m_name = m.name().map(|v| v.as_str()).unwrap_or("");
                        let mut h = DefaultHasher::new();
                        m_name.hash(&mut h);
                        h.finish() == parsed.name_hash
                            && m_size.width == parsed.width
                            && m_size.height == parsed.height
                    })
                    .collect();

                if !candidates.is_empty() {
                    return candidates.into_iter().min_by_key(|m| {
                        let p = m.position();
                        (p.x - parsed.x).abs() + (p.y - parsed.y).abs()
                    });
                }
            }
            None
        })
        .or_else(|| {
            parse_legacy_monitor_index(target_monitor_id).and_then(|i| monitors.get(i))
        })
        .ok_or_else(|| {
            AppError::NotFound(format!("Monitor {} not found", target_monitor_id))
        })?;

    let position = monitor.position();
    let size = monitor.size();
    let scale = monitor.scale_factor();

    let logical_x = position.x as f64 / scale;
    let logical_y = position.y as f64 / scale;
    let logical_w = size.width as f64 / scale;
    let logical_h = size.height as f64 / scale;

    if label == "projector" {
        if let Ok(mut bible_state) = app.state::<crate::state::AppState>().bible_projection.lock() {
            // Store logical (CSS) pixel dimensions — cosmic-text uses the same unit space as CSS font sizes
            bible_state.projector_size = Some((logical_w as u32, logical_h as u32));
        }
    }

    let window = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(url.into()))
        .title(title)
        .visible(false)
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        .fullscreen(false)
        .decorations(false)
        .resizable(false)
        // Phase 3 of frame-perfect multi-monitor video plan
        // (docs/plans/2026-04-25-frame-perfect-multi-monitor-video.md):
        // both projector and return windows must be transparent so the native
        // GStreamer sink can render BELOW the WKWebView/WebView2/WebKitGTK.
        // The webview keeps drawing slide overlays (text/logos) on top.
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(false)
        .position(logical_x, logical_y)
        .inner_size(logical_w, logical_h)
        .build()
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let _ = window.set_size(tauri::Size::Physical(*size));
    let _ = window.set_position(tauri::Position::Physical(*position));

    std::thread::sleep(std::time::Duration::from_millis(200));
    window.show().map_err(|e| AppError::Tauri(e.to_string()))?;

    for _ in 0..8 {
        let _ = window.set_fullscreen(true);
        std::thread::sleep(std::time::Duration::from_millis(150));
        if window.is_fullscreen().unwrap_or(false) {
            return Ok(());
        }
    }
    let _ = window.maximize();
    Ok(())
}
