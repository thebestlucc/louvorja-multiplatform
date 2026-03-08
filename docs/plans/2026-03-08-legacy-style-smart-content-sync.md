# Legacy-Style Smart Content Sync

**Date:** 2026-03-08

## Summary

Implement a dedicated content-sync system that recreates the useful parts of the legacy Delphi flow:

1. detect when remote content changed,
2. show a clear “new content available” prompt,
3. compute what changed instead of blindly re-importing everything,
4. let the operator sync selectively or fully,
5. repair missing/stale local media,
6. fall back to the current full-fetch flow when the remote manifest API is unavailable.

This plan explicitly separates:

- **app binary updates** handled by the Tauri updater,
- **content updates** handled by a new manifest-driven sync pipeline.

## Goal

Deliver a production-ready content sync flow for hymnal and API-backed collections that:

- detects remote content changes on startup and on demand,
- shows current vs remote content versions,
- computes a sync plan for changed hymns, albums, and media,
- supports selective sync and full sync,
- records sync metadata locally,
- can restore drifted or missing assets,
- does not break the existing legacy fetch wizard.

## Non-Goals

- Replacing the Tauri binary updater.
- Syncing file-based `.slja` / `.pptx` collections from a remote source.
- Background auto-download without user confirmation.
- Deleting user-authored hymns or file-based collections.

## Current Baseline

Relevant existing pieces:

- Remote content fetcher: [src-tauri/src/legacy_fetch/mod.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/legacy_fetch/mod.rs)
- Background fetch orchestration: [src-tauri/src/commands/legacy_fetch.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/legacy_fetch.rs)
- Content version toast on startup: [src/routes/__root.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/__root.tsx)
- Manual fetch UI: [src/components/migration/legacy-fetch-wizard.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/migration/legacy-fetch-wizard.tsx)
- Schema foundation for API-backed collections: [src-tauri/src/db/migrations.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs)
- Collection/hymn linkage: [src-tauri/src/db/queries/collections.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/queries/collections.rs)

Current limitation:

- The app only compares remote `db_version` against local `api.dbVersion`.
- It knows that “something changed”, but not **what** changed.
- The user can run a broad fetch or restore a single hymn/album, but there is no real sync plan.

## Architecture Decisions

1. **Create a new `content_sync` module instead of overloading `legacy_fetch` further.**
   `legacy_fetch` stays as the bulk import/fallback path. `content_sync` becomes the selective-sync path.

2. **Use manifest-first sync with fallback.**
   Preferred path:
   - remote summary endpoint says whether sync is needed,
   - remote manifest endpoints describe changed/deleted entities,
   - app applies only necessary updates.

   Fallback path:
   - if manifest endpoints are unavailable, reuse current `db_version` check,
   - show a degraded UX that offers a full fetch through the existing pipeline.

3. **Persist per-entity sync metadata locally.**
   Store remote version/hash/asset version per hymn and album so the app can detect:
   - changed text,
   - changed media,
   - deleted remote entries,
   - missing local files.

4. **Treat albums as collections and hymns as the canonical content rows.**
   Reuse existing `collections`, `hymns`, and `collection_hymns`.
   Add sync metadata beside them instead of duplicating domain tables.

5. **Never auto-delete user content.**
   Remote deletions only apply to rows marked as API-managed.
   User-created/file-based content is out of scope for remote deletion.

6. **Use the same import/update primitives for smart sync and full fetch.**
   Refactor shared import logic so both flows call the same upsert/media-write helpers.

## Required Remote API Contract

Preferred new API endpoints on `api.louvorja.com.br`:

### `GET /sync/summary`

Returns:

```json
{
  "content_version": 128,
  "previous_version": 127,
  "has_changes": true,
  "generated_at": "2026-03-08T12:00:00Z",
  "counts": {
    "hymns_changed": 12,
    "albums_changed": 2,
    "deletions": 1
  }
}
```

### `GET /sync/manifest/hymns?page=N`

Returns per-hymn metadata:

```json
{
  "current_page": 1,
  "last_page": 1,
  "data": [
    {
      "id_music": 42,
      "version": 15,
      "content_hash": "blake3-or-sha256",
      "lyrics_hash": "blake3-or-sha256",
      "audio_version": "3",
      "playback_version": "2",
      "image_version": "9",
      "updated_at": "2026-03-08T11:00:00Z",
      "deleted": false
    }
  ]
}
```

### `GET /sync/manifest/albums?page=N`

Returns per-album metadata:

