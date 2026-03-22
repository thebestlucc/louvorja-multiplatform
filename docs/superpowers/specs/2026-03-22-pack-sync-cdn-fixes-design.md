# Pack Sync CDN Fixes — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Admin panel + Rust backend + frontend query layer

---

## Problem Summary

Three related issues in the CDN pack sync system:

1. **Dual folder extraction** — Packs extract into both `config/` and `media/` subfolders. Root cause: `canonicalPackPath()` returns the original FTP path unchanged when the second-to-last segment is not a numeric ID (e.g. `.DS_Store` inside an album folder). Those files enter the ZIP with `config/` prefixes, creating a stray `config/` tree on extraction.

2. **`.DS_Store` ghost collection** — macOS metadata files are not filtered. `extractAlbumName()` returns `".DS_Store"` as a collection name; the executor calls `ensure_collection_by_name(".DS_Store")`.

3. **Audio and covers not resolving** — The current `media/` canonical path format diverges from the legacy DB path format (`/musics/pt/…`, `/covers/…`, `/images/…`). The executor's ID-extraction heuristic silently produces `None` for album songs. Album year always displays 2026 because the old import uses `created_at` instead of parsing the year from the album name prefix.

---

## Fix 1 — Admin Panel: Filter system files (Issues 1 & 2)

**File:** `admin-panel/src/app/packs/new/page.tsx`

Add `isSystemFile(relativePath: string): boolean` before any other processing:

```typescript
function isSystemFile(relativePath: string): boolean {
  return relativePath.split('/').some(
    seg => seg.startsWith('.') || seg === '__MACOSX'
  );
}
```

Apply in two places:
1. When building `LocalFile[]` — skip files where `isSystemFile(relativePath)` is true.
2. In `groupFiles()` — also skip files whose canonical path starts with `config/` (defensive fallback).

**Rust executor:** before calling `ensure_collection_by_name`, skip if `album_name` starts with `.`.

---

## Fix 2 — Canonical paths aligned with DB format (Issues 1 & 3)

**File:** `admin-panel/src/app/packs/new/page.tsx` — `canonicalPackPath()` rewritten.

New canonical format matches the legacy DB `files.dir + '/' + files.name` exactly:

| FTP source | New canonical |
|---|---|
| `config/musicas/{album}/{id}/{file}` | `musics/{lang-short}/{album}/{file}` |
| `config/capas/{id}/{file}` | `covers/{file}` |
| `config/imagens/{id}/{file}` | `images/{file}` |

`{lang-short}` is `pt`, `en`, or `es` derived from the pack's selected BCP 47 language tag.

On extraction files land at `{app_data_dir}/musics/pt/AlbumName/song.mp3`. Resolution from DB is `app_data_dir.join(path.trim_start_matches('/'))`. No translation module needed.

**Requires re-publishing all packs** (necessary regardless to fix Issues 1 & 2).

---

## Fix 3 — Language-scoped packs & i18n content selection

### Admin panel

New required `language` select field with no default (publish flow is blocked until selected):

| Display label | BCP 47 tag | Internal code (DB `id_language`, path prefix) |
|---|---|---|
| Português (Brasil) | `pt-BR` | `pt` |
| Español | `es` | `es` |
| English (US) | `en-US` | `en` |

`es` without a region subtag is intentional — the Spanish content covers multiple countries. `pt-BR` and `en-US` are region-specific by content. All three are valid BCP 47.

Pack IDs embed the language tag: `hymnal-pt-BR-audio-001`.

### Manifest TypeScript changes (`admin-panel/src/lib/manifest.ts`)

```typescript
export interface ManifestPack {
  // ...existing fields...
  language: "pt-BR" | "es" | "en-US";  // required
}

export interface DbEntry {
  url: string;
  version: number;
}

export interface ContentManifest {
  manifestVersion: number;
  generatedAt: string;
  packs: ManifestPack[];
  // dbUrl and dbVersion are REMOVED
  databases: Record<string, DbEntry>;  // keyed by BCP 47 tag
}
```

