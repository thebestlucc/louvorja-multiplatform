use crate::db::models::{Album, Hymn, HymnWriteInput};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn search_hymns(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::search_hymns(&conn, &query)
}

#[tauri::command]
pub fn get_hymn(id: i64, state: tauri::State<'_, AppState>) -> Result<Hymn, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_hymn_by_id(&conn, id)
}

#[tauri::command]
pub fn get_albums(state: tauri::State<'_, AppState>) -> Result<Vec<Album>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_albums(&conn)
}

#[tauri::command]
pub fn get_hymns_by_album(
    album: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Hymn>, AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::music::get_hymns_by_album(&conn, &album)
}

#[tauri::command]
pub fn create_hymn(
    input: HymnWriteInput,
    state: tauri::State<'_, AppState>,
) -> Result<Hymn, AppError> {
    validate_hymn_input(&input)?;
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    let hymn_id = crate::db::queries::music::insert_hymn(&tx, &input)?;
    let hymn = crate::db::queries::music::get_hymn_by_id(&tx, hymn_id)?;
    tx.commit()?;
    Ok(hymn)
}

#[tauri::command]
pub fn update_hymn(
    id: i64,
    input: HymnWriteInput,
    state: tauri::State<'_, AppState>,
) -> Result<Hymn, AppError> {
    validate_hymn_input(&input)?;
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::music::update_hymn(&tx, id, &input)?;
    let hymn = crate::db::queries::music::get_hymn_by_id(&tx, id)?;
    tx.commit()?;
    Ok(hymn)
}

#[tauri::command]
pub fn delete_hymn(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.unchecked_transaction()?;
    crate::db::queries::music::delete_hymn(&tx, id)?;
    tx.commit()?;
    Ok(())
}

fn validate_hymn_input(input: &HymnWriteInput) -> Result<(), AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::Internal("Hymn title is required.".into()));
    }
    if let Some(number) = input.number {
        if number < 0 {
            return Err(AppError::Internal(
                "Hymn number must be greater than or equal to zero.".into(),
            ));
        }
    }
    if let Some(path) = &input.cover_path {
        validate_cover_path(path)?;
    }
    Ok(())
}

fn validate_cover_path(path: &str) -> Result<(), AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::Internal("Cover path cannot be empty.".into()));
    }
    if trimmed.contains("..") {
        return Err(AppError::Internal(
            "Cover path cannot contain parent path traversal segments.".into(),
        ));
    }
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("data:")
        || trimmed.starts_with("blob:")
    {
        return Err(AppError::Internal(
            "Cover path must reference managed/local media, not remote URLs.".into(),
        ));
    }
    Ok(())
}
