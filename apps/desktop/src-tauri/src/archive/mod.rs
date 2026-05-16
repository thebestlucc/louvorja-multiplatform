pub mod manifest;
pub mod pptx;

use crate::db::models::slides::SlideContent;
use crate::error::AppError;
use manifest::Manifest;
use std::collections::{BTreeMap, HashMap};
use std::io::{Read, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;

/// Slide data in a presentation archive.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SlideData {
    pub slide_type: String,
    pub content: String,
    pub notes: Option<String>,
    pub transition: Option<String>,
}

/// Media file embedded in the archive.
#[derive(Debug, Clone)]
pub struct MediaFile {
    pub filename: String,
    pub data: Vec<u8>,
}

/// Full presentation archive.
#[derive(Debug, Clone)]
pub struct PresentationArchive {
    pub manifest: Manifest,
    pub slides: Vec<SlideData>,
    pub media: Vec<MediaFile>,
}

/// Read a .slja archive from disk.
pub fn read_slja(path: &Path) -> Result<PresentationArchive, AppError> {
    let file = std::fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Internal(format!("Failed to open .slja archive: {}", e)))?;

    let manifest_entry = find_archive_entry_name(&mut archive, "manifest.json");
    let slides_entry = find_archive_entry_name(&mut archive, "slides.json");

    if let (Some(manifest_entry), Some(slides_entry)) = (manifest_entry, slides_entry) {
        return read_modern_slja(&mut archive, &manifest_entry, &slides_entry);
    }

    if let Some(legacy_slides_entry) = find_archive_entry_name(&mut archive, "slides.lja") {
        return read_legacy_slja(path, &mut archive, &legacy_slides_entry);
    }

    Err(AppError::Internal(
        "Unsupported .slja archive layout: expected manifest/slides JSON or slides.lja".into(),
    ))
}

/// Write a presentation to a .slja archive on disk.
pub fn write_slja(path: &Path, presentation: &PresentationArchive) -> Result<(), AppError> {
    let file = std::fs::File::create(path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Write manifest.json
    zip.start_file("manifest.json", options)
        .map_err(|e| AppError::Internal(format!("Failed to write manifest: {}", e)))?;
    let manifest_json = presentation.manifest.to_json()?;
    zip.write_all(manifest_json.as_bytes())?;

    // Write slides.json
    zip.start_file("slides.json", options)
        .map_err(|e| AppError::Internal(format!("Failed to write slides: {}", e)))?;
    let slides_json = serde_json::to_string_pretty(&presentation.slides)?;
    zip.write_all(slides_json.as_bytes())?;

    // Write media files
    for media in &presentation.media {
        let entry_name = format!("media/{}", media.filename);
        zip.start_file(entry_name, options)
            .map_err(|e| AppError::Internal(format!("Failed to write media: {}", e)))?;
        zip.write_all(&media.data)?;
    }

    zip.finish()
        .map_err(|e| AppError::Internal(format!("Failed to finalize archive: {}", e)))?;

    Ok(())
}

/// Import a file as a PresentationArchive, detecting format by extension.
pub fn import_presentation(path: &Path) -> Result<PresentationArchive, AppError> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "slja" => read_slja(path),
        "pptx" => pptx::read_pptx(path),
        _ => Err(AppError::Internal(format!(
            "Unsupported file format: .{}",
            ext
        ))),
    }
}

