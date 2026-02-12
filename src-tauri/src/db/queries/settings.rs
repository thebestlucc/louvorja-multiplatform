use crate::db::models::{MonitorConfig, Setting};
use crate::error::AppError;
use rusqlite::Connection;

pub fn get_setting(_conn: &Connection, _key: &str) -> Result<Setting, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn set_setting(_conn: &Connection, _key: &str, _value: &str) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_all_settings(_conn: &Connection) -> Result<Vec<Setting>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
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
