#![allow(dead_code)]

use std::path::{Path, PathBuf};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::db::models::{
    ContentSyncEntity, ContentSyncLocalMediaPaths, ContentSyncRemoteEntityInput, ContentSyncRun,
    ContentSyncRunMode, ContentSyncRunStatus, ContentSyncState,
};
use crate::error::AppError;

/// Maps BCP 47 content language tags to the 2-letter code used
/// as id_language in the legacy DB files table.
pub fn bcp47_to_lang_code(tag: &str) -> &str {
    match tag {
        "pt-BR" => "pt",
        "en-US" => "en",
        "es" => "es",
        other => other,
    }
}

fn map_state_row(row: &Row<'_>) -> Result<ContentSyncState, rusqlite::Error> {
    let last_sync_status = row
        .get::<_, Option<String>>(4)?
        .map(|value| ContentSyncRunStatus::from_db_str(&value));

    Ok(ContentSyncState {
        id: row.get(0)?,
        content_version: row.get(1)?,
        last_checked_at: row.get(2)?,
        last_synced_at: row.get(3)?,
        last_sync_status,
        last_error: row.get(5)?,
    })
}

fn map_entity_row(row: &Row<'_>) -> Result<ContentSyncEntity, rusqlite::Error> {
    Ok(ContentSyncEntity {
        id: row.get(0)?,
        entity_type: row.get(1)?,
        remote_id: row.get(2)?,
        local_id: row.get(3)?,
        remote_version: row.get(4)?,
        content_hash: row.get(5)?,
        lyrics_hash: row.get(6)?,
        image_version: row.get(7)?,
        audio_version: row.get(8)?,
        playback_version: row.get(9)?,
        updated_at: row.get(10)?,
        deleted: row.get(11)?,
        last_seen_at: row.get(12)?,
        created_at: row.get(13)?,
        updated_local_at: row.get(14)?,
    })
}

fn map_run_row(row: &Row<'_>) -> Result<ContentSyncRun, rusqlite::Error> {
    Ok(ContentSyncRun {
        id: row.get(0)?,
        mode: ContentSyncRunMode::from_db_str(&row.get::<_, String>(1)?),
        status: ContentSyncRunStatus::from_db_str(&row.get::<_, String>(2)?),
        requested_version: row.get(3)?,
        completed_version: row.get(4)?,
        planned_changes_json: row.get(5)?,
        result_json: row.get(6)?,
        error_json: row.get(7)?,
        created_at: row.get(8)?,
        finished_at: row.get(9)?,
    })
}

pub fn get_content_sync_state(conn: &Connection) -> Result<Option<ContentSyncState>, AppError> {
    conn.query_row(
        "SELECT id, content_version, last_checked_at, last_synced_at, last_sync_status, last_error
         FROM content_sync_state
         WHERE id = 1",
        [],
        map_state_row,
    )
    .optional()
    .map_err(AppError::Database)
}

