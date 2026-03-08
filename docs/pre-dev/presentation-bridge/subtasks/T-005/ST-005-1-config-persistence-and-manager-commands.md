# ST-005-1: Persist Bridge Config And Add Main-App Manager Commands

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Let LouvorJA store bridge settings, probe an existing bridge, and start/stop/sync it through dedicated Tauri commands.

**Prerequisites**
- `T-004` completed
- Read `docs/pre-dev/presentation-bridge/CONTEXT.md`

**Files**
- Create: `src-tauri/src/commands/presentation_bridge.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/presentation_bridge/config.rs`
- Modify: `src/lib/tauri.ts`
- Modify: `src/lib/bindings.ts`
- Modify: `src/lib/queries.ts`

## Steps

### Step 1: Add a failing backend test for config loading

Add a test in `config.rs` that loads a default bridge config and asserts:
- bridge disabled by default
- startWithOs defaults to false

### Step 2: Run tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result:
- bridge config defaults test fails

### Step 3: Implement persisted config read/write

Use a dedicated bridge config file in app data. Do not couple bridge startup to the main app database.

### Step 4: Add main-app manager commands

Create commands for:
- `bridge_status`
- `bridge_start`
- `bridge_stop`
- `bridge_apply_config`

Make `bridge_start` probe before spawn.

### Step 5: Add typed frontend wrappers

Update:
- `src/lib/tauri.ts`
- `src/lib/bindings.ts`
- `src/lib/queries.ts`

so the frontend can call bridge manager commands.

### Step 6: Re-run verification

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- bridge config tests pass
- Rust compiles with new commands
- frontend wrappers build cleanly

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/commands/presentation_bridge.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/presentation_bridge/config.rs src/lib/tauri.ts src/lib/bindings.ts src/lib/queries.ts && git commit -m "feat(bridge): add config persistence and manager commands"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/commands/presentation_bridge.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/presentation_bridge/config.rs src/lib/tauri.ts src/lib/bindings.ts src/lib/queries.ts
```
