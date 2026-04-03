use crate::db::models::{Presentation, Slide, SlideContent, TransitionConfig};
use crate::db::queries::collections::reindex_collection_song_documents_by_presentation;
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

#[allow(dead_code)]
pub fn insert_slide(
    conn: &Connection,
    presentation_id: i64,
    content_json: &str,
    sort_order: i32,
) -> Result<i64, AppError> {
    insert_slide_with_metadata(conn, presentation_id, content_json, sort_order, None, None)
}

pub fn insert_slide_with_metadata(
    conn: &Connection,
    presentation_id: i64,
    content_json: &str,
    sort_order: i32,
    notes: Option<&str>,
    transition: Option<&str>,
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
        "INSERT INTO slides (presentation_id, slide_index, slide_type, content, notes, transition) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            presentation_id,
            sort_order,
            slide_type,
            content_json,
            notes,
            transition
        ],
    )?;

    // Touch presentation updated_at
    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;
    reindex_collection_song_documents_by_presentation(conn, presentation_id)?;

    Ok(conn.last_insert_rowid())
}

#[allow(dead_code)]
pub fn update_slide(conn: &Connection, id: i64, content_json: &str) -> Result<(), AppError> {
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
         WHERE id = ?1",
        params![presentation_id],
    )?;
    reindex_collection_song_documents_by_presentation(conn, presentation_id)?;

    Ok(())
}

pub fn count_slides(conn: &Connection, presentation_id: i64) -> Result<i64, AppError> {
    conn.query_row(
        "SELECT COUNT(*) FROM slides WHERE presentation_id = ?1",
        params![presentation_id],
        |row| row.get(0),
    )
    .map_err(AppError::Database)
}

pub fn create_slide(
    conn: &Connection,
    presentation_id: i64,
    slide_index: i32,
    content: &SlideContent,
) -> Result<Slide, AppError> {
    let content_json =
        serde_json::to_string(content).map_err(|e| AppError::Internal(e.to_string()))?;
    let slide_type = content.slide_type_str();

    conn.execute(
        "INSERT INTO slides (presentation_id, slide_index, slide_type, content) VALUES (?1, ?2, ?3, ?4)",
        params![presentation_id, slide_index, slide_type, content_json],
    )?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;
    reindex_collection_song_documents_by_presentation(conn, presentation_id)?;

    conn.query_row(
        "SELECT id, presentation_id, slide_index, slide_type, content, notes, transition FROM slides WHERE id = ?1",
        params![id],
        |row| {
            Ok(Slide {
                id: row.get("id")?,
                presentation_id: row.get("presentation_id")?,
                slide_index: row.get("slide_index")?,
                slide_type: row.get("slide_type")?,
                content: row.get("content")?,
                notes: row.get("notes")?,
                transition: row.get("transition")?,
            })
        },
    )
    .map_err(AppError::Database)
}

pub fn update_slide_content(conn: &Connection, id: i64, content: &SlideContent) -> Result<(), AppError> {
    let content_json =
        serde_json::to_string(content).map_err(|e| AppError::Internal(e.to_string()))?;
    let slide_type = content.slide_type_str();

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

    conn.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;
    reindex_collection_song_documents_by_presentation(conn, presentation_id)?;

    Ok(())
}

pub fn update_slide_notes(conn: &Connection, id: i64, notes: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE slides SET notes = ?1 WHERE id = ?2",
        params![notes, id],
    )?;
    Ok(())
}

pub fn update_slide_transition(
    conn: &Connection,
    id: i64,
    transition: &TransitionConfig,
) -> Result<(), AppError> {
    let json =
        serde_json::to_string(transition).map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute(
        "UPDATE slides SET transition = ?1 WHERE id = ?2",
        params![json, id],
    )?;
    Ok(())
}

pub fn delete_slide(conn: &mut Connection, id: i64) -> Result<(), AppError> {
    // Get presentation_id and slide_index before deleting
    let (presentation_id, deleted_index): (i64, i64) = conn
        .query_row(
            "SELECT presentation_id, slide_index FROM slides WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Slide with id {} not found", id))
            }
            other => AppError::Database(other),
        })?;

    // Wrap in a transaction: DELETE + re-index + timestamp update must be atomic.
    // A failure mid-operation would leave slide_index values with gaps.
    let tx = conn.transaction()?;

    tx.execute("DELETE FROM slides WHERE id = ?1", params![id])?;

    // Single SQL statement replaces the N+1 SELECT+UPDATE loop for re-indexing.
    // Shifts slide_index down by 1 for all slides after the deleted one.
    tx.execute(
        "UPDATE slides SET slide_index = slide_index - 1 \
         WHERE presentation_id = ?1 AND slide_index > ?2",
        params![presentation_id, deleted_index],
    )?;

    tx.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;

    tx.commit()?;

    reindex_collection_song_documents_by_presentation(conn, presentation_id)?;

    Ok(())
}