pub fn upsert_content_sync_state(
    conn: &Connection,
    state: &ContentSyncState,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_state (
            id,
            content_version,
            last_checked_at,
            last_synced_at,
            last_sync_status,
            last_error
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            content_version = excluded.content_version,
            last_checked_at = excluded.last_checked_at,
            last_synced_at = excluded.last_synced_at,
            last_sync_status = excluded.last_sync_status,
            last_error = excluded.last_error",
        params![
            state.id,
            state.content_version,
            state.last_checked_at,
            state.last_synced_at,
            state.last_sync_status.as_ref().map(ContentSyncRunStatus::as_db_str),
            state.last_error,
        ],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

pub fn mark_content_sync_checked(
    conn: &Connection,
    content_version: Option<i64>,
    last_error: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_state (
            id,
            content_version,
            last_checked_at,
            last_error
         ) VALUES (1, ?1, datetime('now'), ?2)
         ON CONFLICT(id) DO UPDATE SET
            content_version = COALESCE(excluded.content_version, content_sync_state.content_version),
            last_checked_at = datetime('now'),
            last_error = excluded.last_error",
        params![content_version, last_error],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

pub fn upsert_remote_manifest_entity(
    conn: &Connection,
    entity: &ContentSyncRemoteEntityInput,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_entities (
            entity_type,
            remote_id,
            local_id,
            remote_version,
            content_hash,
            lyrics_hash,
            image_version,
            audio_version,
            playback_version,
            updated_at,
            deleted,
            last_seen_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
         ON CONFLICT(entity_type, remote_id) DO UPDATE SET
            local_id = COALESCE(excluded.local_id, content_sync_entities.local_id),
            remote_version = excluded.remote_version,
            content_hash = excluded.content_hash,
            lyrics_hash = excluded.lyrics_hash,
            image_version = excluded.image_version,
            audio_version = excluded.audio_version,
            playback_version = excluded.playback_version,
            updated_at = excluded.updated_at,
            deleted = excluded.deleted,
            last_seen_at = datetime('now')",
        params![
            entity.entity_type,
            entity.remote_id,
            entity.local_id,
            entity.remote_version,
            entity.content_hash,
            entity.lyrics_hash,
            entity.image_version,
            entity.audio_version,
            entity.playback_version,
            entity.updated_at,
            entity.deleted,
        ],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

pub fn upsert_content_sync_entity(
    conn: &Connection,
    entity: &ContentSyncEntity,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_entities (
            entity_type,
            remote_id,
            local_id,
            remote_version,
            content_hash,
            lyrics_hash,
            image_version,
            audio_version,
            playback_version,
            updated_at,
            deleted,
            last_seen_at,
            updated_local_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(entity_type, remote_id) DO UPDATE SET
            local_id = excluded.local_id,
            remote_version = excluded.remote_version,
            content_hash = excluded.content_hash,
            lyrics_hash = excluded.lyrics_hash,
            image_version = excluded.image_version,
            audio_version = excluded.audio_version,
            playback_version = excluded.playback_version,
            updated_at = excluded.updated_at,
            deleted = excluded.deleted,
            last_seen_at = excluded.last_seen_at,
            updated_local_at = excluded.updated_local_at",
        params![
            entity.entity_type,
            entity.remote_id,
            entity.local_id,
            entity.remote_version,
            entity.content_hash,
            entity.lyrics_hash,
            entity.image_version,
            entity.audio_version,
            entity.playback_version,
            entity.updated_at,
            entity.deleted,
            entity.last_seen_at,
            entity.updated_local_at,
        ],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

pub fn list_content_sync_entities(
    conn: &Connection,
    entity_type: Option<&str>,
) -> Result<Vec<ContentSyncEntity>, AppError> {
    let sql = if entity_type.is_some() {
        "SELECT
            id,
            entity_type,
            remote_id,
            local_id,
            remote_version,
            content_hash,
            lyrics_hash,
            image_version,
            audio_version,
            playback_version,
            updated_at,
            deleted,
            last_seen_at,
            created_at,
            updated_local_at
         FROM content_sync_entities
         WHERE entity_type = ?1
         ORDER BY remote_id ASC"
    } else {
        "SELECT
            id,
            entity_type,
            remote_id,
            local_id,
            remote_version,
            content_hash,
            lyrics_hash,
            image_version,
            audio_version,
            playback_version,
            updated_at,
            deleted,
            last_seen_at,
            created_at,
            updated_local_at
         FROM content_sync_entities
         ORDER BY entity_type ASC, remote_id ASC"
    };

    let mut stmt = conn.prepare(sql).map_err(AppError::Database)?;
    let rows = if let Some(entity_type) = entity_type {
        stmt.query_map([entity_type], map_entity_row)
    } else {
        stmt.query_map([], map_entity_row)
    }
    .map_err(AppError::Database)?;

    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

pub fn list_stale_content_sync_entities(conn: &Connection) -> Result<Vec<ContentSyncEntity>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                entity_type,
                remote_id,
                local_id,
                remote_version,
                content_hash,
                lyrics_hash,
                image_version,
                audio_version,
                playback_version,
                updated_at,
                deleted,
                last_seen_at,
                created_at,
                updated_local_at
             FROM content_sync_entities
             WHERE deleted = 1 OR local_id IS NULL
             ORDER BY entity_type ASC, remote_id ASC",
        )
        .map_err(AppError::Database)?;

    let rows = stmt
        .query_map([], map_entity_row)
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(rows)
}

pub fn get_hymn_media_paths(
    conn: &Connection,
    hymn_id: i64,
) -> Result<Option<ContentSyncLocalMediaPaths>, AppError> {
    conn.query_row(
        "SELECT id, audio_path, playback_path, cover_path, album
         FROM hymns
         WHERE id = ?1",
        [hymn_id],
        |row| {
            Ok(ContentSyncLocalMediaPaths {
                entity_type: "hymn".to_string(),
                local_id: row.get(0)?,
                audio_path: row.get(1)?,
                playback_path: row.get(2)?,
                cover_path: row.get(3)?,
                album: row.get(4)?,
                language: None, // Will be resolved by the sync runner if needed
            })
        },
    )
    .optional()
    .map_err(AppError::Database)
}

pub fn get_album_media_paths(
    conn: &Connection,
    collection_id: i64,
) -> Result<Option<ContentSyncLocalMediaPaths>, AppError> {
    conn.query_row(
        "SELECT id, cover_path, name
         FROM collections
         WHERE id = ?1",
        [collection_id],
        |row| {
            Ok(ContentSyncLocalMediaPaths {
                entity_type: "album".to_string(),
                local_id: row.get(0)?,
                audio_path: None,
                playback_path: None,
                cover_path: row.get(1)?,
                album: row.get(2)?,
                language: None,
            })
        },
    )
    .optional()
    .map_err(AppError::Database)
}

/// Update the local_id of an existing content_sync_entities row.
/// Called after CreateHymn/CreateAlbum so the next plan run resolves the entity.
pub fn set_content_sync_entity_local_id(
    conn: &Connection,
    entity_type: &str,
    remote_id: i64,
    local_id: i64,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE content_sync_entities SET local_id = ?1, updated_local_at = datetime('now')
         WHERE entity_type = ?2 AND remote_id = ?3",
        rusqlite::params![local_id, entity_type, remote_id],
    )?;
    Ok(())
}

pub fn set_hymn_audio_path(conn: &Connection, hymn_id: i64, path: &str) -> Result<(), AppError> {
    conn.execute("UPDATE hymns SET audio_path = ?2 WHERE id = ?1", params![hymn_id, path])
        .map_err(AppError::Database)?;
    Ok(())
}

pub fn set_hymn_playback_path(conn: &Connection, hymn_id: i64, path: &str) -> Result<(), AppError> {
    conn.execute("UPDATE hymns SET playback_path = ?2 WHERE id = ?1", params![hymn_id, path])
        .map_err(AppError::Database)?;
    Ok(())
}

pub fn set_hymn_cover_path(conn: &Connection, hymn_id: i64, path: &str) -> Result<(), AppError> {
    conn.execute("UPDATE hymns SET cover_path = ?2 WHERE id = ?1", params![hymn_id, path])
        .map_err(AppError::Database)?;
    Ok(())
}

pub fn create_content_sync_run(conn: &Connection, run: &ContentSyncRun) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_runs (
            id,
            mode,
            status,
            requested_version,
            completed_version,
            planned_changes_json,
            result_json,
            error_json,
            created_at,
            finished_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            run.id,
            run.mode.as_db_str(),
            run.status.as_db_str(),
            run.requested_version,
            run.completed_version,
            run.planned_changes_json,
            run.result_json,
            run.error_json,
            run.created_at,
            run.finished_at,
        ],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

pub fn prepare_content_sync_run(
    conn: &Connection,
    run_id: &str,
    mode: ContentSyncRunMode,
    requested_version: Option<i64>,
    planned_changes_json: Option<&str>,
) -> Result<(), AppError> {
    let updated = conn.execute(
        "UPDATE content_sync_runs
         SET mode = ?2,
             requested_version = ?3,
             planned_changes_json = ?4
         WHERE id = ?1",
        params![
            run_id,
            mode.as_db_str(),
            requested_version,
            planned_changes_json,
        ],
    )
    .map_err(AppError::Database)?;

    if updated == 0 {
        return Err(AppError::NotFound(format!("content_sync_run not found: {run_id}")));
    }
    Ok(())
}

pub fn complete_content_sync_run(
    conn: &Connection,
    run_id: &str,
    status: ContentSyncRunStatus,
    completed_version: Option<i64>,
    result_json: Option<&str>,
    error_json: Option<&str>,
    finished_at: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE content_sync_runs
         SET status = ?2,
             completed_version = ?3,
             result_json = ?4,
             error_json = ?5,
             finished_at = ?6
         WHERE id = ?1",
        params![
            run_id,
            status.as_db_str(),
            completed_version,
            result_json,
            error_json,
            finished_at,
        ],
    )
    .map_err(AppError::Database)?;

    Ok(())
}

pub fn get_content_sync_run(
    conn: &Connection,
    run_id: &str,
) -> Result<Option<ContentSyncRun>, AppError> {
    conn.query_row(
        "SELECT
            id,
            mode,
            status,
            requested_version,
            completed_version,
            planned_changes_json,
            result_json,
            error_json,
            created_at,
            finished_at
         FROM content_sync_runs
         WHERE id = ?1",
        [run_id],
        map_run_row,
    )
    .optional()
    .map_err(AppError::Database)
}

// TODO(review): Add debug_assert!(!pack_id.is_empty()) to catch empty pack_id in dev - Business Logic Reviewer, 2026-03-19, Severity: Low
/// Returns the locally cached version for a pack, or 0 if unknown.
pub fn get_pack_local_version(conn: &Connection, pack_id: &str) -> Result<u32, AppError> {
    // TODO(review): local_version stored as SQLite INTEGER (signed i64) but read as u32; add CHECK (local_version >= 0) to schema in a future migration to enforce at DB level - Nil-Safety Reviewer, 2026-03-19, Severity: Low
    conn.query_row(
        "SELECT local_version FROM content_sync_packs WHERE pack_id = ?1",
        rusqlite::params![pack_id],
        |row| row.get::<_, u32>(0),
    )
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(0),
        other => Err(AppError::Database(other)),
    })
}

// TODO(review): Add debug_assert!(!pack_id.is_empty()) to catch empty pack_id in dev - Business Logic Reviewer, 2026-03-19, Severity: Low
/// Upsert the extracted version for a pack.
pub fn set_pack_local_version(conn: &Connection, pack_id: &str, version: u32) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_packs (pack_id, local_version, extracted_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(pack_id) DO UPDATE SET local_version = ?2, extracted_at = datetime('now')",
        rusqlite::params![pack_id, version],
    )
    .map(|_| ())
    .map_err(AppError::Database)
}

pub fn get_pack_extracted_version(conn: &Connection, pack_id: &str) -> Result<u32, AppError> {
    conn.query_row(
        "SELECT extracted_version FROM content_sync_packs WHERE pack_id = ?1",
        rusqlite::params![pack_id],
        |row| row.get::<_, u32>(0),
    )
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(0),
        other => Err(AppError::Database(other)),
    })
}

