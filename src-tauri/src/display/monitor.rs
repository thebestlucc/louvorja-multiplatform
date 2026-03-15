use display_info::DisplayInfo as ExternalDisplayInfo;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use tauri::AppHandle;

pub fn stable_monitor_id(monitor: &tauri::Monitor) -> String {
    let size = monitor.size();
    let position = monitor.position();
    let name = monitor
        .name()
        .map(|value| value.to_string())
        .unwrap_or_default();

    let mut hasher = DefaultHasher::new();
    name.hash(&mut hasher);
    let name_hash = hasher.finish();

    format!(
        "monitor-v2|{:016x}|{}|{}|{}|{}",
        name_hash, size.width, size.height, position.x, position.y
    )
}

pub struct ParsedMonitorId {
    pub name_hash: u64,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

pub fn parse_monitor_id(id: &str) -> Option<ParsedMonitorId> {
    let parts: Vec<&str> = id.strip_prefix("monitor-v2|")?.split('|').collect();
    if parts.len() != 5 {
        return None;
    }

    Some(ParsedMonitorId {
        name_hash: u64::from_str_radix(parts[0], 16).ok()?,
        width: parts[1].parse().ok()?,
        height: parts[2].parse().ok()?,
        x: parts[3].parse().ok()?,
        y: parts[4].parse().ok()?,
    })
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
        if normalized_tauri_name == normalized_friendly_name
            || normalized_tauri_name == normalized_display_name
        {
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

pub fn map_external_displays_to_monitors(
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

pub fn normalize_monitor_label(raw: &str) -> Option<String> {
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

pub fn detect_manufacturer(value: &str) -> Option<String> {
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

pub fn extract_model(value: Option<&str>, manufacturer: Option<&str>) -> Option<String> {
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

pub fn infer_connection_type(name: Option<&str>, friendly_name: Option<&str>) -> Option<String> {
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

pub fn monitor_signature(monitor: &tauri::Monitor, fallback_index: usize) -> String {
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

pub fn current_monitors_signature(app: &AppHandle) -> Option<Vec<String>> {
    let monitors = app.available_monitors().ok()?;
    Some(
        monitors
            .iter()
            .enumerate()
            .map(|(index, monitor)| monitor_signature(monitor, index))
            .collect(),
    )
}
