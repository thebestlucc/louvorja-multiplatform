# ST-001-1: Scaffold The Bridge Binary And Shared Modules

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Create the standalone `presentation-bridge` Rust binary and the shared library module surface it will use.

**Prerequisites**
- Read `docs/pre-dev/presentation-bridge/CONTEXT.md`
- Read `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`
- Confirm the command module entrypoint exists:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && sed -n '1,120p' src-tauri/src/commands/mod.rs
  ```

**Files**
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/bin/presentation-bridge.rs`
- Create: `src-tauri/src/presentation_bridge/mod.rs`
- Create: `src-tauri/src/presentation_bridge/config.rs`
- Create: `src-tauri/src/presentation_bridge/ipc.rs`
- Create: `src-tauri/src/presentation_bridge/lifecycle.rs`
- Create: `src-tauri/src/presentation_bridge/powerpoint.rs`

## Steps

### Step 1: Add a small lifecycle unit test first

Create a basic unit test in `src-tauri/src/presentation_bridge/lifecycle.rs` that asserts:
- `managed` parses into the managed mode enum
- `independent` parses into the independent mode enum

### Step 2: Run Rust tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result:
- tests fail because the `presentation_bridge` module does not exist yet

### Step 3: Create the shared module surface

Add:
- `BridgeMode`
- `BridgeStartupSource`
- `BridgeStatus`
- `BridgeConfig`

Keep the PowerPoint adapter as a stub in this subtask. Do not implement automation yet.

### Step 4: Create the binary entrypoint

Create `src-tauri/src/bin/presentation-bridge.rs` with a minimal `main()` that:
- loads config,
- initializes lifecycle mode,
- leaves IPC bootstrap as a callable function stub,
- returns a proper process exit code on bootstrap error.

### Step 5: Export the shared module from the library crate

Update `src-tauri/src/lib.rs` so the bridge binary can import shared code from the crate cleanly.

### Step 6: Re-run tests and cargo check

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml --bin presentation-bridge
```

Expected result:
- lifecycle test passes
- `presentation-bridge` binary compiles

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/lib.rs src-tauri/src/bin/presentation-bridge.rs src-tauri/src/presentation_bridge && git commit -m "feat(bridge): scaffold presentation-bridge binary"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/lib.rs src-tauri/src/bin/presentation-bridge.rs src-tauri/src/presentation_bridge
```