pub fn set_pack_extracted_version(conn: &Connection, pack_id: &str, version: u32) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_packs (pack_id, extracted_version, extracted_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(pack_id) DO UPDATE SET extracted_version = ?2, extracted_at = datetime('now')",
        rusqlite::params![pack_id, version],
    )
    .map(|_| ())
    .map_err(AppError::Database)
}

pub fn get_pack_db_version(conn: &Connection, pack_id: &str) -> Result<u32, AppError> {
    conn.query_row(
        "SELECT db_version FROM content_sync_packs WHERE pack_id = ?1",
        rusqlite::params![pack_id],
        |row| row.get::<_, u32>(0),
    )
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(0),
        other => Err(AppError::Database(other)),
    })
}

pub fn set_pack_db_version(conn: &Connection, pack_id: &str, version: u32) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO content_sync_packs (pack_id, db_version)
         VALUES (?1, ?2)
         ON CONFLICT(pack_id) DO UPDATE SET db_version = ?2",
        rusqlite::params![pack_id, version],
    )
    .map(|_| ())
    .map_err(AppError::Database)
}

/// Update a hymn's media path based on API ID and file type.
pub fn update_hymn_path_by_api_id(
    conn: &Connection,
    api_music_id: i64,
    file_type: &str,
    path: &str,
) -> Result<(), AppError> {
    let col = match file_type {
        "audio" => "audio_path",
        "playback" => "playback_path",
        "cover" => "cover_path",
        _ => return Err(AppError::Internal(format!("Unknown hymn file type: {}", file_type))),
    };
    let sql = format!("UPDATE hymns SET {} = ?1 WHERE api_music_id = ?2", col);
    conn.execute(&sql, rusqlite::params![path, api_music_id])
        .map(|_| ())
        .map_err(AppError::Database)
}

