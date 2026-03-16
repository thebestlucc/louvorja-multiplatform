use crate::db::models::{Favorite, Hymn};
use crate::error::AppError;
use rusqlite::{params, Connection};

pub fn get_favorite_hymns(conn: &Connection) -> Result<Vec<Hymn>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT h.* FROM hymns h
         JOIN favorites f ON h.id = f.item_id
         WHERE f.item_type = 'hymn'
         ORDER BY f.id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Hymn {
            id: row.get(0)?,
            number: row.get(1)?,
            title: row.get(2)?,
            author: row.get(3)?,
            album: row.get(4)?,
            lyrics: row.get(5)?,
            chords: row.get(6)?,
            audio_path: row.get(7)?,
            playback_path: row.get(8)?,
            category: row.get(9)?,
            notes: row.get(10)?,
            cover_path: row.get(11)?,
            lyrics_sync: row.get(12)?,
            api_music_id: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
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
