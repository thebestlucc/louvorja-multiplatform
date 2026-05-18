use super::manifest::Manifest;
use super::{MediaFile, PresentationArchive, SlideData};
use crate::db::models::slides::{
    ImageFit, SlideContent, TransitionConfig, TransitionKind,
};
use crate::error::AppError;
use quick_xml::events::Event;
use quick_xml::Reader;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

// ─── ppt-rs type aliases to avoid name collision with our SlideContent ──────

type PptSlideContent = ppt_rs::generator::SlideContent;

// ─── Legacy read_pptx (used by archive/mod.rs import_presentation) ───────────

/// A text shape extracted from a PPTX slide.
#[derive(Debug)]
struct ShapeText {
    placeholder_type: String,
    paragraphs: Vec<String>,
    text_color: Option<String>,
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

    slide_names.sort_by_key(|name| extract_slide_number(name));

    let mut slides = Vec::new();
    for slide_name in &slide_names {
        let extraction = extract_slide_content(&mut archive, slide_name)?;
        let slide_data = shapes_to_slide_data(&extraction.shapes, extraction.background_color);
        slides.push(slide_data);
    }

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

// ─── New typed import/export functions ────────────────────────────────────────

type ParsedSlide = (SlideContent, Option<String>, Option<TransitionConfig>);

/// Import a PPTX file → Vec of (SlideContent, optional speaker notes).
///
/// Images found in the PPTX are extracted to `media_dest/{sha256}.{ext}` and
/// referenced via a managed `media/images/{sha256}.{ext}` relative path.
pub fn import_pptx_slides(
    path: &Path,
    media_dest: &Path,
) -> Result<Vec<ParsedSlide>, AppError> {
    let path_str = path
        .to_str()
        .ok_or_else(|| AppError::Internal("PPTX path is not valid UTF-8".into()))?;

    // Use ppt-rs to parse slide titles / body text
    let reader = ppt_rs::oxml::presentation::PresentationReader::open(path_str)
        .map_err(|e| AppError::Internal(format!("ppt-rs failed to open PPTX: {}", e)))?;

    let parsed_slides = reader
        .get_all_slides()
        .map_err(|e| AppError::Internal(format!("ppt-rs failed to read slides: {}", e)))?;

    // Also open the ZIP directly for image extraction and notes
    let zip_file = std::fs::File::open(path)?;
    let mut zip_archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| AppError::Internal(format!("Failed to open PPTX as ZIP: {}", e)))?;

    // Build a sorted list of slide paths (same order ppt-rs uses)
    let mut slide_names: Vec<String> = Vec::new();
    for i in 0..zip_archive.len() {
        if let Ok(entry) = zip_archive.by_index(i) {
            let name = entry.name().to_string();
            if name.starts_with("ppt/slides/slide")
                && name.ends_with(".xml")
                && !name.contains("Layout")
                && !name.contains("Master")
            {
                slide_names.push(name);
            }
        }
    }
    slide_names.sort_by_key(|n| extract_slide_number(n));

    // Extract notes for each slide (best-effort, not an error if absent)
    let mut notes_per_slide: Vec<Option<String>> = Vec::with_capacity(slide_names.len());
    for slide_name in &slide_names {
        // Notes file mirrors slide: ppt/slides/slide1.xml → ppt/notesSlides/notesSlide1.xml
        let slide_num = extract_slide_number(slide_name);
        let notes_path = format!("ppt/notesSlides/notesSlide{}.xml", slide_num);
        let notes = extract_notes_text(&mut zip_archive, &notes_path);
        notes_per_slide.push(notes);
    }

    // Extract images from the ZIP and copy to media_dest
    let image_map = extract_images_to_dest(&mut zip_archive, media_dest)?;

    // Get slide dimensions for background image threshold detection
    let slide_size = get_presentation_slide_size(&mut zip_archive);

    // Detect which slides contain background images (size >= 30% of slide area)
    let slide_image_paths: Vec<Option<String>> = slide_names
        .iter()
        .map(|sn| detect_slide_image(&mut zip_archive, sn, &image_map, slide_size))
        .collect();