### Manifest Rust struct changes (`content_sync/manifest.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPack {
    // ...existing fields...
    pub language: String,   // BCP 47 tag
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEntry {
    pub url: String,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentManifest {
    pub manifest_version: i64,
    pub generated_at: String,
    pub packs: Vec<ManifestPack>,
    // Remove: db_url, db_version
    #[serde(default)]
    pub databases: HashMap<String, DbEntry>,  // keyed by BCP 47
}
```

`DbEntry` fields are `url` and `version` (both lowercase, no rename needed). `serde(rename_all = "camelCase")` is still applied for consistency.

### `LegacyDbSyncItem` / `legacy_db` removal

`LegacyDbSyncItem` struct and `legacy_db: Option<LegacyDbSyncItem>` field are removed from `PackSyncPlan`. The planner no longer builds a legacy-DB phase. Phase 3 (legacy DB import) in `executor.rs` is replaced by the content-db save logic in Fix 4.

### App settings

`pack_sync.selected_languages` is stored as a JSON string in the existing settings key-value table (same pattern as other `pack_sync.*` keys).

```rust
// db/queries/content_sync.rs — new helpers
pub fn get_selected_languages(conn: &Connection) -> Vec<String> {
    get_setting(conn, "pack_sync.selected_languages")
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default()   // empty Vec if missing
}

pub fn set_selected_languages(conn: &Connection, langs: &[String]) -> Result<(), AppError> {
    let json = serde_json::to_string(langs).map_err(AppError::SerdeJson)?;
    set_setting(conn, "pack_sync.selected_languages", &json)
}
```

**Default / first-run behaviour:** if `selected_languages` is empty AND `content_dbs` already contains entries (previous sync under old system), default to all installed language codes so existing users are not left with a broken empty state. Otherwise an empty `selected_languages` produces a zero-item plan and the dialog prompts the user to pick at least one language.

### Planner changes (`planner.rs`)

`build_plan` reads `selected_languages` from settings. It filters `manifest.packs` to only those whose `pack.language` is in `selected_languages`, and filters `manifest.databases` similarly. `PackSyncPlanItem` gains `language: String`. `PackSyncPlan` gains `available_languages: Vec<String>` (all languages present in manifest) and `selected_languages: Vec<String>` (current setting), surfaced in the sync dialog. The `legacy_db` field and `LegacyDbSyncItem` references are removed.

### Rollout note

Once the admin panel publishes a manifest with `databases` instead of `dbUrl`/`dbVersion`, old app versions will see `db_url = None` and skip the legacy DB import permanently. Coordinate by releasing a new app version supporting `databases` before flipping the manifest.

---

## Fix 4 — content.db as primary hymnal/collection source

Replace `import_legacy_db` with saving the downloaded DB directly as `content-{bcp47}.db`.

### AppState (`state.rs`)

```rust
pub struct AppState {
    pub db: Pool<SqliteConnectionManager>,
    pub content_dbs: Arc<Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>,
    // ...existing fields unchanged...
}
```

Initialised in `lib.rs` `setup()`:

```rust
let content_dbs: HashMap<String, Pool<SqliteConnectionManager>> = HashMap::new();
// (populated below by startup scan)
let app_state = AppState {
    db: main_pool,
    content_dbs: Arc::new(Mutex::new(content_dbs)),
    // ...
};
app.manage(app_state);

// Startup scan — after manage():
let app_data_dir = app.path().app_data_dir()?;
let state = app.state::<AppState>();
for entry in std::fs::read_dir(&app_data_dir)?.flatten() {
    let path = entry.path();
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.starts_with("content-") && name.ends_with(".db") {
            let lang = name
                .strip_prefix("content-").unwrap()
                .strip_suffix(".db").unwrap()
                .to_string();  // e.g. "pt-BR"
            if let Ok(pool) = open_content_db_pool(&path) {
                init_content_db_fts(&pool.get()?, &lang)?;
                state.content_dbs.lock().unwrap().insert(lang, pool);
            }
        }
    }
}
```

### Calling convention for query functions

To avoid holding `content_dbs` mutex during query execution, clone the pool (r2d2 `Pool` is `Arc`-based, clone is cheap):

```rust
// In Tauri command handler:
let pool_opt: Option<Pool<SqliteConnectionManager>> = {
    let map = state.content_dbs.lock().unwrap();
    map.get("pt-BR").cloned()   // clone Arc-based pool, drop MutexGuard here
};
let content_conn = pool_opt.as_ref().and_then(|p| p.get().ok());

// Pass to query function:
let hymns = get_hymns(&main_conn, content_conn.as_deref())?;
//                                  ^ PooledConnection derefs to &Connection
```

The `MutexGuard` is dropped at the end of the inner block, before `.get()` is called and before the query runs.

### Query function signatures

```rust
pub fn get_hymns(conn: &Connection, content_db: Option<&Connection>) -> Result<Vec<Hymn>, AppError>
pub fn get_hymn(conn: &Connection, content_db: Option<&Connection>, id: i64) -> Result<Hymn, AppError>
pub fn search_hymns(conn: &Connection, content_db: Option<&Connection>, query: &str) -> Result<Vec<Hymn>, AppError>
pub fn get_collections(conn: &Connection, content_db: Option<&Connection>) -> Result<Vec<Collection>, AppError>
pub fn get_collection_hymns(conn: &Connection, content_db: Option<&Connection>, album_id: i64) -> Result<Vec<Hymn>, AppError>
```

When `content_db` is `None`, all functions return `Ok(vec![])`.

### `bcp47_to_lang_code` helper

```rust
/// Maps BCP 47 content language tags to the 2-letter code used
/// as id_language in the legacy DB files table.
pub fn bcp47_to_lang_code(tag: &str) -> &str {
    match tag {
        "pt-BR" => "pt",
        "en-US" => "en",
        "es"    => "es",
        other   => other,  // pass-through for unknown tags
    }
}
```

The legacy DB uses 2-letter codes (`pt`, `en`, `es`) as `id_language` values, confirmed from `legacy-app/database.db`.

### `save_content_db` helper (`db/queries/content_sync.rs`)

```rust
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

