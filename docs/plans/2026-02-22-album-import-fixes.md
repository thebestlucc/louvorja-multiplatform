# Album Import: Bug Fixes & Improvements Plan

**Date:** 2026-02-22  
**Source:** Code review of `2026-02-22-album-import-collections.md` implementation  
**Status:** Complete (implemented 2026-02-23)

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | `commands/legacy_fetch.rs` | `restore_hymn_from_api` passes wrong `data_dir` to `download_media_file` |
| 2 | HIGH | `commands/legacy_fetch.rs` | `restore_hymn_from_api` hardcodes `ApiLanguage::Pt` |
| 3 | HIGH | `commands/legacy_fetch.rs` | Album import skips hymn update when `replace_existing=true` and hymn already exists |
| 4 | MEDIUM | `queries/collections.rs` | `insert_collection_hymn` returns stale `last_insert_rowid()` on `INSERT OR IGNORE` duplicate |
| 5 | MEDIUM | `queries/collections.rs` | `item_order` never updated when re-importing an already-linked hymn |
| 6 | MEDIUM | `models.rs` | Stale `#[allow(dead_code)]` on `CollectionHymn` and `CollectionWithHymns` |
| 7 | LOW | `legacy_fetch/mod.rs` | `download_media_file` has no response size limit |
| 8 | LOW | `commands/legacy_fetch.rs` | `run_states` HashMap never prunes completed entries |

---

## Fix 1 — CRITICAL: `restore_hymn_from_api` wrong media dir

**File:** `src-tauri/src/commands/legacy_fetch.rs` lines 972–975

**Problem:**  
`download_media_file` expects `media_dir` (the directory that _contains_ `media/` as a path prefix in its output). The function builds:
```
relative_path = "media/{subfolder}/{id}/{filename}"
full_path     = media_dir.join(subfolder).join(id).join(filename)
```
In the batch import, `media_dir = app.path().app_data_dir()?.join("media")` — so `full_path` resolves to `<app_data>/media/images/123/file.jpg`, matching the relative path `media/images/123/file.jpg`.

But `restore_hymn_from_api` passes `app.path().app_data_dir()?` (without `.join("media")`), so `full_path` resolves to `<app_data>/images/123/file.jpg` while the DB stores `media/images/123/file.jpg`. The file is written to the wrong disk location and the existing relative path in the DB becomes stale — the cover is effectively lost.

**Fix:**
```rust
// BEFORE (line 972)
let data_dir: PathBuf = app
    .path()
    .app_data_dir()
    .map_err(|e| AppError::Internal(e.to_string()))?;

// AFTER
let data_dir: PathBuf = app
    .path()
    .app_data_dir()
    .map_err(|e| AppError::Internal(e.to_string()))?
    .join("media");
```

**Test:** Re-run "Restore from API" on a hymn, observe that the cover file lands under `<app_data>/media/images/{id}/` and renders correctly on projection.

---

## Fix 2 — HIGH: Hardcoded `ApiLanguage::Pt` in restore

**File:** `src-tauri/src/commands/legacy_fetch.rs` line 963

**Problem:**  
`restore_hymn_from_api` always uses `ApiLanguage::Pt`:
```rust
let detail = fetch_music_detail(ApiLanguage::Pt, api_music_id).await ...
```
Users who imported in `en` or `es` locale will fetch Portuguese lyrics on restore, silently replacing their localized data.

**Fix:**  
Accept a `language` parameter in the command and pass it through from the frontend:

```rust
// Command signature adds `language`:
pub async fn restore_hymn_from_api(
    hymn_id: i64,
    language: ApiLanguage,    // NEW
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), AppError> {
    ...
    let detail = fetch_music_detail(language, api_music_id).await ...
```

**Frontend (`lib/tauri.ts`):**
```ts
// Update wrapper to accept and pass language
export async function restoreHymnFromApi(hymnId: number, language: string): Promise<void> {
  return invoke<void>("restore_hymn_from_api", { hymnId, language });
}
```

**Frontend (`lib/queries.ts` / usage site):**  
Pass user's current locale (mapped to `pt`/`en`/`es`) when calling the mutation.

---

## Fix 3 — HIGH: Album import skips update for existing hymns

**File:** `src-tauri/src/commands/legacy_fetch.rs` lines 724–728

**Problem:**  
```rust
let hymn_id = if let Some(hid) = existing_hymn_id {
    hid   // ← when hymn already exists, skip entire import block
} else {
    // fetch lyrics, download media, call import_music_to_db ...
};
```
When `options.replace_existing == true` and the hymn already exists by `api_music_id`, the code still short-circuits to just `hid`, never calling `import_music_to_db` with `replace_existing=true`. Updated lyrics, covers, and audio are silently lost.

**Fix:**  
When `replace_existing && existing_hymn_id.is_some()`, fall through to the import path so `import_music_to_db` runs the UPDATE branch:

