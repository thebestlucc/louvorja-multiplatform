# Pack Sync — Rust Backend & Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace legacy-DB-import with a direct `content.db` strategy: the downloaded DB becomes the primary source for hymnal and collection queries, with FTS5 search, language-scoped sync, and DB-aligned path resolution.

**Architecture:** The downloaded legacy DB is saved as `content-{lang}.db` in `app_data_dir`. A new `content_dbs` pool map in `AppState` gives query functions a connection to this DB alongside the main DB. Music and collection queries accept `Option<&Connection>` for content_db; when `None` they return empty lists. The planner filters by `selected_languages` setting. The executor no longer runs a DB-update phase — it only extracts ZIPs and saves the content DB.

**Tech Stack:** Rust, rusqlite, r2d2/r2d2_sqlite, Tauri 2, specta. Frontend: React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-22-pack-sync-cdn-fixes-design.md`

**Prerequisite:** Complete `docs/superpowers/plans/2026-03-22-pack-sync-admin-panel.md` first (manifest type changes must be in place).

---

## File Map

| File | Change |
|---|---|
| `src-tauri/src/content_sync/manifest.rs` | Add `language` to `ManifestPack`; replace `db_url`/`db_version` with `databases: HashMap<String, DbEntry>` |
| `src-tauri/src/pack_sync/planner.rs` | Add `language` to `PackSyncPlanItem`; remove `LegacyDbSyncItem`/`legacy_db`; filter by `selected_languages`; add `available_languages` |
| `src-tauri/src/state.rs` | Add `content_dbs: Arc<Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>` |
| `src-tauri/src/db/queries/content_sync.rs` | Add `bcp47_to_lang_code`, `save_content_db`, `init_content_db_fts`, `get_selected_languages`, `set_selected_languages`; remove `import_legacy_db` |
| `src-tauri/src/pack_sync/executor.rs` | Remove DB-update phase; replace Phase 3 (legacy DB import) with `save_content_db` + hot-swap; add `.DS_Store` collection guard |
| `src-tauri/src/lib.rs` | Startup scan for `content-*.db`; initialise `content_dbs`; update `erase_app_data` |
| `src-tauri/src/db/queries/music.rs` | Rewrite `search_hymns`, `get_hymns_by_album`/album queries with `Option<&Connection>` |
| `src-tauri/src/commands/music.rs` | Pass content_db pool clone to query functions |
| `src-tauri/src/commands/collections.rs` | Pass content_db pool clone to collection query functions |
| `src/types/content-sync.ts` | Remove `LegacyDbSyncItem`; add `language` to `PackSyncPlanItem`; add `availableLanguages`/`selectedLanguages` to `PackSyncPlan` |
| `src/components/content-sync/pack-sync-dialog.tsx` | Add language selection checklist before sync starts |

---

### Task 1: Update Rust manifest structs

**Files:**
- Modify: `src-tauri/src/content_sync/manifest.rs`

**Context:** The current structs have `db_url: Option<String>` and `db_version: Option<i64>` on `ContentManifest`, and no `language` field on `ManifestPack`. We add `language`, add `DbEntry`, add `databases: HashMap<String, DbEntry>`, and remove `db_url`/`db_version`.

- [ ] **Step 1: Add imports**

At the top of `src-tauri/src/content_sync/manifest.rs`, ensure `HashMap` is imported:
```rust
use std::collections::HashMap;
```

- [ ] **Step 2: Add `DbEntry` struct and update `ManifestPack` and `ContentManifest`**

Find the three structs and make these exact changes:

```rust
// NEW struct — add before ContentManifest:
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEntry {
    pub url: String,
    pub version: i64,
}

// UPDATED ManifestPack — add language field:
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPack {
    pub id: String,
    pub url: String,
    pub version: u32,
    pub size: u64,
    pub sha256: String,
    pub files: Vec<ManifestFile>,
    #[serde(default)]
    pub language: String,    // BCP 47 tag, e.g. "pt-BR"
}

// UPDATED ContentManifest — remove db_url/db_version, add databases:
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentManifest {
    pub manifest_version: i64,
    pub generated_at: Option<String>,
    #[serde(default)]
    pub packs: Vec<ManifestPack>,
    // REMOVED: db_url, db_version
    #[serde(default)]
    pub databases: HashMap<String, DbEntry>,   // keyed by BCP 47 tag
}
```

- [ ] **Step 3: Fix any compilation errors from db_url/db_version removal**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "error"
```

Search for all remaining uses of `db_url` or `db_version` in Rust code and update them to use `databases`:
```bash
grep -r "db_url\|db_version" src-tauri/src --include="*.rs"
```
For each match in `planner.rs` and `executor.rs`, update to use `manifest.databases.get("pt-BR")` etc. (Task 2 and 5 will complete this fully).