/// Ensure a collection with the given name exists (CDN/API-sourced).
/// Returns the existing collection id if already present, otherwise inserts and returns the new id.
/// If the collection exists with a non-api source_type (e.g. 'remote' from an older sync),
/// it is upgraded to 'api' so it appears in the Albums tab.
pub fn ensure_collection_by_name(conn: &Connection, name: &str) -> Result<i64, AppError> {
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM collections WHERE name = ?1 LIMIT 1",
            params![name],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::Database)?;

    if let Some(id) = existing {
        // Upgrade source_type to 'api' if it was created with an older value (e.g. 'remote').
        conn.execute(
            "UPDATE collections SET source_type = 'api' WHERE id = ?1 AND source_type != 'api'",
            params![id],
        )
        .map_err(AppError::Database)?;
        return Ok(id);
    }

    conn.execute(
        "INSERT INTO collections (name, source_type) VALUES (?1, 'api')",
        params![name],
    )
    .map_err(AppError::Database)?;

    Ok(conn.last_insert_rowid())
}

/// Update a collection's cover path based on API album ID.
pub fn update_collection_cover_by_api_id(
    conn: &Connection,
    api_album_id: i64,
    path: &str,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE collections SET cover_path = ?1 WHERE api_album_id = ?2",
        rusqlite::params![path, api_album_id],
    )
    .map(|_| ())
    .map_err(AppError::Database)
}