```json
{
  "current_page": 1,
  "last_page": 1,
  "data": [
    {
      "id_album": 10,
      "version": 7,
      "content_hash": "blake3-or-sha256",
      "image_version": "5",
      "updated_at": "2026-03-08T11:00:00Z",
      "deleted": false
    }
  ]
}
```

### `GET /sync/deletions?since_version=127`

Returns hard deletions for API-managed content.

If these endpoints cannot ship immediately, the app rollout still proceeds with:

- `GET /params`
- existing hymnal/albums/music detail endpoints
- startup degraded mode that offers full sync only

## Local Data Model Changes

Add a new migration with these tables:

### `content_sync_state`

Single-row or key/value style state:

```sql
CREATE TABLE IF NOT EXISTS content_sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content_version INTEGER,
    last_checked_at TEXT,
    last_synced_at TEXT,
    last_sync_status TEXT,
    last_error TEXT
);
```

### `content_sync_entities`

Tracks remote metadata for API-managed rows:

```sql
CREATE TABLE IF NOT EXISTS content_sync_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,             -- 'hymn' | 'album'
    remote_id INTEGER NOT NULL,
    local_id INTEGER,                      -- hymns.id or collections.id
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
CREATE INDEX IF NOT EXISTS idx_content_sync_entities_type_remote
ON content_sync_entities(entity_type, remote_id);
```

### `content_sync_runs`

Stores audit/report history:

```sql
CREATE TABLE IF NOT EXISTS content_sync_runs (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,                    -- 'check' | 'selective' | 'full' | 'repair'
    status TEXT NOT NULL,                  -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    requested_version INTEGER,
    completed_version INTEGER,
    planned_changes_json TEXT,
    result_json TEXT,
    error_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
);
```

## File-by-File Impact

### Backend

- [src-tauri/src/db/migrations.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs)
  Add migration for sync tables.
- [src-tauri/src/db/models.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/models.rs)
  Add `ContentSyncState`, `ContentSyncEntity`, `ContentSyncRun`, `ContentSyncPlan`, `ContentSyncPlanItem`.
- `src-tauri/src/db/queries/content_sync.rs`
  New query module for sync state/entities/runs.
- `src-tauri/src/content_sync/mod.rs`
  New sync engine: summary fetch, manifest fetch, diff planning, execution.
- `src-tauri/src/commands/content_sync.rs`
  New Tauri commands.
- [src-tauri/src/legacy_fetch/mod.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/legacy_fetch/mod.rs)
  Refactor reusable importer/media logic into helpers consumable by both pipelines.
- [src-tauri/src/commands/legacy_fetch.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/legacy_fetch.rs)
  Reuse shared helpers; fallback handoff from smart sync to full fetch.
- [src-tauri/src/state.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/state.rs)
  Add runtime sync state if evented progress is needed.
- [src-tauri/src/lib.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs)
  Register commands.

### Frontend

- `src/types/content-sync.ts`
  New typed sync models.
- [src/lib/tauri.ts](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts)
  Add wrappers for sync commands.
- [src/lib/queries.ts](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts)
  Add hooks for summary, plan, run, progress, execute, dismiss.
- `src/stores/content-sync-store.ts`
  Store modal/report state if needed.
- [src/routes/__root.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/__root.tsx)
  Replace simple toast-only check with summary + modal trigger.
- `src/components/content-sync/content-sync-modal.tsx`
  New modal with current version, remote version, changed counts, actions.
- `src/components/content-sync/content-sync-report.tsx`
  New post-sync report card.
- [src/components/layout/status-bar.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/layout/status-bar.tsx)
  Add sync indicator entry.
- [src/routes/settings/index.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx)
  Add content sync settings and “Check now” action.
- [src/locales/en.json](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json)
- [src/locales/pt.json](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json)
- [src/locales/es.json](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json)

## Step-by-Step Execution Plan

## Task 1: Refactor shared import primitives out of the legacy fetch path

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Modify:**

- [src-tauri/src/legacy_fetch/mod.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/legacy_fetch/mod.rs)
- `src-tauri/src/content_sync/importer.rs`

**Work:**

1. Extract reusable functions for:
   - hymn upsert,
   - album collection upsert,
   - media download/write,
   - `collection_hymns` linking.
2. Keep `legacy_fetch` behavior identical after refactor.
3. Ensure `restore_hymn_from_api` and `restore_album_from_api` continue using the shared helpers.

**Verification:**

```bash
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
```

