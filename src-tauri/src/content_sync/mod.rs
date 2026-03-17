#![allow(dead_code)]

pub mod importer;

use crate::db::models::{
    ContentSyncFallbackAction, ContentSyncLocalMediaPaths, ContentSyncPlan, ContentSyncPlanItem,
    ContentSyncPlanItemAction, ContentSyncPlanItemStatus, ContentSyncRemoteEntityInput,
    ContentSyncProgress, ContentSyncReport, ContentSyncRun, ContentSyncRunMode,
    ContentSyncRunStatus, ContentSyncState, ContentSyncSummary, ContentSyncSummaryMode,
};
use crate::db::queries::{content_sync, settings};
use crate::error::AppError;
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use uuid::Uuid;

type EntityKey = (String, i64);

pub struct ContentSyncRunState {
    pub progress: ContentSyncProgress,
    pub report: Option<ContentSyncReport>,
    pub cancel_flag: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct ContentSyncRuntimeState {
    pub active_run_id: Option<String>,
    pub runs: HashMap<String, ContentSyncRunState>,
}

pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn initial_progress(run_id: &str, plan: &ContentSyncPlan) -> ContentSyncProgress {
    let requires_fallback = plan_requires_full_sync_fallback(plan);
    ContentSyncProgress {
        run_id: run_id.to_string(),
        step: if requires_fallback {
            "fallback".to_string()
        } else {
            "planning".to_string()
        },
        status: ContentSyncRunStatus::Pending,
        percent: 0.0,
        message: Some(if requires_fallback {
            "Selective sync is unavailable. A full sync fallback is required.".to_string()
        } else {
            "Preparing content sync plan execution.".to_string()
        }),
        items_total: plan.items.len() as u64,
        items_processed: 0,
    }
}

pub fn begin_runtime_run(
    conn: &Connection,
    run_id: &str,
    plan: &ContentSyncPlan,
) -> Result<ContentSyncRun, AppError> {
    let run = ContentSyncRun {
        id: run_id.to_string(),
        mode: if plan_requires_full_sync_fallback(plan) {
            ContentSyncRunMode::Full
        } else {
            plan.mode.clone()
        },
        status: ContentSyncRunStatus::Pending,
        requested_version: plan.summary.remote_version,
        completed_version: None,
        planned_changes_json: Some(serde_json::to_string(&plan.items)?),
        result_json: None,
        error_json: None,
        created_at: chrono_like_now(),
        finished_at: None,
    };
    content_sync::create_content_sync_run(conn, &run)?;
    Ok(run)
}

pub fn update_runtime_progress(
    runtime_state: &mut ContentSyncRuntimeState,
    run_id: &str,
    step: &str,
    status: ContentSyncRunStatus,
    percent: f64,
    message: Option<String>,
    items_processed: u64,
) -> Option<ContentSyncProgress> {
    let run = runtime_state.runs.get_mut(run_id)?;
    run.progress.step = step.to_string();
    run.progress.status = status;
    run.progress.percent = percent;
    run.progress.message = message;
    run.progress.items_processed = items_processed;
    Some(run.progress.clone())
}

pub fn finalize_runtime_run(
    conn: &Connection,
    run_id: &str,
    plan: &ContentSyncPlan,
    status: ContentSyncRunStatus,
    applied_count: i32,
    skipped_count: i32,
    failed_count: i32,
    message: Option<String>,
) -> Result<ContentSyncReport, AppError> {
    let fallback_used = plan_requires_full_sync_fallback(plan);
    let result_json = serde_json::json!({
        "appliedCount": applied_count,
        "skippedCount": skipped_count,
        "failedCount": failed_count,
        "fallbackUsed": fallback_used,
        "message": message,
    })
    .to_string();

    content_sync::complete_content_sync_run(
        conn,
        run_id,
        status,
        plan.summary.remote_version,
        Some(&result_json),
        None,
        Some(&chrono_like_now()),
    )?;

    load_report(conn, run_id)?.ok_or_else(|| {
        AppError::Internal(format!("Content sync report '{}' was not persisted.", run_id))
    })
}

pub fn mark_run_cancelled(cancel_flag: &Arc<AtomicBool>) {
    cancel_flag.store(true, Ordering::SeqCst);
}

pub fn is_run_cancelled(cancel_flag: &Arc<AtomicBool>) -> bool {
    cancel_flag.load(Ordering::SeqCst)
}

fn hydrated_sync_state(conn: &Connection) -> Result<Option<ContentSyncState>, AppError> {
    let mut sync_state = content_sync::get_content_sync_state(conn)?;

    let stored_version = sync_state
        .as_ref()
        .and_then(|state| state.content_version)
        .or_else(|| {
            settings::get_setting(conn, "api.dbVersion")
                .ok()
                .and_then(|setting| setting.value.parse::<i64>().ok())
        });

    if let Some(current_version) = stored_version {
        match &mut sync_state {
            Some(state) if state.content_version.is_none() => {
                state.content_version = Some(current_version);
            }
            None => {
                sync_state = Some(ContentSyncState {
                    id: 1,
                    content_version: Some(current_version),
                    last_checked_at: None,
                    last_synced_at: None,
                    last_sync_status: None,
                    last_error: None,
                });
            }
            _ => {}
        }
    }

    Ok(sync_state)
}

pub fn load_summary<F>(conn: &Connection, file_exists: F) -> Result<ContentSyncSummary, AppError>
where
    F: Fn(&str) -> bool,
{
    let sync_state = hydrated_sync_state(conn)?;
    let mut summary = baseline_degraded_summary(None, sync_state);

    // Count missing assets
    let hymns = conn
        .prepare("SELECT id, audio_path, playback_path, cover_path, album FROM hymns")?
        .query_map([], |row| {
            Ok(ContentSyncLocalMediaPaths {
                entity_type: "hymn".to_string(),
                local_id: row.get(0)?,
                audio_path: row.get(1)?,
                playback_path: row.get(2)?,
                cover_path: row.get(3)?,
                album: row.get(4)?,
                language: None,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let albums = conn
        .prepare("SELECT id, cover_path, name FROM collections")?
        .query_map([], |row| {
            Ok(ContentSyncLocalMediaPaths {
                entity_type: "album".to_string(),
                local_id: row.get(0)?,
                audio_path: None,
                playback_path: None,
                cover_path: row.get(1)?,
                album: row.get(2)?,
                language: None,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut missing_count = 0;
    for media in hymns {
        if media_paths_missing(&media, &file_exists) {
            missing_count += 1;
        }
    }
    for media in albums {
        if media_paths_missing(&media, &file_exists) {
            missing_count += 1;
        }
    }

    summary.missing_asset_count = missing_count;
    if missing_count > 0 {
        summary.has_updates = true;
    }

    Ok(summary)
}

pub fn resolve_remote_path_from_url(url: &str) -> String {
    if url.contains("/file/musics/") {
        let parts: Vec<&str> = url.split("/file/musics/").collect();
        if parts.len() == 2 {
            let sub = parts[1];
            let sub_parts: Vec<&str> = sub.splitn(2, '/').collect();
            if sub_parts.len() == 2 {
                let lang = sub_parts[0];
                let rest = sub_parts[1];
                if lang == "pt" {
                    return format!("config/musicas/{}", rest);
                } else {
                    return format!("{}/config/musicas/{}", lang.to_uppercase(), rest);
                }
            }
        }
    } else if url.contains("/file/images/") {
        let parts: Vec<&str> = url.split("/file/images/").collect();
        if parts.len() == 2 {
            return format!("config/imagens/{}", parts[1]);
        }
    }
    url.to_string()
}

pub fn build_degraded_plan<F>(
    conn: &Connection,
    summary: ContentSyncSummary,
    file_exists: F,
) -> Result<ContentSyncPlan, AppError>
where
    F: Fn(&str) -> bool,
{
    let mut items = Vec::new();

    // When the remote version is newer, include a FullSyncFallback marker to signal
    // that a full API sync is also needed (new hymns may have been added remotely).
    // This is a MARKER ONLY — the executor processes it as a single skip and continues.
    if summary.has_updates && summary.remote_version > summary.current_version {
        items.push(ContentSyncPlanItem {
            id: "fallback-full-sync".to_string(),
            entity_type: "system".to_string(),
            remote_id: None,
            local_id: None,
            action: ContentSyncPlanItemAction::FullSyncFallback,
            status: ContentSyncPlanItemStatus::Pending,
            reason: Some(
                "Remote version is newer — a full API sync is also needed to get new content.".to_string(),
            ),
            remote_path: None,
            label: Some("Full Database Sync Required".to_string()),
        });
    }

    // Always scan for and repair missing local media files — regardless of version.
    // This ensures FTP downloads run even when there is a version mismatch.
    let hymns = conn
        .prepare("SELECT id, api_music_id, audio_path, playback_path, cover_path, album, title FROM hymns")?
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                ContentSyncLocalMediaPaths {
                    entity_type: "hymn".to_string(),
                    local_id: row.get(0)?,
                    audio_path: row.get(2)?,
                    playback_path: row.get(3)?,
                    cover_path: row.get(4)?,
                    album: row.get(5)?,
                    language: None,
                },
                row.get::<_, String>(6)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for (local_id, remote_id, media, name) in hymns {
        if media_paths_missing(&media, &file_exists) {
            let mut missing_parts = Vec::new();
            if let Some(ref p) = media.audio_path { if !file_exists(p) { missing_parts.push("audio"); } }
            if let Some(ref p) = media.playback_path { if !file_exists(p) { missing_parts.push("playback"); } }
            if let Some(ref p) = media.cover_path { if !file_exists(p) { missing_parts.push("cover"); } }

            items.push(ContentSyncPlanItem {
                id: format!("repair-hymn-{}", local_id),
                entity_type: "hymn".to_string(),
                remote_id,
                local_id: Some(local_id),
                action: ContentSyncPlanItemAction::RepairMedia,
                status: ContentSyncPlanItemStatus::Pending,
                reason: Some(format!("Missing: {}", missing_parts.join(", "))),
                remote_path: None,
                label: Some(name),
            });
        }
    }

    let albums = conn
        .prepare("SELECT id, api_album_id, cover_path, name FROM collections")?
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                ContentSyncLocalMediaPaths {
                    entity_type: "album".to_string(),
                    local_id: row.get(0)?,
                    audio_path: None,
                    playback_path: None,
                    cover_path: row.get(2)?,
                    album: row.get(3)?,
                    language: None,
                },
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for (local_id, remote_id, media, name) in albums {
        if media_paths_missing(&media, &file_exists) {
            items.push(ContentSyncPlanItem {
                id: format!("repair-album-{}", local_id),
                entity_type: "album".to_string(),
                remote_id,
                local_id: Some(local_id),
                action: ContentSyncPlanItemAction::RepairMedia,
                status: ContentSyncPlanItemStatus::Pending,
                reason: Some("Missing: cover image".to_string()),
                remote_path: None,
                label: Some(name),
            });
        }
    }

    Ok(ContentSyncPlan {
        mode: if summary.has_updates {
            ContentSyncRunMode::Full
        } else {
            ContentSyncRunMode::Selective
        },
        summary,
        items,
    })
}

pub fn plan_requires_full_sync_fallback(plan: &ContentSyncPlan) -> bool {
    plan.items
        .iter()
        .any(|item| matches!(item.action, ContentSyncPlanItemAction::FullSyncFallback))
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default();

    seconds.to_string()
}

pub fn build_manifest_plan<F>(
    conn: &Connection,
    remote_version: Option<i64>,
    hymns: &[ContentSyncRemoteEntityInput],
    albums: &[ContentSyncRemoteEntityInput],
    file_exists: F,
) -> Result<ContentSyncPlan, AppError>
where
    F: Fn(&str) -> bool,
{
    let sync_state = hydrated_sync_state(conn)?;
    let local_entities = content_sync::list_content_sync_entities(conn, None)?;
    let local_by_key = local_entities
        .iter()
        .cloned()
        .map(|entity| ((entity.entity_type.clone(), entity.remote_id), entity))
        .collect::<HashMap<EntityKey, _>>();

    let mut items = Vec::new();

    for hymn in hymns {
        if let Some(item) = classify_hymn_plan_item(conn, hymn, &local_by_key, &file_exists)? {
            items.push(item);
        }
    }

    for album in albums {
        if let Some(item) = classify_album_plan_item(conn, album, &local_by_key, &file_exists)? {
            items.push(item);
        }
    }

    persist_remote_manifest(conn, hymns, &local_by_key)?;
    persist_remote_manifest(conn, albums, &local_by_key)?;

    let current_version = sync_state.as_ref().and_then(|state| state.content_version);
    let changed_hymn_count = items
        .iter()
        .filter(|item| item.entity_type == "hymn")
        .count() as i32;
    let changed_album_count = items
        .iter()
        .filter(|item| item.entity_type == "album")
        .count() as i32;
    let missing_asset_count = items
        .iter()
        .filter(|item| matches!(item.action, ContentSyncPlanItemAction::RepairMedia))
        .count() as i32;

    Ok(ContentSyncPlan {
        mode: ContentSyncRunMode::Selective,
        summary: ContentSyncSummary {
            mode: ContentSyncSummaryMode::Smart,
            current_version,
            remote_version,
            has_updates: !items.is_empty(),
            changed_hymn_count,
            changed_album_count,
            missing_asset_count,
            fallback_action: None,
            last_checked_at: sync_state.as_ref().and_then(|state| state.last_checked_at.clone()),
            last_synced_at: sync_state.as_ref().and_then(|state| state.last_synced_at.clone()),
            last_sync_status: sync_state
                .as_ref()
                .and_then(|state| state.last_sync_status.clone()),
            last_error: sync_state.as_ref().and_then(|state| state.last_error.clone()),
        },
        items,
    })
}

pub fn load_report(conn: &Connection, run_id: &str) -> Result<Option<ContentSyncReport>, AppError> {
    Ok(content_sync::get_content_sync_run(conn, run_id)?.map(ContentSyncReport::from_run))
}

pub fn baseline_degraded_summary(
    remote_version: Option<i64>,
    state: Option<ContentSyncState>,
) -> ContentSyncSummary {
    let current_version = state.as_ref().and_then(|value| value.content_version);
    let has_updates = match (current_version, remote_version) {
        (Some(local), Some(remote)) => remote > local,
        (None, Some(_)) => true,
        _ => false,
    };

    ContentSyncSummary {
        mode: ContentSyncSummaryMode::Degraded,
        current_version,
        remote_version,
        has_updates,
        changed_hymn_count: 0,
        changed_album_count: 0,
        missing_asset_count: 0,
        fallback_action: Some(ContentSyncFallbackAction::StartFullSync),
        last_checked_at: state.as_ref().and_then(|value| value.last_checked_at.clone()),
        last_synced_at: state.as_ref().and_then(|value| value.last_synced_at.clone()),
        last_sync_status: state
            .as_ref()
            .and_then(|value| value.last_sync_status.clone()),
        last_error: state.as_ref().and_then(|value| value.last_error.clone()),
    }
}

fn classify_hymn_plan_item<F>(
    conn: &Connection,
    remote: &ContentSyncRemoteEntityInput,
    local_by_key: &HashMap<EntityKey, crate::db::models::ContentSyncEntity>,
    file_exists: &F,
) -> Result<Option<ContentSyncPlanItem>, AppError>
where
    F: Fn(&str) -> bool,
{
    let local = local_by_key.get(&(remote.entity_type.clone(), remote.remote_id));

    if remote.deleted {
        return Ok(Some(plan_item(
            remote,
            local.and_then(|entity| entity.local_id),
            ContentSyncPlanItemAction::DeleteRemoteManagedHymn,
            "Remote hymn no longer exists in the manifest.",
        )));
    }

    if local.is_none() || local.and_then(|entity| entity.local_id).is_none() {
        return Ok(Some(plan_item(
            remote,
            None,
            ContentSyncPlanItemAction::CreateHymn,
            "Remote hymn is missing locally.",
        )));
    }

    let local = local.expect("checked above");
    let media_missing = local_media_missing(conn, "hymn", local.local_id, file_exists)?;
    let content_changed = remote.remote_version != local.remote_version
        || remote.content_hash != local.content_hash
        || remote.lyrics_hash != local.lyrics_hash
        || remote.updated_at != local.updated_at;
    let media_changed = remote.image_version != local.image_version
        || remote.audio_version != local.audio_version
        || remote.playback_version != local.playback_version;

    if media_missing {
        return Ok(Some(plan_item(
            remote,
            local.local_id,
            ContentSyncPlanItemAction::RepairMedia,
            "Managed hymn media is missing locally.",
        )));
    }

    if media_changed && !content_changed {
        return Ok(Some(plan_item(
            remote,
            local.local_id,
            ContentSyncPlanItemAction::RepairMedia,
            "Managed hymn media version changed remotely.",
        )));
    }

    if content_changed || media_changed {
        return Ok(Some(plan_item(
            remote,
            local.local_id,
            ContentSyncPlanItemAction::UpdateHymn,
            "Remote hymn metadata changed.",
        )));
    }

    Ok(None)
}

fn classify_album_plan_item<F>(
    conn: &Connection,
    remote: &ContentSyncRemoteEntityInput,
    local_by_key: &HashMap<EntityKey, crate::db::models::ContentSyncEntity>,
    file_exists: &F,
) -> Result<Option<ContentSyncPlanItem>, AppError>
where
    F: Fn(&str) -> bool,
{
    let local = local_by_key.get(&(remote.entity_type.clone(), remote.remote_id));

    if remote.deleted {
        return Ok(Some(plan_item(
            remote,
            local.and_then(|entity| entity.local_id),
            ContentSyncPlanItemAction::DeleteRemoteManagedAlbum,
            "Remote album no longer exists in the manifest.",
        )));
    }

    if local.is_none() || local.and_then(|entity| entity.local_id).is_none() {
        return Ok(Some(plan_item(
            remote,
            None,
            ContentSyncPlanItemAction::CreateAlbum,
            "Remote album is missing locally.",
        )));
    }

    let local = local.expect("checked above");
    let media_missing = local_media_missing(conn, "album", local.local_id, file_exists)?;
    let content_changed = remote.remote_version != local.remote_version
        || remote.content_hash != local.content_hash
        || remote.updated_at != local.updated_at;
    let media_changed = remote.image_version != local.image_version;

    if media_missing {
        return Ok(Some(plan_item(
            remote,
            local.local_id,
            ContentSyncPlanItemAction::RepairMedia,
            "Managed album cover is missing locally.",
        )));
    }

    if media_changed && !content_changed {
        return Ok(Some(plan_item(
            remote,
            local.local_id,
            ContentSyncPlanItemAction::RepairMedia,
            "Managed album cover version changed remotely.",
        )));
    }

    if content_changed || media_changed {
        return Ok(Some(plan_item(
            remote,
            local.local_id,
            ContentSyncPlanItemAction::UpdateAlbum,
            "Remote album metadata changed.",
        )));
    }

    Ok(None)
}

fn plan_item(
    remote: &ContentSyncRemoteEntityInput,
    local_id: Option<i64>,
    action: ContentSyncPlanItemAction,
    reason: &str,
) -> ContentSyncPlanItem {
    ContentSyncPlanItem {
        id: format!(
            "{}:{}:{:?}",
            remote.entity_type, remote.remote_id, action
        )
        .to_lowercase(),
        entity_type: remote.entity_type.clone(),
        remote_id: Some(remote.remote_id),
        local_id,
        action,
        status: ContentSyncPlanItemStatus::Pending,
        reason: Some(reason.to_string()),
        remote_path: None,
        label: None,
    }
}

fn persist_remote_manifest(
    conn: &Connection,
    remote_items: &[ContentSyncRemoteEntityInput],
    local_by_key: &HashMap<EntityKey, crate::db::models::ContentSyncEntity>,
) -> Result<(), AppError> {
    for remote in remote_items {
        let mut merged = remote.clone();
        if merged.local_id.is_none() {
            merged.local_id = local_by_key
                .get(&(merged.entity_type.clone(), merged.remote_id))
                .and_then(|entity| entity.local_id);
        }
        content_sync::upsert_remote_manifest_entity(conn, &merged)?;
    }
    Ok(())
}

fn local_media_missing<F>(
    conn: &Connection,
    entity_type: &str,
    local_id: Option<i64>,
    file_exists: &F,
) -> Result<bool, AppError>
where
    F: Fn(&str) -> bool,
{
    let Some(local_id) = local_id else {
        return Ok(false);
    };

    let media = match entity_type {
        "hymn" => content_sync::get_hymn_media_paths(conn, local_id)?,
        "album" => content_sync::get_album_media_paths(conn, local_id)?,
        _ => None,
    };

    Ok(media
        .as_ref()
        .is_some_and(|media| media_paths_missing(media, file_exists)))
}

fn media_paths_missing<F>(media: &ContentSyncLocalMediaPaths, file_exists: &F) -> bool
where
    F: Fn(&str) -> bool,
{
    [
        media.audio_path.as_deref(),
        media.playback_path.as_deref(),
        media.cover_path.as_deref(),
    ]
    .into_iter()
    .flatten()
    .any(|path| !file_exists(path))
}

#[cfg(test)]
mod tests {
    use super::{
        baseline_degraded_summary, begin_runtime_run, build_degraded_plan, build_manifest_plan,
        finalize_runtime_run, initial_progress, mark_run_cancelled, new_run_id,
        update_runtime_progress, ContentSyncRunState, ContentSyncRuntimeState,
    };
    use crate::db::models::{
        ContentSyncEntity, ContentSyncPlanItemAction, ContentSyncRemoteEntityInput,
        ContentSyncRunStatus, ContentSyncSummaryMode,
    };
    use crate::db::queries::content_sync;
    use rusqlite::Connection;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    fn setup_planner_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            r#"
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE content_sync_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                content_version INTEGER,
                last_checked_at TEXT,
                last_synced_at TEXT,
                last_sync_status TEXT,
                last_error TEXT
            );
            CREATE TABLE content_sync_entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                remote_id INTEGER NOT NULL,
                local_id INTEGER,
                remote_version INTEGER,
                content_hash TEXT,
                lyrics_hash TEXT,
                image_version TEXT,
                audio_version TEXT,
                playback_version TEXT,
                updated_at TEXT,
                deleted INTEGER NOT NULL DEFAULT 0,
                last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_local_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(entity_type, remote_id)
            );
            CREATE TABLE content_sync_runs (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                status TEXT NOT NULL,
                requested_version INTEGER,
                completed_version INTEGER,
                planned_changes_json TEXT,
                result_json TEXT,
                error_json TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                finished_at TEXT
            );
            CREATE TABLE hymns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_music_id INTEGER,
                audio_path TEXT,
                playback_path TEXT,
                cover_path TEXT,
                album TEXT,
                title TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_album_id INTEGER,
                cover_path TEXT,
                name TEXT NOT NULL DEFAULT ''
            );
            "#,
        )
        .expect("planner schema");
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('api.dbVersion', '10')",
            [],
        )
        .expect("seed version");
        conn
    }

    fn remote_entity(entity_type: &str, remote_id: i64) -> ContentSyncRemoteEntityInput {
        ContentSyncRemoteEntityInput {
            entity_type: entity_type.to_string(),
            remote_id,
            local_id: None,
            remote_version: Some(1),
            content_hash: Some(format!("hash-{remote_id}")),
            lyrics_hash: Some(format!("lyrics-{remote_id}")),
            image_version: Some("1".to_string()),
            audio_version: Some("1".to_string()),
            playback_version: Some("1".to_string()),
            updated_at: Some("2026-03-08T12:00:00Z".to_string()),
            deleted: false,
        }
    }

    fn local_entity(
        entity_type: &str,
        remote_id: i64,
        local_id: i64,
        image_version: &str,
    ) -> ContentSyncEntity {
        ContentSyncEntity {
            id: remote_id,
            entity_type: entity_type.to_string(),
            remote_id,
            local_id: Some(local_id),
            remote_version: Some(1),
            content_hash: Some(format!("hash-{remote_id}")),
            lyrics_hash: Some(format!("lyrics-{remote_id}")),
            image_version: Some(image_version.to_string()),
            audio_version: Some("1".to_string()),
            playback_version: Some("1".to_string()),
            updated_at: Some("2026-03-08T12:00:00Z".to_string()),
            deleted: false,
            last_seen_at: "2026-03-08T12:00:00Z".to_string(),
            created_at: "2026-03-08T12:00:00Z".to_string(),
            updated_local_at: "2026-03-08T12:00:00Z".to_string(),
        }
    }

    #[test]
    fn degraded_summary_keeps_full_sync_fallback() {
        let summary = baseline_degraded_summary(None, None);

        assert_eq!(summary.mode, ContentSyncSummaryMode::Degraded);
        assert_eq!(summary.remote_version, None);
        assert!(summary.fallback_action.is_some());
    }

    #[test]
    fn planner_classifies_new_remote_hymn() {
        let conn = setup_planner_db();
        let hymn = remote_entity("hymn", 101);

        let plan = build_manifest_plan(&conn, Some(11), &[hymn], &[], |_| true)
            .expect("manifest plan");

        assert_eq!(plan.summary.mode, ContentSyncSummaryMode::Smart);
        assert_eq!(plan.summary.changed_hymn_count, 1);
        assert_eq!(plan.items.len(), 1);
        assert_eq!(plan.items[0].action, ContentSyncPlanItemAction::CreateHymn);
    }

    #[test]
    fn planner_classifies_hymn_image_only_change_as_media_repair() {
        let conn = setup_planner_db();
        conn.execute(
            "INSERT INTO hymns (id, cover_path) VALUES (?1, ?2)",
            rusqlite::params![1_i64, "cover.jpg"],
        )
        .expect("seed hymn");
        content_sync::upsert_content_sync_entity(
            &conn,
            &local_entity("hymn", 101, 1, "1"),
        )
        .expect("seed sync entity");

        let mut hymn = remote_entity("hymn", 101);
        hymn.local_id = Some(1);
        hymn.image_version = Some("2".to_string());

        let plan = build_manifest_plan(&conn, Some(11), &[hymn], &[], |_| true)
            .expect("manifest plan");

        assert_eq!(plan.items.len(), 1);
        assert_eq!(plan.items[0].action, ContentSyncPlanItemAction::RepairMedia);
    }

    #[test]
    fn planner_classifies_deleted_api_album() {
        let conn = setup_planner_db();
        conn.execute(
            "INSERT INTO collections (id, cover_path) VALUES (?1, ?2)",
            rusqlite::params![2_i64, "album-cover.jpg"],
        )
        .expect("seed collection");
        content_sync::upsert_content_sync_entity(
            &conn,
            &local_entity("album", 55, 2, "1"),
        )
        .expect("seed album sync entity");

        let mut album = remote_entity("album", 55);
        album.local_id = Some(2);
        album.deleted = true;

        let plan = build_manifest_plan(&conn, Some(11), &[], &[album], |_| true)
            .expect("manifest plan");

        assert_eq!(plan.items.len(), 1);
        assert_eq!(
            plan.items[0].action,
            ContentSyncPlanItemAction::DeleteRemoteManagedAlbum
        );
    }

    #[test]
    fn planner_classifies_missing_local_media_file() {
        let conn = setup_planner_db();
        conn.execute(
            "INSERT INTO hymns (id, audio_path, playback_path, cover_path) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![1_i64, "missing-audio.mp3", "playback.mp3", "cover.jpg"],
        )
        .expect("seed hymn with media");
        content_sync::upsert_content_sync_entity(
            &conn,
            &local_entity("hymn", 101, 1, "1"),
        )
        .expect("seed sync entity");

        let mut hymn = remote_entity("hymn", 101);
        hymn.local_id = Some(1);

        let plan = build_manifest_plan(&conn, Some(11), &[hymn], &[], |path| path != "missing-audio.mp3")
            .expect("manifest plan");

        assert_eq!(plan.items.len(), 1);
        assert_eq!(plan.summary.missing_asset_count, 1);
        assert_eq!(plan.items[0].action, ContentSyncPlanItemAction::RepairMedia);
    }

    #[test]
    fn planner_returns_degraded_full_sync_fallback_when_manifest_is_unavailable() {
        let conn = setup_planner_db();
        let plan = build_degraded_plan(
            &conn,
            baseline_degraded_summary(
                Some(11),
                Some(crate::db::models::ContentSyncState {
                    id: 1,
                    content_version: Some(10),
                    last_checked_at: None,
                    last_synced_at: None,
                    last_sync_status: None,
                    last_error: None,
                }),
            ),
            |_| true,
        )
        .unwrap();

        assert_eq!(plan.summary.mode, ContentSyncSummaryMode::Degraded);
        assert_eq!(plan.items.len(), 1);
        assert_eq!(
            plan.items[0].action,
            ContentSyncPlanItemAction::FullSyncFallback
        );
    }

    #[test]
    fn degraded_plan_with_version_mismatch_still_repairs_missing_local_files() {
        let conn = setup_planner_db();

        // Seed a hymn with missing audio
        conn.execute(
            "INSERT INTO hymns (id, audio_path, playback_path, cover_path) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![1_i64, "media/audio/1/song.mp3", "media/playback/1/pb.mp3", "media/images/1/cover.jpg"],
        )
        .expect("seed hymn");

        // Version mismatch: remote=11, local=10
        let summary = baseline_degraded_summary(
            Some(11),
            Some(crate::db::models::ContentSyncState {
                id: 1,
                content_version: Some(10),
                last_checked_at: None,
                last_synced_at: None,
                last_sync_status: None,
                last_error: None,
            }),
        );

        // file_exists returns false for everything (missing files)
        let plan = build_degraded_plan(&conn, summary, |_| false).unwrap();

        // Must have FullSyncFallback marker AND RepairMedia items
        let has_fallback = plan.items.iter().any(|i| matches!(i.action, ContentSyncPlanItemAction::FullSyncFallback));
        let has_repair = plan.items.iter().any(|i| matches!(i.action, ContentSyncPlanItemAction::RepairMedia));

        assert!(has_fallback, "FullSyncFallback marker must still be present on version mismatch");
        assert!(has_repair, "RepairMedia items must be emitted even on version mismatch — this was the bug");
        assert!(plan.items.len() >= 2, "Plan must contain at least the fallback marker + one repair item");
    }

    #[test]
    fn runtime_creates_sync_run_record() {
        let conn = setup_planner_db();
        let run_id = new_run_id();
        let plan = build_degraded_plan(&conn, baseline_degraded_summary(Some(11), None), |_| true).unwrap();

        let run = begin_runtime_run(&conn, &run_id, &plan).expect("create run");

        assert_eq!(run.id, run_id);
        assert_eq!(run.status, ContentSyncRunStatus::Pending);
        assert!(content_sync::get_content_sync_run(&conn, &run_id)
            .expect("load run")
            .is_some());
    }

    #[test]
    fn runtime_updates_progress_state() {
        let conn = setup_planner_db();
        let run_id = new_run_id();
        let plan = build_degraded_plan(&conn, baseline_degraded_summary(Some(11), None), |_| true).unwrap();
        let progress = initial_progress(&run_id, &plan);
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let mut runtime_state = ContentSyncRuntimeState::default();
        runtime_state.runs.insert(
            run_id.clone(),
            ContentSyncRunState {
                progress,
                report: None,
                cancel_flag,
            },
        );

        let updated = update_runtime_progress(
            &mut runtime_state,
            &run_id,
            "executing",
            ContentSyncRunStatus::Running,
            42.0,
            Some("Processing planner item.".to_string()),
            1,
        )
        .expect("updated progress");

        assert_eq!(updated.step, "executing");
        assert_eq!(updated.status, ContentSyncRunStatus::Running);
        assert_eq!(updated.percent, 42.0);
        assert_eq!(updated.items_processed, 1);
    }

    #[test]
    fn runtime_persists_completed_report() {
        let conn = setup_planner_db();
        let run_id = new_run_id();
        let plan = build_degraded_plan(&conn, baseline_degraded_summary(Some(11), None), |_| true).unwrap();
        begin_runtime_run(&conn, &run_id, &plan).expect("create run");

        let report = finalize_runtime_run(
            &conn,
            &run_id,
            &plan,
            ContentSyncRunStatus::Completed,
            0,
            1,
            0,
            Some("Fallback persisted.".to_string()),
        )
        .expect("persist report");

        assert_eq!(report.run_id, run_id);
        assert_eq!(report.status, ContentSyncRunStatus::Completed);
        assert!(report.fallback_used);
        assert_eq!(report.skipped_count, 1);
    }

    #[test]
    fn runtime_cancellation_moves_run_to_cancelled_terminal_state() {
        let conn = setup_planner_db();
        let run_id = new_run_id();
        let plan = build_degraded_plan(&conn, baseline_degraded_summary(Some(11), None), |_| true).unwrap();
        begin_runtime_run(&conn, &run_id, &plan).expect("create run");

        let cancel_flag = Arc::new(AtomicBool::new(false));
        mark_run_cancelled(&cancel_flag);
        assert!(super::is_run_cancelled(&cancel_flag));

        let report = finalize_runtime_run(
            &conn,
            &run_id,
            &plan,
            ContentSyncRunStatus::Cancelled,
            0,
            1,
            0,
            Some("Cancelled by operator.".to_string()),
        )
        .expect("persist cancelled report");

        assert_eq!(report.status, ContentSyncRunStatus::Cancelled);
    }
}