- [ ] **Step 4: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: no errors (warnings about unused fields are OK at this stage).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/content_sync/manifest.rs
git commit -m "feat(rust): update manifest structs — add DbEntry, ManifestPack.language, ContentManifest.databases"
```

---

### Task 2: Update planner structs and logic

**Files:**
- Modify: `src-tauri/src/pack_sync/planner.rs`

**Context:** Current `planner.rs` has `LegacyDbSyncItem`, `legacy_db: Option<LegacyDbSyncItem>` in `PackSyncPlan`, and builds a legacy DB phase. We remove all that, add `language: String` to `PackSyncPlanItem`, add `available_languages`/`selected_languages` to `PackSyncPlan`, and filter packs by `selected_languages`.

- [ ] **Step 1: Add required import**

At the top of `src-tauri/src/pack_sync/planner.rs`, add:
```rust
use crate::db::queries::content_sync as cs_queries;
```
(It's already imported as `content_sync` — check and use consistently.)

- [ ] **Step 2: Update `PackSyncPlanItem` — add `language`**

In the `PackSyncPlanItem` struct, add:
```rust
pub language: String,   // BCP 47 tag, e.g. "pt-BR"
```

- [ ] **Step 3: Remove `LegacyDbSyncItem` and update `PackSyncPlan`**

Delete the `LegacyDbSyncItem` struct entirely. Replace `PackSyncPlan` with:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PackSyncPlan {
    pub manifest_version: i64,
    pub items: Vec<PackSyncPlanItem>,
    pub total_download_size: u64,
    pub total_download_count: usize,
    pub available_languages: Vec<String>,    // all languages in manifest
    pub selected_languages: Vec<String>,     // current user setting
}
```

- [ ] **Step 4: Rewrite `build_plan()`**

Replace the `build_plan` function body with the new logic:

```rust
pub fn build_plan(
    conn: &Connection,
    manifest: &ContentManifest,
    stored_manifest_version: i64,
) -> Result<PackSyncPlan, AppError> {
    use crate::db::queries::content_sync::get_selected_languages;

    let selected_languages = get_selected_languages(conn);
    let available_languages: Vec<String> = {
        let mut langs: Vec<String> = manifest
            .packs
            .iter()
            .map(|p| p.language.clone())
            .chain(manifest.databases.keys().cloned())
            .collect();
        langs.sort();
        langs.dedup();
        langs
    };

    // If nothing selected, return empty plan (dialog prompts user to pick a language).
    // Exception: if content_dbs already has entries from a previous sync, default to
    // all installed languages so existing users are not broken.
    let effective_languages = if selected_languages.is_empty() {
        return Ok(PackSyncPlan {
            manifest_version: manifest.manifest_version,
            items: vec![],
            total_download_size: 0,
            total_download_count: 0,
            available_languages,
            selected_languages,
        });
    } else {
        selected_languages.clone()
    };

    // Early return if manifest version hasn't changed
    if manifest.manifest_version == stored_manifest_version && stored_manifest_version > 0 {
        // Still check if any content DB needs downloading
        let db_items = build_db_items(conn, manifest, &effective_languages)?;
        if db_items.is_empty() {
            return Ok(PackSyncPlan {
                manifest_version: manifest.manifest_version,
                items: vec![],
                total_download_size: 0,
                total_download_count: 0,
                available_languages,
                selected_languages,
            });
        }
    }

    let mut items = Vec::new();
    let mut total_download_size = 0u64;
    let mut total_download_count = 0usize;

    for pack in &manifest.packs {
        // Filter by selected languages
        if !effective_languages.contains(&pack.language) {
            continue;
        }

        let extracted_version =
            crate::db::queries::content_sync::get_pack_extracted_version(conn, &pack.id)?;

        let needs_download = pack.version > extracted_version;
        if !needs_download {
            continue;
        }

        total_download_size += pack.size;
        total_download_count += 1;

        let files: Vec<PackSyncFileItem> = pack
            .files
            .iter()
            .map(|f| PackSyncFileItem {
                path: f.path.clone(),
                hymn_api_id: f.hymn_api_id,
                album_api_id: f.album_api_id,
                file_type: f.file_type.clone(),
                size: f.size,
                album_name: f.album_name.clone(),
            })
            .collect();

        items.push(PackSyncPlanItem {
            pack_id: pack.id.clone(),
            pack_url: pack.url.clone(),
            pack_version: pack.version,
            pack_size: pack.size,
            pack_sha256: pack.sha256.clone(),
            local_extracted_version: extracted_version,
            local_db_version: 0,      // kept for struct compat; unused
            needs_download: true,
            needs_db_update: false,   // no longer used
            file_count: files.len(),
            files,
            language: pack.language.clone(),
        });
    }

    // Add content DB download items as pseudo-packs with empty files
    let db_items = build_db_items(conn, manifest, &effective_languages)?;
    items.extend(db_items);

    Ok(PackSyncPlan {
        manifest_version: manifest.manifest_version,
        items,
        total_download_size,
        total_download_count,
        available_languages,
        selected_languages,
    })
}

/// Build plan items for content DB downloads, one per selected language.
fn build_db_items(
    conn: &Connection,
    manifest: &ContentManifest,
    selected_languages: &[String],
) -> Result<Vec<PackSyncPlanItem>, AppError> {
    let mut items = Vec::new();
    for lang in selected_languages {
        if let Some(db_entry) = manifest.databases.get(lang) {
            let stored_version = crate::db::queries::settings::get_setting(conn, &format!("pack_sync.db_version.{}", lang))
                .ok()
                .and_then(|s| s.value.parse::<i64>().ok())
                .unwrap_or(0);
            if db_entry.version > stored_version {
                items.push(PackSyncPlanItem {
                    pack_id: format!("content-db-{}", lang),
                    pack_url: db_entry.url.clone(),
                    pack_version: db_entry.version as u32,
                    pack_size: 0,
                    pack_sha256: String::new(),
                    local_extracted_version: stored_version as u32,
                    local_db_version: 0,
                    needs_download: true,
                    needs_db_update: false,
                    file_count: 0,
                    files: vec![],
                    language: lang.clone(),
                });
            }
        }
    }
    Ok(items)
}
```

