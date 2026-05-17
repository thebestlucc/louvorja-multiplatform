use crate::bible::text_split::{split_verse, SplitParams, VerseSplitResult};
use crate::db::models::{BibleSearchResult, BibleVersion, Book, SlideContent, SlideContext, Verse};
use crate::db::models::slides::{BibleMode, BackgroundConfig, BackgroundKind};
use crate::display::projection::update_current_slide;
use crate::error::AppError;
use crate::state::{AppState, BibleNavContext, BibleProjectionState, StreamingState};
use crate::utils::catcher::catcher;
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;
use tauri::{AppHandle, Emitter, Manager};

/// BibleRenderer projector font scale factor (base * SCALE, min MIN_FONT)
const PROJECTOR_FONT_SCALE: f32 = 1.6;
const MIN_PROJECTOR_FONT_SIZE: f32 = 32.0;
const DEFAULT_PROJECTOR_FONT_SIZE: f32 = 48.0;
/// Padding as fraction of window dimension (matches BibleRenderer CSS `padding: 10%`)
const BIBLE_PADDING_RATIO: f32 = 0.10;

fn build_bible_context_payload(
    version_id: i64,
    book: &str,
    chapter: i64,
    verse: i64,
    part_index: usize,
    total_parts: usize,
) -> serde_json::Value {
    serde_json::json!({
        "versionId": version_id,
        "book": book,
        "chapter": chapter,
        "verseNumber": verse,
        "partIndex": part_index,
        "totalParts": total_parts,
    })
}

