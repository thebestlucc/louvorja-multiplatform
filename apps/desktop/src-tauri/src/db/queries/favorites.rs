use crate::db::models::{Collection, Favorite, Hymn};
use crate::error::AppError;
use rusqlite::{params, Connection};

pub fn get_favorite_collections(conn: &Connection, query: Option<&str>) -> Result<Vec<Collection>, AppError> {
    if let Some(q) = query.filter(|s| !s.trim().is_empty()) {
        if !crate::db::queries::collections::collections_fts_exists_pub(conn)? {
            return Ok(vec![]);
        }

        let Some(fts_query) = build_fts_prefix_query(q) else {
            return Ok(vec![]);
        };

        let mut stmt = conn.prepare(
            "SELECT DISTINCT c.*,
                    (SELECT COUNT(1) FROM collection_songs cs WHERE cs.collection_id = c.id)
                    + (SELECT COUNT(1) FROM collection_hymns ch WHERE ch.collection_id = c.id)
                    AS song_count
             FROM collections c
             JOIN favorites f ON c.id = f.item_id
             JOIN collections_fts fts ON fts.collection_id = c.id
             WHERE f.item_type = 'collection'
             AND fts.collections_fts MATCH ?1
             ORDER BY c.name ASC, f.id DESC",
        )?;
        let rows = stmt.query_map(params![fts_query], |row| {
            crate::db::queries::collections::map_collection_row_pub(row)
        })?.collect::<Result<Vec<_>, _>>()?;
        return Ok(rows);
    }

    let mut stmt = conn.prepare(
        "SELECT 
            c.id, c.name, c.description, c.year, c.cover_path, c.auto_cover_path,
            (
                (SELECT COUNT(1) FROM collection_songs cs WHERE cs.collection_id = c.id)
                + (SELECT COUNT(1) FROM collection_hymns ch WHERE ch.collection_id = c.id)
            ) as song_count,
            c.source_type, c.api_album_id, c.created_at, c.updated_at
         FROM collections c
         JOIN favorites f ON c.id = f.item_id
         WHERE f.item_type = 'collection'
         ORDER BY c.name ASC, f.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        crate::db::queries::collections::map_collection_row_pub(row)
    })?;

    let mut collections = Vec::new();
    for row in rows {
        collections.push(row?);
    }
    Ok(collections)
}

fn sanitize_fts_query(query: &str) -> Vec<String> {
    query
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .collect()
}

fn build_fts_prefix_query(query: &str) -> Option<String> {
    let terms = sanitize_fts_query(query);
    if terms.is_empty() {
        return None;
    }
    Some(
        terms
            .into_iter()
            .map(|term| format!("{term}*"))
            .collect::<Vec<_>>()
            .join(" "),
    )
}

pub fn get_favorite_hymns(conn: &Connection, query: Option<&str>) -> Result<Vec<Hymn>, AppError> {
    if let Some(q) = query.filter(|s| !s.trim().is_empty()) {
        // If numeric, search by number within favorites
        if let Ok(num) = q.parse::<i64>() {
            let mut stmt = conn.prepare(
                "SELECT h.* FROM hymns h
                 JOIN favorites f ON h.id = f.item_id
                 WHERE f.item_type = 'hymn' AND h.number = ?1
                 ORDER BY h.number ASC",
            )?;
            let hymns = stmt.query_map(params![num], |row| {
                crate::db::queries::music::map_hymn_row_pub(row)
            })?.collect::<Result<Vec<_>, _>>()?;
            return Ok(hymns);
        }

        // Text search via FTS5 within favorites
        let Some(fts_query) = build_fts_prefix_query(q) else {
            return Ok(vec![]);
        };

        let mut stmt = conn.prepare(
            "SELECT h.* FROM hymns h
             JOIN favorites f ON h.id = f.item_id
             JOIN hymns_fts fts ON fts.rowid = h.id
             WHERE f.item_type = 'hymn' AND fts.hymns_fts MATCH ?1
             ORDER BY h.number ASC, f.id DESC",
        )?;
        let hymns = stmt.query_map(params![fts_query], |row| {
            crate::db::queries::music::map_hymn_row_pub(row)
        })?.collect::<Result<Vec<_>, _>>()?;
        return Ok(hymns);
    }

    let mut stmt = conn.prepare(
        "SELECT h.* FROM hymns h
         JOIN favorites f ON h.id = f.item_id
         WHERE f.item_type = 'hymn'
         ORDER BY h.number ASC, f.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        crate::db::queries::music::map_hymn_row_pub(row)
    })?;

    let mut hymns = Vec::new();
    for row in rows {
        hymns.push(row?);
    }
    Ok(hymns)
}

pub fn toggle_favorite(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
) -> Result<bool, AppError> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM favorites WHERE item_type = ?1 AND item_id = ?2)",
        params![item_type, item_id],
        |row| row.get(0),
    )?;

    if exists {
        conn.execute(
            "DELETE FROM favorites WHERE item_type = ?1 AND item_id = ?2",
            params![item_type, item_id],
        )?;
        Ok(false)
    } else {
        conn.execute(
            "INSERT INTO favorites (item_type, item_id) VALUES (?1, ?2)",
            params![item_type, item_id],
        )?;
        Ok(true)
    }
}

pub fn get_favorites(conn: &Connection, item_type: &str) -> Result<Vec<Favorite>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, item_type, item_id, created_at FROM favorites WHERE item_type = ?1 ORDER BY id DESC",
    )?;
    let rows = stmt.query_map(params![item_type], |row| {
        Ok(Favorite {
            id: row.get(0)?,
            item_type: row.get(1)?,
            item_id: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;

    let mut favorites = Vec::new();
    for row in rows {
        favorites.push(row?);
    }
    Ok(favorites)
}

pub fn is_favorite(conn: &Connection, item_type: &str, item_id: i64) -> Result<bool, AppError> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM favorites WHERE item_type = ?1 AND item_id = ?2)",
        params![item_type, item_id],
        |row| row.get(0),
    )?;
    Ok(exists)
}

pub fn get_all_favorite_ids(conn: &Connection, item_type: &str) -> Result<Vec<i64>, AppError> {
    let mut stmt = conn.prepare_cached(
        "SELECT item_id FROM favorites WHERE item_type = ?1",
    )?;
    let ids = stmt
        .query_map(params![item_type], |row| row.get(0))?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(AppError::Database)?;
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;
    use rusqlite::Connection;

    #[test]
    fn test_toggle_favorites() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        // Add
        let is_fav = toggle_favorite(&conn, "hymn", 1).unwrap();
        assert!(is_fav);
        assert!(is_favorite(&conn, "hymn", 1).unwrap());

        // Remove
        let is_fav = toggle_favorite(&conn, "hymn", 1).unwrap();
        assert!(!is_fav);
        assert!(!is_favorite(&conn, "hymn", 1).unwrap());
    }

    #[test]
    fn test_get_favorites() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        toggle_favorite(&conn, "hymn", 1).unwrap();
        toggle_favorite(&conn, "hymn", 2).unwrap();
        toggle_favorite(&conn, "bible", 100).unwrap();

        let hymn_favs = get_favorites(&conn, "hymn").unwrap();
        assert_eq!(hymn_favs.len(), 2);
        assert_eq!(hymn_favs[0].item_id, 2); // Ordered by created_at DESC
        assert_eq!(hymn_favs[1].item_id, 1);

        let bible_favs = get_favorites(&conn, "bible").unwrap();
        assert_eq!(bible_favs.len(), 1);
        assert_eq!(bible_favs[0].item_id, 100);
    }
}
