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
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        )
        .map_err(Into::into)
    });
    Pool::new(manager).map_err(|e| AppError::Internal(e.to_string()))
}

pub fn init_db(app_data_dir: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("louvorja.db");

    let manager = SqliteConnectionManager::file(db_path).with_init(|c| {
        c.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        )
        .map_err(Into::into)
    });

    let pool = Pool::new(manager).map_err(|e| AppError::Internal(e.to_string()))?;

    let conn = pool.get().map_err(|e| AppError::Internal(e.to_string()))?;
    migrations::run_migrations(&conn)?;

    Ok(pool)
}
