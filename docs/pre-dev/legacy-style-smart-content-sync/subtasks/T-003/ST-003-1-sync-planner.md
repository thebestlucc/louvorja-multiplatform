# ST-003-1: Implement The Manifest-Aware Sync Planner

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Build a planner that turns remote summary/manifest data and local metadata into a typed sync plan.

**Prerequisites**
- Read [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
- Complete `T-001/ST-001-1-sync-foundation.md`
- Complete `T-002/ST-002-1-shared-importer-refactor.md`

**Files**
- Modify: `src-tauri/src/content_sync/mod.rs`
- Modify: `src-tauri/src/db/models.rs`
- Modify: `src-tauri/src/db/queries/content_sync.rs`

## Steps

### Step 1: Add failing planner tests for change classification

Write tests that cover:
- new remote hymn,
- changed hymn image only,
- deleted API album,
- missing local media file,
- manifest unavailable degraded mode.

### Step 2: Run targeted tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync planner
```

Expected result:
- failure because planning logic and plan item classification are incomplete

### Step 3: Implement manifest client adapters and planner logic

Add:
- summary fetch path,
- manifest-page fetch path,
- degraded fallback path,
- local metadata comparison,
- plan-item generation with typed actions.

### Step 4: Persist enough metadata for future runs

Make sure the planner can read and write the metadata needed for:
- remote version tracking,
- content hash tracking,
- asset version tracking,
- drift detection.

### Step 5: Re-run tests and cargo check

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync planner
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected result:
- planner tests pass
- degraded fallback remains typed and explicit

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/content_sync/mod.rs src-tauri/src/db/models.rs src-tauri/src/db/queries/content_sync.rs && git commit -m "feat(sync): add manifest-aware sync planner"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/content_sync/mod.rs src-tauri/src/db/models.rs src-tauri/src/db/queries/content_sync.rs
```
