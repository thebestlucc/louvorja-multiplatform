pub mod manifest;
mod pptx;

use crate::error::AppError;
use manifest::Manifest;
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

    // Read manifest.json
    let manifest = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| AppError::Internal("Missing manifest.json in .slja archive".into()))?;
        let mut manifest_str = String::new();
        manifest_file.read_to_string(&mut manifest_str)?;
        Manifest::from_json(&manifest_str)?
    };

    // Read slides.json
    let slides: Vec<SlideData> = {
        let mut slides_file = archive
            .by_name("slides.json")
            .map_err(|_| AppError::Internal("Missing slides.json in .slja archive".into()))?;
        let mut slides_str = String::new();
        slides_file.read_to_string(&mut slides_str)?;
        serde_json::from_str(&slides_str)?
    };

    // Read media files from media/ directory
    let mut media = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| AppError::Internal(format!("Failed to read archive entry: {}", e)))?;
        let name = file.name().to_string();
        if name.starts_with("media/") && name.len() > 6 {
            let mut data = Vec::new();
            file.read_to_end(&mut data)?;
            media.push(MediaFile {
                filename: name[6..].to_string(),
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
