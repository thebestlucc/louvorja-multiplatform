# CDN Pack Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver media assets (audio, playback, covers) to LouvorJA Tauri installations via Cloudflare R2 CDN packs, replacing FTP dependency with a manifest-driven download system.

**Architecture:** Two independent components sharing a manifest JSON contract. (1) Admin Panel — a Next.js app for creating/editing media packs and uploading to R2. (2) Tauri App — on startup fetches manifest from CDN, shows a plan dialog, downloads packs on user confirmation, extracts files, updates DB paths. Full spec: `docs/superpowers/specs/2026-03-20-cdn-pack-sync-design.md`.

**Tech Stack:** Next.js 14 (App Router), shadcn/ui, @aws-sdk/client-s3, archiver, busboy | Tauri 2, Rust, rusqlite, reqwest, sha2, zip

---

## Phase 1 — Shared Manifest Schema (Rust)

### Task 1: Update manifest structs to match new CDN pack schema

**Files:**
- Modify: `src-tauri/src/content_sync/manifest.rs`

The current file has `ManifestPack` (with `hymn_ids: Vec<i64>`, `sha256: Option<String>`), `ManifestUpdate`, and `ContentManifest`. Replace all three structs with the new schema that includes per-file metadata.

- [ ] **Step 1: Write failing test for new manifest schema**

In `src-tauri/src/content_sync/manifest.rs`, replace the existing `parse_manifest_with_packs_and_updates` test:

```rust
#[test]
fn parse_manifest_with_pack_files() {
    let json = r#"{
        "manifestVersion": 42,
        "generatedAt": "2026-03-20T15:00:00Z",
        "packs": [
            {
                "id": "hymnal-pt-001",
                "url": "https://pub-xxx.r2.dev/packs/hymnal-pt-001-v3.zip",
                "version": 3,
                "size": 456000000,
                "sha256": "e3b0c44298fc1c149afb",
                "files": [
                    {
                        "path": "media/audio/123/hino123.mp3",
                        "hymnApiId": 123,
                        "albumApiId": null,
                        "type": "audio",
                        "size": 5200000
                    },
                    {
                        "path": "media/images/456/album456.jpg",
                        "hymnApiId": null,
                        "albumApiId": 456,
                        "type": "album_cover",
                        "size": 120000
                    }
                ]
            }
        ]
    }"#;
    let manifest: ContentManifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.manifest_version, 42);
    assert_eq!(manifest.generated_at.as_deref(), Some("2026-03-20T15:00:00Z"));
    assert_eq!(manifest.packs.len(), 1);
    let pack = &manifest.packs[0];
    assert_eq!(pack.id, "hymnal-pt-001");
    assert_eq!(pack.version, 3);
    assert_eq!(pack.sha256, "e3b0c44298fc1c149afb");
    assert_eq!(pack.files.len(), 2);
    assert_eq!(pack.files[0].path, "media/audio/123/hino123.mp3");
    assert_eq!(pack.files[0].hymn_api_id, Some(123));
    assert_eq!(pack.files[0].album_api_id, None);
    assert_eq!(pack.files[0].file_type, "audio");
    assert_eq!(pack.files[1].album_api_id, Some(456));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib content_sync::manifest::tests::parse_manifest_with_pack_files`
Expected: FAIL — struct fields don't exist yet.

- [ ] **Step 3: Replace structs with new schema**

Replace the three structs in `src-tauri/src/content_sync/manifest.rs`:

```rust
use serde::Deserialize;
use crate::error::AppError;

const MAX_MANIFEST_BYTES: usize = 1 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    pub path: String,
    pub hymn_api_id: Option<i64>,
    pub album_api_id: Option<i64>,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPack {
    pub id: String,
    pub url: String,
    pub version: u32,
    pub size: u64,
    pub sha256: String,
    pub files: Vec<ManifestFile>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentManifest {
    pub manifest_version: i64,
    pub generated_at: Option<String>,
    #[serde(default)]
    pub packs: Vec<ManifestPack>,
}
```

Keep `fetch_manifest()` unchanged — its return type `ContentManifest` already matches.

- [ ] **Step 4: Update remaining tests**

Replace `parse_manifest_minimal_fields` and `parse_manifest_update_with_all_optional_fields_absent` tests. Remove `parse_manifest_with_packs_and_updates` (replaced in step 1). Add:

```rust
#[test]
fn parse_manifest_minimal() {
    let json = r#"{"manifestVersion": 1}"#;
    let manifest: ContentManifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.manifest_version, 1);
    assert!(manifest.generated_at.is_none());
    assert!(manifest.packs.is_empty());
}

#[test]
fn parse_manifest_empty_packs() {
    let json = r#"{"manifestVersion": 1, "packs": []}"#;
    let manifest: ContentManifest = serde_json::from_str(json).unwrap();
    assert!(manifest.packs.is_empty());
}
```

- [ ] **Step 5: Run all manifest tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib content_sync::manifest`
Expected: ALL PASS

- [ ] **Step 6: Fix compilation errors in files that import old structs**

The `commands/content_sync.rs` file references `ManifestUpdate` in some unused imports and `ManifestPack`'s old field `hymn_ids`. Search for any compilation errors:

Run: `cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -50`

Fix any errors — likely need to remove references to `ManifestUpdate` and `hymn_ids` in snapshot-related code that uses the old schema. These are in `content_sync/snapshot.rs` and `commands/content_sync.rs`. The snapshot module uses its own `SnapshotManifest` type, not `ContentManifest`, so changes should be limited to import cleanup.

- [ ] **Step 7: Verify full build**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles (warnings for dead code are OK).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/content_sync/manifest.rs
git commit -m "feat(sync): update manifest schema for CDN pack delivery"
```

---

## Phase 2 — Tauri Backend: Migration, Queries, and Pack Sync Commands

### Task 2: Add migrate_v34 — extracted_version and db_version columns

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

**Context:** The existing `content_sync_packs` table (created in `migrate_v33`, line ~1285) has `pack_id TEXT PRIMARY KEY, local_version INTEGER, extracted_at TEXT`. We add two columns and deprecate `local_version`.