- [ ] **Step 5: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/pack_sync/planner.rs
git commit -m "feat(rust): rewrite planner — language-scoped packs, remove LegacyDbSyncItem, add selected_languages filtering"
```

---

### Task 3: Add `content_dbs` to `AppState`

**Files:**
- Modify: `src-tauri/src/state.rs`

**Context:** `AppState` currently has `db: Pool<SqliteConnectionManager>` and `bible_db: Pool<SqliteConnectionManager>`. We add a new field for the map of content DBs, keyed by BCP 47 language tag.

- [ ] **Step 1: Add import at top of `state.rs`**

```rust
use std::collections::HashMap;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
```
(These may already be imported — check first.)

- [ ] **Step 2: Add the field to `AppState`**

In the `AppState` struct, after `pub bible_db: Pool<SqliteConnectionManager>`, add:

```rust
/// Content DBs keyed by BCP 47 language tag (e.g. "pt-BR").
/// None means no DB downloaded yet for that language.
pub content_dbs: std::sync::Arc<std::sync::Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>,
```

- [ ] **Step 3: Verify Rust compiles (expect errors in lib.rs about AppState initialisation — fixed in Task 7)**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```
The only errors should be about `content_dbs` not being initialised in `lib.rs`. All other code should compile.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat(rust): add content_dbs pool map to AppState"
```

---

### Task 4: Add content_sync helper functions

**Files:**
- Modify: `src-tauri/src/db/queries/content_sync.rs`

**Context:** This file contains all pack sync DB queries. We add five new functions: `bcp47_to_lang_code`, `get_selected_languages`, `set_selected_languages`, `save_content_db`, `init_content_db_fts`. We also add a helper to open a content DB pool.

- [ ] **Step 1: Add `bcp47_to_lang_code` helper**

Add at the top of the file (after `use` statements):

```rust
/// Maps BCP 47 content language tags to the 2-letter code used
/// as id_language in the legacy DB files table.
pub fn bcp47_to_lang_code(tag: &str) -> &str {
    match tag {
        "pt-BR" => "pt",
        "en-US" => "en",
        "es"    => "es",
        other   => other,
    }
}
```

- [ ] **Step 2: Add `get_selected_languages` and `set_selected_languages`**

```rust
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
```

- [ ] **Step 3: Add `save_content_db`**

```rust
use std::path::{Path, PathBuf};

/// Renames the downloaded temp DB to its final content-{lang}.db path.
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
```

- [ ] **Step 4: Add `init_content_db_fts`**

```rust
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
```

- [ ] **Step 5: Add `open_content_db_pool` helper**

```rust
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

/// Opens an r2d2 pool for a content DB file.
pub fn open_content_db_pool(path: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    let manager = SqliteConnectionManager::file(path);
    Pool::builder()
        .min_idle(Some(1))
        .max_size(3)
        .build(manager)
        .map_err(|e| AppError::Internal(format!("Content DB pool error: {}", e)))
}
```

- [ ] **Step 6: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/db/queries/content_sync.rs
git commit -m "feat(rust): add content_sync helpers — bcp47_to_lang_code, save_content_db, init_content_db_fts, selected_languages"
```

---

### Task 5: Update executor — remove DB update phase, add content.db save

**Files:**
- Modify: `src-tauri/src/pack_sync/executor.rs`