fn read_modern_slja(
    archive: &mut zip::ZipArchive<std::fs::File>,
    manifest_entry: &str,
    slides_entry: &str,
) -> Result<PresentationArchive, AppError> {
    let manifest = {
        let mut manifest_file = archive.by_name(manifest_entry).map_err(|e| {
            AppError::Internal(format!(
                "Failed to read manifest entry '{}' in .slja archive: {}",
                manifest_entry, e
            ))
        })?;
        let mut manifest_str = String::new();
        manifest_file.read_to_string(&mut manifest_str)?;
        Manifest::from_json(&manifest_str)?
    };

    let slides: Vec<SlideData> = {
        let mut slides_file = archive.by_name(slides_entry).map_err(|e| {
            AppError::Internal(format!(
                "Failed to read slides entry '{}' in .slja archive: {}",
                slides_entry, e
            ))
        })?;
        let mut slides_str = String::new();
        slides_file.read_to_string(&mut slides_str)?;
        serde_json::from_str(&slides_str)?
    };

    let mut media = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| AppError::Internal(format!("Failed to read archive entry: {}", e)))?;
        if file.is_dir() {
            continue;
        }
        let normalized_name = normalize_archive_path(file.name());
        if normalized_name.starts_with("media/") && normalized_name.len() > 6 {
            let mut data = Vec::new();
            file.read_to_end(&mut data)?;
            media.push(MediaFile {
                filename: normalized_name[6..].to_string(),
                data,
            });
        }
    }

    Ok(PresentationArchive {
        manifest,
        slides,
        media,
    })
}

fn read_legacy_slja(
    path: &Path,
    archive: &mut zip::ZipArchive<std::fs::File>,
    slides_entry: &str,
) -> Result<PresentationArchive, AppError> {
    let mut slides_bytes = Vec::new();
    archive
        .by_name(slides_entry)
        .map_err(|e| {
            AppError::Internal(format!(
                "Failed to read legacy slide entry '{}' in .slja archive: {}",
                slides_entry, e
            ))
        })?
        .read_to_end(&mut slides_bytes)?;

    let slides_lja = decode_legacy_text(&slides_bytes);
    let parsed = parse_legacy_lja(&slides_lja)?;

    let fallback_title = path
        .file_stem()
        .and_then(|name| name.to_str())
        .map(|name| name.replace('_', " ").trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Imported legacy presentation".to_string());

    let manifest = Manifest {
        title: parsed.title.unwrap_or(fallback_title),
        author: None,
        aspect_ratio: "16:9".to_string(),
        slide_count: parsed.slides.len(),
        created_at: None,
        updated_at: None,
    };

    let mut media = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| AppError::Internal(format!("Failed to read archive entry: {}", e)))?;
        if file.is_dir() {
            continue;
        }

        let normalized_name = normalize_archive_path(file.name());
        if normalized_name.is_empty() || normalized_name.eq_ignore_ascii_case("slides.lja") {
            continue;
        }

        let mut data = Vec::new();
        file.read_to_end(&mut data)?;
        media.push(MediaFile {
            filename: normalized_name,
            data,
        });
    }

    Ok(PresentationArchive {
        manifest,
        slides: parsed.slides,
        media,
    })
}

#[derive(Default)]
struct ParsedLegacySlides {
    title: Option<String>,
    slides: Vec<SlideData>,
}

fn parse_legacy_lja(raw: &str) -> Result<ParsedLegacySlides, AppError> {
    let mut current_section = String::new();
    let mut general: HashMap<String, String> = HashMap::new();
    let mut slides: BTreeMap<usize, HashMap<String, String>> = BTreeMap::new();

    for raw_line in raw.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }

        if line.starts_with('[') && line.ends_with(']') {
            current_section = line[1..line.len() - 1].trim().to_string();
            continue;
        }

        let Some((raw_key, raw_value)) = line.split_once('=') else {
            continue;
        };
        let key = raw_key.trim().to_ascii_lowercase();
        let value = raw_value.trim().to_string();

        if current_section.eq_ignore_ascii_case("geral") {
            general.insert(key, value);
            continue;
        }

        if let Some(index) = parse_legacy_slide_index(&current_section) {
            slides.entry(index).or_default().insert(key, value);
        }
    }

    let title = general
        .get("titulo")
        .or_else(|| general.get("title"))
        .map(|value| normalize_legacy_text(value))
        .filter(|value| !value.trim().is_empty());
    let has_audio = general
        .get("audio")
        .map(|value| value.trim() != "0")
        .unwrap_or(true);
    let audio_path = if has_audio {
        general
            .get("url_musica")
            .or_else(|| general.get("url_music"))
            .or_else(|| general.get("audio_path"))
            .map(|value| normalize_archive_path(value))
            .filter(|value| !value.is_empty())
    } else {
        None
    };

    let legacy_tempo_is_microseconds = detect_legacy_tempo_scale_microseconds(&slides);

    let mut parsed_slides = Vec::new();
    for slide in slides.into_values() {
        if let Some(parsed_slide) =
            convert_legacy_slide(&slide, audio_path.as_deref(), legacy_tempo_is_microseconds)?
        {
            parsed_slides.push(parsed_slide);
        }
    }

    if parsed_slides.is_empty() {
        return Err(AppError::Internal(
            "Legacy .slja archive has no parseable slides.".into(),
        ));
    }

    Ok(ParsedLegacySlides {
        title,
        slides: parsed_slides,
    })
}

