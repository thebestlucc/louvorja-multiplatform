use crate::db::models::{Presentation, Slide};
use crate::error::AppError;
use crate::state::AppState;
use std::path::Path;

#[tauri::command]
pub fn get_presentations(state: tauri::State<'_, AppState>) -> Result<Vec<Presentation>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::get_presentations(&conn)
}

#[tauri::command]
pub fn get_presentation(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Presentation, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::get_presentation_by_id(&conn, id)
}

#[tauri::command]
pub fn create_presentation(
    title: String,
    aspect_ratio: String,
    state: tauri::State<'_, AppState>,
) -> Result<Presentation, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let id = crate::db::queries::slides::insert_presentation(&conn, &title, &aspect_ratio)?;
    crate::db::queries::slides::get_presentation_by_id(&conn, id)
}

#[tauri::command]
pub fn update_presentation(
    id: i64,
    title: String,
    aspect_ratio: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::update_presentation(&conn, id, &title, &aspect_ratio)
}

#[tauri::command]
pub fn delete_presentation(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::delete_presentation(&conn, id)
}

#[tauri::command]
pub fn get_slides(
    presentation_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Slide>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::get_slides(&conn, presentation_id)
}

#[tauri::command]
pub fn create_slide(
    presentation_id: i64,
    content_json: String,
    sort_order: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Slide, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let id = crate::db::queries::slides::insert_slide(
        &conn,
        presentation_id,
        &content_json,
        sort_order,
    )?;
    // Return the created slide
    let slides = crate::db::queries::slides::get_slides(&conn, presentation_id)?;
    slides
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::Internal("Failed to retrieve created slide".into()))
}

#[tauri::command]
pub fn update_slide(
    id: i64,
    content_json: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::update_slide(&conn, id, &content_json)
}

#[tauri::command]
pub fn delete_slide(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::delete_slide(&conn, id)
}

#[tauri::command]
pub fn reorder_slides(
    presentation_id: i64,
    slide_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::slides::update_slide_orders(&conn, presentation_id, &slide_ids)
}

#[tauri::command]
pub fn import_slja(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Presentation, AppError> {
    let file_path = Path::new(&path);
    let archive = crate::archive::import_presentation(file_path)?;

    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let pres_id = crate::db::queries::slides::insert_presentation(
        &conn,
        &archive.manifest.title,
        &archive.manifest.aspect_ratio,
    )?;

    for (i, slide) in archive.slides.iter().enumerate() {
        crate::db::queries::slides::insert_slide(&conn, pres_id, &slide.content, i as i32)?;
    }

    crate::db::queries::slides::get_presentation_by_id(&conn, pres_id)
}

#[tauri::command]
pub fn export_slja(
    presentation_id: i64,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let presentation = crate::db::queries::slides::get_presentation_by_id(&conn, presentation_id)?;
    let slides = crate::db::queries::slides::get_slides(&conn, presentation_id)?;

    let archive = crate::archive::PresentationArchive {
        manifest: crate::archive::manifest::Manifest {
            title: presentation.title,
            author: presentation.author,
            aspect_ratio: presentation.aspect_ratio,
            slide_count: slides.len(),
            created_at: Some(presentation.created_at),
            updated_at: Some(presentation.updated_at),
        },
        slides: slides
            .into_iter()
            .map(|s| crate::archive::SlideData {
                slide_type: s.slide_type,
                content: s.content,
                notes: s.notes,
                transition: s.transition,
            })
            .collect(),
        media: vec![],
    };

    crate::archive::write_slja(Path::new(&path), &archive)
}