**Context:** The executor has three phases. Phase 2 updates the local `hymns`/`collections` tables by matching API IDs from canonical paths — this is now obsolete. Phase 3 imports the legacy DB — replaced by `save_content_db`. We remove both old phases. Content DB items (identified by `pack_id.starts_with("content-db-")`) are handled separately from ZIP packs.

- [ ] **Step 1: Add `.DS_Store` collection guard**

In the DB-update loop (around line 340 in the current file), find:
```rust
if let Some(ref name) = file.album_name {
    if !is_hinario(name) {
        let _ = content_sync::ensure_collection_by_name(&conn, name);
    }
}
```
Add a guard:
```rust
if let Some(ref name) = file.album_name {
    if !is_hinario(name) && !name.starts_with('.') {
        let _ = content_sync::ensure_collection_by_name(&conn, name);
    }
}
```

- [ ] **Step 2: Remove the `needs_db_update` phase entirely**

In Phase 2 (the extraction + DB update loop), find the block:
```rust
if item.needs_db_update {
    // ... update hymn paths by API ID ...
    let _ = content_sync::set_pack_db_version(...);
}
```
Delete this entire `if item.needs_db_update { ... }` block. The `needs_db_update` field is now always false (per planner Task 2).

- [ ] **Step 3: Route content DB items in the download phase**

Content DB plan items have `pack_id` starting with `"content-db-"`. They must be downloaded to a `.db.tmp` file (not a `.zip.tmp`) and then saved via `save_content_db`.

In the download phase (Phase 1), find where temp file paths are built:
```rust
let zip_path = app_data_dir.join(format!("pack_{}.zip.tmp", item.pack_id));
```

Wrap with a check:
```rust
let is_content_db = item.pack_id.starts_with("content-db-");
let tmp_filename = if is_content_db {
    format!("{}.db.tmp", item.pack_id)
} else {
    format!("pack_{}.zip.tmp", item.pack_id)
};
let zip_path = app_data_dir.join(&tmp_filename);
```

- [ ] **Step 4: Replace Phase 3 (legacy DB import) with content DB save + hot-swap**

Find the Phase 3 block (after all ZIP packs are processed). It currently downloads `legacy_db_item.url` and calls `import_legacy_db`. Replace entirely with:

```rust
// Phase 3: Save and hot-swap content DB files
for item in &plan_items {
    if !item.pack_id.starts_with("content-db-") { continue; }
    let lang = &item.language;
    let tmp_path = app_data_dir.join(format!("{}.db.tmp", item.pack_id));

    if !tmp_path.exists() { continue; }

    let dest = match content_sync::save_content_db(&tmp_path, lang, &app_data_dir) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[pack-sync] Failed to save content DB for {}: {}", lang, e);
            continue;
        }
    };

    // Open new pool, init FTS5
    match content_sync::open_content_db_pool(&dest) {
        Ok(new_pool) => {
            match new_pool.get() {
                Ok(conn) => {
                    let _ = content_sync::init_content_db_fts(&conn, lang);
                }
                Err(e) => eprintln!("[pack-sync] FTS init failed for {}: {}", lang, e),
            }
            // Hot-swap in AppState (requires mut for insert)
            {
                let mut content_dbs = state.content_dbs.lock().unwrap();
                content_dbs.insert(lang.clone(), new_pool);
                // Drop MutexGuard before accessing other state
            }
            // Record version using main DB conn (not the content pool conn)
            let main_conn = state.db.get().map_err(AppError::from);
            if let Ok(ref mc) = main_conn {
                let _ = settings::set_setting(
                    mc,
                    &format!("pack_sync.db_version.{}", lang),
                    &item.pack_version.to_string(),
                );
            }
        }
        Err(e) => eprintln!("[pack-sync] Pool open failed for {}: {}", lang, e),
    }
}
```

Note: `state.content_dbs` requires `state` to be accessible here — it is already in scope as `state` from earlier in the function.