- [ ] **Step 1: Add migrate_v34 function**

At the end of `run_migrations()` (after the `current_version < 33` block, line ~1300), add:

```rust
if current_version < 34 {
    migrate_v34(conn)?;
    conn.execute("INSERT INTO schema_version (version) VALUES (34)", [])?;
}
```

Then add the function:

```rust
fn migrate_v34(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(conn, "content_sync_packs", "extracted_version", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "content_sync_packs", "db_version", "INTEGER NOT NULL DEFAULT 0")?;
    Ok(())
}
```

- [ ] **Step 2: Run build to verify migration compiles**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/migrations.rs
git commit -m "feat(sync): add migrate_v34 — extracted_version and db_version for pack sync"
```

### Task 3: Add pack sync queries

**Files:**
- Modify: `src-tauri/src/db/queries/content_sync.rs`

- [ ] **Step 1: Write failing tests for new query functions**

Add to the existing `tests` module in `content_sync.rs`:

```rust
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib db::queries::content_sync::tests`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement query functions**

Add after `set_pack_local_version` (line ~546):

```rust
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib db::queries::content_sync::tests`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries/content_sync.rs
git commit -m "feat(sync): add pack sync queries — extracted_version, db_version, path updates"
```

### Task 4: Add build.rs CDN_MANIFEST_URL env var support

**Files:**
- Modify: `src-tauri/build.rs`

- [ ] **Step 1: Update build.rs**

```rust
fn main() {
    // CDN_MANIFEST_URL: passed at build time, read in Rust via env!("CDN_MANIFEST_URL")
    // In dev: read from .env file at repo root. In CI: set as GitHub Actions secret.
    if let Ok(url) = std::env::var("CDN_MANIFEST_URL") {
        println!("cargo:rustc-env=CDN_MANIFEST_URL={}", url);
    } else {
        // Fallback for dev when .env is missing — feature is silently disabled
        println!("cargo:rustc-env=CDN_MANIFEST_URL=");
    }

    tauri_build::build()
}
```

- [ ] **Step 2: Add .env to repo root (gitignored)**

Create `.env.example` at repo root:
```
CDN_MANIFEST_URL=https://pub-xxx.r2.dev/manifest.json
```

Verify `.env` is in `.gitignore`. If not, add it.

- [ ] **Step 3: Verify build with env var**

Run: `CDN_MANIFEST_URL=https://example.com/manifest.json cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/build.rs .env.example
git commit -m "feat(sync): add CDN_MANIFEST_URL build-time env var support"
```

### Task 5: Implement pack_sync module — plan and execute logic

**Files:**
- Create: `src-tauri/src/pack_sync/mod.rs`
- Create: `src-tauri/src/pack_sync/planner.rs`
- Create: `src-tauri/src/pack_sync/executor.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod pack_sync;`)

**Context:** This module handles: (1) fetching the CDN manifest, (2) comparing against local state to build a plan, (3) downloading/verifying/extracting packs, (4) updating DB paths. Reuses `content_sync::manifest::fetch_manifest` for fetching and `http_sync::downloader::download_file_http` for downloading.

- [ ] **Step 1: Create `pack_sync/mod.rs`**

```rust
pub mod planner;
pub mod executor;

use serde::{Deserialize, Serialize};

/// The CDN manifest URL, baked at compile time.
/// Empty string means pack sync is disabled (e.g. dev without .env).
pub const CDN_MANIFEST_URL: &str = env!("CDN_MANIFEST_URL");

pub fn is_pack_sync_enabled() -> bool {
    !CDN_MANIFEST_URL.is_empty()
}
```

- [ ] **Step 2: Create `pack_sync/planner.rs`**

```rust
use crate::content_sync::manifest::{ContentManifest, ManifestPack, ManifestFile};
use crate::db::queries::content_sync;
use crate::error::AppError;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncPlanItem {
    pub pack_id: String,
    pub pack_url: String,
    pub pack_version: u32,
    pub pack_size: u64,
    pub pack_sha256: String,
    pub local_extracted_version: u32,
    pub local_db_version: u32,
    pub needs_download: bool,
    pub needs_db_update: bool,
    pub file_count: usize,
    pub files: Vec<PackSyncFileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncFileItem {
    pub path: String,
    pub hymn_api_id: Option<i64>,
    pub album_api_id: Option<i64>,
    pub file_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncPlan {
    pub manifest_version: i64,
    pub items: Vec<PackSyncPlanItem>,
    pub total_download_size: u64,
    pub total_download_count: usize,
}

/// Build a plan by comparing the remote manifest against local pack state.
/// If manifest_version matches what's stored locally, returns an empty plan.
pub fn build_plan(
    conn: &Connection,
    manifest: &ContentManifest,
    stored_manifest_version: i64,
) -> Result<PackSyncPlan, AppError> {
    if manifest.manifest_version == stored_manifest_version && stored_manifest_version > 0 {
        return Ok(PackSyncPlan {
            manifest_version: manifest.manifest_version,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
        });
    }

    let mut items = Vec::new();
    let mut total_download_size = 0u64;
    let mut total_download_count = 0usize;

    for pack in &manifest.packs {
        let extracted_version = content_sync::get_pack_extracted_version(conn, &pack.id)?;
        let db_version = content_sync::get_pack_db_version(conn, &pack.id)?;

        let needs_download = pack.version > extracted_version;
        let needs_db_update = pack.version > db_version;

        if !needs_download && !needs_db_update {
            continue;
        }

        if needs_download {
            total_download_size += pack.size;
            total_download_count += 1;
        }

        let files: Vec<PackSyncFileItem> = pack.files.iter().map(|f| PackSyncFileItem {
            path: f.path.clone(),
            hymn_api_id: f.hymn_api_id,
            album_api_id: f.album_api_id,
            file_type: f.file_type.clone(),
            size: f.size,
        }).collect();

        items.push(PackSyncPlanItem {
            pack_id: pack.id.clone(),
            pack_url: pack.url.clone(),
            pack_version: pack.version,
            pack_size: pack.size,
            pack_sha256: pack.sha256.clone(),
            local_extracted_version: extracted_version,
            local_db_version: db_version,
            needs_download,
            needs_db_update,
            file_count: files.len(),
            files,
        });
    }

    Ok(PackSyncPlan {
        manifest_version: manifest.manifest_version,
        items,
        total_download_size,
        total_download_count,
    })
}
```

