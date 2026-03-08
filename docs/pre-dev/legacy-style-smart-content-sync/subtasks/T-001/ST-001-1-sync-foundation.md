# ST-001-1: Scaffold Content Sync Foundation

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Create the minimum schema, model, command-registration, and backend module surface for smart content sync.

**Prerequisites**
- Read [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
- Read [tasks.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/tasks.md)
- Read [docs/plans/2026-03-08-legacy-style-smart-content-sync.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/plans/2026-03-08-legacy-style-smart-content-sync.md)

**Files**
- Modify: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/models.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/db/queries/content_sync.rs`
- Create: `src-tauri/src/content_sync/mod.rs`
- Create: `src-tauri/src/commands/content_sync.rs`

## Steps

### Step 1: Add a failing Rust unit test for sync summary model wiring

Add a minimal unit test in `src-tauri/src/content_sync/mod.rs` that constructs a degraded summary result and asserts:
- mode is degraded,
- remote version is optional,
- fallback action is present.

### Step 2: Run cargo test and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync
```

Expected result:
- tests fail because the `content_sync` module and models do not exist yet

### Step 3: Add the schema and Rust types

Implement:
- migration for `content_sync_state`
- migration for `content_sync_entities`
- migration for `content_sync_runs`
- typed models for summary, run state, plan items, and reports

### Step 4: Scaffold the query and command modules

Create:
- `db/queries/content_sync.rs` with placeholder CRUD helpers
- `commands/content_sync.rs` with stubbed commands returning typed placeholder responses
- `content_sync/mod.rs` with the degraded-summary baseline

### Step 5: Register the new commands

Update `src-tauri/src/lib.rs` so the content sync commands are included in `generate_handler![]`.

### Step 6: Re-run cargo test and cargo check

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected result:
- the new content-sync tests pass
- the Tauri crate compiles with the new module and command surface

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/db/migrations.rs src-tauri/src/db/models.rs src-tauri/src/lib.rs src-tauri/src/db/queries/content_sync.rs src-tauri/src/content_sync/mod.rs src-tauri/src/commands/content_sync.rs && git commit -m "feat(sync): scaffold content sync foundation"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/db/migrations.rs src-tauri/src/db/models.rs src-tauri/src/lib.rs src-tauri/src/db/queries/content_sync.rs src-tauri/src/content_sync/mod.rs src-tauri/src/commands/content_sync.rs
```
