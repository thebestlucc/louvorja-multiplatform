pub mod hymn_importer;
pub mod service_importer;

use crate::error::AppError;
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use uuid::Uuid;

pub const CANCELLATION_MESSAGE: &str = "Migration cancelled by user.";

const DOMAIN_HYMNS: &str = "hymns";
const DOMAIN_BIBLE: &str = "bible";
const DOMAIN_FAVORITES: &str = "favorites";
const DOMAIN_SERVICES: &str = "services";
const DOMAIN_SETTINGS: &str = "settings";
const SETTINGS_EXCLUDE_KEYS: [&str; 6] = [
    "app.firstRunCompleted",
    "migration.lastSourcePath",
    "migration.lastRunStatus",
    "migration.lastRunAt",
    "migration.lastReport",
    "schema.version",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationOptions {
    #[serde(default = "default_true")]
    pub include_hymns: bool,
    #[serde(default = "default_true")]
    pub include_bible: bool,
    #[serde(default = "default_true")]
    pub include_favorites: bool,
    #[serde(default = "default_true")]
    pub include_services: bool,
    #[serde(default = "default_true")]
    pub include_settings: bool,
    #[serde(default)]
    pub replace_existing: bool,
}

impl Default for MigrationOptions {
    fn default() -> Self {
        Self {
            include_hymns: true,
            include_bible: true,
            include_favorites: true,
            include_services: true,
            include_settings: true,
            replace_existing: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationRunInfo {
    pub run_id: String,
    pub started_at: String,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationProgress {
    pub run_id: String,
    pub step: String,
    pub completed: u32,
    pub total: u32,
    pub percent: f64,
    pub eta_seconds: Option<u64>,
    pub message: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationProgressEvent {
    pub run_id: String,
    pub step: String,
    pub completed: u32,
    pub total: u32,
    pub percent: f64,
    pub eta_seconds: Option<u64>,
    pub message: String,
}

impl From<&MigrationProgress> for MigrationProgressEvent {
    fn from(value: &MigrationProgress) -> Self {
        Self {
            run_id: value.run_id.clone(),
            step: value.step.clone(),
            completed: value.completed,
            total: value.total,
            percent: value.percent,
            eta_seconds: value.eta_seconds,
            message: value.message.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationErrorItem {
    pub domain: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationDomainReport {
    pub domain: String,
    pub imported: u32,
    pub skipped: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    pub run_id: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub source_path: String,
    pub domains: Vec<MigrationDomainReport>,
    pub errors: Vec<MigrationErrorItem>,
}

pub struct MigrationRunState {
    pub progress: MigrationProgress,
    pub report: Option<MigrationReport>,
    pub cancel_flag: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct MigrationRuntimeState {
    pub active_run_id: Option<String>,
    pub runs: HashMap<String, MigrationRunState>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationDomain {
    Hymns,
    Bible,
    Favorites,
    Services,
    Settings,
}

impl MigrationDomain {
    pub fn id(self) -> &'static str {
        match self {
            Self::Hymns => DOMAIN_HYMNS,
            Self::Bible => DOMAIN_BIBLE,
            Self::Favorites => DOMAIN_FAVORITES,
            Self::Services => DOMAIN_SERVICES,
            Self::Settings => DOMAIN_SETTINGS,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Hymns => "Importing hymns",
            Self::Bible => "Importing Bible versions and verses",
            Self::Favorites => "Importing favorites",
            Self::Services => "Importing services",
            Self::Settings => "Importing settings",
        }
    }
}

pub fn selected_domains(options: &MigrationOptions) -> Vec<MigrationDomain> {
    let mut domains = Vec::with_capacity(5);
    if options.include_hymns {
        domains.push(MigrationDomain::Hymns);
    }
    if options.include_bible {
        domains.push(MigrationDomain::Bible);
    }
    if options.include_favorites {
        domains.push(MigrationDomain::Favorites);
    }
    if options.include_services {
        domains.push(MigrationDomain::Services);
    }
    if options.include_settings {
        domains.push(MigrationDomain::Settings);
    }
    domains
}

pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn safe_source_label(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "legacy.db".to_string())
}

pub fn preflight_source_path(path: &str) -> Result<(), AppError> {
    if path.trim().is_empty() {
        return Err(AppError::Internal(
            "Legacy source path is required.".to_string(),
        ));
    }

    let source_path = Path::new(path);
    if !source_path.exists() {
        return Err(AppError::NotFound(format!(
            "Legacy source file '{}' was not found.",
            safe_source_label(path)
        )));
    }
    if !source_path.is_file() {
        return Err(AppError::Internal(format!(
            "Legacy source '{}' is not a file.",
            safe_source_label(path)
        )));
    }

    let metadata = std::fs::metadata(source_path)?;
    if metadata.len() == 0 {
        return Err(AppError::Internal(format!(
            "Legacy source '{}' is empty.",
            safe_source_label(path)
        )));
    }

    let conn = open_readonly_source(path)?;
    let _: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    Ok(())
}

pub fn open_readonly_source(path: &str) -> Result<Connection, AppError> {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(AppError::Database)
}

pub fn table_exists(conn: &Connection, table_name: &str) -> Result<bool, AppError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![table_name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn sanitize_error_message(raw: &str) -> String {
    let normalized = raw.trim().replace('\n', " ");
    let collapsed = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.len() <= 220 {
        return collapsed;
    }
    format!("{}...", &collapsed[..217])
}

pub fn is_cancelled(cancel_flag: &AtomicBool) -> Result<(), AppError> {
    if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(AppError::Internal(CANCELLATION_MESSAGE.to_string()));
    }
    Ok(())
}

pub fn is_cancellation_error(error: &AppError) -> bool {
    match error {
        AppError::Internal(message) => message == CANCELLATION_MESSAGE,
        _ => false,
    }
}

pub fn import_bible_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
    cancel_flag: &AtomicBool,
) -> Result<MigrationDomainReport, AppError> {
    is_cancelled(cancel_flag)?;

    if !table_exists(source, "bible_versions")? || !table_exists(source, "bible_verses")? {
        return Err(AppError::Internal(
            "Source database does not contain Bible tables.".to_string(),
        ));
    }

    let tx = target.transaction()?;

    if replace_existing {
        tx.execute("DELETE FROM bible_fts", [])?;
        tx.execute("DELETE FROM bible_verses", [])?;
        tx.execute("DELETE FROM bible_versions", [])?;
    }

    let mut imported = 0u32;
    let mut skipped = 0u32;

    {
        let mut select_versions = source.prepare(
            "SELECT id, name, abbreviation, language, file_path FROM bible_versions ORDER BY id ASC",
        )?;
        let mut rows = select_versions.query([])?;

        let sql = if replace_existing {
            "INSERT INTO bible_versions (id, name, abbreviation, language, file_path) VALUES (?1, ?2, ?3, ?4, ?5)"
        } else {
            "INSERT OR IGNORE INTO bible_versions (id, name, abbreviation, language, file_path) VALUES (?1, ?2, ?3, ?4, ?5)"
        };
        let mut insert_version = tx.prepare(sql)?;

        while let Some(row) = rows.next()? {
            is_cancelled(cancel_flag)?;
            let changed = insert_version.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?
            ])?;
            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    {
        let mut select_verses = source.prepare(
            "SELECT id, version_id, book, chapter, verse, text FROM bible_verses ORDER BY id ASC",
        )?;
        let mut rows = select_verses.query([])?;

        let sql = if replace_existing {
            "INSERT INTO bible_verses (id, version_id, book, chapter, verse, text) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        } else {
            "INSERT OR IGNORE INTO bible_verses (id, version_id, book, chapter, verse, text) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        };
        let mut insert_verse = tx.prepare(sql)?;
        let mut processed = 0u32;

        while let Some(row) = rows.next()? {
            if processed % 250 == 0 {
                is_cancelled(cancel_flag)?;
            }
            processed = processed.saturating_add(1);
            let changed = insert_verse.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, String>(5)?
            ])?;
            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }

    tx.execute_batch(
        "
        DELETE FROM bible_fts;
        INSERT INTO bible_fts(rowid, text, book)
        SELECT id, text, book FROM bible_verses;
        ",
    )?;
    tx.commit()?;

    Ok(MigrationDomainReport {
        domain: DOMAIN_BIBLE.to_string(),
        imported,
        skipped,
    })
}

pub fn import_favorites_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
    cancel_flag: &AtomicBool,
) -> Result<MigrationDomainReport, AppError> {
    is_cancelled(cancel_flag)?;

    if !table_exists(source, "favorites")? {
        return Err(AppError::Internal(
            "Source database does not contain favorites table.".to_string(),
        ));
    }

    let tx = target.transaction()?;
    if replace_existing {
        tx.execute("DELETE FROM favorites", [])?;
    }

    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut select = source
        .prepare("SELECT id, item_type, item_id, created_at FROM favorites ORDER BY id ASC")?;
    let mut rows = select.query([])?;

    {
        let sql = if replace_existing {
            "INSERT INTO favorites (id, item_type, item_id, created_at) VALUES (?1, ?2, ?3, ?4)"
        } else {
            "INSERT OR IGNORE INTO favorites (id, item_type, item_id, created_at) VALUES (?1, ?2, ?3, ?4)"
        };
        let mut insert = tx.prepare(sql)?;

        while let Some(row) = rows.next()? {
            is_cancelled(cancel_flag)?;
            let changed = insert.execute(params![
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?
            ])?;
            if changed == 1 {
                imported = imported.saturating_add(1);
            } else {
                skipped = skipped.saturating_add(1);
            }
        }
    }
    tx.commit()?;

    Ok(MigrationDomainReport {
        domain: DOMAIN_FAVORITES.to_string(),
        imported,
        skipped,
    })
}

pub fn import_settings_domain(
    source: &Connection,
    target: &mut Connection,
    replace_existing: bool,
    cancel_flag: &AtomicBool,
) -> Result<MigrationDomainReport, AppError> {
    is_cancelled(cancel_flag)?;

    if !table_exists(source, "settings")? {
        return Err(AppError::Internal(
            "Source database does not contain settings table.".to_string(),
        ));
    }

    let tx = target.transaction()?;
    let mut imported = 0u32;
    let mut skipped = 0u32;

    let mut select = source.prepare("SELECT key, value FROM settings ORDER BY key ASC")?;
    let mut rows = select.query([])?;

    while let Some(row) = rows.next()? {
        is_cancelled(cancel_flag)?;
        let key = row.get::<_, String>(0)?;
        let value = row.get::<_, String>(1)?;

        if SETTINGS_EXCLUDE_KEYS.contains(&key.as_str()) {
            skipped = skipped.saturating_add(1);
            continue;
        }

        let changed = if replace_existing {
            tx.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?
        } else {
            tx.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?
        };

        if changed == 1 {
            imported = imported.saturating_add(1);
        } else {
            skipped = skipped.saturating_add(1);
        }
    }

    tx.commit()?;
    Ok(MigrationDomainReport {
        domain: DOMAIN_SETTINGS.to_string(),
        imported,
        skipped,
    })
}

fn default_true() -> bool {
    true
}
