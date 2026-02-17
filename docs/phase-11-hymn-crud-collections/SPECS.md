# Phase 11 Specs — Hymn CRUD + Collections + Hybrid Cache Covers

## 1. Implementation Objective

Deliver complete hymn write operations and a separate collections domain using hybrid cache semantics, plus cross-surface cover support and sync-state visibility, while preserving runtime projection stability.

## 2. Baseline Gaps (Current Code)

1. Hymn command surface historically relied on non-functional stubs.
2. No dedicated collections domain/tables/routes for user-managed non-hymnal songs.
3. No canonical hybrid metadata for source tracking (`hash` + `mtime` + cached presentation link).
4. Cover support is inconsistent across hymn and collection surfaces.
5. Docs governance is split between `docs/phase-*` and legacy `.specs/*`.

## 3. Public API / Type Contracts

## 3.1 Rust DB / Domain

Update `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs`:
- `hymns.cover_path TEXT NULL`
- `collections` table:
  - `id`, `name`, `description`, `cover_path`, `auto_cover_path`, timestamps
- `collection_songs` table:
  - `id`, `collection_id`, `source_path`, `source_format`, `source_hash`, `source_mtime_ms`,
  - `cache_presentation_id`, `sync_status`, `last_sync_at`, `item_order`, timestamps

Add models in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/models.rs`:
- `HymnWriteInput`
- `Collection`
- `CollectionSong`
- `CollectionWithSongs`
- `CollectionSongSyncStatus` (`in_sync`, `stale`, `missing_source`, `error`)

## 3.2 Rust Commands

In `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/music.rs`:
- `create_hymn(input: HymnWriteInput) -> Result<Hymn, AppError>`
- `update_hymn(id: i64, input: HymnWriteInput) -> Result<Hymn, AppError>`
- `delete_hymn(id: i64) -> Result<(), AppError>`

Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/collections.rs`:
- collection CRUD
- `import_collection_song(collection_id, path) -> Result<CollectionSong, AppError>`
- `check_collection_song_sync(song_id) -> Result<CollectionSongSyncStatus, AppError>`
- `resync_collection_song(song_id) -> Result<CollectionSong, AppError>`

Extend `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/utility.rs`:
- `copy_image_to_media(image_path: String) -> Result<String, AppError>`

## 3.3 Frontend Contracts

Update `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts` with wrappers for hymn/collections/sync/cover APIs.

Add `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/collection.ts`.

Update `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/hymn.ts` with `cover_path`.

Add settings key contract:
- `collections.autoCheckSourceOnOpen` (boolean, default `true`)

## 4. Architecture Decisions

1. **Hybrid cache as runtime authority**:
   - source file is imported into cached presentation content.
   - runtime uses cached presentation even if source file is missing.
2. **Sync status model**:
   - compute with `hash + mtime` against source file.
   - statuses mapped to user-visible labels and actions.
3. **Domain separation**:
   - `presentations.library_kind = "presentation"` for core slide decks.
   - `presentations.library_kind = "collection_song"` for collection-backed cache.
4. **Cover handling**:
   - managed media path contract (no blobs).
   - explicit user cover preferred over auto cover fallback.

## 5. File-by-File Impact

### Backend
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/models.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/queries/music.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/queries/slides.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/queries/collections.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/music.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/collections.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/utility.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs`

### Frontend
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/hymn.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/collection.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/media/cover-image.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/media/cover-picker.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/collections/route.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/collections/index.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/collections/$collectionId.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/hymnal/index.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/hymnal/$hymnId.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/layout/sidebar.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/ui/command-palette.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/index.tsx`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`

### Documentation Governance
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/CODEX/AGENTS.md`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/README.md` (new)

## 6. Security / Performance Requirements

1. Validate extension and max size for cover upload.
2. Canonicalize and verify source paths for collection import.
3. Keep sync checks scoped to collection open flow (toggleable), avoid global polling loops.
4. Return user-safe errors for invalid files or inaccessible paths.
5. Avoid loading entire app surfaces on sync updates; update only targeted collection state.

## 7. Accessibility / UX Requirements

1. Icon-only controls must expose `aria-label`.
2. Keyboard operations must cover import, resync, reorder, delete actions.
3. Sync status labels must be localized and readable by screen readers.
4. Cover pickers must provide explicit action text for upload and clear.

## 8. Acceptance Criteria

1. Hymn CRUD create/update/delete persists all fields including `cover_path`.
2. Collection import accepts `.slja` and `.pptx`, creates cached presentation linkage, and stores source metadata.
3. Auto-check marks `stale` after source change and prompts user to resync.
4. Resync updates cache and status returns to `in_sync`.
5. Missing source yields `missing_source` while cached playback remains usable.
6. Cover upload rejects invalid type/oversized files safely.
7. Covers render on intended hymn/collection surfaces with fallback.
8. Docs governance pattern is declared and linked from tracking/agent files.
9. Static checks pass.

## 9. Verification Commands

- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`