- [ ] **Step 3: Create `pack_sync/executor.rs`**

```rust
use crate::content_sync::manifest::ContentManifest;
use crate::db::queries::{content_sync, settings};
use crate::error::AppError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use super::planner::{PackSyncPlan, PackSyncPlanItem};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncProgress {
    pub run_id: String,
    pub status: String, // "pending" | "running" | "completed" | "failed" | "cancelled"
    pub percent: f64,
    pub message: Option<String>,
    pub packs_total: usize,
    pub packs_processed: usize,
}

pub fn new_run_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn execute_pack_sync(
    app: AppHandle,
    run_id: String,
    cancel_flag: Arc<AtomicBool>,
) {
    let emit = |status: &str, percent: f64, message: &str, processed: usize, total: usize| {
        let _ = app.emit("pack-sync-progress", PackSyncProgress {
            run_id: run_id.clone(),
            status: status.to_string(),
            percent,
            message: Some(message.to_string()),
            packs_total: total,
            packs_processed: processed,
        });
    };

    emit("running", 0.0, "Fetching manifest…", 0, 0);

    // Fetch manifest
    let manifest_url = super::CDN_MANIFEST_URL;
    if manifest_url.is_empty() {
        emit("failed", 100.0, "CDN manifest URL not configured.", 0, 0);
        return;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_default();

    let manifest = match tauri::async_runtime::block_on(
        crate::content_sync::manifest::fetch_manifest(&client, manifest_url)
    ) {
        Ok(m) => m,
        Err(e) => {
            emit("failed", 100.0, &format!("Manifest fetch failed: {}", e), 0, 0);
            return;
        }
    };

    // Get DB connection
    let Some(state) = app.try_state::<AppState>() else {
        emit("failed", 100.0, "App state unavailable.", 0, 0);
        return;
    };
    let conn = match state.db.get() {
        Ok(c) => c,
        Err(e) => {
            emit("failed", 100.0, &format!("DB unavailable: {}", e), 0, 0);
            return;
        }
    };

    // Get stored manifest version
    let stored_version = settings::get_setting(&conn, "pack_sync.manifest_version")
        .ok()
        .and_then(|s| s.value.parse::<i64>().ok())
        .unwrap_or(0);

    // Build plan
    let plan = match super::planner::build_plan(&conn, &manifest, stored_version) {
        Ok(p) => p,
        Err(e) => {
            emit("failed", 100.0, &format!("Plan failed: {}", e), 0, 0);
            return;
        }
    };

    if plan.items.is_empty() {
        emit("completed", 100.0, "Already up to date.", 0, 0);
        let _ = settings::set_setting(&conn, "pack_sync.manifest_version",
            &manifest.manifest_version.to_string());
        return;
    }

    let total = plan.items.len();
    let app_data_dir = app.path().app_data_dir().unwrap_or_default();

    for (index, item) in plan.items.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            emit("cancelled", (index as f64 / total as f64) * 100.0,
                "Pack sync cancelled.", index, total);
            return;
        }

        let percent = ((index + 1) as f64 / total as f64) * 100.0;

        // Step 1: Download if needed
        if item.needs_download {
            emit("running", percent,
                &format!("Downloading pack {} ({}/{})…", item.pack_id, index + 1, total),
                index, total);

            let zip_path = app_data_dir.join(format!("pack_{}.zip.tmp", item.pack_id));

            let dl_result = tauri::async_runtime::block_on(
                crate::http_sync::downloader::download_file_http(
                    &client, &item.pack_url, &zip_path, Some(item.pack_size),
                )
            );

            match dl_result {
                Ok(crate::http_sync::downloader::DownloadResult::Downloaded) | Ok(crate::http_sync::downloader::DownloadResult::Skipped) => {}
                Err(e) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] Download failed for {}: {}", item.pack_id, e);
                    emit("running", percent,
                        &format!("Download failed for {}: {}", item.pack_id, e),
                        index + 1, total);
                    continue;
                }
            }

            // Step 2: Verify SHA-256
            emit("running", percent,
                &format!("Verifying pack {}…", item.pack_id), index, total);
            match verify_sha256(&zip_path, &item.pack_sha256) {
                Ok(true) => {}
                Ok(false) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] SHA-256 mismatch for {}", item.pack_id);
                    emit("running", percent,
                        &format!("SHA-256 mismatch for {}. Skipped.", item.pack_id),
                        index + 1, total);
                    continue;
                }
                Err(e) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] SHA-256 check failed for {}: {}", item.pack_id, e);
                    continue;
                }
            }

            // Step 3: Extract
            emit("running", percent,
                &format!("Extracting pack {}…", item.pack_id), index, total);
            match crate::http_sync::downloader::extract_zip_to(&zip_path, &app_data_dir) {
                Ok(_) => {
                    let _ = std::fs::remove_file(&zip_path);
                }
                Err(e) => {
                    let _ = std::fs::remove_file(&zip_path);
                    eprintln!("[pack-sync] Extract failed for {}: {}", item.pack_id, e);
                    continue;
                }
            }

            // Step 4: Mark extracted
            let _ = content_sync::set_pack_extracted_version(&conn, &item.pack_id, item.pack_version);
        }

        // Step 5: Update DB paths
        if item.needs_db_update {
            emit("running", percent,
                &format!("Updating database for pack {}…", item.pack_id), index, total);

            for file in &item.files {
                if let Some(hymn_api_id) = file.hymn_api_id {
                    let _ = content_sync::update_hymn_path_by_api_id(
                        &conn, hymn_api_id, &file.file_type, &file.path,
                    );
                }
                if let Some(album_api_id) = file.album_api_id {
                    let _ = content_sync::update_collection_cover_by_api_id(
                        &conn, album_api_id, &file.path,
                    );
                }
            }

            // Step 6: Mark DB updated
            let _ = content_sync::set_pack_db_version(&conn, &item.pack_id, item.pack_version);
        }
    }

    // Step 7: Store manifest version
    let _ = settings::set_setting(&conn, "pack_sync.manifest_version",
        &manifest.manifest_version.to_string());

    emit("completed", 100.0, "Pack sync complete.", total, total);
}

fn verify_sha256(path: &Path, expected: &str) -> Result<bool, AppError> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(AppError::Io)?;
    let mut hasher = sha2::Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(AppError::Io)?;
        if n == 0 { break; }
        use sha2::Digest;
        hasher.update(&buf[..n]);
    }
    use sha2::Digest;
    let result = format!("{:x}", hasher.finalize());
    Ok(result == expected)
}
```

