# ST-002-1: Bundle The Bridge As A Sidecar And Add A Launcher

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Make `presentation-bridge` shippable and spawnable from LouvorJA through a controlled sidecar path.

**Prerequisites**
- `T-001` completed
- Read `docs/pre-dev/presentation-bridge/CONTEXT.md`
- Confirm current packaging config:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && sed -n '1,220p' src-tauri/tauri.conf.json
  ```

**Files**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/desktop.json`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/presentation_bridge/launcher.rs`

## Steps

### Step 1: Record the current absence of sidecar packaging

Run:

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "externalBin|shell" src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/src/lib.rs
```

Expected result:
- no `presentation-bridge` sidecar packaging is present yet

### Step 2: Add sidecar packaging support

Update Tauri packaging config so `presentation-bridge` is bundled as an external binary / sidecar.

### Step 3: Add the launcher helper

Create `src-tauri/src/presentation_bridge/launcher.rs` with functions for:
- resolving the packaged bridge binary,
- starting it only through the named sidecar path,
- returning structured startup errors.

### Step 4: Initialize any required runtime/plugin support

If sidecar launch requires the shell plugin in this app shape, add it in `Cargo.toml` and `src-tauri/src/lib.rs`.

### Step 5: Re-run build verification

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- Rust compiles with launcher support
- frontend build still succeeds after Tauri config updates

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/capabilities/desktop.json src-tauri/src/lib.rs src-tauri/src/presentation_bridge/launcher.rs && git commit -m "feat(bridge): package presentation-bridge as sidecar"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/capabilities/desktop.json src-tauri/src/lib.rs src-tauri/src/presentation_bridge/launcher.rs
```
