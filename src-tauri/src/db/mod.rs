pub mod migrations;
pub mod models;
pub mod queries;

use crate::error::AppError;
use rusqlite::Connection;
use std::path::Path;

pub fn init_db(app_data_dir: &Path) -> Result<Connection, AppError> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("louvorja.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    migrations::run_migrations(&conn)?;

    Ok(conn)
}