**Note:** The `extract_zip_to` function needs to be made public from `http_sync::downloader`. Currently `extract_zip` is private. We'll expose a public wrapper.

- [ ] **Step 4: Expose extract_zip_to in downloader.rs**

In `src-tauri/src/http_sync/downloader.rs`, add after `extract_zip`:

```rust
/// Public wrapper for extracting a ZIP file to a destination directory.
/// Used by pack_sync executor after downloading a pack.
pub fn extract_zip_to(zip_path: &Path, dest_dir: &Path) -> Result<PackResult, AppError> {
    extract_zip(zip_path, dest_dir)
}
```

- [ ] **Step 5: Add sha2 dependency to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
sha2 = "0.10"
```

- [ ] **Step 6: Add `mod pack_sync;` to lib.rs**

In `src-tauri/src/lib.rs`, add after `mod http_sync;` (line 9):

```rust
mod pack_sync;
```

- [ ] **Step 7: Verify build**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/pack_sync/ src-tauri/src/http_sync/downloader.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(sync): add pack_sync module — planner, executor, SHA-256 verification"
```

### Task 6: Add pack sync Tauri commands

**Files:**
- Create: `src-tauri/src/commands/pack_sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (register commands in `collect_commands!`)
- Modify: `src-tauri/src/state.rs` (add pack sync runtime state to `AppState`)

- [ ] **Step 1: Add PackSyncRuntimeState to state.rs**

In `src-tauri/src/state.rs`, add the struct and add a field to `AppState`:

```rust
use crate::pack_sync::executor::PackSyncProgress;