fn convert_legacy_slide(
    slide: &HashMap<String, String>,
    audio_path: Option<&str>,
    tempo_in_microseconds: bool,
) -> Result<Option<SlideData>, AppError> {
    let legacy_type = slide
        .get("tipo")
        .map(|value| value.to_ascii_uppercase())
        .unwrap_or_else(|| "LETRA".to_string());
    let text = slide
        .get("letra")
        .map(|value| normalize_legacy_text(value))
        .unwrap_or_default();
    let image = slide
        .get("imagem")
        .map(|value| normalize_archive_path(value))
        .filter(|value| !value.is_empty());
    let background_image = image.as_deref().map(to_media_path);
    let text_color = slide
        .get("cor_letra")
        .map(|value| value.trim().to_string())
        .filter(|value| value.starts_with('#') && value.len() >= 4);
    let background_color = slide
        .get("cor_fundo")
        .map(|value| value.trim().to_string())
        .filter(|value| value.starts_with('#') && value.len() >= 4);
    let font_size = slide
        .get("tamanho_letra")
        .and_then(|value| value.trim().parse::<i32>().ok())
        .map(|value| value.clamp(12, 96));
    let slide_audio_path = audio_path.map(to_media_path);

    let (slide_type, content_json) = if legacy_type.contains("CAPA") {
        if text.is_empty() {
            if let Some(image_path) = image.as_ref() {
                (
                    "image".to_string(),
                    serde_json::json!({
                        "slideType": "image",
                        "backgroundImage": to_media_path(image_path),
                        "label": "Legacy cover",
                        "audioPath": slide_audio_path,
                    }),
                )
            } else {
                return Ok(None);
            }
        } else {
            let mut lines = text
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>();
            if lines.is_empty() {
                lines.push("Untitled");
            }
            let title = lines[0].to_string();
            let subtitle = if lines.len() > 1 {
                Some(lines[1..].join(" "))
            } else {
                None
            };
            (
                "cover".to_string(),
                serde_json::json!({
                    "slideType": "cover",
                    "title": title,
                    "subtitle": subtitle,
                    "backgroundImage": background_image,
                    "textColor": text_color,
                    "backgroundColor": background_color,
                    "textSize": font_size,
                    "audioPath": slide_audio_path,
                }),
            )
        }
    } else if legacy_type.contains("LETRA") && !text.is_empty() {
        (
            "lyrics".to_string(),
            serde_json::json!({
                "slideType": "lyrics",
                "text": text,
                "backgroundImage": background_image,
                "textColor": text_color,
                "backgroundColor": background_color,
                "textSize": font_size,
                "audioPath": slide_audio_path,
            }),
        )
    } else if !text.is_empty() {
        (
            "text".to_string(),
            serde_json::json!({
                "slideType": "text",
                "text": text,
                "backgroundImage": background_image,
                "textColor": text_color,
                "backgroundColor": background_color,
                "textSize": font_size,
                "audioPath": slide_audio_path,
            }),
        )
    } else if let Some(image_path) = image.as_ref() {
        (
            "image".to_string(),
            serde_json::json!({
                "slideType": "image",
                "backgroundImage": to_media_path(image_path),
                "label": "Legacy slide image",
                "audioPath": slide_audio_path,
            }),
        )
    } else {
        return Ok(None);
    };

    let mut notes_chunks = Vec::new();
    if let Some(image_path) = image {
        notes_chunks.push(format!("legacy.background={}", image_path));
    }
    if let Some(time_hms) = slide
        .get("tempo_hms")
        .filter(|value| !value.trim().is_empty())
    {
        notes_chunks.push(format!("legacy.tempo_hms={}", time_hms.trim()));
    } else if let Some(time_ms) = slide.get("tempo").filter(|value| !value.trim().is_empty()) {
        if let Some(normalized_tempo_ms) = normalize_legacy_tempo_ms(time_ms, tempo_in_microseconds)
        {
            notes_chunks.push(format!("legacy.tempo_ms={}", normalized_tempo_ms));
        }
    }
    if let Some(audio_path) = audio_path {
        notes_chunks.push(format!("legacy.audio_path={}", audio_path));
    }

    Ok(Some(SlideData {
        slide_type,
        content: serde_json::to_string(&content_json)?,
        notes: if notes_chunks.is_empty() {
            None
        } else {
            Some(notes_chunks.join("\n"))
        },
        transition: None,
    }))
}

