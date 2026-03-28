use super::manifest::Manifest;
use super::{MediaFile, PresentationArchive, SlideData};
use crate::error::AppError;
use quick_xml::events::Event;
use quick_xml::Reader;
use std::io::Read;
use std::path::Path;

/// A text shape extracted from a PPTX slide.
#[derive(Debug)]
struct ShapeText {
    /// Placeholder type: "title", "ctrTitle", "subTitle", "body", "obj", "other"
    placeholder_type: String,
    /// Paragraphs of text within this shape
    paragraphs: Vec<String>,
    /// First explicit text color found in this shape (e.g. "#FFFFFF")
    text_color: Option<String>,
    /// First explicit font size found in this shape (in points)
    text_size: Option<i32>,
}

struct SlideExtraction {
    shapes: Vec<ShapeText>,
    background_color: Option<String>,
}

/// Read a .pptx file and convert it to a PresentationArchive.
pub fn read_pptx(path: &Path) -> Result<PresentationArchive, AppError> {
    let file = std::fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Internal(format!("Failed to open .pptx file: {}", e)))?;

    // Find all slide entries
    let mut slide_names: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| AppError::Internal(format!("Failed to read pptx entry: {}", e)))?;
        let name = entry.name().to_string();
        if name.starts_with("ppt/slides/slide")
            && name.ends_with(".xml")
            && !name.contains("Layout")
            && !name.contains("Master")
        {
            slide_names.push(name);
        }
    }

    // Sort by slide number
    slide_names.sort_by_key(|name| extract_slide_number(name));

    let mut slides = Vec::new();
    for slide_name in &slide_names {
        let extraction = extract_slide_content(&mut archive, slide_name)?;
        let slide_data = shapes_to_slide_data(&extraction.shapes, extraction.background_color);
        slides.push(slide_data);
    }

    // Extract media files
    let mut media = Vec::new();
    let media_entries: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            archive.by_index(i).ok().and_then(|entry| {
                let name = entry.name().to_string();
                if name.starts_with("ppt/media/") && name.len() > 10 {
                    Some(name)
                } else {
                    None
                }
            })
        })
        .collect();

    for entry_name in media_entries {
        let mut file = archive
            .by_name(&entry_name)
            .map_err(|e| AppError::Internal(format!("Failed to read media: {}", e)))?;
        let mut data = Vec::new();
        file.read_to_end(&mut data)?;
        let filename = entry_name
            .rsplit('/')
            .next()
            .unwrap_or(&entry_name)
            .to_string();
        media.push(MediaFile { filename, data });
    }

    // Extract title from first slide
    let title = if let Some(first_slide) = slides.first() {
        let val: serde_json::Value = serde_json::from_str(&first_slide.content).unwrap_or_default();
        let t = val.get("title").and_then(|t| t.as_str()).unwrap_or("");
        if t.is_empty() {
            val.get("text")
                .and_then(|t| t.as_str())
                .and_then(|text| text.lines().next())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| {
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Imported Presentation")
                        .to_string()
                })
        } else {
            t.to_string()
        }
    } else {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Imported Presentation")
            .to_string()
    };

    let manifest = Manifest {
        title,
        author: None,
        aspect_ratio: "16:9".to_string(),
        slide_count: slides.len(),
        created_at: None,
        updated_at: None,
    };

    Ok(PresentationArchive {
        manifest,
        slides,
        media,
    })
}

