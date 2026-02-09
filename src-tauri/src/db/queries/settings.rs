use rusqlite::Connection;
use crate::db::models::{Setting, MonitorConfig};
use crate::error::AppError;

pub fn get_setting(_conn: &Connection, _key: &str) -> Result<Setting, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn set_setting(_conn: &Connection, _key: &str, _value: &str) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_all_settings(_conn: &Connection) -> Result<Vec<Setting>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn get_monitor_configs(_conn: &Connection) -> Result<Vec<MonitorConfig>, AppError> {
    Err(AppError::Internal("Not implemented".into()))
}

pub fn set_monitor_config(_conn: &Connection, _config: &MonitorConfig) -> Result<(), AppError> {
    Err(AppError::Internal("Not implemented".into()))
}