### FTS5 init (`db/queries/content_sync.rs`)

```rust
/// Creates and populates musics_fts if not already populated.
/// Safe to call multiple times (guarded by row count check).
pub fn init_content_db_fts(conn: &Connection, lang_bcp47: &str) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS musics_fts USING fts5(name, lyrics);"
    )?;
    // Guard: skip if already populated (handles interrupted-init recovery)
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM musics_fts", [], |r| r.get(0)
    )?;
    if count > 0 { return Ok(()); }

    let lang_short = bcp47_to_lang_code(lang_bcp47);
    let mut stmt = conn.prepare(
        "INSERT INTO musics_fts(rowid, name, lyrics)
         SELECT m.id_music, m.name, COALESCE(GROUP_CONCAT(l.lyric, ' '), '')
         FROM musics m
         LEFT JOIN lyrics l ON l.id_music = m.id_music AND l.id_language = ?1
         GROUP BY m.id_music"
    )?;
    stmt.execute([lang_short])?;
    Ok(())
}
```

`execute_batch` is used only for the DDL (no parameters). The `INSERT` uses `prepare()` + `execute()` to bind the language code.

### content.db lifecycle

1. **Download** — executor saves to `{app_data_dir}/content-{bcp47}.db.tmp`, verifies SHA-256, calls `save_content_db()` to rename atomically.
2. **FTS5 init** — `init_content_db_fts()` called after rename. Skips if already populated (row count > 0 guards against partial init).
3. **Hot-swap** — executor: open new pool on renamed file → call `init_content_db_fts` on new connection → acquire `content_dbs` mutex → remove old entry (old `Pool` is dropped; r2d2 drains gracefully when last reference is gone, no explicit close API needed) → insert new pool → release mutex. Mutex held only during map surgery, not during FTS init.
4. **App startup** — startup scan in `lib.rs` as shown above.
5. **Erase app data** — existing command extended to:
   - Drain `content_dbs` map (acquire mutex, call `.clear()`, release mutex).
   - Delete all `content-*.db` files from `app_data_dir`.
   - Delete extracted pack directories: `musics/`, `covers/`, `images/`.
   - Delete any `*.db.tmp` and `pack_*.zip.tmp` temp files.
   - Reset all `pack_sync.*` settings to defaults via `delete_setting` / `set_setting`.

### Hymnal queries (`db/queries/music.rs`)

```sql
-- get_hymns via content_db
SELECT
    m.id_music                       AS id,
    m.name                           AS title,
    a.name                           AS album,
    am.track                         AS number,
    fa.dir || '/' || fa.name         AS audio_path,
    fp.dir || '/' || fp.name         AS playback_path,
    fi.dir || '/' || fi.name         AS cover_path
FROM musics m
LEFT JOIN albums_musics am ON am.id_music = m.id_music
LEFT JOIN albums        a  ON a.id_album  = am.id_album
LEFT JOIN files         fa ON fa.id_file  = m.id_file_music
LEFT JOIN files         fp ON fp.id_file  = m.id_file_instrumental_music
LEFT JOIN files         fi ON fi.id_file  = m.id_file_image
WHERE m.id_language = ?1
ORDER BY a.name, am.track;
```

Returned `audio_path`, `playback_path`, `cover_path` are DB-native paths like `/musics/pt/AlbumName/song.mp3`. Command handler resolves to absolute path: `app_data_dir.join(path.trim_start_matches('/'))`.

The existing `Hymn` struct in `models.rs` already has `audio_path: Option<String>` and `playback_path: Option<String>` fields (used by the old import). Verify `cover_path: Option<String>` is present; add if missing.

### Collection queries (`db/queries/music.rs`)

```rust
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub cover_path: Option<String>,
    pub year: Option<u32>,
    // ...other existing fields...
}
```

```sql
-- get_collections via content_db
SELECT
    a.id_album                        AS id,
    a.name                            AS name,
    f.dir || '/' || f.name            AS cover_path,
    CAST(SUBSTR(a.name, 1, 4) AS INTEGER) AS year
FROM albums a
LEFT JOIN files f ON f.id_file = a.id_file_image
WHERE a.id_language = ?1
ORDER BY a.name;
```