- [ ] **Step 5: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/pack_sync/executor.rs
git commit -m "feat(rust): executor — remove DB-update phase, add content.db save/hot-swap, DS_Store guard"
```

---

### Task 6: Initialise `content_dbs` in `lib.rs` and update `erase_app_data`

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Context:** `AppState` now requires `content_dbs` to be initialised. On startup, we scan for existing `content-*.db` files and open pools. We also update `erase_app_data`.

- [ ] **Step 1: Initialise `content_dbs` in `AppState` construction**

Find where `AppState { db, bible_db, ... }` is constructed in `setup()`. Add:

```rust
content_dbs: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
```

- [ ] **Step 2: Add startup scan after `app.manage(state)`**

After the `app.manage(app_state)` call (or `app.manage(state)`), add:

```rust
// Startup scan: open existing content-*.db files
{
    let app_data = app.path().app_data_dir()
        .expect("app_data_dir unavailable");
    let state = app.state::<AppState>();
    if let Ok(entries) = std::fs::read_dir(&app_data) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if name.starts_with("content-") && name.ends_with(".db") {
                let lang = name
                    .strip_prefix("content-")
                    .unwrap_or("")
                    .strip_suffix(".db")
                    .unwrap_or("")
                    .to_string();
                if let Ok(pool) = crate::db::queries::content_sync::open_content_db_pool(&path) {
                    if let Ok(conn) = pool.get() {
                        let _ = crate::db::queries::content_sync::init_content_db_fts(&conn, &lang);
                    }
                    state.content_dbs.lock().unwrap().insert(lang, pool);
                }
            }
        }
    }
}
```

- [ ] **Step 3: Update `erase_app_data` command**

Find the `erase_app_data` command (search with `grep -r "erase_app_data" src-tauri/src --include="*.rs"`). Extend it to:

```rust
// 1. Drain content_dbs (drop all pools)
{
    let mut map = state.content_dbs.lock().unwrap();
    map.clear();
}

// 2. Delete content-*.db files
let app_data = app.path().app_data_dir()?;
if let Ok(entries) = std::fs::read_dir(&app_data) {
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.starts_with("content-") && name.ends_with(".db") {
            let _ = std::fs::remove_file(&path);
        }
        // Delete extracted pack directories
        if matches!(name, "musics" | "covers" | "images") {
            let _ = std::fs::remove_dir_all(&path);
        }
        // Delete temp files
        if name.ends_with(".db.tmp") || name.ends_with(".zip.tmp") {
            let _ = std::fs::remove_file(&path);
        }
    }
}

