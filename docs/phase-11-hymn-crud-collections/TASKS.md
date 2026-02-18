# Phase 11 Tasks — Hymn CRUD + Collections + Hybrid Cache Covers

## Summary

- Scope locked to Phase 11 revised plan.
- Canonical decisions:
  1. Collections model: `Hybrid cache`.
  2. Sync behavior: auto-check on open (`collections.autoCheckSourceOnOpen`, default `true`).
  3. `Collections` and `Presentations` remain separate modules.
  4. Cover support for hymn and collection with upload + fallback.
- This task list is dependency-ordered and includes a documentation-governance task to enforce a single feature-decision source of truth.

## Public APIs / Interfaces / Types to Deliver

1. Rust DB/domain updates in:
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/models.rs`

2. Rust command surface:
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/music.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/collections.rs`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/utility.rs`

3. Frontend contract updates:
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/hymn.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/collection.ts`

## Execution Batches

### Batch 0 — Phase/Docs Gate
- Add/update Phase 11 references in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`.
- Ensure Phase 11 docs package exists in:
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/PRD.md`
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/SPECS.md`
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/TASKS.md`

### Batch 1 — Schema + Queries
- Implement migration for hymn cover + collections + collection_songs metadata.
- Add/update query modules for collections and hymn write fields.
- Add hash/mtime helpers used by sync-check logic.

### Batch 2 — Hymn CRUD Backend
- Replace legacy stubs with transactional persistence:
  - `create_hymn`
  - `update_hymn`
  - `delete_hymn`
- Add input validation and typed error returns.

### Batch 3 — Collections Backend (Hybrid)
- Implement collection CRUD commands.
- Implement import from `.slja`/`.pptx` with cached presentation creation.
- Persist source metadata (`path`, `format`, `hash`, `mtime`) and sync status.
- Implement manual resync command and delete/reorder song flows.

### Batch 4 — Frontend Types/Wrappers/Queries
- Add new TS types and typed wrappers.
- Add query keys + mutations for hymn CRUD and collection operations.
- Keep cache invalidation targeted by entity and collection ID.

### Batch 5 — Collections UI + Navigation
- Create routes:
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/collections/route.tsx`
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/collections/index.tsx`
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/collections/$collectionId.tsx`
- Add Collections entry in sidebar/dashboard/command palette.

### Batch 6 — Cover System
- Add reusable cover components and media copy command wrapper.
- Render covers in hymn and collection surfaces with fallback behavior.

### Batch 7 — Auto-Check + Settings
- On collection open, compare source metadata against cached metadata.
- If stale/missing/error, surface status and resync affordance.
- Add settings toggle for `collections.autoCheckSourceOnOpen` in `/settings`.

### Batch 8 — i18n + a11y + Hardening
- Add EN/PT/ES keys for collections/sync/cover/settings copy.
- Add keyboard/screen-reader labels for icon actions.
- Enforce validation for cover uploads and import path safety.
- Enforce pub/sub-only realtime synchronization for playback/projection/streaming (remove remaining polling paths).

### Batch 9 — Documentation Source of Truth Normalization (New)
- Enforce docs structure pattern in `docs`:
  - `docs/phase-{number}-{feature-name}/PRD.md`
  - `docs/phase-{number}-{feature-name}/SPECS.md`
  - `docs/phase-{number}-{feature-name}/TASKS.md`
  - `docs/phase-{number}-{feature-name}/HANDOFF.md` (post implementation)
- Add/update phase learnings documentation when a non-obvious incident is solved:
  - `docs/phase-{number}-{feature-name}/LEARNINGS.md`
- Update tracking files to point to this pattern and declare docs as canonical feature-decision source:
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/CODEX/AGENTS.md`
- Add a docs index/reference file in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/`.

### Batch 10 — Validation + Closure
- Execute static checks and smoke matrix.
- Confirm no regressions in presentations/projection/return/streaming.
- Update Phase 11 status in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md` when exit criteria pass.
- Complete `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/HANDOFF.md`.

## Test Cases and Scenarios

1. Hymn CRUD persists all fields including `cover_path`.
2. Collection import accepts valid `.slja/.pptx` and creates cached presentation link.
3. Sync check returns `stale` after source changes and prompts resync on open when enabled.
4. Resync returns status to `in_sync`.
5. Missing source returns `missing_source` while cached playback remains available.
6. Cover upload rejects invalid file type and oversized files safely.
7. Covers render correctly across hymn/collection surfaces with fallback.
8. Presentations module and projector/return/streaming flows remain stable.
9. Docs tracking points to `docs/phase-*` as single source of truth.
10. No polling-based realtime synchronization remains in projection/playback paths.

## Verification Commands

- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`
