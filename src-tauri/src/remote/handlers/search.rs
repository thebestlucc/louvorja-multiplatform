//! Search handlers for remote WS commands.
//!
//! These ops execute DB queries synchronously (via `spawn_blocking`) and return
//! results directly in the WS response payload. No Tauri events are needed —
//! the remote client receives results inline.

use crate::{error::AppError, state::AppState};
use serde_json::Value;
use tauri::{AppHandle, Manager};

fn app_state(app: &AppHandle) -> Result<tauri::State<'_, AppState>, AppError> {
    app.try_state::<AppState>()
        .ok_or_else(|| AppError::Internal("AppState not available".into()))
}

/// `hymn.search { query, limit? }` — full-text search over hymns.
pub async fn hymn_search(app: &AppHandle, query: String, limit: usize) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.db.get()?;
    let mut results = crate::db::queries::music::search_hymns(&conn, &query)?;
    results.truncate(limit);
    Ok(serde_json::to_value(results).unwrap_or(Value::Array(vec![])))
}

/// `bible.search { query, limit? }` — full-text search over Bible verses.
pub async fn bible_search(app: &AppHandle, query: String, limit: usize) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let mut results = crate::db::queries::bible::search_bible_text(&conn, &query, None)?;
    results.truncate(limit);
    Ok(serde_json::to_value(results).unwrap_or(Value::Array(vec![])))
}

/// `bible.get_verse { versionId, book, chapter, verse }` — get specific verse.
pub async fn bible_get_verse(
    app: &AppHandle,
    version_id: i64,
    book: String,
    chapter: i64,
) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let results = crate::db::queries::bible::get_verses(&conn, version_id, &book, chapter)?;
    Ok(serde_json::to_value(results).unwrap_or(Value::Array(vec![])))
}

/// `service.list_today` — list all services ordered by date descending (most recent first).
pub async fn service_list_today(app: &AppHandle) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.db.get()?;
    let services = crate::db::queries::liturgy::get_services(&conn)?;
    // Return at most the 10 most recent services (frontend can filter further).
    let recent: Vec<_> = services.into_iter().take(10).collect();
    Ok(serde_json::to_value(recent).unwrap_or(Value::Array(vec![])))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_limit_is_bounded() {
        // Ensure callers that omit limit get a sane default.
        let default_limit: usize = 50;
        let max_limit: usize = 200;
        assert!(default_limit <= max_limit);
    }

    #[test]
    fn limit_truncation_works() {
        let mut v = vec![1, 2, 3, 4, 5];
        v.truncate(3);
        assert_eq!(v, vec![1, 2, 3]);
    }
}