    // Extract formatting (color, size, bg, transition) for each slide
    let slide_formatting: Vec<SlideFormatting> = slide_names
        .iter()
        .map(|sn| extract_slide_formatting(&mut zip_archive, sn))
        .collect();

    // Build SlideContent for each parsed slide
    let mut result = Vec::with_capacity(parsed_slides.len());
    for (i, parsed) in parsed_slides.iter().enumerate() {
        let notes = notes_per_slide.get(i).cloned().flatten();
        let image_path = slide_image_paths.get(i).cloned().flatten();
        let fmt = slide_formatting.get(i);
        let text_color = fmt.and_then(|f| f.text_color.clone());
        let text_size = fmt.and_then(|f| f.text_size);
        let transition = fmt.and_then(|f| f.transition.clone());

        let mut title = parsed.title.as_deref().unwrap_or("").trim().to_string();
        let mut body = parsed.body_text.join("\n").trim().to_string();

        // ppt-rs only reads placeholder shapes. If both are empty, the slide
        // uses custom text boxes — fall back to positional shape extraction.
        if title.is_empty() && body.is_empty() {
            let slide_name = slide_names.get(i).map(|s| s.as_str()).unwrap_or("");
            let blocks = extract_all_text_shapes(&mut zip_archive, slide_name);
            if let Some(first) = blocks.first() {
                title = first.text.clone();
            }
            if blocks.len() > 1 {
                body = blocks[1..].iter().map(|b| b.text.as_str()).collect::<Vec<_>>().join("\n");
            }
        }

        let has_text = !title.is_empty() || !body.is_empty();

        // Build background: image > solid bg color > default
        let background = if let Some(ref img_path) = image_path {
            crate::db::models::slides::BackgroundConfig {
                kind: crate::db::models::slides::BackgroundKind::Image,
                color: None,
                image_path: Some(img_path.clone()),
                gradient_start: None,
                gradient_end: None,
                gradient_angle: None,
                opacity: None,
            }
        } else if let Some(color) = fmt.and_then(|f| f.bg_color.clone()) {
            crate::db::models::slides::BackgroundConfig {
                kind: crate::db::models::slides::BackgroundKind::Solid,
                color: Some(color),
                image_path: None,
                gradient_start: None,
                gradient_end: None,
                gradient_angle: None,
                opacity: None,
            }
        } else {
            SlideContent::default_background()
        };

        let content = if has_text {
            // Text content takes priority; image (if any) becomes the background.
            if !title.is_empty() && body.is_empty() {
                // Title-only → Cover
                SlideContent::Cover {
                    title,
                    subtitle: None,
                    label: None,
                    background,
                    text_color,
                    text_size,
                }
            } else if !title.is_empty() {
                // Title + body → Text
                SlideContent::Text {
                    content: format!("{}\n{}", title, body),
                    background,
                    text_color,
                    text_size,
                }
            } else {
                // Body only (no title) → Lyrics
                SlideContent::Lyrics {
                    text: body,
                    label: None,
                    background,
                    text_color,
                    text_size,
                }
            }
        } else if let Some(img_path) = image_path {
            // No text at all — pure image slide
            SlideContent::Image {
                path: img_path,
                caption: None,
                fit: ImageFit::Cover,
                background: SlideContent::default_background(),
            }
        } else {
            SlideContent::Pause
        };

        result.push((content, notes, transition));
    }

    Ok(result)
}

