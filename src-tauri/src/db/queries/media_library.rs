use crate::db::models::{MediaLibraryCategory, MediaLibraryCategoryInput, MediaLibraryItem, MediaLibraryItemInput};
use crate::error::AppError;
use rusqlite::{params, Connection, Row};

fn map_category_row(row: &Row) -> Result<MediaLibraryCategory, rusqlite::Error> {
    Ok(MediaLibraryCategory {
        id: row.get("id")?,
        name: row.get("name")?,
        sort_order: row.get("sort_order")?,
        id_language: row.get("id_language")?,
    })
}

fn map_item_row(row: &Row) -> Result<MediaLibraryItem, rusqlite::Error> {
    Ok(MediaLibraryItem {
        id: row.get("id")?,
        category_id: row.get("category_id")?,
        name: row.get("name")?,
        file_path: row.get("file_path")?,
        file_type: row.get("file_type")?,
        thumbnail_path: row.get("thumbnail_path")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
    })
}

pub fn get_categories(conn: &Connection, language: &str) -> Result<Vec<MediaLibraryCategory>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, sort_order, id_language 
         FROM media_library_categories 
         WHERE id_language = ?1 
         ORDER BY sort_order, name"
    )?;
    let categories = stmt.query_map(params![language], map_category_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(categories)
}

pub fn upsert_category(conn: &Connection, input: MediaLibraryCategoryInput) -> Result<i64, AppError> {
    if let Some(id) = input.id {
        conn.execute(
            "UPDATE media_library_categories 
             SET name = ?1, sort_order = ?2, id_language = ?3 
             WHERE id = ?4",
            params![input.name, input.sort_order, input.id_language, id],
        )?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO media_library_categories (name, sort_order, id_language) 
             VALUES (?1, ?2, ?3)",
            params![input.name, input.sort_order, input.id_language],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

pub fn delete_category(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM media_library_categories WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_items_by_category(conn: &Connection, category_id: i64) -> Result<Vec<MediaLibraryItem>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, category_id, name, file_path, file_type, thumbnail_path, sort_order, created_at 
         FROM media_library_items 
         WHERE category_id = ?1 
         ORDER BY sort_order, created_at DESC"
    )?;
    let items = stmt.query_map(params![category_id], map_item_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

pub fn upsert_item(conn: &Connection, input: MediaLibraryItemInput) -> Result<i64, AppError> {
    if let Some(id) = input.id {
        conn.execute(
            "UPDATE media_library_items 
             SET category_id = ?1, name = ?2, file_path = ?3, file_type = ?4, thumbnail_path = ?5, sort_order = ?6 
             WHERE id = ?7",
            params![input.category_id, input.name, input.file_path, input.file_type, input.thumbnail_path, input.sort_order, id],
        )?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO media_library_items (category_id, name, file_path, file_type, thumbnail_path, sort_order) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![input.category_id, input.name, input.file_path, input.file_type, input.thumbnail_path, input.sort_order],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

pub fn delete_item(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM media_library_items WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn search_library_items(conn: &Connection, query: &str) -> Result<Vec<MediaLibraryItem>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, category_id, name, file_path, file_type, thumbnail_path, sort_order, created_at 
         FROM media_library_items 
         WHERE name LIKE ?1 
         ORDER BY name 
         LIMIT 50"
    )?;
    let items = stmt.query_map(params![format!("%{}%", query)], map_item_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}