/// Convert extracted shapes into a SlideData with appropriate type and styling.
fn shapes_to_slide_data(shapes: &[ShapeText], background_color: Option<String>) -> SlideData {
    let mut title_text = String::new();
    let mut subtitle_text = String::new();
    let mut body_paragraphs: Vec<String> = Vec::new();

    // Dominant text color: prefer body/title placeholder, fall back to any shape
    let dominant_color = shapes
        .iter()
        .find_map(|s| s.text_color.clone());

    // Dominant font size: prefer body placeholder so body text size is used
    let dominant_size = shapes
        .iter()
        .find(|s| matches!(s.placeholder_type.as_str(), "body" | "obj"))
        .and_then(|s| s.text_size)
        .or_else(|| shapes.iter().find_map(|s| s.text_size));

    for shape in shapes {
        let text = shape
            .paragraphs
            .iter()
            .filter(|p| !p.trim().is_empty())
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");

        if text.is_empty() {
            continue;
        }

        match shape.placeholder_type.as_str() {
            "title" | "ctrTitle" => {
                title_text = text;
            }
            "subTitle" => {
                subtitle_text = text;
            }
            "body" | "obj" => {
                body_paragraphs.push(text);
            }
            _ => {
                body_paragraphs.push(text);
            }
        }
    }

    let body_text = body_paragraphs.join("\n\n");

    if !title_text.is_empty() && body_text.is_empty() {
        // Title-only slide → cover
        let content = serde_json::json!({
            "slideType": "cover",
            "title": title_text,
            "subtitle": if subtitle_text.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(subtitle_text) },
            "textColor": dominant_color,
            "backgroundColor": background_color,
            "textSize": dominant_size,
        })
        .to_string();

        SlideData {
            slide_type: "cover".to_string(),
            content,
            notes: None,
            transition: None,
        }
    } else if !title_text.is_empty() {
        // Title + body → text slide with title as first line
        let full_text = if subtitle_text.is_empty() {
            format!("{}\n\n{}", title_text, body_text)
        } else {
            format!("{}\n{}\n\n{}", title_text, subtitle_text, body_text)
        };

        let content = serde_json::json!({
            "slideType": "text",
            "text": full_text.trim(),
            "textColor": dominant_color,
            "backgroundColor": background_color,
            "textSize": dominant_size,
        })
        .to_string();

        SlideData {
            slide_type: "text".to_string(),
            content,
            notes: None,
            transition: None,
        }
    } else if !body_text.is_empty() {
        // Body only → text slide
        let content = serde_json::json!({
            "slideType": "text",
            "text": body_text,
            "textColor": dominant_color,
            "backgroundColor": background_color,
            "textSize": dominant_size,
        })
        .to_string();

        SlideData {
            slide_type: "text".to_string(),
            content,
            notes: None,
            transition: None,
        }
    } else {
        // Empty slide → pause
        let content = serde_json::json!({
            "slideType": "pause",
        })
        .to_string();

        SlideData {
            slide_type: "pause".to_string(),
            content,
            notes: None,
            transition: None,
        }
    }
}

fn extract_slide_number(name: &str) -> u32 {
    name.trim_start_matches("ppt/slides/slide")
        .trim_end_matches(".xml")
        .parse::<u32>()
        .unwrap_or(0)
}

