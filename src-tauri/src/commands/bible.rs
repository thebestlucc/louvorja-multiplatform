use crate::db::models::{BibleSearchResult, BibleVersion, Book, SlideContent, SlideContext, Verse};
use crate::error::AppError;
use crate::state::{AppState, StreamingState};
use tauri::{AppHandle, Emitter, Manager};

fn broadcast_bible_stream_payloads(
    server: &crate::streaming::StreamingServer,
    slide_data: &SlideContent,
    reference: &str,
) {
    let music_json = serde_json::json!({
        "label": "",
        "text": "",
        "title": "",
        "subtitle": "",
    });
    server.broadcast_music(&music_json.to_string());

    let bible_json = serde_json::json!({
        "reference": reference,
        "text": slide_data.text.as_deref().unwrap_or(""),
    });
    server.broadcast_bible(&bible_json.to_string());

    let return_json = serde_json::json!({
        "current": {
            "label": slide_data.label.as_deref().unwrap_or(""),
            "text": slide_data.text.as_deref().unwrap_or(""),
            "title": slide_data.title.as_deref().unwrap_or(""),
            "subtitle": slide_data.subtitle.as_deref().unwrap_or(""),
        },
        "next": null,
        "index": 0,
        "total": 1,
        "title": reference,
    });
    server.broadcast_return(&return_json.to_string());
}

#[tauri::command]
#[specta::specta]
pub fn get_bible_versions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleVersion>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_versions(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn get_books(
    version_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Book>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_books(&conn, version_id)
}

#[tauri::command]
#[specta::specta]
pub fn get_verses(
    version_id: i64,
    book: String,
    chapter: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Verse>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_verses(&conn, version_id, &book, chapter)
}

#[tauri::command]
#[specta::specta]
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
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::get_verse_range(&conn, version_id, &book, chapter, start, end)
}

#[tauri::command]
#[specta::specta]
pub fn search_bible(
    query: String,
    version_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::search_bible_text(&conn, &query, version_id)
}

