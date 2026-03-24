use crate::db::models::{MonitorConfig, Setting};
use crate::error::AppError;
use rusqlite::Connection;

pub fn get_setting(conn: &Connection, key: &str) -> Result<Setting, AppError> {
    conn.query_row(
        "SELECT key, value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Setting '{}' not found", key))
        }
        other => AppError::Database(other),
    })
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(AppError::Database)?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> Result<Vec<Setting>, AppError> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(AppError::Database)?;
    let settings = stmt
        .query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(settings)
}

pub fn get_monitor_configs(conn: &Connection) -> Result<Vec<MonitorConfig>, AppError> {
    let mut stmt = conn
        .prepare("SELECT id, monitor_id, role, enabled FROM monitor_configs WHERE enabled = 1")
        .map_err(AppError::Database)?;
    let configs = stmt
        .query_map([], |row| {
            Ok(MonitorConfig {
                id: row.get(0)?,
                monitor_id: row.get(1)?,
                role: row.get(2)?,
                enabled: row.get(3)?,
            })
        })
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(configs)
}

pub fn set_monitor_config(conn: &Connection, config: &MonitorConfig) -> Result<(), AppError> {
    // Delete existing rows with the same role, then insert
    conn.execute(
        "DELETE FROM monitor_configs WHERE role = ?1",
        rusqlite::params![config.role],
    )
    .map_err(AppError::Database)?;

    conn.execute(
        "INSERT INTO monitor_configs (monitor_id, role, enabled) VALUES (?1, ?2, ?3)",
        rusqlite::params![config.monitor_id, config.role, config.enabled],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

/// Removes CDN-synced content (hymns, collections, related junction/sync tables) from the main DB
/// while preserving all user-created data: presentations, slides, services, service items,
/// monitor configs, schedule data, and settings. Bible data lives in a separate DB and is
/// never touched. FTS indexes and triggers are rebuilt atomically within the transaction.
pub fn clear_database(conn: &Connection) -> Result<(), AppError> {
    // Delete from tables that reference other tables first (foreign keys), then parent tables
    // Order matters due to foreign key constraints
    // NOTE: Bible data (bible_verses, bible_versions, bible_fts) is preserved
    //
    // CRITICAL: We drop FTS triggers before mass deletion to avoid "database disk image is malformed"
    // errors caused by triggers trying to update a corrupted or already-cleared index.
    let tx = conn.unchecked_transaction().map_err(AppError::Database)?;

    tx.execute_batch(
        "
        -- Temporarily drop triggers to allow safe cleanup of potentially corrupted FTS indexes
        DROP TRIGGER IF EXISTS hymns_ai;
        DROP TRIGGER IF EXISTS hymns_ad;
        DROP TRIGGER IF EXISTS hymns_au;

        -- Clear child tables that reference CDN data (must precede parent deletes)
        -- NOTE: slides, service_items, services, presentations, monitor_configs and all
        -- schedule_* tables are user-created data and are intentionally preserved.
        DELETE FROM audio_sync_points;
        DELETE FROM favorites;
        DELETE FROM collection_songs;
        DELETE FROM collection_hymns;
        DELETE FROM content_sync_runs;
        DELETE FROM content_sync_entities;
        DELETE FROM content_sync_state;
        DELETE FROM content_sync_packs;

        -- Clear CDN parent tables (Bible data is in a separate DB and is never touched)
        DELETE FROM hymns;
        DELETE FROM collections;

        -- Reset pack sync manifest version so the planner re-checks all packs
        DELETE FROM settings WHERE key = 'pack_sync.manifest_version';

        -- Clear and fix FTS indexes
        -- hymns_fts is an external content table, so we use 'delete-all'.
        INSERT INTO hymns_fts(hymns_fts) VALUES('delete-all');
        -- collections_fts is a standard FTS5 table, so we use DELETE.
        DELETE FROM collections_fts;

        -- Re-create triggers (optimized with v29 logic)
        CREATE TRIGGER hymns_ai
        AFTER INSERT ON hymns
        WHEN NEW.category = 'hymnal'
        BEGIN
            INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
            VALUES (NEW.id, NEW.title, COALESCE(NEW.lyrics,''), COALESCE(NEW.author,''), COALESCE(NEW.album,''));
        END;

        CREATE TRIGGER hymns_ad
        AFTER DELETE ON hymns
        WHEN OLD.category = 'hymnal'
        BEGIN
            INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
            VALUES ('delete', OLD.id, OLD.title, COALESCE(OLD.lyrics,''), COALESCE(OLD.author,''), COALESCE(OLD.album,''));
        END;

        CREATE TRIGGER hymns_au
        AFTER UPDATE ON hymns
        BEGIN
            INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
            SELECT 'delete', OLD.id, OLD.title, COALESCE(OLD.lyrics,''), COALESCE(OLD.author,''), COALESCE(OLD.album,'')
            WHERE OLD.category = 'hymnal';

            INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
            SELECT NEW.id, NEW.title, COALESCE(NEW.lyrics,''), COALESCE(NEW.author,''), COALESCE(NEW.album,'')
            WHERE NEW.category = 'hymnal';
        END;
        ",
    )
    .map_err(AppError::Database)?;

    tx.commit().map_err(AppError::Database)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::clear_database;
    use crate::db::migrations::run_migrations;
    use rusqlite::Connection;

    #[test]
    fn clear_database_succeeds_when_main_db_has_no_bible_tables() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        run_migrations(&conn).expect("run migrations");

        let bible_fts_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'bible_fts'",
                [],
                |row| row.get(0),
            )
            .expect("query bible_fts existence");
        assert_eq!(bible_fts_exists, 0, "main db should not contain bible_fts after v32");

        conn.execute(
            "UPDATE settings SET value = 'pt' WHERE key = 'app.language'",
            [],
        )
        .expect("update setting");
        conn.execute(
            "INSERT INTO hymns (title, category) VALUES ('Test Hymn', 'hymnal')",
            [],
        )
        .expect("insert hymn");

        clear_database(&conn).expect("clear database without bible tables");

        let hymn_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM hymns", [], |row| row.get(0))
            .expect("query hymns");
        assert_eq!(hymn_count, 0, "user hymn data should be cleared");

        let language: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'app.language'",
                [],
                |row| row.get(0),
            )
            .expect("read preserved setting");
        assert_eq!(language, "pt", "settings should be preserved");
    }
}
