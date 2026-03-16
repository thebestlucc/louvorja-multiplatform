use crate::db::models::Favorite;
use crate::error::AppError;
use rusqlite::{params, Connection};

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
