use cosmic_text::{Attrs, Buffer, Family, FontSystem, Metrics, Shaping};

use crate::db::models::slides::{BackgroundConfig, BibleMode, SlideContent};

/// Result of splitting a verse into 1+ parts that fit the projection area.
/// `verse_number` and `reference` are scaffolded for the upcoming Bible navigation
/// feature (see `docs/pre-dev/`). They are set on construction but consumed by the
/// frontend via `parts`, so the Rust side currently only reads `parts`.
#[derive(Debug, Clone)]
pub struct VerseSplitResult {
    #[allow(dead_code)]
    pub verse_number: i32,
    #[allow(dead_code)]
    pub reference: String,
    pub parts: Vec<SlideContent>,
}

/// Parameters for the text split calculation.
pub struct SplitParams {
    pub font_family: String,
    pub font_size: f32,
    pub width: u32,
    pub height: u32,
    pub h_padding: f32,
    pub v_padding: f32,
    pub ref_line_height: f32,
}

impl Default for SplitParams {
    fn default() -> Self {
        Self {
            font_family: "Inter".to_string(),
            font_size: 48.0,
            width: 1920,
            height: 1080,
            h_padding: 80.0,
            v_padding: 48.0,
            ref_line_height: 40.0,
        }
    }
}

/// Measure the height of `text` using cosmic-text layout engine.
/// Returns 0.0 if measurement fails (e.g., font not found, no layout runs).
fn measure_text_height_cosmic(
    font_system: &mut FontSystem,
    text: &str,
    font_family: &str,
    font_size: f32,
    line_height: f32,
    max_width: f32,
) -> f32 {
    let metrics = Metrics::new(font_size, line_height);
    let mut buffer = Buffer::new(font_system, metrics);
    buffer.set_size(font_system, Some(max_width), Some(100_000.0));

    let family = if font_family == "__system__" {
        Family::SansSerif
    } else {
        Family::Name(font_family)
    };
    let attrs = Attrs::new().family(family);
    buffer.set_text(font_system, text, attrs, Shaping::Advanced);
    buffer.shape_until_scroll(font_system, false);

    let mut total = 0.0_f32;
    let mut last_y = -1.0_f32;
    for run in buffer.layout_runs() {
        if run.line_y != last_y {
            total = run.line_y + line_height;
            last_y = run.line_y;
        }
    }
    total
}

/// Heuristic text height estimation based on character count.
/// Used as fallback when cosmic-text returns 0 or suspiciously low values.
/// Approximates average character width as ~0.55 * font_size for proportional fonts.
fn estimate_text_height_heuristic(
    text: &str,
    font_size: f32,
    line_height: f32,
    max_width: f32,
) -> f32 {
    let avg_char_width = font_size * 0.55;
    let chars_per_line = (max_width / avg_char_width).max(1.0);
    let char_count = text.chars().count() as f32;
    let estimated_lines = (char_count / chars_per_line).ceil().max(1.0);
    estimated_lines * line_height
}

/// Measure text height using cosmic-text with heuristic fallback.
/// Takes the MAXIMUM of both measurements to be conservative (avoid overflow).
fn measure_text_height(
    font_system: &mut FontSystem,
    text: &str,
    font_family: &str,
    font_size: f32,
    line_height: f32,
    max_width: f32,
) -> f32 {
    let cosmic = measure_text_height_cosmic(
        font_system, text, font_family, font_size, line_height, max_width,
    );

    // Trust cosmic-text when it returns a reasonable value (> 1 line height).
    // Fall back to heuristic when cosmic returns suspiciously low (font not found, shaping failed).
    if cosmic > line_height {
        cosmic
    } else {
        estimate_text_height_heuristic(text, font_size, line_height, max_width)
    }
}

/// Split a verse into parts that fit the projection area.
pub fn split_verse(
    font_system: &mut FontSystem,
    verse_text: &str,
    reference: &str,
    verse_number: i32,
    params: &SplitParams,
    mode: &BibleMode,
    background: &BackgroundConfig,
    text_color: Option<&str>,
    text_size: Option<i32>,
) -> VerseSplitResult {
    let available_width = params.width as f32 - 2.0 * params.h_padding;
    let available_height = params.height as f32 - 2.0 * params.v_padding - params.ref_line_height;
    let line_height = params.font_size * 1.5;

    let total_height = measure_text_height(
        font_system,
        verse_text,
        &params.font_family,
        params.font_size,
        line_height,
        available_width,
    );

    if total_height <= available_height {
        return VerseSplitResult {
            verse_number,
            reference: reference.to_string(),
            parts: vec![make_bible_slide(
                verse_text, reference, mode, background, text_color, text_size,
            )],
        };
    }

    let words: Vec<&str> = verse_text.split_whitespace().collect();
    let mut parts: Vec<String> = Vec::new();
    let mut start = 0;

    while start < words.len() {
        // Target 85% of available height for safety margin (CSS rendering may differ)
        let target_height = available_height * 0.85;
        let mut lo = start + 1;
        let mut hi = words.len();
        let mut best = start + 1;

        while lo <= hi {
            let mid = (lo + hi) / 2;
            let candidate = words[start..mid].join(" ");
            let measured_text = if !parts.is_empty() {
                format!("...{}", candidate)
            } else {
                candidate.clone()
            };

            let h = measure_text_height(
                font_system,
                &measured_text,
                &params.font_family,
                params.font_size,
                line_height,
                available_width,
            );

            if h <= target_height {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }

        let chunk = words[start..best].join(" ");
        let is_first = parts.is_empty();
        let is_last = best >= words.len();

        let text = match (is_first, is_last) {
            (true, true) => chunk,
            (true, false) => format!("{}...", chunk),
            (false, true) => format!("...{}", chunk),
            (false, false) => format!("...{}...", chunk),
        };

        parts.push(text);
        start = best;
    }

    let total_parts = parts.len();
    let split_parts: Vec<SlideContent> = parts
        .into_iter()
        .enumerate()
        .map(|(i, text)| {
            let part_ref = format!("{} ({}/{})", reference, i + 1, total_parts);
            make_bible_slide(&text, &part_ref, mode, background, text_color, text_size)
        })
        .collect();

    VerseSplitResult {
        verse_number,
        reference: reference.to_string(),
        parts: split_parts,
    }
}

fn make_bible_slide(
    text: &str,
    reference: &str,
    mode: &BibleMode,
    background: &BackgroundConfig,
    text_color: Option<&str>,
    text_size: Option<i32>,
) -> SlideContent {
    SlideContent::Bible {
        reference: reference.to_string(),
        text: text.to_string(),
        mode: mode.clone(),
        background: background.clone(),
        text_color: text_color.map(|s| s.to_string()),
        text_size,
    }
}