```rust
let hymn_id = if existing_hymn_id.is_some() && !options.replace_existing {
    existing_hymn_id.unwrap()
} else {
    // Existing full import block (fetch lyrics, download media, import_music_to_db)
    // import_music_to_db already handles the Some(id)+replace_existing UPDATE path
    ...
};
```

**Note:** `import_music_to_db` already has the `Some(id) if replace_existing => { UPDATE ... }` branch — it just never gets called because the outer code short-circuits.

---

## Fix 4 — MEDIUM: `insert_collection_hymn` stale rowid on duplicates

**File:** `src-tauri/src/db/queries/collections.rs` lines 698–710

**Problem:**  
```rust
conn.execute(
    "INSERT OR IGNORE INTO collection_hymns (collection_id, hymn_id, item_order)
     VALUES (?1, ?2, ?3)",
    params![collection_id, hymn_id, item_order],
)?;
Ok(conn.last_insert_rowid())  // stale if INSERT was ignored
```
When the `(collection_id, hymn_id)` UNIQUE constraint fires, the INSERT is silently ignored, but `last_insert_rowid()` returns the rowid from the **previous** successful insert (or 0), not the existing row's ID. Callers may get a wrong/misleading ID.

**Fix — Option A (return bool for "was inserted"):**
```rust
pub fn insert_collection_hymn(
    conn: &Connection,
    collection_id: i64,
    hymn_id: i64,
    item_order: i64,
) -> Result<bool, AppError> {
    conn.execute(
        "INSERT OR IGNORE INTO collection_hymns (collection_id, hymn_id, item_order)
         VALUES (?1, ?2, ?3)",
        params![collection_id, hymn_id, item_order],
    )?;
    Ok(conn.changes() > 0)
}
```

**Callers update:**  
The only caller (album import loop) already uses `.is_ok()` — change to check the returned bool:
```rust
if let Ok(true) = insert_collection_hymn(&db_guard, collection_id, hymn_id, track_order) {
    collection_hymns_linked += 1;
}
```

---

## Fix 5 — MEDIUM: `item_order` not refreshed on re-import

**File:** `src-tauri/src/db/queries/collections.rs` lines 698–710

**Problem:**  
When the same hymn is re-linked to the same collection on a re-import (e.g., the API reordered tracks), `INSERT OR IGNORE` silently discards the new `item_order`. The collection stays with the stale track order.

**Fix:**  
Change to `ON CONFLICT ... DO UPDATE SET item_order`:
```rust
conn.execute(
    "INSERT INTO collection_hymns (collection_id, hymn_id, item_order)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(collection_id, hymn_id) DO UPDATE SET item_order = excluded.item_order",
    params![collection_id, hymn_id, item_order],
)?;
Ok(conn.changes() > 0)
```

This also fixes Fix 4 because `ON CONFLICT ... DO UPDATE` always counts as a "change" — `conn.changes()` will be 1 for both inserts and updates. A true new link vs an order-update can be differentiated by checking `conn.last_insert_rowid()` vs the previous value, but for the counter's purpose, counting only genuinely new links requires a SELECT-first approach or removing the counter bump on updates.

**Revised approach — combine Fixes 4+5:**
```rust
pub fn insert_collection_hymn(
    conn: &Connection,
    collection_id: i64,
    hymn_id: i64,
    item_order: i64,
) -> Result<bool, AppError> {
    // Check if link already exists
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM collection_hymns WHERE collection_id = ?1 AND hymn_id = ?2",
            params![collection_id, hymn_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    conn.execute(
        "INSERT INTO collection_hymns (collection_id, hymn_id, item_order)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(collection_id, hymn_id) DO UPDATE SET item_order = excluded.item_order",
        params![collection_id, hymn_id, item_order],
    )?;

    Ok(!exists) // true = newly created link
}
```

---

## Fix 6 — MEDIUM: Stale `#[allow(dead_code)]` on models

**File:** `src-tauri/src/db/models.rs` lines 303–317

**Problem:**  
`CollectionHymn` and `CollectionWithHymns` still carry `#[allow(dead_code)]` and "Planned for album-import-collections feature" doc comments, but the feature is now implemented. `CollectionHymn` is actively used by the `get_collection_hymns` command, and `CollectionWithHymns` is used by `get_collection_with_hymns`.

**Fix:**  
- `CollectionHymn`: Remove `#[allow(dead_code)]` and update doc comment — it's actively used by the `add_hymn_to_collection` / `remove_hymn_from_collection` commands via types. **Wait** — check if it's actually used by name anywhere. If only `Vec<Hymn>` is returned (not `Vec<CollectionHymn>`), `CollectionHymn` itself remains dead code. Need to verify.
  
  → `get_collection_hymns` returns `Vec<Hymn>`, not `Vec<CollectionHymn>`. The struct IS dead code — keep `#[allow(dead_code)]` but update the doc comment to note it's scaffolded for future direct-link CRUD.

- `CollectionWithHymns`: Used by `get_collection_with_hymns()` which itself has `#[allow(dead_code)]`. Both are scaffolded. Keep annotations, update doc comments:

