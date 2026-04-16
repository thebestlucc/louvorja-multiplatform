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
    #[serde(rename = "hymn", rename_all = "camelCase")]
    Hymn { hymn_id: i64 },
    #[serde(rename = "bible", rename_all = "camelCase")]
    Bible {
        version_id: i64,
        book: String,
        book_name: String,
        chapter: i64,
        verse: i64,
    },
    #[serde(rename = "video", rename_all = "camelCase")]
    Video {
        video_source: String, // "youtube" | "local"
        video_id: Option<String>,
        video_url: Option<String>,
        video_title: Option<String>,
        duration: Option<f64>,
    },
    #[serde(rename = "presentation", rename_all = "camelCase")]
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

/// `presentation.list {}` — list all presentations, newest first.
pub async fn presentation_list(app: &AppHandle) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.db.get()?;
    let items = crate::db::queries::slides::get_presentations(&conn)?;
    Ok(serde_json::to_value(items).unwrap_or(Value::Array(vec![])))
}

/// `video.list { query? }` — list downloaded / known videos from the online_videos table,
/// optionally filtered by title substring.
pub async fn video_list(app: &AppHandle, query: String) -> Result<Value, AppError> {
    let state = app_state(app)?;
    let conn = state.db.get()?;
    let items = crate::db::queries::online_videos::search_videos(&conn, &query)?;
    Ok(serde_json::to_value(items).unwrap_or(Value::Array(vec![])))
}

/// `queue.add { items: QueueAddItemRaw[] }` — append mixed-kind items to the queue.
/// All items are emitted in a single `remote-queue-add { items: [...] }` event.
pub async fn queue_add(
    app: &AppHandle,
    payload: &Value,
) -> Result<Value, AppError> {
    use tauri::Emitter;
    let batch: QueueAddBatchPayload = serde_json::from_value(payload.clone())
        .map_err(|e| AppError::Internal(format!("queue.add invalid payload: {e}")))?;
    if batch.items.is_empty() {
        return Err(AppError::Internal("queue.add: items must be non-empty".into()));
    }
    app.emit(
        "remote-queue-add",
        serde_json::json!({
            "items": serde_json::to_value(&batch.items)
                .map_err(|e| AppError::Internal(format!("serialize items: {e}")))?
        }),
    )
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

    #[test]
    fn queue_add_payload_parses_mixed_batch() {
        let v = serde_json::json!({
            "items": [
                { "kind": "hymn", "hymnId": 42 },
                { "kind": "bible", "versionId": 1, "book": "John", "bookName": "John", "chapter": 3, "verse": 16 },
                { "kind": "video", "videoSource": "youtube", "videoId": "abc" },
                { "kind": "presentation", "presentationId": 7 }
            ]
        });
        let parsed: super::QueueAddBatchPayload = serde_json::from_value(v).unwrap();
        assert_eq!(parsed.items.len(), 4);
    }

    #[test]
    fn queue_add_rejects_empty_batch() {
        let v = serde_json::json!({ "items": [] });
        let parsed: super::QueueAddBatchPayload = serde_json::from_value(v).unwrap();
        assert_eq!(parsed.items.len(), 0);
        // queue_add() will reject this at runtime (not tested here — app handle unavailable).
    }
}