fn detect_legacy_tempo_scale_microseconds(
    slides: &BTreeMap<usize, HashMap<String, String>>,
) -> bool {
    let max_tempo = slides
        .values()
        .filter_map(|slide| slide.get("tempo"))
        .filter_map(|value| value.trim().parse::<u64>().ok())
        .max()
        .unwrap_or(0);

    // Legacy exports commonly store tempo in microseconds.
    // If values exceed 1h in milliseconds, treat source as microseconds.
    max_tempo > 3_600_000
}

fn normalize_legacy_tempo_ms(raw: &str, tempo_in_microseconds: bool) -> Option<u64> {
    let parsed = raw.trim().parse::<u64>().ok()?;
    if tempo_in_microseconds {
        return Some(parsed / 1000);
    }
    Some(parsed)
}

fn parse_legacy_slide_index(section: &str) -> Option<usize> {
    let normalized = section.trim().to_ascii_lowercase();
    if let Some(raw) = normalized.strip_prefix("slide:") {
        return raw.trim().parse::<usize>().ok();
    }
    None
}

fn to_media_path(path: &str) -> String {
    let normalized = normalize_archive_path(path);
    if normalized.starts_with("media/") {
        normalized
    } else {
        format!("media/{}", normalized)
    }
}

fn normalize_legacy_text(value: &str) -> String {
    value
        .replace('|', "\n")
        .replace('\r', "")
        .trim()
        .to_string()
}

fn find_archive_entry_name(
    archive: &mut zip::ZipArchive<std::fs::File>,
    target_name: &str,
) -> Option<String> {
    let target = normalize_archive_path(target_name).to_ascii_lowercase();
    for i in 0..archive.len() {
        let Ok(entry) = archive.by_index(i) else {
            continue;
        };
        let normalized = normalize_archive_path(entry.name()).to_ascii_lowercase();
        if normalized == target {
            return Some(entry.name().to_string());
        }
    }
    None
}

fn normalize_archive_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

fn decode_legacy_text(bytes: &[u8]) -> String {
    match String::from_utf8(bytes.to_vec()) {
        Ok(text) => text,
        Err(_) => bytes.iter().map(|byte| char::from(*byte)).collect(),
    }
}

/// Collect absolute-path media fields from a SlideContent for archive bundling.
/// Relative paths (yt-dlp downloads, managed covers) are excluded.
pub(crate) fn extract_media_paths(content: &SlideContent) -> Vec<String> {
    [
        content.background_image(),
        content.video_path(),
        content.video_url(),
    ]
    .into_iter()
    .flatten()
    .filter(|p| std::path::Path::new(p).is_absolute())
    .map(String::from)
    .collect()
}

/// Return a filename unique within `seen`, appending _2, _3, ... on collision.
pub(crate) fn unique_archive_name(
    filename: &str,
    seen: &mut std::collections::HashSet<String>,
) -> String {
    if seen.insert(filename.to_string()) {
        return filename.to_string();
    }
    let (stem, ext) = match filename.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (filename.to_string(), String::new()),
    };
    let mut counter = 2usize;
    loop {
        let candidate = format!("{stem}_{counter}{ext}");
        if seen.insert(candidate.clone()) {
            return candidate;
        }
        counter += 1;
    }
}