/// Extract all text shapes and slide styling from a slide XML.
fn extract_slide_content(
    archive: &mut zip::ZipArchive<std::fs::File>,
    slide_name: &str,
) -> Result<SlideExtraction, AppError> {
    let mut slide_file = archive
        .by_name(slide_name)
        .map_err(|e| AppError::Internal(format!("Failed to read slide {}: {}", slide_name, e)))?;
    let mut xml_str = String::new();
    slide_file.read_to_string(&mut xml_str)?;

    let mut reader = Reader::from_str(&xml_str);
    let mut shapes: Vec<ShapeText> = Vec::new();

    // --- Shape parsing state ---
    let mut in_sp = false;
    let mut in_txbody = false;
    let mut in_paragraph = false;
    let mut in_run = false;       // inside <a:r> (text run element)
    let mut in_rpr = false;       // inside <a:rPr> (run properties)
    let mut in_rpr_fill = false;  // inside <a:solidFill> inside <a:rPr>
    let mut in_text_elem = false; // inside <a:t>
    let mut placeholder_type = String::new();
    let mut current_paragraphs: Vec<String> = Vec::new();
    let mut current_paragraph_runs: Vec<String> = Vec::new();
    let mut shape_text_color: Option<String> = None;
    let mut shape_text_size: Option<i32> = None;

    // --- Background parsing state ---
    let mut in_bg = false;
    let mut in_bgpr = false;
    let mut bg_in_fill = false;
    let mut background_color: Option<String> = None;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                if local == b"sp" && !in_sp {
                    in_sp = true;
                    placeholder_type = "other".to_string();
                    current_paragraphs.clear();
                    shape_text_color = None;
                    shape_text_size = None;
                } else if !in_sp {
                    // Background color detection (outside shapes)
                    if local == b"bg" {
                        in_bg = true;
                    } else if in_bg && local == b"bgPr" {
                        in_bgpr = true;
                    } else if in_bgpr && local == b"solidFill" {
                        bg_in_fill = true;
                    } else if bg_in_fill && local == b"srgbClr" && background_color.is_none() {
                        if let Some(color) = extract_attr_val(e.attributes()) {
                            background_color = Some(format!("#{}", color));
                        }
                    }
                } else {
                    // Inside a shape
                    if local == b"ph" {
                        // Extract placeholder type attribute
                        for attr in e.attributes().flatten() {
                            if local_name(attr.key.as_ref()) == b"type" {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    placeholder_type = val.to_string();
                                }
                            }
                        }
                    } else if local == b"txBody" {
                        in_txbody = true;
                    } else if in_txbody && local == b"p" {
                        in_paragraph = true;
                        current_paragraph_runs.clear();
                    } else if in_paragraph && local == b"r" {
                        in_run = true;
                    } else if in_run && local == b"rPr" {
                        in_rpr = true;
                        // Extract font size from sz attribute (hundredths of a point → points)
                        if shape_text_size.is_none() {
                            for attr in e.attributes().flatten() {
                                if local_name(attr.key.as_ref()) == b"sz" {
                                    if let Ok(val) = std::str::from_utf8(&attr.value) {
                                        if let Ok(sz) = val.parse::<i32>() {
                                            shape_text_size = Some((sz / 100).clamp(8, 96));
                                        }
                                    }
                                }
                            }
                        }
                    } else if in_rpr && local == b"solidFill" {
                        in_rpr_fill = true;
                    } else if in_rpr_fill && local == b"srgbClr" && shape_text_color.is_none() {
                        if let Some(color) = extract_attr_val(e.attributes()) {
                            shape_text_color = Some(format!("#{}", color));
                        }
                    } else if in_paragraph && local == b"t" {
                        in_text_elem = true;
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                if !in_sp {
                    // Self-closing background color elements
                    if bg_in_fill && local == b"srgbClr" && background_color.is_none() {
                        if let Some(color) = extract_attr_val(e.attributes()) {
                            background_color = Some(format!("#{}", color));
                        }
                    }
                } else {
                    // Self-closing elements inside a shape
                    if local == b"ph" {
                        for attr in e.attributes().flatten() {
                            if local_name(attr.key.as_ref()) == b"type" {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    placeholder_type = val.to_string();
                                }
                            }
                        }
                    } else if in_paragraph && local == b"br" {
                        // Line break within paragraph
                        current_paragraph_runs.push("\n".to_string());
                    } else if in_run && local == b"rPr" {
                        // Self-closing run properties — only carries sz, no fill children
                        if shape_text_size.is_none() {
                            for attr in e.attributes().flatten() {
                                if local_name(attr.key.as_ref()) == b"sz" {
                                    if let Ok(val) = std::str::from_utf8(&attr.value) {
                                        if let Ok(sz) = val.parse::<i32>() {
                                            shape_text_size = Some((sz / 100).clamp(8, 96));
                                        }
                                    }
                                }
                            }
                        }
                    } else if in_rpr_fill && local == b"srgbClr" && shape_text_color.is_none() {
                        if let Some(color) = extract_attr_val(e.attributes()) {
                            shape_text_color = Some(format!("#{}", color));
                        }
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                if !in_sp {
                    if local == b"bg" {
                        in_bg = false;
                        in_bgpr = false;
                        bg_in_fill = false;
                    } else if local == b"bgPr" {
                        in_bgpr = false;
                        bg_in_fill = false;
                    } else if local == b"solidFill" && bg_in_fill {
                        bg_in_fill = false;
                    }
                } else {
                    // Inside a shape — detect closing tags
                    if local == b"sp" {
                        // Shape closed: PPTX shapes are not nested so this is always our shape.
                        in_sp = false;
                        if current_paragraphs.iter().any(|p| !p.trim().is_empty()) {
                            shapes.push(ShapeText {
                                placeholder_type: placeholder_type.clone(),
                                paragraphs: current_paragraphs.clone(),
                                text_color: shape_text_color.clone(),
                                text_size: shape_text_size,
                            });
                        }
                    } else if local == b"t" && in_text_elem {
                        in_text_elem = false;
                    } else if local == b"r" && in_run {
                        in_run = false;
                        in_rpr = false;
                        in_rpr_fill = false;
                    } else if local == b"rPr" && in_rpr {
                        in_rpr = false;
                        in_rpr_fill = false;
                    } else if local == b"solidFill" && in_rpr_fill {
                        in_rpr_fill = false;
                    } else if local == b"p" && in_paragraph {
                        in_paragraph = false;
                        in_run = false;
                        let para_text = current_paragraph_runs.join("");
                        current_paragraphs.push(para_text);
                    } else if local == b"txBody" {
                        in_txbody = false;
                        in_paragraph = false;
                        in_run = false;
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_text_elem {
                    if let Ok(text) = e.unescape() {
                        current_paragraph_runs.push(text.to_string());
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(AppError::Internal(format!("XML parse error: {}", e))),
            _ => {}
        }
    }

    Ok(SlideExtraction {
        shapes,
        background_color,
    })
}

/// Extract the `val` attribute from an element's attributes (used for srgbClr).
fn extract_attr_val(
    attrs: quick_xml::events::attributes::Attributes,
) -> Option<String> {
    for attr in attrs.flatten() {
        if local_name(attr.key.as_ref()) == b"val" {
            if let Ok(val) = std::str::from_utf8(&attr.value) {
                return Some(val.to_string());
            }
        }
    }
    None
}

/// Extract local name from a potentially namespaced XML tag (e.g., "a:t" -> "t")
fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}