// 3. Reset pack_sync.* settings
let conn = state.db.get().map_err(AppError::from)?;
let _ = settings::delete_setting(&conn, "pack_sync.manifest_version");
let _ = settings::delete_setting(&conn, "pack_sync.selected_languages");
// Delete per-lang db_version keys
// ... (iterate known languages or use a LIKE query)
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): init content_dbs on startup, update erase_app_data for new content.db structure"
```

---

### Task 7: Add content_db queries for hymnal

**Files:**
- Modify: `src-tauri/src/db/queries/music.rs`

**Context:** The current `search_hymns` queries the main `hymns` table. We add content_db support: when `content_db: Option<&Connection>` is `Some`, query the legacy DB schema (`musics`, `albums_musics`, `albums`, `files`) and map to the existing `Hymn` struct.

- [ ] **Step 1: Add `get_hymns_from_content_db` function**

Add after the existing `search_hymns` function:

```rust
/// Query hymnal from the content DB (downloaded legacy DB).
/// Returns Hymn structs with paths ready for app_data_dir resolution.
pub fn get_hymns_from_content_db(
    content_db: &Connection,
    lang_bcp47: &str,
) -> Result<Vec<Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db.prepare(
        "SELECT
            m.id_music            AS id,
            am.track              AS number,
            m.name                AS title,
            NULL                  AS author,
            a.name                AS album,
            NULL                  AS lyrics,
            NULL                  AS chords,
            fa.dir || '/' || fa.name  AS audio_path,
            fp.dir || '/' || fp.name  AS playback_path,
            'hymnal'              AS category,
            NULL                  AS notes,
            fi.dir || '/' || fi.name  AS cover_path,
            NULL                  AS lyrics_sync,
            m.id_music            AS api_music_id,
            m.created_at          AS created_at,
            m.updated_at          AS updated_at
         FROM musics m
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE m.id_language = ?1
         ORDER BY a.name, am.track"
    ).map_err(AppError::Database)?;

    let hymns = stmt.query_map([lang_short], |row| {
        Ok(Hymn {
            id: row.get("id")?,
            number: row.get("number")?,
            title: row.get("title")?,
            author: row.get("author")?,
            album: row.get("album")?,
            lyrics: row.get("lyrics")?,
            chords: row.get("chords")?,
            audio_path: row.get("audio_path")?,
            playback_path: row.get("playback_path")?,
            category: row.get("category")?,
            notes: row.get("notes")?,
            cover_path: row.get("cover_path")?,
            lyrics_sync: row.get("lyrics_sync")?,
            api_music_id: row.get("api_music_id")?,
            created_at: row.get::<_, Option<String>>("created_at")?.unwrap_or_default(),
            updated_at: row.get::<_, Option<String>>("updated_at")?.unwrap_or_default(),
        })
    })
    .map_err(AppError::Database)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(AppError::Database)?;

    Ok(hymns)
}
```

- [ ] **Step 2: Add `search_hymns_content_db` for FTS5 search**

```rust
pub fn search_hymns_content_db(
    content_db: &Connection,
    query: &str,
    lang_bcp47: &str,
) -> Result<Vec<Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;

    let trimmed = query.trim();
    if trimmed.is_empty() {
        return get_hymns_from_content_db(content_db, lang_bcp47);
    }

    let lang_short = bcp47_to_lang_code(lang_bcp47);

    // Sanitize query: keep alphanumeric + whitespace, then build FTS5 prefix query.
    // Same pattern as bible.rs sanitize_fts_query.
    let sanitized: String = trimmed
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");
    if sanitized.is_empty() {
        return get_hymns_from_content_db(content_db, lang_bcp47);
    }
    let fts_query = format!("{}*", sanitized);

    // Check if FTS table exists
    let fts_exists: bool = content_db
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='musics_fts'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !fts_exists {
        // Fall back to LIKE search
        return get_hymns_from_content_db(content_db, lang_bcp47);
    }

    let mut stmt = content_db.prepare(
        "SELECT m.id_music AS id, am.track AS number, m.name AS title,
                NULL AS author, a.name AS album, NULL AS lyrics, NULL AS chords,
                fa.dir || '/' || fa.name AS audio_path,
                fp.dir || '/' || fp.name AS playback_path,
                'hymnal' AS category, NULL AS notes,
                fi.dir || '/' || fi.name AS cover_path,
                NULL AS lyrics_sync, m.id_music AS api_music_id,
                m.created_at, m.updated_at
         FROM musics_fts
         JOIN musics m ON musics_fts.rowid = m.id_music
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE musics_fts MATCH ?1
           AND m.id_language = ?2
         ORDER BY rank
         LIMIT 50"
    ).map_err(AppError::Database)?;

    let hymns = stmt.query_map([&fts_query as &dyn rusqlite::ToSql, &lang_short], |row| {
        Ok(Hymn {
            id: row.get("id")?,
            number: row.get("number")?,
            title: row.get("title")?,
            author: row.get("author")?,
            album: row.get("album")?,
            lyrics: row.get("lyrics")?,
            chords: row.get("chords")?,
            audio_path: row.get("audio_path")?,
            playback_path: row.get("playback_path")?,
            category: row.get("category")?,
            notes: row.get("notes")?,
            cover_path: row.get("cover_path")?,
            lyrics_sync: row.get("lyrics_sync")?,
            api_music_id: row.get("api_music_id")?,
            created_at: row.get::<_, Option<String>>("created_at")?.unwrap_or_default(),
            updated_at: row.get::<_, Option<String>>("updated_at")?.unwrap_or_default(),
        })
    })
    .map_err(AppError::Database)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(AppError::Database)?;

    Ok(hymns)
}
```

- [ ] **Step 3: Add `get_collections_from_content_db` and `get_collection_hymns_from_content_db`**

```rust
pub fn get_collections_from_content_db(
    content_db: &Connection,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Collection>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db.prepare(
        "SELECT
            a.id_album                                   AS id,
            a.name                                       AS name,
            NULL                                         AS description,
            CAST(SUBSTR(a.name, 1, 4) AS INTEGER)        AS year,
            f.dir || '/' || f.name                       AS cover_path,
            NULL                                         AS auto_cover_path,
            COUNT(am.id_music)                           AS song_count,
            'api'                                        AS source_type,
            a.id_album                                   AS api_album_id,
            a.created_at,
            a.updated_at
         FROM albums a
         LEFT JOIN files f ON f.id_file = a.id_file_image
         LEFT JOIN albums_musics am ON am.id_album = a.id_album
         WHERE a.id_language = ?1
         GROUP BY a.id_album
         ORDER BY a.name"
    ).map_err(AppError::Database)?;

    let collections = stmt.query_map([lang_short], |row| {
        let year_raw: Option<i64> = row.get("year")?;
        let year = year_raw
            .and_then(|y| if y >= 1900 && y <= 2100 { Some(y as i32) } else { None });
        Ok(crate::db::models::Collection {
            id: row.get("id")?,
            name: row.get("name")?,
            description: row.get("description")?,
            year,
            cover_path: row.get("cover_path")?,
            auto_cover_path: row.get("auto_cover_path")?,
            song_count: row.get::<_, i64>("song_count")? as i32,
            source_type: row.get("source_type")?,
            api_album_id: row.get("api_album_id")?,
            created_at: row.get::<_, Option<String>>("created_at")?.unwrap_or_default(),
            updated_at: row.get::<_, Option<String>>("updated_at")?.unwrap_or_default(),
        })
    })
    .map_err(AppError::Database)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(AppError::Database)?;

    Ok(collections)
}
```

Also add `get_collection_hymns_from_content_db` (songs for a specific album):

```rust
pub fn get_collection_hymns_from_content_db(
    content_db: &Connection,
    album_id: i64,
    lang_bcp47: &str,
) -> Result<Vec<crate::db::models::Hymn>, AppError> {
    use crate::db::queries::content_sync::bcp47_to_lang_code;
    let lang_short = bcp47_to_lang_code(lang_bcp47);

    let mut stmt = content_db.prepare(
        "SELECT
            m.id_music AS id, am.track AS number, m.name AS title,
            NULL AS author, a.name AS album, NULL AS lyrics, NULL AS chords,
            fa.dir || '/' || fa.name AS audio_path,
            fp.dir || '/' || fp.name AS playback_path,
            'hymnal' AS category, NULL AS notes,
            fi.dir || '/' || fi.name AS cover_path,
            NULL AS lyrics_sync, m.id_music AS api_music_id,
            m.created_at, m.updated_at
         FROM musics m
         LEFT JOIN albums_musics am ON am.id_music = m.id_music
         LEFT JOIN albums        a  ON a.id_album  = am.id_album
         LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
         LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
         LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
         WHERE am.id_album = ?1
           AND m.id_language = ?2
         ORDER BY am.track"
    ).map_err(AppError::Database)?;

    let hymns = stmt.query_map(rusqlite::params![album_id, lang_short], |row| {
        Ok(crate::db::models::Hymn {
            id: row.get("id")?,
            number: row.get("number")?,
            title: row.get("title")?,
            author: row.get("author")?,
            album: row.get("album")?,
            lyrics: row.get("lyrics")?,
            chords: row.get("chords")?,
            audio_path: row.get("audio_path")?,
            playback_path: row.get("playback_path")?,
            category: row.get("category")?,
            notes: row.get("notes")?,
            cover_path: row.get("cover_path")?,
            lyrics_sync: row.get("lyrics_sync")?,
            api_music_id: row.get("api_music_id")?,
            created_at: row.get::<_, Option<String>>("created_at")?.unwrap_or_default(),
            updated_at: row.get::<_, Option<String>>("updated_at")?.unwrap_or_default(),
        })
    })
    .map_err(AppError::Database)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(AppError::Database)?;

    Ok(hymns)
}
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries/music.rs
git commit -m "feat(rust): add content_db hymnal and collection query functions"
```

---

### Task 8: Update command handlers to use content_db

**Files:**
- Modify: `src-tauri/src/commands/music.rs`
- Modify: `src-tauri/src/commands/collections.rs`

**Context:** Command handlers currently call `db::queries::music::search_hymns(conn, query)`. They need to also pull from `content_dbs` and merge or prefer the content_db results.

- [ ] **Step 1: Add helper to get content_db connection in command handlers**

Add this helper to `commands/music.rs` (or a shared location):

```rust
/// Gets an active language setting and returns a PooledConnection from content_dbs.
/// Returns None if no content DB is available for the active language.
fn get_content_db_conn(
    state: &AppState,
    conn: &rusqlite::Connection,
) -> Option<r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>> {
    let langs = crate::db::queries::content_sync::get_selected_languages(conn);
    let lang = langs.into_iter().next()?;  // use first selected language
    let map = state.content_dbs.lock().ok()?;
    let pool = map.get(&lang)?.clone();    // clone pool before dropping lock
    drop(map);                              // release lock before .get()
    pool.get().ok()
}
```

- [ ] **Step 2: Update `search_hymns` command**

Find the `search_hymns` Tauri command in `commands/music.rs`. It currently takes `state` and `query`. Add `app: tauri::AppHandle` and update:

```rust
#[tauri::command]
pub async fn search_hymns(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    query: String,
) -> Result<Vec<Hymn>, AppError> {
    use tauri::Manager;
    let conn = state.db.get().map_err(AppError::from)?;
    let content_conn = get_content_db_conn(&state, &conn);

    if let Some(ref cdb) = content_conn {
        // Use content DB (prefer over main DB for CDN-sourced hymns)
        let langs = crate::db::queries::content_sync::get_selected_languages(&conn);
        let lang = langs.into_iter().next().unwrap_or_else(|| "pt-BR".to_string());
        let hymns = crate::db::queries::music::search_hymns_content_db(cdb, &query, &lang)?;
        // Resolve paths: join app_data_dir with the relative DB paths
        let app_data = app.path().app_data_dir().map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok(resolve_hymn_paths(hymns, &app_data));
    }

    // Fallback to main DB
    crate::db::queries::music::search_hymns(&conn, &query)
}