#[tauri::command]
#[specta::specta]
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
        .get()
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
        title: Some(reference.clone()),
        subtitle: None,
        label: None,
        video_path: None,
        background_image: None,
        background_color: None,
        audio_path: None,
        auto_play: None,
        r#loop: None,
        muted: None,
        mode: None,
        text_color: None,
        text_size: None,
    };

    drop(conn);

    // Update current slide state
    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }

    let slide_context = SlideContext {
        next: None,
        index: 0,
        total: 1,
        title: reference.clone(),
    };
    {
        let mut context = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *context = Some(slide_context.clone());
    }

    // Emit to projector window
    app.emit("slide-changed", &slide_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    app.emit("slide-context", &slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let streaming_state = app.state::<StreamingState>();
    if let Ok(server) = streaming_state.server.lock() {
        broadcast_bible_stream_payloads(&server, &slide_data, &reference);
    }

    Ok(())
}

/// Navigate bible projection by one verse forward or backward.
/// Handles chapter and book boundaries:
/// - Right arrow: next verse; if last verse in chapter, go to next chapter; if last chapter, go to next book.
/// - Left arrow: previous verse; if first verse in chapter, go to previous chapter's last verse; if first chapter, go to previous book's last chapter.
#[tauri::command]
#[specta::specta]
pub fn navigate_bible_verse(
    direction: String, // "next" or "prev"
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    // Read current slide
    let current_slide = {
        let current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        current.clone()
    };

    let slide = current_slide.ok_or_else(|| AppError::Internal("No slide projected".into()))?;
    if slide.slide_type != "bible" {
        return Ok(()); // Not a bible slide, ignore
    }

    // Parse reference from title: "Book Chapter:Start" or "Book Chapter:Start-End"
    let reference = slide.title.as_deref().unwrap_or("");
    let (book, chapter, verse_start) = parse_bible_reference(reference)?;

    let conn = state
        .db
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // We need to figure out the version_id from the current verse
    let version_id: i64 = conn
        .query_row(
            "SELECT version_id FROM bible_verses WHERE book = ?1 AND chapter = ?2 AND verse = ?3 LIMIT 1",
            rusqlite::params![book, chapter, verse_start],
            |row| row.get(0),
        )
        .map_err(|_| AppError::Internal("Could not determine bible version".into()))?;

    // Get ordered list of books for this version
    let books = crate::db::queries::bible::get_books(&conn, version_id)?;

    let book_idx = books
        .iter()
        .position(|b| b.name == book)
        .ok_or_else(|| AppError::Internal(format!("Book '{}' not found", book)))?;

    let (new_book, new_chapter, new_verse) = if direction == "next" {
        // Get max verse in current chapter
        let max_verse: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(verse), 0) FROM bible_verses WHERE version_id = ?1 AND book = ?2 AND chapter = ?3",
                rusqlite::params![version_id, book, chapter],
                |row| row.get(0),
            )?;

        if verse_start < max_verse {
            // Next verse in same chapter
            (book.clone(), chapter, verse_start + 1)
        } else {
            // Try next chapter in same book
            let max_chapter = books[book_idx].chapter_count;
            if chapter < max_chapter as i64 {
                (book.clone(), chapter + 1, 1)
            } else {
                // Try next book
                if book_idx + 1 < books.len() {
                    (books[book_idx + 1].name.clone(), 1, 1)
                } else {
                    return Ok(()); // Last verse of last book, do nothing
                }
            }
        }
    } else {
        // "prev"
        if verse_start > 1 {
            // Previous verse in same chapter
            (book.clone(), chapter, verse_start - 1)
        } else {
            // Try previous chapter
            if chapter > 1 {
                let prev_chapter = chapter - 1;
                let max_verse: i64 = conn
                    .query_row(
                        "SELECT COALESCE(MAX(verse), 0) FROM bible_verses WHERE version_id = ?1 AND book = ?2 AND chapter = ?3",
                        rusqlite::params![version_id, book, prev_chapter],
                        |row| row.get(0),
                    )?;
                (book.clone(), prev_chapter, max_verse)
            } else {
                // Try previous book
                if book_idx > 0 {
                    let prev_book = &books[book_idx - 1];
                    let prev_chapter = prev_book.chapter_count;
                    let max_verse: i64 = conn
                        .query_row(
                            "SELECT COALESCE(MAX(verse), 0) FROM bible_verses WHERE version_id = ?1 AND book = ?2 AND chapter = ?3",
                            rusqlite::params![version_id, prev_book.name, prev_chapter],
                            |row| row.get(0),
                        )?;
                    (prev_book.name.clone(), prev_chapter as i64, max_verse)
                } else {
                    return Ok(()); // First verse of first book, do nothing
                }
            }
        }
    };

    // Fetch the new verse
    let verses = crate::db::queries::bible::get_verse_range(
        &conn,
        version_id,
        &new_book,
        new_chapter,
        new_verse,
        new_verse,
    )?;

    if verses.is_empty() {
        return Ok(());
    }

    let v = &verses[0];
    let text = format!("{} {}", v.verse, v.text);
    let new_reference = format!("{} {}:{}", new_book, new_chapter, new_verse);

    let slide_data = SlideContent {
        slide_type: "bible".to_string(),
        text: Some(text),
        title: Some(new_reference.clone()),
        subtitle: None,
        label: None,
        video_path: None,
        background_image: None,
        background_color: None,
        audio_path: None,
        auto_play: None,
        r#loop: None,
        muted: None,
        mode: None,
        text_color: None,
        text_size: None,
    };

    drop(conn);

    // Update current slide state
    {
        let mut current = state
            .current_slide
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *current = Some(slide_data.clone());
    }

    let slide_context = SlideContext {
        next: None,
        index: 0,
        total: 1,
        title: new_reference.clone(),
    };
    {
        let mut context = state
            .slide_context
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *context = Some(slide_context.clone());
    }

    app.emit("slide-changed", &slide_data)
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    app.emit("slide-context", &slide_context)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    if let Ok(server) = streaming_state.server.lock() {
        broadcast_bible_stream_payloads(&server, &slide_data, &new_reference);
    }

    Ok(())
}

/// Parse a bible reference string like "Gênesis 1:3" or "1 Samuel 2:5-8"
fn parse_bible_reference(reference: &str) -> Result<(String, i64, i64), AppError> {
    // Match patterns like "Book Chapter:Verse" or "Book Chapter:Start-End"
    // Book name can contain spaces and numbers (e.g., "1 Samuel", "Song of Solomon")
    let re_err = || AppError::Internal(format!("Invalid bible reference: '{}'", reference));

    // Find the last space-separated "N:N" or "N:N-N" pattern
    if let Some(colon_pos) = reference.rfind(':') {
        // Everything after colon is verse part (possibly "3" or "3-8")
        let verse_part = &reference[colon_pos + 1..];
        let verse_start: i64 = if let Some(dash_pos) = verse_part.find('-') {
            verse_part[..dash_pos]
                .trim()
                .parse()
                .map_err(|_| re_err())?
        } else {
            verse_part.trim().parse().map_err(|_| re_err())?
        };

        // Everything before colon: find the chapter number (last space-separated token)
        let before_colon = &reference[..colon_pos];
        if let Some(space_pos) = before_colon.rfind(' ') {
            let chapter: i64 = before_colon[space_pos + 1..]
                .trim()
                .parse()
                .map_err(|_| re_err())?;
            let book = before_colon[..space_pos].trim().to_string();
            Ok((book, chapter, verse_start))
        } else {
            Err(re_err())
        }
    } else {
        Err(re_err())
    }
}

#[tauri::command]
#[specta::specta]
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
        .get()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    crate::db::queries::bible::import_bible_version(&conn, &name, &abbreviation, &language, &verses)
}