/// Export slides to a PPTX file using ppt-rs.
///
/// Each `SlideContent` variant is mapped to a ppt-rs `SlideContent` builder.
/// Features not supported by ppt-rs (e.g. image embedding) fall back to a
/// text slide with a note — no `unwrap()` or `panic!()` used.
pub fn export_pptx_slides(
    slides: &[(SlideContent, Option<String>)],
    output_path: &Path,
    title: &str,
    _app_data_dir: &Path,
) -> Result<(), AppError> {
    let mut ppt_slides: Vec<PptSlideContent> = Vec::with_capacity(slides.len());

    for (content, notes) in slides {
        let notes_str = notes.as_deref().unwrap_or("");

        let ppt_slide = match content {
            SlideContent::Cover { title: t, subtitle, .. } => {
                let mut s = PptSlideContent::new(t);
                if let Some(sub) = subtitle {
                    s = s.add_bullet(sub);
                }
                if !notes_str.is_empty() {
                    s = s.notes(notes_str);
                }
                s
            }
            SlideContent::Lyrics { text, label, .. } => {
                let slide_title = label.as_deref().unwrap_or("");
                let mut s = PptSlideContent::new(slide_title);
                for line in text.lines() {
                    s = s.add_bullet(line);
                }
                if !notes_str.is_empty() {
                    s = s.notes(notes_str);
                }
                s
            }
            SlideContent::Text { content: text, .. } => {
                let mut lines = text.lines();
                let first = lines.next().unwrap_or("");
                let mut s = PptSlideContent::new(first);
                for line in lines {
                    s = s.add_bullet(line);
                }
                if !notes_str.is_empty() {
                    s = s.notes(notes_str);
                }
                s
            }
            SlideContent::Image { path, caption, .. } => {
                // ppt-rs image embedding: use add_image_from_file if available,
                // otherwise fall back to a text slide with path in notes.
                let slide_title = caption.as_deref().unwrap_or("Image");
                let mut s = PptSlideContent::new(slide_title);
                // Attempt to embed image from managed path
                let image_result = ppt_rs::generator::Image::from_path(path);
                match image_result {
                    Ok(img) => {
                        s = s.add_image(img);
                    }
                    Err(_) => {
                        // Image unavailable — put path in notes
                        let combined_notes = if notes_str.is_empty() {
                            format!("[Image: {}]", path)
                        } else {
                            format!("[Image: {}]\n{}", path, notes_str)
                        };
                        s = s.notes(&combined_notes);
                    }
                }
                s
            }
            SlideContent::Video { path, overlay_text, .. } => {
                let slide_title = overlay_text.as_deref().unwrap_or("Video");
                let mut s = PptSlideContent::new(slide_title);
                let combined_notes = if notes_str.is_empty() {
                    format!("[Video: {}]", path)
                } else {
                    format!("[Video: {}]\n{}", path, notes_str)
                };
                s = s.notes(&combined_notes);
                s
            }
            SlideContent::Bible { reference, text, .. } => {
                let mut s = PptSlideContent::new(reference);
                for line in text.lines() {
                    s = s.add_bullet(line);
                }
                if !notes_str.is_empty() {
                    s = s.notes(notes_str);
                }
                s
            }
            SlideContent::OnlineVideo { source, title: video_title } => {
                let slide_title = video_title.as_deref().unwrap_or("Online Video");
                let mut s = PptSlideContent::new(slide_title);
                let bullet = match source {
                    crate::db::models::slides::VideoSource::Local { url } => url.clone(),
                    crate::db::models::slides::VideoSource::Youtube { video_id } => {
                        format!("https://www.youtube.com/watch?v={}", video_id)
                    }
                };
                s = s.add_bullet(&bullet);
                if !notes_str.is_empty() {
                    s = s.notes(notes_str);
                }
                s
            }
            SlideContent::Pause => {
                let mut s = PptSlideContent::new("");
                if !notes_str.is_empty() {
                    s = s.notes(notes_str);
                }
                s
            }
        };

        ppt_slides.push(ppt_slide);
    }

    let pptx_bytes = ppt_rs::generator::create_pptx_with_content(title, ppt_slides)
        .map_err(|e| AppError::Internal(format!("ppt-rs export failed: {}", e)))?;

    std::fs::write(output_path, &pptx_bytes)?;
    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Extract speaker notes text from a notesSlide XML entry in the ZIP.
fn extract_notes_text(
    archive: &mut zip::ZipArchive<std::fs::File>,
    notes_path: &str,
) -> Option<String> {
    let mut entry = archive.by_name(notes_path).ok()?;
    let mut xml_str = String::new();
    entry.read_to_string(&mut xml_str).ok()?;

    let mut reader = Reader::from_str(&xml_str);
    let mut texts: Vec<String> = Vec::new();
    let mut in_text = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                if local_name(name.as_ref()) == b"t" {
                    in_text = true;
                }
            }
            Ok(Event::Text(ref e)) if in_text => {
                if let Ok(t) = e.unescape() {
                    let s = t.trim().to_string();
                    if !s.is_empty() {
                        texts.push(s);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                if local_name(e.name().as_ref()) == b"t" {
                    in_text = false;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    if texts.is_empty() {
        None
    } else {
        Some(texts.join(" "))
    }
}

/// Extract all images from the PPTX ZIP to `media_dest`, keyed by their
/// original ZIP path. Returns a map: zip_path → managed relative path.
fn extract_images_to_dest(
    archive: &mut zip::ZipArchive<std::fs::File>,
    media_dest: &Path,
) -> Result<std::collections::HashMap<String, String>, AppError> {
    let mut map = std::collections::HashMap::new();

    let image_extensions = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff"];

    let image_entries: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            archive.by_index(i).ok().and_then(|e| {
                let name = e.name().to_string();
                if name.starts_with("ppt/media/") {
                    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
                    if image_extensions.contains(&ext.as_str()) {
                        return Some(name);
                    }
                }
                None
            })
        })
        .collect();

    for zip_path in image_entries {
        let mut entry = archive
            .by_name(&zip_path)
            .map_err(|e| AppError::Internal(format!("Failed to read image {}: {}", zip_path, e)))?;
        let mut data = Vec::new();
        entry.read_to_end(&mut data)?;

        let ext = zip_path.rsplit('.').next().unwrap_or("bin").to_lowercase();
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(&data);
            format!("{:x}", hasher.finalize())
        };
        let filename = format!("{}.{}", hash, ext);
        let dest_path = media_dest.join(&filename);

        if !dest_path.exists() {
            std::fs::write(&dest_path, &data).map_err(|e| {
                AppError::Internal(format!("Failed to write image {}: {}", filename, e))
            })?;
        }

        // Relative managed path: media/images/{hash}.{ext}
        let managed_path = format!("media/images/{}", filename);
        map.insert(zip_path, managed_path);
    }

    Ok(map)
}

/// Parse a slide's .rels file and return a map of rId → resolved zip path.
///
/// Slide rels live at `ppt/slides/_rels/<slide_filename>.rels`.
fn parse_slide_rels(
    archive: &mut zip::ZipArchive<std::fs::File>,
    slide_name: &str,
) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();

    // slide_name is e.g. "ppt/slides/slide1.xml"
    // rels file is "ppt/slides/_rels/slide1.xml.rels"
    let filename = slide_name.rsplit('/').next().unwrap_or(slide_name);
    let rels_path = format!("ppt/slides/_rels/{}.rels", filename);

    let mut entry = match archive.by_name(&rels_path) {
        Ok(e) => e,
        Err(_) => return map,
    };
    let mut xml_str = String::new();
    if entry.read_to_string(&mut xml_str).is_err() {
        return map;
    }

    let mut reader = Reader::from_str(&xml_str);
    loop {
        match reader.read_event() {
            Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) => {
                if local_name(e.name().as_ref()) == b"Relationship" {
                    let mut rid = String::new();
                    let mut target = String::new();
                    for attr in e.attributes().flatten() {
                        match local_name(attr.key.as_ref()) {
                            b"Id" => {
                                if let Ok(v) = std::str::from_utf8(&attr.value) {
                                    rid = v.to_string();
                                }
                            }
                            b"Target" => {
                                if let Ok(v) = std::str::from_utf8(&attr.value) {
                                    target = v.to_string();
                                }
                            }
                            _ => {}
                        }
                    }
                    if !rid.is_empty() && !target.is_empty() {
                        // Target is relative to ppt/slides/, e.g. "../media/image1.png"
                        // Normalize to zip path: "ppt/media/image1.png"
                        let normalized = if let Some(stripped) = target.strip_prefix("../") {
                            format!("ppt/{}", stripped)
                        } else if target.starts_with('/') {
                            target.trim_start_matches('/').to_string()
                        } else {
                            format!("ppt/slides/{}", target)
                        };
                        map.insert(rid, normalized);
                    }
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    map
}

/// Read slide dimensions (cx, cy in EMU) from ppt/presentation.xml.
/// Returns standard 16:9 fallback (9144000 × 5143500) if not found.
fn get_presentation_slide_size(
    archive: &mut zip::ZipArchive<std::fs::File>,
) -> (i64, i64) {
    let mut entry = match archive.by_name("ppt/presentation.xml") {
        Ok(e) => e,
        Err(_) => return (9144000, 5143500),
    };
    let mut xml_str = String::new();
    if entry.read_to_string(&mut xml_str).is_err() {
        return (9144000, 5143500);
    }
    let mut reader = Reader::from_str(&xml_str);
    loop {
        match reader.read_event() {
            Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) => {
                let ename = e.name();
                if local_name(ename.as_ref()) == b"sldSz" {
                    let cx = get_attr(e, b"cx").and_then(|v| v.parse::<i64>().ok()).unwrap_or(9144000);
                    let cy = get_attr(e, b"cy").and_then(|v| v.parse::<i64>().ok()).unwrap_or(5143500);
                    return (cx, cy);
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }
    (9144000, 5143500)
}

/// Scan a slide XML for blipFill references, resolve the rId via the slide's
/// .rels file, and return the corresponding managed image path from `image_map`.
/// Only returns an image if it covers >= 30% of the slide area (ignores icons/logos).
fn detect_slide_image(
    archive: &mut zip::ZipArchive<std::fs::File>,
    slide_name: &str,
    image_map: &std::collections::HashMap<String, String>,
    slide_size: (i64, i64),
) -> Option<String> {
    // Parse the slide's relationship file first so we can resolve rIds.
    let rels = parse_slide_rels(archive, slide_name);

    let mut entry = archive.by_name(slide_name).ok()?;
    let mut xml_str = String::new();
    entry.read_to_string(&mut xml_str).ok()?;

    let slide_area = slide_size.0 * slide_size.1;
    let min_bg_area = slide_area * 3 / 10; // 30% threshold

    let mut reader = Reader::from_str(&xml_str);
    let mut in_pic = false;
    let mut pic_rid: Option<String> = None;
    let mut pic_cx: i64 = 0;
    let mut pic_cy: i64 = 0;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                if ln == b"pic" {
                    in_pic = true;
                    pic_rid = None;
                    pic_cx = 0;
                    pic_cy = 0;
                } else if in_pic && ln == b"ext" {
                    if let Some(cx) = get_attr(e, b"cx") {
                        pic_cx = cx.parse::<i64>().unwrap_or(0);
                    }
                    if let Some(cy) = get_attr(e, b"cy") {
                        pic_cy = cy.parse::<i64>().unwrap_or(0);
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                if in_pic {
                    match ln {
                        b"blip" => {
                            if let Some(rid) = get_attr(e, b"embed") {
                                pic_rid = Some(rid);
                            }
                        }
                        b"ext" => {
                            if let Some(cx) = get_attr(e, b"cx") {
                                pic_cx = cx.parse::<i64>().unwrap_or(0);
                            }
                            if let Some(cy) = get_attr(e, b"cy") {
                                pic_cy = cy.parse::<i64>().unwrap_or(0);
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let ename = e.name();
                if local_name(ename.as_ref()) == b"pic" && in_pic {
                    // Only use this image if it's large enough to be a background
                    let area = pic_cx * pic_cy;
                    if area >= min_bg_area {
                        if let Some(rid) = &pic_rid {
                            if let Some(zip_path) = rels.get(rid.as_str()) {
                                if let Some(managed) = image_map.get(zip_path) {
                                    return Some(managed.clone());
                                }
                            }
                        }
                    }
                    in_pic = false;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }
    None
}

// ─── Non-placeholder text extraction (fallback for custom-layout slides) ─────

/// A text block from a shape, with its vertical position for ordering.
struct ShapeBlock {
    y: i64,
    text: String,
}

/// Extract text from ALL `<p:sp>` shapes in the slide, sorted by y-position.
/// Used when ppt-rs finds no placeholder text (custom slide layouts).
fn extract_all_text_shapes(
    archive: &mut zip::ZipArchive<std::fs::File>,
    slide_name: &str,
) -> Vec<ShapeBlock> {
    let mut entry = match archive.by_name(slide_name) {
        Ok(e) => e,
        Err(_) => return vec![],
    };
    let mut xml_str = String::new();
    if entry.read_to_string(&mut xml_str).is_err() {
        return vec![];
    }

    let mut reader = Reader::from_str(&xml_str);

    let mut blocks: Vec<ShapeBlock> = Vec::new();
    let mut in_sp = false;
    let mut in_pic = false; // skip p:pic (image elements)
    let mut in_txbody = false;
    let mut current_y: i64 = i64::MAX;
    let mut current_texts: Vec<String> = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                match ln {
                    b"pic" => in_pic = true,
                    b"sp" if !in_pic => {
                        in_sp = true;
                        current_y = i64::MAX;
                        current_texts = Vec::new();
                    }
                    b"off" if in_sp && !in_txbody => {
                        if let Some(y_str) = get_attr(e, b"y") {
                            current_y = y_str.parse::<i64>().unwrap_or(i64::MAX);
                        }
                    }
                    b"txBody" if in_sp => in_txbody = true,
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                if ln == b"off" && in_sp && !in_txbody {
                    if let Some(y_str) = get_attr(e, b"y") {
                        current_y = y_str.parse::<i64>().unwrap_or(i64::MAX);
                    }
                }
            }
            Ok(Event::Text(ref e)) if in_txbody => {
                if let Ok(t) = e.unescape() {
                    let s = t.trim().to_string();
                    if !s.is_empty() {
                        current_texts.push(s);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                match ln {
                    b"pic" => in_pic = false,
                    b"txBody" => in_txbody = false,
                    b"sp" if in_sp => {
                        let text = current_texts.join(" ").trim().to_string();
                        if !text.is_empty() {
                            blocks.push(ShapeBlock { y: current_y, text });
                        }
                        in_sp = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    blocks.sort_by_key(|b| b.y);
    blocks
}

// ─── Formatting extraction ────────────────────────────────────────────────────

struct SlideFormatting {
    text_color: Option<String>,
    text_size: Option<i32>,
    bg_color: Option<String>,
    transition: Option<TransitionConfig>,
}

/// Parse a slide XML to extract dominant text color, font size, background
/// color, and transition. All values are best-effort (first-found).
fn extract_slide_formatting(
    archive: &mut zip::ZipArchive<std::fs::File>,
    slide_name: &str,
) -> SlideFormatting {
    let mut entry = match archive.by_name(slide_name) {
        Ok(e) => e,
        Err(_) => {
            return SlideFormatting {
                text_color: None,
                text_size: None,
                bg_color: None,
                transition: None,
            }
        }
    };
    let mut xml_str = String::new();
    if entry.read_to_string(&mut xml_str).is_err() {
        return SlideFormatting {
            text_color: None,
            text_size: None,
            bg_color: None,
            transition: None,
        };
    }

    let mut reader = Reader::from_str(&xml_str);

    let mut text_color: Option<String> = None;
    let mut text_size: Option<i32> = None;
    let mut bg_color: Option<String> = None;
    let mut transition: Option<TransitionConfig> = None;

    // Track context to avoid picking up colors from non-text elements
    let mut in_bg = false;
    let mut in_transition = false;
    let mut in_body = false; // inside p:txBody
    let mut in_run_props = false; // inside a:rPr
    let mut bg_fill_depth: u32 = 0; // depth inside p:bgPr to find solidFill

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                match ln {
                    b"bg" | b"bgPr" => {
                        in_bg = true;
                        bg_fill_depth = 0;
                    }
                    b"solidFill" if in_bg => {
                        bg_fill_depth += 1;
                    }
                    b"srgbClr" if in_bg && bg_color.is_none() => {
                        if let Some(val) = get_attr(e, b"val") {
                            bg_color = Some(format!("#{}", val));
                        }
                    }
                    b"txBody" => in_body = true,
                    b"rPr" if in_body => {
                        in_run_props = true;
                        if text_size.is_none() {
                            if let Some(sz) = get_attr(e, b"sz") {
                                if let Ok(n) = sz.parse::<i32>() {
                                    text_size = Some(n / 100);
                                }
                            }
                        }
                    }
                    b"srgbClr" if in_run_props && text_color.is_none() => {
                        if let Some(val) = get_attr(e, b"val") {
                            text_color = Some(format!("#{}", val));
                        }
                    }
                    b"transition" => {
                        in_transition = true;
                        let dur_ms = get_attr(e, b"dur")
                            .and_then(|d| d.parse::<u32>().ok())
                            .unwrap_or(400);
                        transition = Some(TransitionConfig {
                            kind: TransitionKind::Fade,
                            duration_ms: dur_ms,
                        });
                    }
                    b"push" | b"wipe" | b"conveyor" | b"fly" if in_transition => {
                        if let Some(ref mut t) = transition {
                            t.kind = TransitionKind::Slide;
                        }
                    }
                    b"zoom" | b"circle" | b"diamond" | b"plus" if in_transition => {
                        if let Some(ref mut t) = transition {
                            t.kind = TransitionKind::Pop;
                        }
                    }
                    b"cut" | b"none" if in_transition => {
                        if let Some(ref mut t) = transition {
                            t.kind = TransitionKind::None;
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let ename = e.name();
                let ln = local_name(ename.as_ref());
                match ln {
                    b"bg" | b"bgPr" => {
                        in_bg = false;
                        bg_fill_depth = 0;
                    }
                    b"solidFill" if in_bg => {
                        bg_fill_depth = bg_fill_depth.saturating_sub(1);
                    }
                    b"txBody" => in_body = false,
                    b"rPr" => in_run_props = false,
                    b"transition" => in_transition = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    SlideFormatting {
        text_color,
        text_size,
        bg_color,
        transition,
    }
}

/// Extract a single XML attribute value by local name.
fn get_attr(e: &quick_xml::events::BytesStart<'_>, name: &[u8]) -> Option<String> {
    e.attributes().flatten().find_map(|a| {
        if local_name(a.key.as_ref()) == name {
            std::str::from_utf8(&a.value).ok().map(|s| s.to_string())
        } else {
            None
        }
    })
}

// ─── Shared helpers (also used by legacy read_pptx above) ────────────────────

fn extract_slide_number(name: &str) -> u32 {
    name.trim_start_matches("ppt/slides/slide")
        .trim_end_matches(".xml")
        .parse::<u32>()
        .unwrap_or(0)
}

fn shapes_to_slide_data(shapes: &[ShapeText], background_color: Option<String>) -> SlideData {
    let mut title_text = String::new();
    let mut subtitle_text = String::new();
    let mut body_paragraphs: Vec<String> = Vec::new();

    let dominant_color = shapes.iter().find_map(|s| s.text_color.clone());

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

    let mut in_sp = false;
    let mut in_txbody = false;
    let mut in_paragraph = false;
    let mut in_run = false;
    let mut in_rpr = false;
    let mut in_rpr_fill = false;
    let mut in_text_elem = false;
    let mut placeholder_type = String::new();
    let mut current_paragraphs: Vec<String> = Vec::new();
    let mut current_paragraph_runs: Vec<String> = Vec::new();
    let mut shape_text_color: Option<String> = None;
    let mut shape_text_size: Option<i32> = None;

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
                } else if local == b"ph" {
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
            Ok(Event::Empty(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                if !in_sp {
                    if bg_in_fill && local == b"srgbClr" && background_color.is_none() {
                        if let Some(color) = extract_attr_val(e.attributes()) {
                            background_color = Some(format!("#{}", color));
                        }
                    }
                } else if local == b"ph" {
                    for attr in e.attributes().flatten() {
                        if local_name(attr.key.as_ref()) == b"type" {
                            if let Ok(val) = std::str::from_utf8(&attr.value) {
                                placeholder_type = val.to_string();
                            }
                        }
                    }
                } else if in_paragraph && local == b"br" {
                    current_paragraph_runs.push("\n".to_string());
                } else if in_run && local == b"rPr" {
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
                } else if local == b"sp" {
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

fn extract_attr_val(attrs: quick_xml::events::attributes::Attributes) -> Option<String> {
    for attr in attrs.flatten() {
        if local_name(attr.key.as_ref()) == b"val" {
            if let Ok(val) = std::str::from_utf8(&attr.value) {
                return Some(val.to_string());
            }
        }
    }
    None
}

fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}