// IMPORTANT: After adding `app: AppHandle` parameter, re-run `pnpm tauri dev`
// once to regenerate bindings.ts (tauri-specta picks up the new signature).
```

Path resolution helper:

```rust
fn resolve_hymn_paths(
    mut hymns: Vec<Hymn>,
    app_data_dir: &std::path::Path,
) -> Vec<Hymn> {
    for h in &mut hymns {
        if let Some(ref p) = h.audio_path.clone() {
            h.audio_path = Some(
                app_data_dir
                    .join(p.trim_start_matches('/'))
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        if let Some(ref p) = h.playback_path.clone() {
            h.playback_path = Some(
                app_data_dir
                    .join(p.trim_start_matches('/'))
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        if let Some(ref p) = h.cover_path.clone() {
            h.cover_path = Some(
                app_data_dir
                    .join(p.trim_start_matches('/'))
                    .to_string_lossy()
                    .into_owned(),
            );
        }
    }
    hymns
}
```

- [ ] **Step 3: Update collection commands similarly**

In `commands/collections.rs`, update `get_collections` and `get_collection_hymns` to use `get_collection_db_conn` (same pattern) and call `get_collections_from_content_db` when available.

- [ ] **Step 4: Verify Rust compiles and bindings regenerate**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error"
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/music.rs src-tauri/src/commands/collections.rs
git commit -m "feat(rust): update command handlers to use content_db for hymnal and collections"
```

---

### Task 9: Update frontend TypeScript types and sync dialog

**Files:**
- Modify: `src/types/content-sync.ts`
- Modify: `src/components/content-sync/pack-sync-dialog.tsx`

- [ ] **Step 1: Update `content-sync.ts`**

In `src/types/content-sync.ts`:

1. Remove `LegacyDbSyncItem` interface entirely.
2. Add `language: string` to `PackSyncPlanItem`.
3. Update `PackSyncPlan`:

```typescript
export interface PackSyncPlan {
  manifestVersion: number;
  items: PackSyncPlanItem[];
  totalDownloadSize: number;
  totalDownloadCount: number;
  // legacyDb is REMOVED
  availableLanguages: string[];    // all languages in manifest
  selectedLanguages: string[];     // current user setting
}
```

- [ ] **Step 2: Add language selection to `pack-sync-dialog.tsx`**

In the sync dialog, before the pack list or the "Start Sync" button, add a language checklist:

```tsx
{plan && plan.availableLanguages.length > 0 && (
  <div className="space-y-2 px-3 py-2 border-b border-border">
    <p className="text-xs font-medium text-muted-foreground">
      {t("settings.packSync.selectLanguages")}
    </p>
    <div className="flex flex-wrap gap-2">
      {plan.availableLanguages.map((lang) => (
        <label key={lang} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selectedLangs.includes(lang)}
            onChange={(e) => {
              setSelectedLangs((prev) =>
                e.target.checked
                  ? [...prev, lang]
                  : prev.filter((l) => l !== lang)
              );
            }}
          />
          {LANG_DISPLAY[lang] ?? lang}
        </label>
      ))}
    </div>
  </div>
)}
```

Add the display map:
```typescript
const LANG_DISPLAY: Record<string, string> = {
  "pt-BR": "Português (Brasil)",
  "es": "Español",
  "en-US": "English (US)",
};
```

Disable the sync button when no languages are selected:
```tsx
disabled={isRunning || (plan?.availableLanguages.length ?? 0) > 0 && selectedLangs.length === 0}
```

- [ ] **Step 3: Add i18n key**

Add to all three locale files (`src/locales/en.json`, `pt.json`, `es.json`):

```json
// en.json
"selectLanguages": "Select languages to sync"

// pt.json
"selectLanguages": "Selecione os idiomas para sincronizar"

// es.json
"selectLanguages": "Seleccionar idiomas para sincronizar"
```

(Nested under the existing `settings.packSync` key.)

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/types/content-sync.ts src/components/content-sync/pack-sync-dialog.tsx src/locales/
git commit -m "feat(frontend): update PackSyncPlan types, add language selection to sync dialog"
```

---

### Task 10: Final integration verification

- [ ] **Step 1: Full Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: clean build, zero errors.

- [ ] **Step 2: Full frontend build (also regenerates bindings.ts)**

```bash
pnpm vite build
```
Expected: no TypeScript errors, no build warnings.

- [ ] **Step 3: Verify no legacy `db_url` / `dbVersion` references in Rust**

```bash
grep -r "db_url\|db_version\b" src-tauri/src --include="*.rs"
```
Expected: zero matches (only `databases` and per-lang `db_version.{lang}` keys remain).

- [ ] **Step 4: Verify no `LegacyDbSyncItem` references remain**

```bash
grep -r "LegacyDbSyncItem\|legacy_db" src-tauri/src --include="*.rs"
grep -r "LegacyDbSyncItem\|legacyDb" src --include="*.ts" --include="*.tsx"
```
Expected: zero matches.

- [ ] **Step 5: Smoke test in dev mode**

```bash
pnpm tauri dev
```
- Open Settings → Pack Sync. Verify the dialog shows language checkboxes.
- Without content.db: hymnal should show empty state (no error toast).
- After a fresh sync with a language selected: `content-pt-BR.db` should appear in the app data directory.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: pack sync CDN fixes complete — content.db, language-scoped packs, DB-aligned paths"
```
