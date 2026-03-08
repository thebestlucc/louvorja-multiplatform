# ST-004-1: Implement Sync Execution Runtime

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Execute sync plans in the background with progress events, persisted reports, cancellation, and full-sync fallback.

**Prerequisites**
- Read [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
- Complete `T-001/ST-001-1-sync-foundation.md`
- Complete `T-002/ST-002-1-shared-importer-refactor.md`
- Complete `T-003/ST-003-1-sync-planner.md`

**Files**
- Modify: `src-tauri/src/content_sync/mod.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/content_sync.rs`

## Steps

### Step 1: Add failing tests for runtime state/report behavior

Write tests that assert:
- a sync run can be created,
- progress state can be updated,
- a completed run persists a report,
- cancellation moves the run to a cancelled terminal state.

### Step 2: Run targeted tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync runtime
```

Expected result:
- failure because runtime state and executor/report plumbing are incomplete

### Step 3: Implement execution orchestration

Add:
- run creation,
- background thread/runtime spawn,
- progress emission,
- cancellation support,
- report persistence,
- degraded handoff to full sync when required.

### Step 4: Register Tauri command surface

Wire up:
- `get_content_sync_summary`
- `plan_content_sync`
- `start_content_sync`
- `get_content_sync_progress`
- `cancel_content_sync`
- `get_content_sync_report`

### Step 5: Re-run tests and cargo check

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync runtime
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected result:
- runtime tests pass
- commands compile and are exported cleanly

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/content_sync/mod.rs src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/commands/content_sync.rs && git commit -m "feat(sync): add execution runtime and reports"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/content_sync/mod.rs src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/commands/content_sync.rs
```
