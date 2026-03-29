pub mod migrations;
pub mod models;
pub mod queries;

use crate::error::AppError;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

pub fn init_bible_db(bible_db_path: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    let manager = SqliteConnectionManager::file(bible_db_path).with_init(|c| {
        c.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA temp_store=MEMORY;
             PRAGMA mmap_size=134217728;
             PRAGMA cache_size=-4000;
             PRAGMA foreign_keys=ON;
             PRAGMA busy_timeout=5000;",
        )
        .map_err(Into::into)
    });
    let pool = Pool::builder()
        .max_size(2)
        .min_idle(Some(1))
        .connection_timeout(std::time::Duration::from_secs(5))
        .build(manager)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Ensure the bible schema exists even if the resource file was missing
    // and init_bible_db created an empty SQLite file.
    let conn = pool.get().map_err(|e| AppError::Internal(e.to_string()))?;
    let has_table: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='bible_versions'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if !has_table {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS bible_versions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                abbreviation TEXT   NOT NULL UNIQUE,
                language    TEXT    NOT NULL DEFAULT 'pt',
                is_builtin  INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS bible_verses (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                version_id  INTEGER NOT NULL REFERENCES bible_versions(id),
                book        TEXT    NOT NULL,
                chapter     INTEGER NOT NULL,
                verse       INTEGER NOT NULL,
                text        TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_bible_verses_lookup
                ON bible_verses(version_id, book, chapter, verse);",
        )
        .map_err(|e| AppError::Internal(format!("Failed to create bible schema: {e}")))?;
        eprintln!("[app] Created empty bible schema — bible will be populated after pack sync");
    }

    Ok(pool)
}

pub fn init_db(app_data_dir: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("louvorja.db");

    let manager = SqliteConnectionManager::file(db_path).with_init(|c| {
        c.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA temp_store=MEMORY;
             PRAGMA mmap_size=134217728;
             PRAGMA cache_size=-8000;
             PRAGMA foreign_keys=ON;
             PRAGMA busy_timeout=5000;",
        )
        .map_err(Into::into)
    });

    let pool = Pool::builder()
        .max_size(4)
        .min_idle(Some(1))
        .connection_timeout(std::time::Duration::from_secs(5))
        .build(manager)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let conn = pool.get().map_err(|e| AppError::Internal(e.to_string()))?;
    migrations::run_migrations(&conn)?;

    Ok(pool)
}