```rust
/// Used by `get_collection_with_hymns` query (currently scaffolded for future collection detail endpoint)
#[allow(dead_code)]
```

**Action:** Update doc comments only — no functional change.

---

## Fix 7 — LOW: No download size limit

**File:** `src-tauri/src/legacy_fetch/mod.rs` `download_file()` (called by `download_media_file`)

**Problem:**  
`download_file` downloads the full response body with no size cap. A malicious or broken API response could write gigabytes to disk.

**Fix:**  
Add a size guard in `download_file`:
```rust
const MAX_DOWNLOAD_SIZE: u64 = 50 * 1024 * 1024; // 50 MB

// In download_file, before writing:
if let Some(len) = response.content_length() {
    if len > MAX_DOWNLOAD_SIZE {
        return Err(format!("File too large: {} bytes (max {})", len, MAX_DOWNLOAD_SIZE).into());
    }
}
```

For streaming bodies (no content-length), track bytes written and abort if threshold exceeded.

---

## Fix 8 — LOW: `run_states` never pruned

**File:** `src-tauri/src/commands/legacy_fetch.rs`

**Problem:**  
`RUN_STATES` is a `Mutex<HashMap<String, RunState>>` that tracks active fetch operations. Entries are inserted when a run starts but never removed when it completes or is cancelled. Over many runs, the HashMap grows unboundedly (though practically this is a minor leak since each entry is small and runs are infrequent).

**Fix:**  
After `run_legacy_fetch_background` completes (either normally or via cancellation), remove the entry:
```rust
// At the end of run_legacy_fetch_background, after emitting final report:
{
    let mut states = RUN_STATES.lock().unwrap();
    states.remove(&run_id);
}
```

Alternatively, prune entries older than 1 hour whenever a new run starts.

---

## Execution Order

| Batch | Fixes | Dependencies | Effort |
|-------|-------|--------------|--------|
| A | 1, 2 | None | ~20 min |
| B | 3 | None | ~15 min |
| C | 4+5 | None | ~15 min |
| D | 6 | None | ~5 min |
| E | 7, 8 | None | ~15 min |
| F | Compile + smoke test | A–E | ~10 min |

All batches are independent (A–E can be done in any order). Batch F validates everything.

### Batch A — Fix 1 + Fix 2 (restore_hymn_from_api)

1. In `commands/legacy_fetch.rs`:
   - Add `.join("media")` to the `data_dir` resolution (Fix 1)
   - Add `language: ApiLanguage` parameter to `restore_hymn_from_api` (Fix 2)
   - Replace `ApiLanguage::Pt` with the new `language` param
2. In `lib/tauri.ts`:
   - Update `restoreHymnFromApi` wrapper to accept and pass `language`
3. In `lib/queries.ts`:
   - Update `useRestoreHymnFromApi` mutation to accept `language` in its variables
4. In `routes/hymnal/$hymnId.tsx`:
   - Pass current i18n language (mapped to `pt`/`en`/`es`) when calling restore mutation

### Batch B — Fix 3 (album import replace_existing)

1. In `commands/legacy_fetch.rs`:
   - Change the `if let Some(hid) = existing_hymn_id` check to only short-circuit when `!options.replace_existing`
   - When `replace_existing && existing_hymn_id.is_some()`, fall through to fetch lyrics + download media + call `import_music_to_db`

### Batch C — Fixes 4+5 (insert_collection_hymn)

1. In `queries/collections.rs`:
   - Replace `INSERT OR IGNORE` with `ON CONFLICT DO UPDATE SET item_order`
   - Change return type from `Result<i64>` to `Result<bool>`
   - Add `exists` check before upsert to return accurate "was new" flag
2. In `commands/legacy_fetch.rs`:
   - Update caller to check `Ok(true)` instead of `.is_ok()`
3. In `commands/collections.rs`:
   - Verify `add_hymn_to_collection` command handles the new return type

### Batch D — Fix 6 (doc comments)

1. In `models.rs`:
   - Update doc comments on `CollectionHymn` and `CollectionWithHymns` to reflect current status
2. In `queries/collections.rs`:
   - Update doc comment on `get_collection_with_hymns` similarly

### Batch E — Fixes 7+8 (hardening)

1. In `legacy_fetch/mod.rs`:
   - Add `MAX_DOWNLOAD_SIZE` constant
   - Add size check in `download_file` (content-length header check + streaming byte counter)
2. In `commands/legacy_fetch.rs`:
   - Add state cleanup at end of `run_legacy_fetch_background` to remove run entry from `RUN_STATES`

### Batch F — Validation

```bash
cargo build --manifest-path src-tauri/Cargo.toml
pnpm vite build && npx tsc --noEmit
```

Manual smoke test:
1. "Restore from API" → verify cover file lands in correct `media/images/{id}/` path
2. Re-run album import with `replace_existing=true` → verify existing hymns get updated
3. Re-import same albums → verify `collection_hymns_linked` counter is accurate (only counts new links)
4. Verify no compile warnings from stale dead_code annotations