`year` is cast to INTEGER in SQL. Rust maps it to `Option<u32>`: accept only values in `1900..=2100`, null → `None`. Example: `"1992 - Brilha Jesus"` → `year = 1992`. Albums with non-numeric prefixes → `year = NULL` → `None`.

### FTS5 search

```sql
SELECT m.id_music, m.name,
       snippet(musics_fts, 1, '<b>', '</b>', '…', 10) AS snippet
FROM musics_fts
JOIN musics m ON musics_fts.rowid = m.id_music
WHERE musics_fts MATCH ?1
  AND m.id_language = ?2
ORDER BY rank
LIMIT 50;
```

Falls back to main DB `hymns_fts` when `content_db` is `None`.

### Remove old import

`import_legacy_db()` is removed from `db/queries/content_sync.rs`. The `hymns` and `collections` tables in main DB are retained for schema stability but CDN sync no longer writes to them.

---

## Test Strategy

- **`is_system_file()`** — unit test with `.DS_Store`, `__MACOSX/foo`, normal paths.
- **`canonical_pack_path()`** — unit tests for each FTP→canonical mapping, including edge cases (year-only album, Hinário, non-music paths).
- **`bcp47_to_lang_code()`** — unit tests for all three known tags plus unknown pass-through.
- **`init_content_db_fts()`** — test with empty DB (populates), test idempotency (second call is a no-op), test interrupted-init recovery (table exists but empty → repopulates).
- **`get_hymns` / `get_collections` with `content_db = None`** — must return `Ok(vec![])`, not an error.
- **`save_content_db()`** — test rename succeeds, returns correct dest path.

---

## Files Changed

### Admin Panel
- `admin-panel/src/app/packs/new/page.tsx` — `isSystemFile()`, required `language` field, rewritten `canonicalPackPath()`
- `admin-panel/src/lib/manifest.ts` — `ManifestPack.language`, `ContentManifest.databases`, remove `dbUrl`/`dbVersion`

### Rust Backend
- `src-tauri/src/state.rs` — add `content_dbs: Arc<Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>`
- `src-tauri/src/lib.rs` — initialise `content_dbs`, startup scan, update `erase_app_data`
- `src-tauri/src/pack_sync/executor.rs` — replace Phase 3 import with `save_content_db` + `init_content_db_fts` + hot-swap; `.DS_Store` collection guard
- `src-tauri/src/pack_sync/planner.rs` — add `language` to `PackSyncPlanItem`; remove `legacy_db`/`LegacyDbSyncItem`; filter by `selected_languages`; surface `available_languages` in plan
- `src-tauri/src/content_sync/manifest.rs` — update `ContentManifest` and `ManifestPack` Rust structs; add `DbEntry`; remove `db_url`/`db_version`
- `src-tauri/src/db/queries/content_sync.rs` — remove `import_legacy_db`; add `save_content_db`, `init_content_db_fts`, `get_selected_languages`, `set_selected_languages`, `bcp47_to_lang_code`
- `src-tauri/src/db/queries/music.rs` — rewrite `get_hymns`, `get_hymn`, `search_hymns`, `get_hymn_by_number`, `get_collections`, `get_collection_hymns` with `Option<&Connection>` for content_db
- `src-tauri/src/db/models.rs` — verify/add `cover_path: Option<String>` on `Hymn`; add/update `Collection` struct with `year: Option<u32>`
- `src-tauri/src/commands/music.rs` (or wherever `erase_app_data` lives) — extend erase per lifecycle spec above; update hymn/collection command handlers to acquire content_db pool using clone pattern

### Frontend
- `src/components/content-sync/pack-sync-dialog.tsx` — language selection checklist; per-language download sizes; block sync if no language selected
- `src/types/content-sync.ts` — `PackSyncPlanItem.language`; `PackSyncPlan.availableLanguages`, `PackSyncPlan.selectedLanguages`
- `src/lib/bindings.ts` — regenerated (do not edit manually)

---

## Constraints & Notes

- **Re-upload required:** All CDN packs must be re-published with DB-aligned paths and language tags. No migration path for existing `media/` packs.
- **Rollout coordination:** Release new app version before switching manifest to `databases`. Old clients permanently stop receiving DB updates once `dbUrl` is removed.
- **Bible DB excluded** — unchanged.
- **r2d2 pool per language** — min 1, max 3 connections each. Mutex wraps the map, not individual pools.
- **content_db effectively read-only** — WAL mode, no contention after FTS init.
- **Hinário detection** — `name.to_lowercase().starts_with("hinar")` covers `"hinário"` without unicode normalisation (the accented `á` preserves the leading ASCII `"hinar"`).