#[cfg(test)]
mod archive_media_tests {
    use super::{extract_media_paths, unique_archive_name};
    use crate::db::models::slides::SlideContent;

    use crate::db::models::slides::{BackgroundConfig, BackgroundKind, VideoMode};

    fn bg_content(path: &str) -> SlideContent {
        SlideContent::Cover {
            title: String::new(),
            subtitle: None,
            label: None,
            background: BackgroundConfig {
                kind: BackgroundKind::Image,
                image_path: Some(path.to_string()),
                ..Default::default()
            },
            text_color: None,
            text_size: None,
        }
    }

    #[test]
    fn test_extract_absolute_bg_included() {
        let paths = extract_media_paths(&bg_content("/Users/user/Downloads/bg.jpg"));
        assert_eq!(paths, vec!["/Users/user/Downloads/bg.jpg".to_string()]);
    }

    #[test]
    fn test_extract_relative_excluded() {
        let paths = extract_media_paths(&bg_content("media/images/hash.jpg"));
        assert!(paths.is_empty(), "relative paths must not be bundled");
    }

    #[test]
    fn test_extract_null_excluded() {
        let content = SlideContent::Text {
            content: String::new(),
            background: BackgroundConfig::default(),
            text_color: None,
            text_size: None,
        };
        let paths = extract_media_paths(&content);
        assert!(paths.is_empty());
    }

    #[test]
    fn test_extract_multiple_fields() {
        let content = SlideContent::Video {
            path: "/abs/clip.mp4".into(),
            auto_play: false,
            loop_video: false,
            muted: false,
            mode: VideoMode::default(),
            overlay_text: None,
            audio_path: None,
        };
        // Video variant only has path, not background_image — test just video_path
        let paths = extract_media_paths(&content);
        assert_eq!(paths.len(), 1);
        assert!(paths.contains(&"/abs/clip.mp4".to_string()));
    }

    #[test]
    fn test_collision_no_collision() {
        let mut seen = std::collections::HashSet::new();
        assert_eq!(unique_archive_name("bg.jpg", &mut seen), "bg.jpg");
    }

    #[test]
    fn test_collision_second_gets_suffix_2() {
        let mut seen = std::collections::HashSet::new();
        let _ = unique_archive_name("bg.jpg", &mut seen);
        assert_eq!(unique_archive_name("bg.jpg", &mut seen), "bg_2.jpg");
    }

    #[test]
    fn test_collision_third_gets_suffix_3() {
        let mut seen = std::collections::HashSet::new();
        let _ = unique_archive_name("bg.jpg", &mut seen);
        let _ = unique_archive_name("bg.jpg", &mut seen);
        assert_eq!(unique_archive_name("bg.jpg", &mut seen), "bg_3.jpg");
    }

    #[test]
    fn test_collision_no_extension() {
        let mut seen = std::collections::HashSet::new();
        let _ = unique_archive_name("Makefile", &mut seen);
        assert_eq!(unique_archive_name("Makefile", &mut seen), "Makefile_2");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_legacy_lja_builds_cover_and_lyrics_slides() {
        let raw = r#"
[Geral]
slides=2
titulo=Teste de Música

[Slide:1]
tipo=CAPA
letra=HOJE É O TEMPO
imagem=imagens\capa.jpg

[Slide:2]
tipo=LETRA
letra=linha 1|linha 2
imagem=imagens\fundo.jpg
"#;

        let parsed = parse_legacy_lja(raw).expect("legacy parse should succeed");
        assert_eq!(parsed.title.as_deref(), Some("Teste de Música"));
        assert_eq!(parsed.slides.len(), 2);

        let cover_content: serde_json::Value = serde_json::from_str(&parsed.slides[0].content)
            .expect("cover content should be valid json");
        assert_eq!(cover_content["slideType"], "cover");
        assert_eq!(cover_content["title"], "HOJE É O TEMPO");

        let lyrics_content: serde_json::Value = serde_json::from_str(&parsed.slides[1].content)
            .expect("lyrics content should be valid json");
        assert_eq!(lyrics_content["slideType"], "lyrics");
        assert_eq!(lyrics_content["text"], "linha 1\nlinha 2");
    }
}