#[tauri::command]
#[specta::specta]
pub fn get_bible_versions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleVersion>, AppError> {
    let conn = state.bible_db.get()?;
    crate::db::queries::bible::get_versions(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn get_books(
    version_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Book>, AppError> {
    let conn = state.bible_db.get()?;
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
    let conn = state.bible_db.get()?;
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
    let conn = state.bible_db.get()?;
    crate::db::queries::bible::get_verse_range(&conn, version_id, &book, chapter, start, end)
}

#[tauri::command]
#[specta::specta]
pub fn search_bible(
    query: String,
    version_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let conn = state.bible_db.get()?;
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
    settings_json: Option<String>,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let _ = end; // Split cache uses single verse (start); end kept for API compat
    let conn = state.bible_db.get()?;

    // Parse optional projection settings from a single JSON object
    let settings: serde_json::Value = settings_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(serde_json::Value::Null);

    let mut mode: BibleMode = settings.get("mode")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let font_family = settings.get("fontFamily")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let text_color: Option<String> = settings.get("textColor")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let text_size: Option<i32> = settings.get("textSize")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);

    // Apply font_family override into mode if provided
    if let Some(ref ff) = font_family {
        mode.font_family = Some(ff.clone());
    }

    let background: BackgroundConfig = settings.get("background")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(|| BackgroundConfig {
            kind: BackgroundKind::Solid,
            color: Some("#1a1a2e".to_string()),
            ..Default::default()
        });

    // Lock bible_projection to initialize split cache
    let (slide_to_project, context_payload, all_parts) = {
        let mut bp = state
            .bible_projection
            .lock()
            .map_err(|e| AppError::Internal(format!("Bible projection lock poisoned: {}", e)))?;

        // Split the starting verse
        let current_split = fetch_and_split_verse(
            &conn,
            &mut bp,
            version_id,
            &book,
            chapter,
            start,
            &mode,
            &background,
            text_color.as_deref(),
            text_size,
        )?
        .ok_or_else(|| AppError::Internal("Verse not found in DB".into()))?;

        // Pre-fetch adjacent verses
        let books = crate::db::queries::bible::get_books(&conn, version_id)?;

        let next_adj = get_adjacent_verse(&conn, version_id, &book, chapter, start, "next", &books)?;
        let next_split = if let Some((nb, nc, nv)) = next_adj {
            fetch_and_split_verse(
                &conn, &mut bp, version_id, &nb, nc, nv,
                &mode, &background, text_color.as_deref(), text_size,
            )?
        } else {
            None
        };

        let prev_adj = get_adjacent_verse(&conn, version_id, &book, chapter, start, "prev", &books)?;
        let prev_split = if let Some((pb, pc, pv)) = prev_adj {
            fetch_and_split_verse(
                &conn, &mut bp, version_id, &pb, pc, pv,
                &mode, &background, text_color.as_deref(), text_size,
            )?
        } else {
            None
        };

        // Set bible projection state
        bp.part_index = 0;
        bp.context = Some(BibleNavContext {
            version_id,
            book: book.clone(),
            chapter: chapter as i32,
            verse: start as i32,
        });
        bp.current = Some(current_split);
        bp.next = next_split;
        bp.prev = prev_split;

        let cur = bp.current.as_ref().unwrap();
        let slide = cur.parts[0].clone();
        let all_parts = cur.parts.clone();
        let payload = build_bible_context_payload(version_id, &book, chapter, start, 0, cur.parts.len());

        (slide, payload, all_parts)
    };
    // Mutex dropped here

    drop(conn);

    let streaming_state = app.state::<StreamingState>();
    project_split_slide(&app, &state, &streaming_state, &slide_to_project, context_payload, &all_parts, 0)?;

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
        let (current, err) = catcher(state.current_slide.read());
        if let Some(e) = err {
            return Err(e);
        }
        current.unwrap().clone()
    };

    let slide = current_slide.ok_or_else(|| AppError::Internal("No slide projected".into()))?;
    if slide.slide_type() != "bible" {
        return Ok(()); // Not a bible slide, ignore
    }

    // Parse reference from title: "Book Chapter:Start" or "Book Chapter:Start-End"
    let reference = slide.title().unwrap_or("");
    let (book, chapter, verse_start) = parse_bible_reference(reference)?;

    let conn = state.bible_db.get()?;

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
    let text = v.text.clone();
    let new_reference = format!("{} {}:{}", new_book, new_chapter, new_verse);

    let slide_data = SlideContent::Bible {
        reference: new_reference.clone(),
        text,
        mode: BibleMode::default(),
        background: BackgroundConfig { kind: BackgroundKind::Solid, color: Some("#1a1a2e".to_string()), ..Default::default() },
        text_color: None,
        text_size: None,
    };

    drop(conn);

    // Update current slide state
    {
        let (current, err) = catcher(state.current_slide.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut current = current.unwrap();
        *current = Some(slide_data.clone());
    }

    let slide_context = SlideContext {
        next: None,
        index: 0,
        total: 1,
        title: new_reference.clone(),
        current_slide_start_ms: None,
        next_slide_start_ms: None,
        audio_duration_ms: None,
    };
    {
        let (context, err) = catcher(state.slide_context.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut context = context.unwrap();
        *context = Some(slide_context.clone());
    }

    update_current_slide(&app, &state, &streaming_state, slide_data)?;

    Ok(())
}

/// Fetch a verse from the DB and split it using cosmic-text measurement.
fn fetch_and_split_verse(
    conn: &PooledConnection<SqliteConnectionManager>,
    bible_state: &mut BibleProjectionState,
    version_id: i64,
    book: &str,
    chapter: i64,
    verse: i64,
    mode: &BibleMode,
    background: &BackgroundConfig,
    text_color: Option<&str>,
    text_size: Option<i32>,
) -> Result<Option<VerseSplitResult>, AppError> {
    let verses = crate::db::queries::bible::get_verse_range(
        conn, version_id, book, chapter, verse, verse,
    )?;

    if verses.is_empty() {
        return Ok(None);
    }

    let v = &verses[0];
    let verse_text = v.text.clone();
    let reference = format!("{} {}:{}", book, chapter, verse);

    let (w, h) = bible_state.projector_size.unwrap_or((1920, 1080));

    let font_family = mode
        .font_family
        .as_deref()
        .unwrap_or("Inter")
        .to_string();
    let font_size = text_size
        .map(|s| {
            let base = (s as f32).clamp(12.0, 120.0);
            (base * PROJECTOR_FONT_SCALE).max(MIN_PROJECTOR_FONT_SIZE)
        })
        .unwrap_or(DEFAULT_PROJECTOR_FONT_SIZE);

    let h_padding = w as f32 * BIBLE_PADDING_RATIO;
    let v_padding = h as f32 * BIBLE_PADDING_RATIO;

    let params = SplitParams {
        font_family,
        font_size,
        width: w,
        height: h,
        h_padding,
        v_padding,
        ..SplitParams::default()
    };

    let result = split_verse(
        &mut bible_state.font_system,
        &verse_text,
        &reference,
        verse as i32,
        &params,
        mode,
        background,
        text_color,
        text_size,
    );

    Ok(Some(result))
}

/// Find the next or previous verse, handling chapter and book boundaries.
/// Returns (new_book, new_chapter, new_verse) or None at Bible boundaries.
fn get_adjacent_verse(
    conn: &PooledConnection<SqliteConnectionManager>,
    version_id: i64,
    book: &str,
    chapter: i64,
    verse: i64,
    direction: &str,
    books: &[Book],
) -> Result<Option<(String, i64, i64)>, AppError> {
    let book_idx = books
        .iter()
        .position(|b| b.name == book)
        .ok_or_else(|| AppError::Internal(format!("Book '{}' not found", book)))?;

    if direction == "next" {
        let max_verse: i64 = conn.query_row(
            "SELECT COALESCE(MAX(verse), 0) FROM bible_verses WHERE version_id = ?1 AND book = ?2 AND chapter = ?3",
            rusqlite::params![version_id, book, chapter],
            |row| row.get(0),
        )?;

        if verse < max_verse {
            return Ok(Some((book.to_string(), chapter, verse + 1)));
        }
        let max_chapter = books[book_idx].chapter_count as i64;
        if chapter < max_chapter {
            return Ok(Some((book.to_string(), chapter + 1, 1)));
        }
        if book_idx + 1 < books.len() {
            return Ok(Some((books[book_idx + 1].name.clone(), 1, 1)));
        }
        Ok(None) // End of Bible
    } else {
        // "prev"
        if verse > 1 {
            return Ok(Some((book.to_string(), chapter, verse - 1)));
        }
        if chapter > 1 {
            let prev_chapter = chapter - 1;
            let max_verse: i64 = conn.query_row(
                "SELECT COALESCE(MAX(verse), 0) FROM bible_verses WHERE version_id = ?1 AND book = ?2 AND chapter = ?3",
                rusqlite::params![version_id, book, prev_chapter],
                |row| row.get(0),
            )?;
            return Ok(Some((book.to_string(), prev_chapter, max_verse)));
        }
        if book_idx > 0 {
            let prev_book = &books[book_idx - 1];
            let prev_chapter = prev_book.chapter_count as i64;
            let max_verse: i64 = conn.query_row(
                "SELECT COALESCE(MAX(verse), 0) FROM bible_verses WHERE version_id = ?1 AND book = ?2 AND chapter = ?3",
                rusqlite::params![version_id, prev_book.name, prev_chapter],
                |row| row.get(0),
            )?;
            return Ok(Some((prev_book.name.clone(), prev_chapter, max_verse)));
        }
        Ok(None) // Start of Bible
    }
}

/// Project a split slide part: update state, emit events, broadcast to streaming.
/// `all_parts` contains all slide parts for the current verse (for sidebar thumbnails).
/// `part_index` is the index of the currently projected part within `all_parts`.
fn project_split_slide(
    app: &AppHandle,
    state: &AppState,
    streaming_state: &StreamingState,
    slide: &SlideContent,
    context_payload: serde_json::Value,
    all_parts: &[SlideContent],
    part_index: usize,
) -> Result<(), AppError> {
    let reference = slide.title().unwrap_or("").to_string();

    // Determine "next" slide for the return monitor preview:
    // If there's a next part in the current split, use that.
    // Otherwise, the caller doesn't provide the next verse's parts here,
    // but we can check if there's a next part in all_parts.
    let next_slide = if part_index + 1 < all_parts.len() {
        Some(all_parts[part_index + 1].clone())
    } else {
        // At last part of verse — try to get next verse's first part from bible_projection cache
        if let Ok(bp) = state.bible_projection.lock() {
            bp.next.as_ref().and_then(|n| n.parts.first().cloned())
        } else {
            None
        }
    };

    let slide_context = SlideContext {
        next: next_slide,
        index: part_index as i32,
        total: all_parts.len() as i32,
        title: reference.clone(),
        current_slide_start_ms: None,
        next_slide_start_ms: None,
        audio_duration_ms: None,
    };
    {
        let (ctx, err) = catcher(state.slide_context.write());
        if let Some(e) = err {
            return Err(e);
        }
        let mut ctx = ctx.unwrap();
        *ctx = Some(slide_context.clone());
    }

    update_current_slide(app, state, streaming_state, slide.clone())?;
    // Include all parts so the frontend can show them in the sidebar
    let mut ctx = context_payload;
    ctx["allSlides"] = serde_json::to_value(all_parts).unwrap_or_default();
    ctx["partIndex"] = serde_json::json!(part_index);
    app.emit("bible-context-changed", &ctx)
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    Ok(())
}

/// Navigate bible projection with split-aware navigation.
/// Navigates within split parts first (next/prev part of same verse),
/// then jumps to the next/prev verse (with splitting) at boundaries.
#[tauri::command]
#[specta::specta]
pub fn navigate_bible(
    direction: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    streaming_state: tauri::State<'_, StreamingState>,
) -> Result<(), AppError> {
    let conn = state.bible_db.get()?;

    // Collect everything we need under the bible_projection lock, then drop it
    // before calling project_split_slide (which locks current_slide / slide_context).
    let (slide_to_project, context_payload, all_parts, active_part_index) = {
        let mut bp = state
            .bible_projection
            .lock()
            .map_err(|e| AppError::Internal(format!("Bible projection lock poisoned: {}", e)))?;

        let ctx = bp.context.as_ref().ok_or_else(|| {
            AppError::Internal("No bible navigation context set".into())
        })?;
        let version_id = ctx.version_id;
        let book = ctx.book.clone();
        let chapter = ctx.chapter as i64;
        let verse = ctx.verse as i64;

        let total_parts = bp.current.as_ref().ok_or_else(|| {
            AppError::Internal("No current split result".into())
        })?.parts.len();
        let part_index = bp.part_index;

        // Try navigating within current split parts
        let within_part = if direction == "next" && part_index + 1 < total_parts {
            Some(part_index + 1)
        } else if direction == "prev" && part_index > 0 {
            Some(part_index - 1)
        } else {
            None
        };

        if let Some(new_index) = within_part {
            bp.part_index = new_index;
            let cur = bp.current.as_ref().unwrap();
            let slide = cur.parts[new_index].clone();
            let parts = cur.parts.clone();
            let payload = build_bible_context_payload(version_id, &book, chapter, verse, new_index, total_parts);
            (slide, payload, parts, new_index)
        } else {
            // At boundary — need to jump to adjacent verse
            let books = crate::db::queries::bible::get_books(&conn, version_id)?;

            let adjacent = get_adjacent_verse(
                &conn, version_id, &book, chapter, verse, &direction, &books,
            )?;

            let (new_book, new_chapter, new_verse) = match adjacent {
                Some(v) => v,
                None => return Ok(()), // At Bible boundary, do nothing
            };

            // Extract mode/background/text_color/text_size from the current first part
            let (mode, background, text_color, text_size): (BibleMode, BackgroundConfig, Option<String>, Option<i32>) = {
                let cur = bp.current.as_ref().unwrap();
                let first_part = &cur.parts[0];
                match first_part {
                    SlideContent::Bible {
                        mode,
                        background,
                        text_color,
                        text_size,
                        ..
                    } => (
                        mode.clone(),
                        background.clone(),
                        text_color.clone(),
                        *text_size,
                    ),
                    _ => (
                        BibleMode::default(),
                        BackgroundConfig {
                            kind: BackgroundKind::Solid,
                            color: Some("#1a1a2e".to_string()),
                            ..Default::default()
                        },
                        None,
                        None,
                    ),
                }
            };

            // Split the new verse
            let new_split = fetch_and_split_verse(
                &conn,
                &mut bp,
                version_id,
                &new_book,
                new_chapter,
                new_verse,
                &mode,
                &background,
                text_color.as_deref(),
                text_size,
            )?
            .ok_or_else(|| AppError::Internal("Adjacent verse not found in DB".into()))?;

            // Shift cache and set part_index
            if direction == "next" {
                bp.prev = bp.current.take();
                bp.current = Some(new_split);
                // Pre-fetch next
                let next_adj = get_adjacent_verse(
                    &conn, version_id, &new_book, new_chapter, new_verse, "next", &books,
                )?;
                bp.next = if let Some((nb, nc, nv)) = next_adj {
                    fetch_and_split_verse(
                        &conn, &mut bp, version_id, &nb, nc, nv,
                        &mode, &background, text_color.as_deref(), text_size,
                    )?
                } else {
                    None
                };
                bp.part_index = 0;
            } else {
                bp.next = bp.current.take();
                bp.current = Some(new_split);
                // Pre-fetch prev
                let prev_adj = get_adjacent_verse(
                    &conn, version_id, &new_book, new_chapter, new_verse, "prev", &books,
                )?;
                bp.prev = if let Some((pb, pc, pv)) = prev_adj {
                    fetch_and_split_verse(
                        &conn, &mut bp, version_id, &pb, pc, pv,
                        &mode, &background, text_color.as_deref(), text_size,
                    )?
                } else {
                    None
                };
                // For "prev", start at last part
                let cur = bp.current.as_ref().unwrap();
                bp.part_index = cur.parts.len().saturating_sub(1);
            }

            // Update context
            bp.context = Some(BibleNavContext {
                version_id,
                book: new_book.clone(),
                chapter: new_chapter as i32,
                verse: new_verse as i32,
            });

            let cur = bp.current.as_ref().unwrap();
            let idx = bp.part_index;
            let slide = cur.parts[idx].clone();
            let parts = cur.parts.clone();
            let payload = build_bible_context_payload(version_id, &new_book, new_chapter, new_verse, idx, cur.parts.len());
            (slide, payload, parts, idx)
        }
    };
    // Mutex dropped here

    drop(conn);

    project_split_slide(&app, &state, &streaming_state, &slide_to_project, context_payload, &all_parts, active_part_index)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn clear_bible_projection(
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let mut bible_state = state.bible_projection.lock()
        .map_err(|_| AppError::Internal("Bible state lock poisoned".into()))?;
    bible_state.current = None;
    bible_state.next = None;
    bible_state.prev = None;
    bible_state.context = None;
    bible_state.part_index = 0;
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
    let conn = state.bible_db.get()?;
    crate::db::queries::bible::import_bible_version(&conn, &name, &abbreviation, &language, &verses)
}

#[tauri::command]
#[specta::specta]
pub fn search_bible_global(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let conn = state.bible_db.get()?;
    crate::db::queries::bible::search_bible_global(&conn, &query)
}