#[derive(Default)]
pub struct PackSyncRuntimeState {
    pub active_run_id: Option<String>,
    pub cancel_flags: std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>,
}
```

Add to `AppState`:
```rust
pub pack_sync: Mutex<PackSyncRuntimeState>,
```

And initialize it in `AppState::new()` or wherever `AppState` is constructed in `lib.rs`.

- [ ] **Step 2: Create commands/pack_sync.rs**

```rust
use crate::error::AppError;
use crate::state::AppState;
use crate::pack_sync::{self, planner::PackSyncPlan, executor::PackSyncProgress};
use crate::utils::catcher::catcher;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub async fn plan_pack_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<PackSyncPlan, AppError> {
    if !pack_sync::is_pack_sync_enabled() {
        return Ok(PackSyncPlan {
            manifest_version: 0,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {}", e)))?;

    let manifest = crate::content_sync::manifest::fetch_manifest(
        &client, pack_sync::CDN_MANIFEST_URL,
    ).await?;

    let (conn, err) = catcher(state.db.get());
    if let Some(e) = err { return Err(e); }
    let conn = conn.unwrap();

    let stored_version = crate::db::queries::settings::get_setting(&conn, "pack_sync.manifest_version")
        .ok()
        .and_then(|s| s.value.parse::<i64>().ok())
        .unwrap_or(0);

    pack_sync::planner::build_plan(&conn, &manifest, stored_version)
}

#[tauri::command]
#[specta::specta]
pub fn start_pack_sync(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    if !pack_sync::is_pack_sync_enabled() {
        return Err(AppError::Internal("Pack sync is not configured.".into()));
    }

    let run_id = pack_sync::executor::new_run_id();
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let (runtime, err) = catcher(state.pack_sync.lock());
        if let Some(e) = err { return Err(e); }
        let mut runtime = runtime.unwrap();
        runtime.active_run_id = Some(run_id.clone());
        runtime.cancel_flags.insert(run_id.clone(), cancel_flag.clone());
    }

    let run_id_clone = run_id.clone();
    std::thread::spawn(move || {
        pack_sync::executor::execute_pack_sync(app, run_id_clone, cancel_flag);
    });

    Ok(run_id)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_pack_sync(
    run_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (runtime, err) = catcher(state.pack_sync.lock());
    if let Some(e) = err { return Err(e); }
    let runtime = runtime.unwrap();

    if let Some(flag) = runtime.cancel_flags.get(&run_id) {
        flag.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    Ok(())
}
```

- [ ] **Step 3: Add `pub mod pack_sync;` to commands/mod.rs**

- [ ] **Step 4: Register commands in lib.rs collect_commands!**

Add after the existing Content Sync commands (line ~88):

```rust
// Pack Sync (CDN)
commands::pack_sync::plan_pack_sync,
commands::pack_sync::start_pack_sync,
commands::pack_sync::cancel_pack_sync,
```

- [ ] **Step 5: Initialize PackSyncRuntimeState in lib.rs setup**

Where `AppState` is constructed (search for `app.manage(AppState {`), add:

```rust
pack_sync: Mutex::new(state::PackSyncRuntimeState::default()),
```

- [ ] **Step 6: Verify build and bindings regeneration**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles. Running `pnpm tauri dev` will regenerate `src/lib/bindings.ts` with the new commands.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/pack_sync.rs src-tauri/src/commands/mod.rs src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat(sync): add pack sync Tauri commands — plan, start, cancel"
```

---

## Phase 3 — Tauri Frontend: Plan Dialog, Startup Hook, Settings UI

### Task 7: Add frontend types and query hooks for pack sync

**Files:**
- Modify: `src/types/content-sync.ts`
- Modify: `src/lib/queries.ts`
- Modify: `src/stores/content-sync-store.ts`

- [ ] **Step 1: Add pack sync types**

In `src/types/content-sync.ts`, append:

```typescript
export interface PackSyncFileItem {
  path: string;
  hymnApiId: number | null;
  albumApiId: number | null;
  type: string;
  size: number;
}

export interface PackSyncPlanItem {
  packId: string;
  packUrl: string;
  packVersion: number;
  packSize: number;
  packSha256: string;
  localExtractedVersion: number;
  localDbVersion: number;
  needsDownload: boolean;
  needsDbUpdate: boolean;
  fileCount: number;
  files: PackSyncFileItem[];
}

export interface PackSyncPlan {
  manifestVersion: number;
  items: PackSyncPlanItem[];
  totalDownloadSize: number;
  totalDownloadCount: number;
}

export interface PackSyncProgress {
  runId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  percent: number;
  message: string | null;
  packsTotal: number;
  packsProcessed: number;
}
```

- [ ] **Step 2: Add query hooks**

In `src/lib/queries.ts`, add to the `queryKeys` object:

```typescript
packSync: {
  plan: ["packSync", "plan"] as const,
},
```

Add hooks:

```typescript
export function usePlanPackSync(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.packSync.plan,
    queryFn: () => invoke<PackSyncPlan>("plan_pack_sync"),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartPackSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => invoke<string>("start_pack_sync"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.packSync.plan });
    },
  });
}

export function useCancelPackSync() {
  return useMutation({
    mutationFn: (runId: string) => invoke<void>("cancel_pack_sync", { runId }),
  });
}
```

- [ ] **Step 3: Add pack sync state to store**

In `src/stores/content-sync-store.ts`, add pack sync fields:

```typescript
packSyncRunId: string | null;
packSyncProgress: PackSyncProgress | null;
packSyncPlanOpen: boolean;
setPackSyncRunId: (runId: string | null) => void;
setPackSyncProgress: (progress: PackSyncProgress | null) => void;
openPackSyncPlan: () => void;
closePackSyncPlan: () => void;
```

And the implementations in the `create` call:

```typescript
packSyncRunId: null,
packSyncProgress: null,
packSyncPlanOpen: false,
setPackSyncRunId: (runId) => set({ packSyncRunId: runId }),
setPackSyncProgress: (progress) => set({ packSyncProgress: progress }),
openPackSyncPlan: () => set({ packSyncPlanOpen: true }),
closePackSyncPlan: () => set({ packSyncPlanOpen: false }),
```

- [ ] **Step 4: Commit**

```bash
git add src/types/content-sync.ts src/lib/queries.ts src/stores/content-sync-store.ts
git commit -m "feat(sync): add pack sync frontend types, query hooks, and store"
```

### Task 8: Add Pack Sync plan dialog component

**Files:**
- Create: `src/components/content-sync/pack-sync-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

```tsx
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useTranslation } from "react-i18next";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { usePlanPackSync, useStartPackSync } from "../../lib/queries";
import { catcher } from "../../lib/catcher";
import { notify } from "../../lib/notify";
import type { PackSyncPlan } from "../../types/content-sync";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function PackSyncDialog() {
  const { t } = useTranslation();
  const open = useContentSyncStore((s) => s.packSyncPlanOpen);
  const close = useContentSyncStore((s) => s.closePackSyncPlan);
  const setRunId = useContentSyncStore((s) => s.setPackSyncRunId);
  const planQuery = usePlanPackSync({ enabled: open });
  const startMutation = useStartPackSync();
  const plan = planQuery.data;

  const handleStart = async () => {
    const [runId, error] = await catcher(startMutation.mutateAsync(), { notify: false });
    if (error) {
      notify.error(error.details ?? error.message);
      return;
    }
    if (runId) {
      setRunId(runId);
    }
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.packSync.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings.packSync.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {plan && plan.items.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label={t("settings.packSync.packsToDownload")} value={plan.totalDownloadCount} />
              <Metric label={t("settings.packSync.totalSize")} value={formatBytes(plan.totalDownloadSize)} />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              {plan.items.map((item) => (
                <div key={item.packId} className="flex items-center justify-between border-b border-border p-2 text-sm last:border-b-0">
                  <span className="font-medium">{item.packId}</span>
                  <span className="text-muted-foreground">
                    v{item.packVersion} · {item.fileCount} {t("settings.packSync.files")} · {formatBytes(item.packSize)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("settings.packSync.upToDate")}</p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={close}>
            {t("settings.packSync.later")}
          </Button>
          <Button
            onClick={() => void handleStart()}
            disabled={!plan || plan.items.length === 0 || startMutation.isPending}
          >
            {startMutation.isPending
              ? t("settings.packSync.starting")
              : t("settings.packSync.downloadAndApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-medium text-foreground">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content-sync/pack-sync-dialog.tsx
git commit -m "feat(sync): add PackSyncDialog component"
```

### Task 9: Wire pack sync into __root.tsx startup flow and status bar

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/layout/status-bar.tsx`

- [ ] **Step 1: Add startup pack sync check to __root.tsx**

Import the new components and hooks. After the existing `contentSyncPlanQuery` effect block (around line ~245), add a similar block for pack sync:

```tsx
import { PackSyncDialog } from "../components/content-sync/pack-sync-dialog";
import { usePlanPackSync } from "../lib/queries";
import type { PackSyncProgress } from "../types/content-sync";

// Inside the component, after the existing content sync hooks:
const packSyncPlanQuery = usePlanPackSync({ enabled: !isBareRoute });
const packSyncPlanShownRef = useRef(false);
const openPackSyncPlan = useContentSyncStore((s) => s.openPackSyncPlan);
const setPackSyncProgress = useContentSyncStore((s) => s.setPackSyncProgress);

// Effect: show pack sync dialog on startup if there are items
useEffect(() => {
  if (isBareRoute || packSyncPlanShownRef.current) return;
  const plan = packSyncPlanQuery.data;
  if (plan && plan.items.length > 0) {
    packSyncPlanShownRef.current = true;
    openPackSyncPlan();
  }
}, [packSyncPlanQuery.data, isBareRoute, openPackSyncPlan]);

// Effect: listen for pack-sync-progress events
useEffect(() => {
  if (isBareRoute) return;
  const unlisten = listen<PackSyncProgress>("pack-sync-progress", (event) => {
    setPackSyncProgress(event.payload);
  });
  return () => { void unlisten.then((fn) => fn()); };
}, [isBareRoute, setPackSyncProgress]);
```

In the JSX, render `<PackSyncDialog />` alongside the existing `<ContentSyncModal />`.

- [ ] **Step 2: Add empty-DB info dialog for manifest failure**

In the startup effect, check if `packSyncPlanQuery.isError` and hymns table is empty (use a lightweight query or check existing content sync summary). If so, show an info dialog instead of silently skipping.

This can be a simple `useEffect` that checks `packSyncPlanQuery.isError` and shows a toast via `sonner`:

```tsx
useEffect(() => {
  if (isBareRoute || !packSyncPlanQuery.isError) return;
  // Only show if this looks like a fresh install (no content sync summary data)
  const summary = contentSyncPlanQuery.data?.summary;
  if (!summary || (summary.changedHymnCount === 0 && !summary.lastSyncedAt)) {
    notify.info(t("settings.packSync.fetchFailedFirstInstall"));
  }
}, [packSyncPlanQuery.isError, isBareRoute]);
```

- [ ] **Step 3: Add pack sync indicator to status bar**

In `src/components/layout/status-bar.tsx`, add alongside the existing content sync indicator:

```tsx
const packSyncProgress = useContentSyncStore((s) => s.packSyncProgress);
const packSyncRunning = packSyncProgress
  && ["pending", "running"].includes(packSyncProgress.status);
```

Render a similar indicator near the existing one.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm vite build && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/__root.tsx src/components/layout/status-bar.tsx
git commit -m "feat(sync): wire pack sync into startup flow and status bar"
```

### Task 10: Add pack sync section to Settings → Synchronization

**Files:**
- Modify: `src/routes/settings/index.tsx`

- [ ] **Step 1: Add PackSyncSection below SyncSection**

In the `SyncSection` component, after the FTP browser `</section>` (line ~1162), add a new section for CDN pack sync:

```tsx
<section className="rounded-lg border border-border bg-card p-4">
  <div className="mb-4 flex items-center gap-2">
    <Package className="h-5 w-5 text-primary" />
    <h2 className="text-lg font-medium">{t("settings.packSync.title")}</h2>
  </div>
  <p className="mb-4 text-sm text-muted-foreground">
    {t("settings.packSync.description")}
  </p>
  <PackSyncSettingsCard />
</section>
```

Create a `PackSyncSettingsCard` inline component that:
- Shows current manifest version (from settings key `pack_sync.manifest_version`)
- Has a "Check Now" button that calls `planPackSync` refetch
- Shows progress when a run is active (from store)
- Follows the same pattern as `ContentSyncReportCard`

- [ ] **Step 2: Commit**

```bash
git add src/routes/settings/index.tsx
git commit -m "feat(sync): add pack sync section to Settings page"
```

### Task 11: Add i18n keys for pack sync

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`

- [ ] **Step 1: Add keys to all three locale files**

Under `settings`, add a `packSync` block to each:

**en.json:**
```json
"packSync": {
  "title": "CDN Pack Sync",
  "description": "Download media packs from CDN. Packs contain audio, playback, and cover files for hymns and albums.",
  "dialogTitle": "Content Packs Available",
  "dialogDescription": "New media packs are available for download.",
  "packsToDownload": "Packs to download",
  "totalSize": "Total download size",
  "files": "files",
  "upToDate": "All packs are up to date.",
  "later": "Later",
  "downloadAndApply": "Download & Apply",
  "starting": "Starting…",
  "checkNow": "Check Now",
  "checking": "Checking…",
  "statusBar": "Downloading packs ({{current}}/{{total}})",
  "fetchFailedFirstInstall": "Could not fetch content packs from the server. Go to Settings → Synchronization to retry.",
  "manifestVersion": "Manifest version",
  "lastSynced": "Last synced"
}
```

**pt.json:** (translated equivalents)
**es.json:** (translated equivalents)

- [ ] **Step 2: Run i18n lint**

Run: `pnpm lint:i18n`
Expected: No missing keys.

- [ ] **Step 3: Commit**

```bash
git add src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat(sync): add i18n keys for pack sync (en/pt/es)"
```

---

## Phase 4 — Admin Panel

### Task 12: Scaffold Next.js admin panel

**Files:**
- Create: `admin-panel/` (new directory)

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
npx create-next-app@14 admin-panel --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd admin-panel
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm add @aws-sdk/client-s3 archiver busboy sonner
pnpm add -D @types/archiver @types/busboy
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog input label table toast progress
```

- [ ] **Step 4: Add react-dropzone and tanstack-table**

```bash
pnpm add react-dropzone @tanstack/react-table
```

- [ ] **Step 5: Create .env.local (gitignored)**

```
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_BUCKET=louvorja-packs
R2_ACCESS_KEY_ID=changeme
R2_SECRET_ACCESS_KEY=changeme
R2_PUBLIC_CDN_BASE=https://pub-xxx.r2.dev
```

- [ ] **Step 6: Create admin-panel/.env.example**

Same content as above with placeholder values.

- [ ] **Step 7: Commit**

```bash
git add admin-panel/
git commit -m "feat(admin): scaffold Next.js admin panel with shadcn/ui"
```

### Task 13: Implement R2 client utility

**Files:**
- Create: `admin-panel/src/lib/r2.ts`

- [ ] **Step 1: Create R2 client wrapper**

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const CDN_BASE = process.env.R2_PUBLIC_CDN_BASE!;

export async function uploadToR2(key: string, body: Buffer | Readable, contentType?: string): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${CDN_BASE}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function existsOnR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  const response = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function getCdnUrl(key: string): string {
  return `${CDN_BASE}/${key}`;
}

export { BUCKET, CDN_BASE };
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/src/lib/r2.ts
git commit -m "feat(admin): add R2 client utility"
```

### Task 14: Implement manifest management

**Files:**
- Create: `admin-panel/src/lib/manifest.ts`

- [ ] **Step 1: Create manifest types and helpers**

```typescript
export interface ManifestFile {
  path: string;
  hymnApiId: number | null;
  albumApiId: number | null;
  type: "audio" | "playback" | "cover" | "album_cover";
  size: number;
}

export interface ManifestPack {
  id: string;
  url: string;
  version: number;
  size: number;
  sha256: string;
  files: ManifestFile[];
}

export interface ContentManifest {
  manifestVersion: number;
  generatedAt: string;
  packs: ManifestPack[];
}

const MANIFEST_KEY = "manifest.json";

export async function fetchManifest(): Promise<ContentManifest | null> {
  const { downloadFromR2, existsOnR2 } = await import("./r2");
  if (!(await existsOnR2(MANIFEST_KEY))) return null;
  const buf = await downloadFromR2(MANIFEST_KEY);
  return JSON.parse(buf.toString("utf-8"));
}

export async function uploadManifest(manifest: ContentManifest): Promise<void> {
  const { uploadToR2 } = await import("./r2");
  const json = JSON.stringify(manifest, null, 2);
  await uploadToR2(MANIFEST_KEY, Buffer.from(json), "application/json");
}

export function incrementManifestVersion(manifest: ContentManifest | null): ContentManifest {
  return {
    manifestVersion: (manifest?.manifestVersion ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    packs: manifest?.packs ?? [],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/src/lib/manifest.ts
git commit -m "feat(admin): add manifest management helpers"
```

### Task 15: Implement pack builder — ZIP creation and bin-packing

**Files:**
- Create: `admin-panel/src/lib/pack-builder.ts`

- [ ] **Step 1: Create bin-packing and ZIP logic**

```typescript
import archiver from "archiver";
import { createHash } from "crypto";
import { createReadStream, statSync } from "fs";
import { Writable } from "stream";
import type { ManifestFile, ManifestPack } from "./manifest";

const MAX_PACK_SIZE = 500 * 1024 * 1024; // 500 MB

export interface FileEntry {
  localPath: string;         // absolute path on disk
  packPath: string;          // relative path inside ZIP (e.g. "media/audio/123/song.mp3")
  hymnApiId: number | null;
  albumApiId: number | null;
  fileType: "audio" | "playback" | "cover" | "album_cover";
  size: number;
}

export interface PackGroup {
  id: string;
  files: FileEntry[];
  totalSize: number;
}

/** Greedy bin-packing: sort files by size desc, fill packs up to MAX_PACK_SIZE. */
export function groupIntoPacks(files: FileEntry[], packIdPrefix: string): PackGroup[] {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const packs: PackGroup[] = [];
  let currentPack: PackGroup | null = null;
  let packIndex = 1;

  for (const file of sorted) {
    if (!currentPack || currentPack.totalSize + file.size > MAX_PACK_SIZE) {
      currentPack = {
        id: `${packIdPrefix}-${String(packIndex).padStart(3, "0")}`,
        files: [],
        totalSize: 0,
      };
      packs.push(currentPack);
      packIndex++;
    }
    currentPack.files.push(file);
    currentPack.totalSize += file.size;
  }

  return packs;
}

/** Create a STORED (no compression) ZIP and return the buffer + SHA-256. */
export async function createPackZip(files: FileEntry[]): Promise<{ buffer: Buffer; sha256: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver("zip", { store: true });
    archive.on("error", reject);
    archive.pipe(writable);

    for (const file of files) {
      archive.file(file.localPath, { name: file.packPath });
    }

    writable.on("finish", () => {
      const buffer = Buffer.concat(chunks);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      resolve({ buffer, sha256 });
    });

    archive.finalize();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/src/lib/pack-builder.ts
git commit -m "feat(admin): add pack builder — bin-packing algorithm and ZIP creation"
```

### Task 16: Implement publish API route

**Files:**
- Create: `admin-panel/src/app/api/packs/publish/route.ts`

- [ ] **Step 1: Create the publish endpoint**

This is the core API route. It receives a pack plan (from the UI), creates ZIPs, uploads to R2, cleans up N-2, updates manifest.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createPackZip, type FileEntry } from "@/lib/pack-builder";
import { uploadToR2, deleteFromR2, existsOnR2, getCdnUrl } from "@/lib/r2";
import { fetchManifest, uploadManifest, incrementManifestVersion, type ManifestPack, type ManifestFile } from "@/lib/manifest";

interface PublishPackRequest {
  packId: string;
  version: number;
  files: FileEntry[];
}

interface PublishRequest {
  packs: PublishPackRequest[];
}

export async function POST(req: NextRequest) {
  try {
    const body: PublishRequest = await req.json();
    const manifest = await fetchManifest();
    const updated = incrementManifestVersion(manifest);

    for (const pack of body.packs) {
      // Create ZIP
      const { buffer, sha256 } = await createPackZip(pack.files);
      const zipKey = `packs/${pack.packId}-v${pack.version}.zip`;

      // Upload ZIP to R2
      await uploadToR2(zipKey, buffer, "application/zip");

      // N-2 cleanup
      const nMinus2Version = pack.version - 2;
      if (nMinus2Version >= 1) {
        const oldKey = `packs/${pack.packId}-v${nMinus2Version}.zip`;
        if (await existsOnR2(oldKey)) {
          await deleteFromR2(oldKey);
        }
      }

      // Build manifest entry
      const manifestFiles: ManifestFile[] = pack.files.map((f) => ({
        path: f.packPath,
        hymnApiId: f.hymnApiId,
        albumApiId: f.albumApiId,
        type: f.fileType,
        size: f.size,
      }));

      const manifestPack: ManifestPack = {
        id: pack.packId,
        url: getCdnUrl(zipKey),
        version: pack.version,
        size: buffer.length,
        sha256,
        files: manifestFiles,
      };

      // Upsert pack in manifest
      const idx = updated.packs.findIndex((p) => p.id === pack.packId);
      if (idx >= 0) {
        updated.packs[idx] = manifestPack;
      } else {
        updated.packs.push(manifestPack);
      }
    }

    // Upload updated manifest
    await uploadManifest(updated);

    return NextResponse.json({ success: true, manifestVersion: updated.manifestVersion });
  } catch (error) {
    console.error("[publish] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/src/app/api/packs/publish/route.ts
git commit -m "feat(admin): add publish API route — ZIP creation, R2 upload, N-2 cleanup"
```

### Task 17: Implement admin panel pages (pack list + new pack + edit pack)

**Files:**
- Create: `admin-panel/src/app/page.tsx` (pack list)
- Create: `admin-panel/src/app/packs/new/page.tsx` (new pack flow)
- Create: `admin-panel/src/app/packs/[id]/page.tsx` (edit pack flow)
- Create: `admin-panel/src/app/api/manifest/route.ts` (GET manifest)
- Create: `admin-panel/src/app/api/packs/[id]/download/route.ts` (download existing pack for editing)

This is the largest task — the UI pages. Each page follows the same pattern: fetch data → render with shadcn/ui → actions call API routes.

- [ ] **Step 1: Create GET /api/manifest route**

```typescript
import { NextResponse } from "next/server";
import { fetchManifest } from "@/lib/manifest";

export async function GET() {
  const manifest = await fetchManifest();
  return NextResponse.json(manifest ?? { manifestVersion: 0, generatedAt: null, packs: [] });
}
```

- [ ] **Step 2: Create pack list page (/) — shows all packs from manifest**

The page fetches `GET /api/manifest`, renders a table with pack ID, version, file count, size, last published date. Each row links to `/packs/[id]`. A "New Pack" button links to `/packs/new`.

- [ ] **Step 3: Create new pack page (/packs/new)**

Uses `react-dropzone` for folder upload. After files are selected locally (browser `File` objects), the client-side code groups them using the bin-packing algorithm. User reviews the groupings, can rename packs. On "Publish", sends each pack's file list to `POST /api/packs/publish`.

**Key detail:** For the new pack flow with local files selected via `webkitdirectory`, the files need to be uploaded to the server as multipart form data. The server saves them to a temp directory, then the publish API reads from there.

Create `POST /api/upload` route that accepts multipart form data via `busboy`, streams to temp dir, returns file metadata.

- [ ] **Step 4: Create edit pack page (/packs/[id])**

Downloads the existing pack ZIP from R2, extracts to temp dir on server, shows file listing. User can add/remove files. On publish, re-creates ZIP and uploads.

- [ ] **Step 5: Create DELETE /api/packs/[id] route**

Removes pack from manifest and deletes all versions from R2.

- [ ] **Step 6: Verify admin panel runs**

```bash
cd admin-panel && pnpm dev
```

Open `http://localhost:3000`. Verify pack list loads (empty if no manifest exists on R2).

- [ ] **Step 7: Commit**

```bash
git add admin-panel/src/
git commit -m "feat(admin): implement pack list, new pack, and edit pack pages"
```

---

## Phase 5 — Verification

### Task 18: End-to-end verification

- [ ] **Step 1: Verify Rust tests pass**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 3: Verify i18n coverage**

```bash
pnpm lint:i18n
```

- [ ] **Step 4: Verify Tauri dev runs**

```bash
CDN_MANIFEST_URL=https://example.com/manifest.json pnpm tauri dev
```

App should start. If manifest URL is unreachable, startup should proceed normally (pack sync silently skipped since app has no content — or shows info dialog if DB is empty).

- [ ] **Step 5: Verify admin panel runs**

```bash
cd admin-panel && pnpm dev
```

- [ ] **Step 6: Manual E2E test (when R2 is configured)**

1. In admin panel: create a test pack with a few small files
2. Publish to R2
3. Restart Tauri app — should show pack sync dialog
4. Click "Download & Apply" — files should appear in `media/` folder
5. Check hymns DB has updated paths

---

## Critical Files Reference

| Purpose | File |
|---|---|
| Manifest structs (Rust) | `src-tauri/src/content_sync/manifest.rs` |
| Pack sync planner | `src-tauri/src/pack_sync/planner.rs` |
| Pack sync executor | `src-tauri/src/pack_sync/executor.rs` |
| Pack sync commands | `src-tauri/src/commands/pack_sync.rs` |
| HTTP downloader (reuse) | `src-tauri/src/http_sync/downloader.rs` |
| DB queries (reuse + extend) | `src-tauri/src/db/queries/content_sync.rs` |
| Migrations | `src-tauri/src/db/migrations.rs` |
| Command registration | `src-tauri/src/lib.rs` |
| App state | `src-tauri/src/state.rs` |
| Build env var | `src-tauri/build.rs` |
| Frontend types | `src/types/content-sync.ts` |
| Query hooks | `src/lib/queries.ts` |
| Store | `src/stores/content-sync-store.ts` |
| Pack sync dialog | `src/components/content-sync/pack-sync-dialog.tsx` |
| Startup wiring | `src/routes/__root.tsx` |
| Settings page | `src/routes/settings/index.tsx` |
| Status bar | `src/components/layout/status-bar.tsx` |
| i18n | `src/locales/{en,pt,es}.json` |
| Admin: R2 client | `admin-panel/src/lib/r2.ts` |
| Admin: manifest | `admin-panel/src/lib/manifest.ts` |
| Admin: pack builder | `admin-panel/src/lib/pack-builder.ts` |
| Admin: publish API | `admin-panel/src/app/api/packs/publish/route.ts` |
| Design spec | `docs/superpowers/specs/2026-03-20-cdn-pack-sync-design.md` |
