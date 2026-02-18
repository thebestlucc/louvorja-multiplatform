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
    /// Placeholder type: "title", "ctrTitle", "subTitle", "body", "other"
    placeholder_type: String,
    /// Paragraphs of text within this shape
    paragraphs: Vec<String>,
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
        let shapes = extract_slide_shapes(&mut archive, slide_name)?;
        let slide_data = shapes_to_slide_data(&shapes);
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

/// Convert extracted shapes into a SlideData with appropriate type.
fn shapes_to_slide_data(shapes: &[ShapeText]) -> SlideData {
    let mut title_text = String::new();
    let mut subtitle_text = String::new();
    let mut body_paragraphs: Vec<String> = Vec::new();

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
                // Non-placeholder shapes — treat as body text
                body_paragraphs.push(text);
            }
        }
    }

    let body_text = body_paragraphs.join("\n\n");

    // Determine slide type based on what we found
    if !title_text.is_empty() && body_text.is_empty() {
        // Title-only slide → cover
        let content = serde_json::json!({
            "type": "cover",
            "title": title_text,
            "subtitle": if subtitle_text.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(subtitle_text) },
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
            "type": "text",
            "text": full_text.trim(),
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
            "type": "text",
            "text": body_text,
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
            "type": "pause",
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

/// Extract all text shapes from a slide XML, detecting placeholder types.
fn extract_slide_shapes(
    archive: &mut zip::ZipArchive<std::fs::File>,
    slide_name: &str,
) -> Result<Vec<ShapeText>, AppError> {
    let mut slide_file = archive
        .by_name(slide_name)
        .map_err(|e| AppError::Internal(format!("Failed to read slide {}: {}", slide_name, e)))?;
    let mut xml_str = String::new();
    slide_file.read_to_string(&mut xml_str)?;

    let mut reader = Reader::from_str(&xml_str);
    let mut shapes: Vec<ShapeText> = Vec::new();

    // State tracking
    let mut in_sp = false; // inside <p:sp> (shape)
    let mut in_txbody = false; // inside <p:txBody>
    let mut in_paragraph = false; // inside <a:p>
    let mut in_text_run = false; // inside <a:t>
    let mut sp_depth: usize = 0;
    let mut placeholder_type = String::new();
    let mut current_paragraphs: Vec<String> = Vec::new();
    let mut current_paragraph_runs: Vec<String> = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                if local == b"sp" && !in_sp {
                    in_sp = true;
                    sp_depth = 1;
                    placeholder_type = "other".to_string();
                    current_paragraphs.clear();
                } else if in_sp {
                    sp_depth += 1;

                    if local == b"ph" {
                        // <p:ph type="title"/> — extract placeholder type
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"type"
                                || local_name(attr.key.as_ref()) == b"type"
                            {
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
                    } else if in_paragraph && local == b"t" {
                        in_text_run = true;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                if in_sp {
                    if local == b"t" && in_text_run {
                        in_text_run = false;
                    } else if local == b"p" && in_paragraph {
                        in_paragraph = false;
                        let para_text = current_paragraph_runs.join("");
                        current_paragraphs.push(para_text);
                    } else if local == b"txBody" {
                        in_txbody = false;
                    } else if local == b"sp" {
                        sp_depth -= 1;
                        if sp_depth == 0 {
                            in_sp = false;
                            if current_paragraphs.iter().any(|p| !p.trim().is_empty()) {
                                shapes.push(ShapeText {
                                    placeholder_type: placeholder_type.clone(),
                                    paragraphs: current_paragraphs.clone(),
                                });
                            }
                        }
                    } else {
                        sp_depth = sp_depth.saturating_sub(0); // sp_depth tracking for nested elements
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                if in_sp {
                    let name = e.name();
                    let name_ref = name.as_ref();
                    let local = local_name(name_ref);

                    if local == b"ph" {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"type"
                                || local_name(attr.key.as_ref()) == b"type"
                            {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    placeholder_type = val.to_string();
                                }
                            }
                        }
                    } else if in_paragraph && local == b"br" {
                        // Line break within paragraph
                        current_paragraph_runs.push("\n".to_string());
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_text_run {
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

    Ok(shapes)
}

/// Extract local name from a potentially namespaced XML tag (e.g., "a:t" -> "t")
fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}
