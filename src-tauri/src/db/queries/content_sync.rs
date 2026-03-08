#![allow(dead_code)]

use crate::db::models::{
    ContentSyncEntity, ContentSyncLocalMediaPaths, ContentSyncRemoteEntityInput, ContentSyncRun,
    ContentSyncRunMode, ContentSyncRunStatus, ContentSyncState,
};
use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension, Row};

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
        "SELECT id, audio_path, playback_path, cover_path
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
        "SELECT id, cover_path
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
            })
        },
    )
    .optional()
    .map_err(AppError::Database)
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
