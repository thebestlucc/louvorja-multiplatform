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

/// Resets the app to default state by clearing user data (hymns, presentations, services, collections)
/// while preserving Bible data, settings, and schema version.
pub fn clear_database(conn: &Connection) -> Result<(), AppError> {
    // Delete from tables that reference other tables first (foreign keys), then parent tables
    // Order matters due to foreign key constraints
    // NOTE: Bible data (bible_verses, bible_versions, bible_fts) is preserved
    conn.execute_batch(
        "
        -- Clear child tables first
        DELETE FROM audio_sync_points;
        DELETE FROM slides;
        DELETE FROM service_items;
        DELETE FROM favorites;
        DELETE FROM collection_songs;
        DELETE FROM collection_hymns;

        -- Clear parent tables (but NOT bible tables)
        DELETE FROM hymns;
        DELETE FROM presentations;
        DELETE FROM services;
        DELETE FROM collections;

        -- Clear FTS tables (but NOT bible_fts)
        DELETE FROM hymns_fts;
        DELETE FROM collections_fts;

        -- Reset monitor configs but keep settings
        DELETE FROM monitor_configs;
        ",
    )
    .map_err(AppError::Database)?;

    Ok(())
}
