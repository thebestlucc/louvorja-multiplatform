use crate::db::models::{Presentation, Slide};
use crate::error::AppError;
use rusqlite::{params, Connection};

pub fn get_presentations(conn: &Connection) -> Result<Vec<Presentation>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, author, aspect_ratio, library_kind, file_path, created_at, updated_at
         FROM presentations
         WHERE COALESCE(library_kind, 'presentation') = 'presentation'
         ORDER BY updated_at DESC",
    )?;
    let presentations = stmt
        .query_map([], |row| {
            Ok(Presentation {
                id: row.get("id")?,
                title: row.get("title")?,
                author: row.get("author")?,
                aspect_ratio: row.get("aspect_ratio")?,
                library_kind: row.get("library_kind")?,
                file_path: row.get("file_path")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(presentations)
}

pub fn get_presentation_by_id(conn: &Connection, id: i64) -> Result<Presentation, AppError> {
    conn.query_row(
        "SELECT id, title, author, aspect_ratio, library_kind, file_path, created_at, updated_at
         FROM presentations WHERE id = ?1",
        params![id],
        |row| {
            Ok(Presentation {
                id: row.get("id")?,
                title: row.get("title")?,
                author: row.get("author")?,
                aspect_ratio: row.get("aspect_ratio")?,
                library_kind: row.get("library_kind")?,
                file_path: row.get("file_path")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Presentation with id {} not found", id))
        }
        other => AppError::Database(other),
    })
}

pub fn insert_presentation(
    conn: &Connection,
    title: &str,
    aspect_ratio: &str,
) -> Result<i64, AppError> {
    insert_presentation_with_kind(conn, title, aspect_ratio, "presentation")
}

pub fn insert_presentation_with_kind(
    conn: &Connection,
    title: &str,
    aspect_ratio: &str,
    library_kind: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO presentations (title, aspect_ratio, library_kind) VALUES (?1, ?2, ?3)",
        params![title, aspect_ratio, library_kind],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_presentation(
    conn: &Connection,
    id: i64,
    title: &str,
    aspect_ratio: &str,
) -> Result<(), AppError> {
    let rows = conn.execute(
        "UPDATE presentations SET title = ?1, aspect_ratio = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![title, aspect_ratio, id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Presentation with id {} not found",
            id
        )));
    }
    Ok(())
}

pub fn delete_presentation(conn: &Connection, id: i64) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM presentations WHERE id = ?1", params![id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Presentation with id {} not found",
            id
        )));
    }
    Ok(())
}

pub fn get_slides(conn: &Connection, presentation_id: i64) -> Result<Vec<Slide>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, presentation_id, slide_index, slide_type, content, notes, transition
         FROM slides WHERE presentation_id = ?1 ORDER BY slide_index",
    )?;
    let slides = stmt
        .query_map(params![presentation_id], |row| {
            Ok(Slide {
                id: row.get("id")?,
                presentation_id: row.get("presentation_id")?,
                slide_index: row.get("slide_index")?,
                slide_type: row.get("slide_type")?,
                content: row.get("content")?,
                notes: row.get("notes")?,
                transition: row.get("transition")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(slides)
}

pub fn insert_slide(
    conn: &Connection,
    presentation_id: i64,
    content_json: &str,
    sort_order: i32,
) -> Result<i64, AppError> {
    // Parse to extract slide_type
    let slide_type = serde_json::from_str::<serde_json::Value>(content_json)
        .ok()
        .and_then(|v| {
            v.get("type")
                .and_then(|t| t.as_str().map(|s| s.to_string()))
        })
        .unwrap_or_else(|| "text".to_string());

    conn.execute(
        "INSERT INTO slides (presentation_id, slide_index, slide_type, content) VALUES (?1, ?2, ?3, ?4)",
        params![presentation_id, sort_order, slide_type, content_json],
    )?;

    // Touch presentation updated_at
    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update_slide(conn: &Connection, id: i64, content_json: &str) -> Result<(), AppError> {
    let slide_type = serde_json::from_str::<serde_json::Value>(content_json)
        .ok()
        .and_then(|v| {
            v.get("type")
                .and_then(|t| t.as_str().map(|s| s.to_string()))
        })
        .unwrap_or_else(|| "text".to_string());

    let rows = conn.execute(
        "UPDATE slides SET content = ?1, slide_type = ?2 WHERE id = ?3",
        params![content_json, slide_type, id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Slide with id {} not found",
            id
        )));
    }

    // Touch parent presentation updated_at
    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now')
         WHERE id = (SELECT presentation_id FROM slides WHERE id = ?1)",
        params![id],
    )?;

    Ok(())
}

pub fn delete_slide(conn: &Connection, id: i64) -> Result<(), AppError> {
    // Get presentation_id before deleting
    let presentation_id: i64 = conn
        .query_row(
            "SELECT presentation_id FROM slides WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Slide with id {} not found", id))
            }
            other => AppError::Database(other),
        })?;

    conn.execute("DELETE FROM slides WHERE id = ?1", params![id])?;

    // Re-index remaining slides
    let mut stmt =
        conn.prepare("SELECT id FROM slides WHERE presentation_id = ?1 ORDER BY slide_index")?;
    let slide_ids: Vec<i64> = stmt
        .query_map(params![presentation_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for (i, sid) in slide_ids.iter().enumerate() {
        conn.execute(
            "UPDATE slides SET slide_index = ?1 WHERE id = ?2",
            params![i as i32, sid],
        )?;
    }

    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;

    Ok(())
}

pub fn update_slide_orders(
    conn: &Connection,
    presentation_id: i64,
    slide_ids: &[i64],
) -> Result<(), AppError> {
    for (i, id) in slide_ids.iter().enumerate() {
        conn.execute(
            "UPDATE slides SET slide_index = ?1 WHERE id = ?2 AND presentation_id = ?3",
            params![i as i32, id, presentation_id],
        )?;
    }

    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;

    Ok(())
}