Expected result: `Finished` or `Checking` with no compile errors in `legacy_fetch` or new `content_sync` modules.

## Task 2: Add sync metadata schema and Rust models

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Modify:**

- [src-tauri/src/db/migrations.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs)
- [src-tauri/src/db/models.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/models.rs)

**Work:**

1. Add the next migration version for:
   - `content_sync_state`
   - `content_sync_entities`
   - `content_sync_runs`
2. Add typed Rust structs with `serde`/`specta` support.
3. Add status enums for plan items and sync runs.

**Verification:**

```bash
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
```

Expected result: new schema compiles and `run_migrations()` remains exhaustive.

## Task 3: Implement database queries for sync state, entity metadata, and run history

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Create/Modify:**

- `src-tauri/src/db/queries/content_sync.rs`
- `src-tauri/src/db/queries/mod.rs`

**Work:**

1. Add CRUD/query functions for:
   - reading/updating sync state,
   - upserting entity metadata by `(entity_type, remote_id)`,
   - creating/completing sync runs,
   - loading drift candidates.
2. Add helper queries to join remote metadata with `hymns` / `collections`.

**Verification:**

```bash
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
```

Expected result: query module compiles and is wired into the `db::queries` tree.

## Task 4: Add manifest-aware API client with graceful fallback

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Create/Modify:**

- `src-tauri/src/content_sync/mod.rs`
- [src-tauri/src/legacy_fetch/mod.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/legacy_fetch/mod.rs)

**Work:**

1. Add `fetch_sync_summary()`.
2. Add `fetch_hymn_manifest_page()` and `fetch_album_manifest_page()`.
3. Add `fetch_deletions_since(version)` if the endpoint exists.
4. If manifest endpoints fail with 404/501/network mismatch:
   - mark sync capability as degraded,
   - return a plan that only allows full sync.

**Verification:**

```bash
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
```

Expected result: manifest client compiles and fallback logic is explicit.

## Task 5: Build the sync planner

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Create/Modify:**

- `src-tauri/src/content_sync/mod.rs`
- `src-tauri/src/db/models.rs`

**Work:**

1. Build a planner that compares:
   - remote content version,
   - remote manifest rows,
   - local `content_sync_entities`,
   - actual local file presence for audio/playback/image paths.
2. Produce typed plan items such as:
   - `create_hymn`
   - `update_hymn`
   - `create_album`
   - `update_album`
   - `relink_collection_hymn`
   - `repair_media`
   - `delete_remote_managed_hymn`
   - `delete_remote_managed_album`
3. Include a summary count for the modal.

**Verification:**

```bash
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
```

Expected result: planner types compile and can represent both manifest and degraded full-sync modes.

## Task 6: Implement the sync executor and evented progress

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Create/Modify:**

- `src-tauri/src/content_sync/mod.rs`
- [src-tauri/src/state.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/state.rs)
- `src-tauri/src/commands/content_sync.rs`

**Work:**

1. Add commands:
   - `get_content_sync_summary`
   - `plan_content_sync`
   - `start_content_sync`
   - `get_content_sync_progress`
   - `cancel_content_sync`
   - `get_content_sync_report`
2. Reuse the background-run pattern already used by `legacy_fetch`.
3. During execution:
   - upsert domain rows,
   - update `content_sync_entities`,
   - record run history,
   - emit progress events,
   - preserve the current full-fetch fallback path.

**Verification:**

```bash
cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml
```

Expected result: commands compile, are registered, and progress payloads are typed.

## Task 7: Register commands and frontend bindings

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Modify:**

- [src-tauri/src/lib.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs)
- [src/lib/tauri.ts](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts)
- [src/lib/queries.ts](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts)
- `src/types/content-sync.ts`

**Work:**

1. Register the new backend commands.
2. Add TypeScript wrappers.
3. Add query/mutation hooks for:
   - summary,
   - plan,
   - execution,
   - progress,
   - report.

**Verification:**

```bash
pnpm exec tsc -p /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tsconfig.json --noEmit
```

Expected result: no new TypeScript errors from the sync bindings.

## Task 8: Replace startup toast-only behavior with a modal-driven sync entrypoint

**Target:** frontend  
**Working Directory:** `.`  
**Agent:** `ring:frontend-engineer`

**Files to Create/Modify:**

- [src/routes/__root.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/__root.tsx)
- `src/components/content-sync/content-sync-modal.tsx`
- `src/stores/content-sync-store.ts`

**Work:**