/// Returns the list of BCP 47 language tags the user has selected for sync.
/// Returns empty Vec if the setting is not set.
pub fn get_selected_languages(conn: &Connection) -> Vec<String> {
    crate::db::queries::settings::get_setting(conn, "pack_sync.selected_languages")
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s.value).ok())
        .unwrap_or_default()
}

pub fn set_selected_languages(conn: &Connection, langs: &[String]) -> Result<(), AppError> {
    let json = serde_json::to_string(langs).map_err(AppError::SerdeJson)?;
    crate::db::queries::settings::set_setting(conn, "pack_sync.selected_languages", &json)
}

/// Renames the downloaded temp DB file to its final content-{lang}.db path.
/// Returns the final path.
pub fn save_content_db(
    tmp_path: &Path,
    lang_bcp47: &str,
    app_data_dir: &Path,
) -> Result<PathBuf, AppError> {
    let filename = format!("content-{}.db", lang_bcp47);
    let dest = app_data_dir.join(&filename);
    std::fs::rename(tmp_path, &dest).map_err(AppError::Io)?;
    Ok(dest)
}

/// Creates and populates musics_fts on the content DB.
/// Safe to call multiple times — skips if table already populated.
pub fn init_content_db_fts(conn: &Connection, lang_bcp47: &str) -> Result<(), AppError> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA cache_size=-8000;
         CREATE VIRTUAL TABLE IF NOT EXISTS musics_fts USING fts5(name, lyrics);",
    )
    .map_err(AppError::Database)?;

    // Guard: skip if already populated (handles interrupted-init recovery)
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM musics_fts", [], |r| r.get(0))
        .map_err(AppError::Database)?;
    if count > 0 {
        return Ok(());
    }

    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let mut stmt = conn
        .prepare(
            "INSERT INTO musics_fts(rowid, name, lyrics)
             SELECT m.id_music, m.name, COALESCE(GROUP_CONCAT(l.lyric, ' '), '')
             FROM musics m
             LEFT JOIN lyrics l ON l.id_music = m.id_music AND l.id_language = ?1
             GROUP BY m.id_music",
        )
        .map_err(AppError::Database)?;
    stmt.execute([lang_short]).map_err(AppError::Database)?;
    Ok(())
}

/// Opens an r2d2 pool for a content DB file.
pub fn open_content_db_pool(path: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    let manager = SqliteConnectionManager::file(path);
    Pool::builder()
        .min_idle(Some(1))
        .max_size(3)
        .build(manager)
        .map_err(|e| AppError::Internal(format!("Content DB pool error: {}", e)))
}

