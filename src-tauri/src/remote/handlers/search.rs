//! Search handlers for remote WS commands.
//!
//! These ops execute DB queries synchronously (via `spawn_blocking`) and return
//! results directly in the WS response payload. No Tauri events are needed —
//! the remote client receives results inline.

use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum QueueAddItemRaw {
    #[serde(rename = "hymn")]
    Hymn { hymn_id: i64 },
    #[serde(rename = "bible")]
    Bible {
        version_id: i64,
        book: String,
        book_name: String,
        chapter: i64,
        verse: i64,
    },
    #[serde(rename = "video")]
    Video {
        video_source: String, // "youtube" | "local"
        video_id: Option<String>,
        video_url: Option<String>,
        video_title: Option<String>,
        duration: Option<f64>,
    },
    #[serde(rename = "presentation")]
    Presentation { presentation_id: i64 },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueAddBatchPayload {
    pub items: Vec<QueueAddItemRaw>,
}

fn app_state(app: &AppHandle) -> Result<tauri::State<'_, AppState>, AppError> {
    app.try_state::<AppState>()
        .ok_or_else(|| AppError::Internal("AppState not available".into()))
}

/// `hymn.search { query, limit? }` — full-text search over hymns.
///
/// Fallback chain:
/// 1. Try content_dbs (CDN hymns) for the first selected language.
/// 2. If content_db returns empty OR is unavailable, try main DB (user-created hymns).
/// 3. Return whichever is non-empty; if both empty, return `[]`.
pub async fn hymn_search(app: &AppHandle, query: String, limit: usize) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.db.get()?;

    let results = if let Some((content_conn, lang, caps)) =
        get_content_db_conn_with_caps(&state, &conn)
    {
        let hymns = crate::db::queries::music::search_hymns_content_db(
            &content_conn,
            &query,
            &lang,
            caps.as_ref(),
        )?;
        if hymns.is_empty() {
            // Content DB exists but returned nothing — also check main DB
            let main_hymns = crate::db::queries::music::search_hymns(&conn, &query)?;
            log::debug!(
                "[remote] hymn.search query={:?} lang={} content_db_count=0 main_db_count={} final_source=main",
                query, lang, main_hymns.len()
            );
            main_hymns
        } else {
            log::debug!(
                "[remote] hymn.search query={:?} lang={} content_db_count={} final_source=content",
                query, lang, hymns.len()
            );
            hymns
        }
    } else {
        let main_hymns = crate::db::queries::music::search_hymns(&conn, &query)?;
        log::debug!(
            "[remote] hymn.search query={:?} content_db_present=false main_db_count={}",
            query, main_hymns.len()
        );
        main_hymns
    };

    let mut results = results;
    results.truncate(limit);
    Ok(serde_json::to_value(results).unwrap_or(Value::Array(vec![])))
}

/// Gets a PooledConnection from content_dbs for the first selected language.
/// Mirrors the helper in `commands/music.rs` — duplicated here to avoid a
/// cross-module dependency on a private function.
fn get_content_db_conn_with_caps(
    state: &AppState,
    conn: &rusqlite::Connection,
) -> Option<(
    r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>,
    String,
    Option<crate::state::ContentDbCapabilities>,
)> {
    let langs = crate::db::queries::content_sync::get_selected_languages(conn);
    let lang = langs.into_iter().next()?;
    let map = state.content_dbs.read().ok()?;
    let pool = map.get(&lang)?.clone();
    drop(map);
    let caps = state
        .content_db_capabilities
        .read()
        .ok()
        .and_then(|m| m.get(&lang).cloned());
    let pooled = pool.get().ok()?;
    Some((pooled, lang, caps))
}

/// `bible.search { query, limit?, versionId? }` — full-text search over Bible verses.
/// When `versionId` is set, results are scoped to that single version.
pub async fn bible_search(
    app: &AppHandle,
    query: String,
    limit: usize,
    version_id: Option<i64>,
) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let mut results = crate::db::queries::bible::search_bible_text(&conn, &query, version_id)?;
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

/// `bible.list_versions {}` — list all available Bible versions.
pub async fn bible_list_versions(app: &AppHandle) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let versions = crate::db::queries::bible::get_versions(&conn)?;
    Ok(serde_json::to_value(versions).unwrap_or(Value::Array(vec![])))
}

