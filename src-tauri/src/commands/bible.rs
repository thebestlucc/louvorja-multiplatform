use crate::db::models::{BibleSearchResult, BibleVersion, Book, SlideContent, Verse};
use crate::error::AppError;
use crate::state::AppState;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn get_bible_versions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleVersion>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_versions(&conn)
}

#[tauri::command]
pub fn get_books(
    version_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Book>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_books(&conn, version_id)
}

#[tauri::command]
pub fn get_verses(
    version_id: i64,
    book: String,
    chapter: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Verse>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_verses(&conn, version_id, &book, chapter)
}

#[tauri::command]
pub fn get_verse_range(
    version_id: i64,
    book: String,
    chapter: i64,
    start: i64,
    end: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Verse>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_verse_range(&conn, version_id, &book, chapter, start, end)
}

#[tauri::command]
pub fn search_bible(
    query: String,
    version_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::search_bible_text(&conn, &query, version_id)
}

#[tauri::command]
pub fn project_bible_verse(
    version_id: i64,
    book: String,
    chapter: i64,
    start: i64,
    end: i64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let verses =
        crate::db::queries::bible::get_verse_range(&conn, version_id, &book, chapter, start, end)?;

    let text = verses
        .iter()
        .map(|v| format!("{} {}", v.verse, v.text))
        .collect::<Vec<_>>()
        .join(" ");

    let reference = if start == end {
        format!("{} {}:{}", book, chapter, start)
    } else {
        format!("{} {}:{}-{}", book, chapter, start, end)
    };

    let slide_data = SlideContent {
        slide_type: "bible".to_string(),
        text: Some(text),
        title: Some(reference),
        subtitle: None,
        label: None,
    };

    // Update current slide state
    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }

    // Emit to projector window
    app.emit("slide-changed", &slide_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn import_bible_version(
    name: String,
    abbreviation: String,
    language: String,
    verses_json: String,
    state: tauri::State<'_, AppState>,
) -> Result<i64, AppError> {
    let verses: Vec<(String, i64, i64, String)> = serde_json::from_str(&verses_json)?;
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::import_bible_version(&conn, &name, &abbreviation, &language, &verses)
}