/// Return the remote legacy DB version that was last successfully imported.
/// Returns `None` if no import has ever been performed.
/// The version is stored as a settings key (`pack_sync.legacy_db_version`).
pub fn get_legacy_db_version(conn: &Connection) -> Result<Option<i64>, AppError> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'pack_sync.legacy_db_version'",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(AppError::Database)
    .map(|opt| opt.and_then(|s| s.parse::<i64>().ok()))
}

/// Persist the remote legacy DB version after a successful import.
pub fn set_legacy_db_version(conn: &Connection, version: i64) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('pack_sync.legacy_db_version', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![version.to_string()],
    )
    .map(|_| ())
    .map_err(AppError::Database)
}

/// Download a legacy Delphi-schema database (already saved to `legacy_db_path`)
/// and import its hymn data into the current app database via ATTACH DATABASE.
///
/// This mirrors `migrate_v13` but operates cross-DB, using `legacy.*` table prefixes.
/// Import is skipped when the local `pack_sync.legacy_db_version` is already >= `remote_version`.
/// Returns the number of hymns inserted (0 when skipped).
pub fn import_legacy_db(
    current_conn: &Connection,
    legacy_db_path: &str,
    remote_version: i64,
) -> Result<usize, AppError> {
    // Skip if we already imported this version or a newer one.
    let local_version = get_legacy_db_version(current_conn)?.unwrap_or(0);
    if local_version >= remote_version {
        return Ok(0);
    }

    // Escape single quotes in the path to prevent SQL injection in ATTACH.
    let safe_path = legacy_db_path.replace('\'', "''");
    current_conn
        .execute_batch(&format!(
            "ATTACH DATABASE '{}' AS legacy;",
            safe_path
        ))
        .map_err(AppError::Database)?;

    // Run the import using cross-DB queries.
    // `legacy.musics`, `legacy.albums_musics`, `legacy.albums`, `legacy.lyrics`, `legacy.files`,
    // `legacy.categories`, `legacy.categories_albums` mirror the same tables from migrate_v13.
    let result = (|| -> Result<usize, AppError> {
        // Check that the required legacy tables actually exist in the attached DB.
        let musics_exists: i64 = current_conn
            .query_row(
                "SELECT COUNT(*) FROM legacy.sqlite_master WHERE type='table' AND name='musics'",
                [],
                |row| row.get(0),
            )
            .map_err(AppError::Database)?;
        if musics_exists == 0 {
            return Ok(0);
        }

        // Count hymns before insert so we can return the delta.
        let before: i64 = current_conn
            .query_row("SELECT COUNT(*) FROM hymns", [], |row| row.get(0))
            .map_err(AppError::Database)?;

        current_conn
            .execute_batch(
                "
                INSERT OR IGNORE INTO hymns (number, title, album, lyrics, audio_path, category)
                SELECT
                    am.track,
                    m.name,
                    a.name,
                    (
                        SELECT GROUP_CONCAT(l.lyric, char(10) || char(10))
                        FROM legacy.lyrics l
                        WHERE l.id_music = m.id_music
                          AND l.id_language = 'pt'
                        ORDER BY l.\"order\"
                    ),
                    CASE
                        WHEN f.dir IS NOT NULL AND f.name IS NOT NULL
                        THEN f.dir || '/' || f.name
                        ELSE NULL
                    END,
                    COALESCE(cat.slug, 'hymnal')
                FROM legacy.musics m
                INNER JOIN legacy.albums_musics am ON am.id_album = (
                    SELECT MIN(id_album) FROM legacy.albums_musics WHERE id_music = m.id_music
                ) AND am.id_music = m.id_music
                INNER JOIN legacy.albums a ON a.id_album = am.id_album
                LEFT JOIN legacy.files f ON f.id_file = m.id_file_music
                LEFT JOIN legacy.categories_albums ca ON ca.id_album = a.id_album
                    AND ca.id_language = 'pt'
                LEFT JOIN legacy.categories cat ON cat.id_category = ca.id_category
                WHERE m.id_language = 'pt'
                ORDER BY am.track;

                INSERT INTO hymns_fts(hymns_fts) VALUES('delete-all');
                INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
                SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
                FROM hymns;
                ",
            )
            .map_err(AppError::Database)?;

        let after: i64 = current_conn
            .query_row("SELECT COUNT(*) FROM hymns", [], |row| row.get(0))
            .map_err(AppError::Database)?;

        Ok((after - before).max(0) as usize)
    })();

    // Always detach, even on error.
    let _ = current_conn.execute_batch("DETACH DATABASE legacy;");

    result
}

