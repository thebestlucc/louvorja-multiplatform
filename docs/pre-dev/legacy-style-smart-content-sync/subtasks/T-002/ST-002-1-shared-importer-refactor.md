# ST-002-1: Extract Shared Importer Primitives

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Move hymn/collection/media upsert logic into reusable helpers consumable by both `legacy_fetch` and `content_sync`.

**Prerequisites**
- Read [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
- Complete `T-001/ST-001-1-sync-foundation.md`

**Files**
- Modify: `src-tauri/src/legacy_fetch/mod.rs`
- Modify: `src-tauri/src/commands/legacy_fetch.rs`
- Create: `src-tauri/src/content_sync/importer.rs`

## Steps

### Step 1: Add a failing unit test for the shared importer contract

Create a Rust test that proves a hymn upsert helper can:
- insert a new hymn with API metadata,
- return the local hymn ID,
- preserve/update managed media paths.

### Step 2: Run targeted Rust tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml legacy_fetch
```

Expected result:
- failure because the shared importer module/contract does not exist yet

### Step 3: Extract shared helper functions

Move the reusable logic for:
- hymn upsert,
- collection upsert for API albums,
- `collection_hymns` linking,
- managed media download/write,
- metadata updates

into `src-tauri/src/content_sync/importer.rs`.

### Step 4: Rewire legacy fetch and restore flows

Update `legacy_fetch` and restore commands to call the shared helper functions without changing public behavior.

### Step 5: Re-run tests and cargo check

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml legacy_fetch
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected result:
- shared importer tests pass
- legacy fetch still compiles and existing behavior remains intact

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/legacy_fetch/mod.rs src-tauri/src/commands/legacy_fetch.rs src-tauri/src/content_sync/importer.rs && git commit -m "refactor(sync): extract shared importer primitives"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/legacy_fetch/mod.rs src-tauri/src/commands/legacy_fetch.rs src-tauri/src/content_sync/importer.rs
```