1. On non-bare routes, call the new summary command instead of only `checkDbVersion()`.
2. If there are remote changes:
   - open a modal,
   - show current/local version vs remote version,
   - show changed counts,
   - present actions:
     - `Sync now`
     - `Review changes`
     - `Later`
3. If the backend is in degraded mode, show:
   - “smart sync unavailable”
   - action to open full sync via the existing fetch flow.

**Verification:**

```bash
pnpm exec tsc -p /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tsconfig.json --noEmit
```

Expected result: the root route compiles and the modal is wired through typed hooks.

## Task 9: Add progress, report, and status-bar visibility

**Target:** frontend  
**Working Directory:** `.`  
**Agent:** `ring:frontend-engineer`

**Files to Create/Modify:**

- `src/components/content-sync/content-sync-report.tsx`
- [src/components/layout/status-bar.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/layout/status-bar.tsx)
- [src/routes/settings/index.tsx](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx)

**Work:**

1. Add a status-bar indicator while sync is running.
2. Show a post-run report with:
   - items planned,
   - hymns updated,
   - albums updated,
   - media repaired,
   - skipped items,
   - errors.
3. Add a settings section with:
   - `Check for content updates on startup`
   - `Open sync prompt automatically`
   - `Check now`
   - `Force full sync`

**Verification:**

```bash
pnpm exec tsc -p /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tsconfig.json --noEmit
```

Expected result: status bar and settings compile cleanly.

## Task 10: Add i18n coverage

**Target:** frontend  
**Working Directory:** `.`  
**Agent:** `ring:frontend-engineer`

**Files to Modify:**

- [src/locales/en.json](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json)
- [src/locales/pt.json](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json)
- [src/locales/es.json](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json)

**Work:**

1. Add copy for:
   - summary modal,
   - degraded mode,
   - progress,
   - report,
   - settings,
   - version labels.
2. Keep keys consistent with existing `legacyFetch` and `updater` naming patterns.

**Verification:**

```bash
node /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/scripts/validate-i18n.mjs
```

Expected result: locale files stay in sync.

## Task 11: Add backend tests for plan and execution behavior

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to Create/Modify:**

- `src-tauri/src/content_sync/mod.rs`
- `src-tauri/src/db/queries/content_sync.rs`

**Work:**

1. Add planner tests for:
   - new hymn,
   - changed hymn media only,
   - deleted remote album,
   - missing local asset repair,
   - degraded full-sync fallback.
2. Add executor tests for metadata persistence and report generation.

**Verification:**

```bash
cargo test --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml content_sync
```

Expected result: sync-specific tests pass.

## Task 12: Add frontend tests for prompt/report UX

**Target:** frontend  
**Working Directory:** `.`  
**Agent:** `ring:frontend-engineer`

**Files to Create/Modify:**

- `tests/content-sync-modal.test.tsx`
- `tests/content-sync-report.test.tsx`

**Work:**

1. Verify modal states:
   - no changes,
   - smart sync available,
   - degraded full-sync fallback.
2. Verify report rendering and counts.
3. Verify startup trigger does not run on bare routes.

**Verification:**

```bash
pnpm test:unit
```

Expected result: new unit tests pass with the current suite.

## Rollout Order

1. Backend refactor and schema.
2. Planner and executor with no UI integration.
3. Typed command exposure.
4. Modal/report/status UI.
5. Startup integration.
6. Tests and polish.

## Failure Recovery

- If manifest endpoints are not ready:
  - ship Tasks 1-3 and 7-10 with degraded mode,
  - route “Sync now” to the existing full fetch wizard.
- If selective deletion is risky:
  - mark deletions as review-only in the plan,
  - hide destructive execution until the API and QA pass.
- If media drift checks are too expensive on startup:
  - run only manifest summary on startup,
  - run file-existence repair during explicit sync execution.

## Verification Checklist

Before considering the feature complete:

1. Startup on a seeded app with unchanged manifest shows no modal.
2. Startup on a newer manifest shows the sync prompt with correct counts.
3. Selective sync updates only changed hymns/albums.
4. Missing local image/audio files are repaired during sync.
5. Degraded mode cleanly offers full sync instead of failing silently.
6. Existing `legacy_fetch` bulk flow still works.
7. Existing single-item restore flows still work.

## Zero-Context Test

A new engineer should be able to start from this plan and know:

- which backend files own sync state and execution,
- which frontend files own the prompt/report UX,
- what new API contract is required,
- how to roll out a degraded fallback first,
- what to verify after each batch.