pub fn list_content_sync_runs(
    conn: &Connection,
    limit: usize,
) -> Result<Vec<ContentSyncRun>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                mode,
                status,
                requested_version,
                completed_version,
                planned_changes_json,
                result_json,
                error_json,
                created_at,
                finished_at
             FROM content_sync_runs
             ORDER BY created_at DESC
             LIMIT ?1",
        )
        .map_err(AppError::Database)?;

    let limit_i64 = i64::try_from(limit)
        .map_err(|_| AppError::Internal("content sync run limit exceeded i64".to_string()))?;

    let rows = stmt
        .query_map([limit_i64], map_run_row)
        .map_err(AppError::Database)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    #[test]
    fn get_pack_version_returns_zero_for_unknown_pack() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let v = get_pack_local_version(&conn, "nonexistent").unwrap();
        assert_eq!(v, 0);
    }

    #[test]
    fn set_and_get_pack_version_roundtrip() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_pack_local_version(&conn, "album-test", 3).unwrap();
        let v = get_pack_local_version(&conn, "album-test").unwrap();
        assert_eq!(v, 3);
    }

    #[test]
    fn set_pack_version_overwrites_previous_value() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_pack_local_version(&conn, "pack-a", 1).unwrap();
        set_pack_local_version(&conn, "pack-a", 7).unwrap();
        let v = get_pack_local_version(&conn, "pack-a").unwrap();
        assert_eq!(v, 7, "second set must overwrite first via upsert");
    }

    #[test]
    fn set_pack_version_populates_extracted_at() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_pack_local_version(&conn, "pack-ts", 2).unwrap();
        let extracted_at: Option<String> = conn.query_row(
            "SELECT extracted_at FROM content_sync_packs WHERE pack_id = ?1",
            rusqlite::params!["pack-ts"],
            |row| row.get(0),
        ).unwrap();
        assert!(extracted_at.is_some(), "extracted_at must be set after set_pack_local_version");
        assert!(!extracted_at.unwrap().is_empty(), "extracted_at must not be empty");
    }

    #[test]
    fn get_pack_extracted_version_returns_zero_for_unknown() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let v = get_pack_extracted_version(&conn, "unknown").unwrap();
        assert_eq!(v, 0);
    }

    #[test]
    fn set_and_get_pack_extracted_version_roundtrip() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_pack_extracted_version(&conn, "pack-a", 5).unwrap();
        assert_eq!(get_pack_extracted_version(&conn, "pack-a").unwrap(), 5);
    }

    #[test]
    fn get_pack_db_version_returns_zero_for_unknown() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let v = get_pack_db_version(&conn, "unknown").unwrap();
        assert_eq!(v, 0);
    }

    #[test]
    fn set_and_get_pack_db_version_roundtrip() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        set_pack_db_version(&conn, "pack-a", 3).unwrap();
        assert_eq!(get_pack_db_version(&conn, "pack-a").unwrap(), 3);
    }

    #[test]
    fn update_hymn_path_by_api_id_sets_audio() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO hymns (title, api_music_id) VALUES ('Test', 123)",
            [],
        ).unwrap();
        update_hymn_path_by_api_id(&conn, 123, "audio", "media/audio/123/song.mp3").unwrap();
        let path: String = conn.query_row(
            "SELECT audio_path FROM hymns WHERE api_music_id = 123", [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(path, "media/audio/123/song.mp3");
    }

    #[test]
    fn update_collection_cover_by_api_id_sets_path() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO collections (name, api_album_id) VALUES ('Album', 456)",
            [],
        ).unwrap();
        update_collection_cover_by_api_id(&conn, 456, "media/images/456/cover.jpg").unwrap();
        let path: String = conn.query_row(
            "SELECT cover_path FROM collections WHERE api_album_id = 456", [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(path, "media/images/456/cover.jpg");
    }
}