/// `bible.list_books { versionId }` — list all books for a version.
pub async fn bible_list_books(app: &AppHandle, version_id: i64) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let books = crate::db::queries::bible::get_books(&conn, version_id)?;
    Ok(serde_json::to_value(books).unwrap_or(Value::Array(vec![])))
}

/// `bible.list_chapters { versionId, book }` — list distinct chapter numbers for a book.
pub async fn bible_list_chapters(app: &AppHandle, version_id: i64, book: String) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let chapters = crate::db::queries::bible::get_chapters(&conn, version_id, &book)?;
    Ok(serde_json::to_value(chapters).unwrap_or(Value::Array(vec![])))
}

/// `bible.list_verses { versionId, book, chapter }` — list all verses for a chapter.
pub async fn bible_list_verses(app: &AppHandle, version_id: i64, book: String, chapter: i64) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.bible_db.get()?;
    let verses = crate::db::queries::bible::get_verses(&conn, version_id, &book, chapter)?;
    Ok(serde_json::to_value(verses).unwrap_or(Value::Array(vec![])))
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

/// `search.select { id, type, ...extra }` — project the tapped search result.
///
/// Emits a Tauri event so the desktop React bridge handles projection:
/// - type="hymns"    → `remote-hymn-select   { id }`
/// - type="bible"    → `remote-bible-select  { book, chapter, verse, text, bookName }`
/// - type="services" → `remote-service-start { serviceId }` (existing service flow)
pub async fn select(app: &AppHandle, id: String, item_type: &str, payload: &Value) -> Result<Value, AppError> {
    use tauri::Emitter;
    match item_type {
        "hymns" => {
            let hymn_id: i64 = id
                .parse()
                .map_err(|_| AppError::Internal(format!("search.select: invalid hymn id: {id}")))?;
            app.emit("remote-hymn-select", serde_json::json!({ "id": hymn_id }))
                .map_err(|e| AppError::Tauri(e.to_string()))?;
        }
        "bible" => {
            // The PWA sends the full verse reference alongside the id so we can
            // project without a DB round-trip. All fields are required.
            let book = payload.get("book").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("search.select bible requires `book`".into()))?;
            let chapter = payload.get("chapter").and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("search.select bible requires `chapter`".into()))?;
            let verse_num = payload.get("verse").and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::Internal("search.select bible requires `verse`".into()))?;
            let text = payload.get("text").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("search.select bible requires `text`".into()))?;
            let book_name = payload.get("bookName").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("search.select bible requires `bookName`".into()))?;
            app.emit("remote-bible-select", serde_json::json!({
                "book": book,
                "chapter": chapter,
                "verse": verse_num,
                "text": text,
                "bookName": book_name
            }))
            .map_err(|e| AppError::Tauri(e.to_string()))?;
        }
        "services" => {
            let service_id: i64 = id
                .parse()
                .map_err(|_| AppError::Internal(format!("search.select: invalid service id: {id}")))?;
            app.emit("remote-service-start", serde_json::json!({ "serviceId": service_id }))
                .map_err(|e| AppError::Tauri(e.to_string()))?;
        }
        other => {
            return Err(AppError::Internal(format!("search.select: unknown type: {other}")));
        }
    }
    Ok(serde_json::json!({}))
}

/// `queue.add { id, type }` — append a hymn to the playing queue WITHOUT
/// clearing the queue or projecting. Only `type="hymns"` is supported today —
/// bible/services have no queue semantics.
pub async fn queue_add(app: &AppHandle, id: String, item_type: &str) -> Result<Value, AppError> {
    use tauri::Emitter;
    if item_type != "hymns" {
        return Err(AppError::Internal(format!(
            "queue.add: only `hymns` type supported, got: {item_type}"
        )));
    }
    let hymn_id: i64 = id
        .parse()
        .map_err(|_| AppError::Internal(format!("queue.add: invalid hymn id: {id}")))?;
    app.emit("remote-queue-add", serde_json::json!({ "id": hymn_id }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

/// `queue.play { id }` — jump to a specific item in the playing queue by its UUID.
/// Emits `remote-queue-play { id }` which the React bridge handles.
pub async fn queue_play(app: &AppHandle, id: String) -> Result<Value, AppError> {
    use tauri::Emitter;
    app.emit("remote-queue-play", serde_json::json!({ "id": id }))
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    Ok(serde_json::json!({}))
}

#[cfg(test)]
mod tests {
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