pub fn update_slide_orders(
    conn: &mut Connection,
    presentation_id: i64,
    slide_ids: &[i64],
) -> Result<(), AppError> {
    // Wrap in a transaction: partial failure would leave indices in an
    // inconsistent state, making slides appear in the wrong order.
    let tx = conn.transaction()?;

    for (i, id) in slide_ids.iter().enumerate() {
        tx.execute(
            "UPDATE slides SET slide_index = ?1 WHERE id = ?2 AND presentation_id = ?3",
            params![i as i32, id, presentation_id],
        )?;
    }

    tx.execute(
        "UPDATE presentations SET updated_at = datetime('now') WHERE id = ?1",
        params![presentation_id],
    )?;

    tx.commit()?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        delete_slide, insert_presentation_with_kind, insert_slide_with_metadata, update_slide,
    };
    use crate::db::models::CollectionSongSyncStatus;
    use crate::db::queries::collections::{
        insert_collection, insert_collection_song, next_collection_song_order, search_collections,
        InsertCollectionSongInput,
    };
    use rusqlite::Connection;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            r#"
            CREATE TABLE collections (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              description TEXT,
              year INTEGER,
              cover_path TEXT,
              auto_cover_path TEXT,
              source_type TEXT NOT NULL DEFAULT 'file',
              api_album_id INTEGER,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE presentations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              author TEXT,
              aspect_ratio TEXT NOT NULL,
              library_kind TEXT,
              file_path TEXT,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE slides (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              presentation_id INTEGER NOT NULL,
              slide_index INTEGER NOT NULL,
              slide_type TEXT NOT NULL,
              content TEXT NOT NULL,
              notes TEXT,
              transition TEXT
            );

            CREATE TABLE collection_songs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              collection_id INTEGER NOT NULL,
              source_path TEXT NOT NULL,
              source_format TEXT NOT NULL,
              source_hash TEXT,
              source_mtime_ms INTEGER,
              cache_presentation_id INTEGER,
              sync_status TEXT NOT NULL,
              last_sync_at TEXT,
              item_order INTEGER NOT NULL,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE VIRTUAL TABLE collections_fts USING fts5(
              entity_type UNINDEXED,
              collection_id UNINDEXED,
              song_id UNINDEXED,
              cover_path UNINDEXED,
              collection_name,
              title,
              description,
              body
            );
            "#,
        )
        .expect("schema setup");
        conn
    }

    fn insert_song_for_presentation(conn: &Connection, presentation_id: i64) {
        let collection_id =
            insert_collection(conn, "Collection", Some("desc"), None, None, "manual", None)
                .expect("collection");
        let order = next_collection_song_order(conn, collection_id).expect("next order");
        insert_collection_song(
            conn,
            InsertCollectionSongInput {
                collection_id,
                source_path: "/tmp/song.lja",
                source_format: "legacy_lja",
                source_hash: Some("hash"),
                source_mtime_ms: Some(1),
                cache_presentation_id: Some(presentation_id),
                sync_status: CollectionSongSyncStatus::InSync,
                item_order: order,
            },
        )
        .expect("song");
    }

    fn has_song_search_hit(conn: &Connection, query: &str) -> bool {
        search_collections(conn, query, 10)
            .expect("search")
            .iter()
            .any(|item| item.song_id.is_some())
    }

    #[test]
    fn reindexes_collection_song_documents_on_slide_insert() {
        let conn = setup_conn();
        let presentation_id =
            insert_presentation_with_kind(&conn, "Song", "16:9", "collection_song")
                .expect("presentation");
        insert_song_for_presentation(&conn, presentation_id);

        assert!(!has_song_search_hit(&conn, "inserttoken"));

        insert_slide_with_metadata(
            &conn,
            presentation_id,
            r#"{"type":"lyrics","text":"inserttoken"}"#,
            0,
            None,
            None,
        )
        .expect("insert slide");

        assert!(has_song_search_hit(&conn, "inserttoken"));
    }

    #[test]
    fn reindexes_collection_song_documents_on_slide_update() {
        let conn = setup_conn();
        let presentation_id =
            insert_presentation_with_kind(&conn, "Song", "16:9", "collection_song")
                .expect("presentation");
        let slide_id = insert_slide_with_metadata(
            &conn,
            presentation_id,
            r#"{"type":"lyrics","text":"oldtoken"}"#,
            0,
            None,
            None,
        )
        .expect("insert slide");
        insert_song_for_presentation(&conn, presentation_id);

        assert!(has_song_search_hit(&conn, "oldtoken"));
        assert!(!has_song_search_hit(&conn, "newtoken"));

        update_slide(&conn, slide_id, r#"{"type":"lyrics","text":"newtoken"}"#).expect("update");

        assert!(!has_song_search_hit(&conn, "oldtoken"));
        assert!(has_song_search_hit(&conn, "newtoken"));
    }

    #[test]
    fn reindexes_collection_song_documents_on_slide_delete() {
        let mut conn = setup_conn();
        let presentation_id =
            insert_presentation_with_kind(&conn, "Song", "16:9", "collection_song")
                .expect("presentation");
        let slide_id = insert_slide_with_metadata(
            &conn,
            presentation_id,
            r#"{"type":"lyrics","text":"deletetoken"}"#,
            0,
            None,
            None,
        )
        .expect("insert slide");
        insert_song_for_presentation(&conn, presentation_id);

        assert!(has_song_search_hit(&conn, "deletetoken"));

        delete_slide(&mut conn, slide_id).expect("delete slide");

        assert!(!has_song_search_hit(&conn, "deletetoken"));
    }
}
