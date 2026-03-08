# ST-003-1: Implement IPC, Singleton Ownership, And Status

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Give `presentation-bridge` a fixed local IPC discovery point, singleton enforcement, and a health/status response LouvorJA can trust.

**Prerequisites**
- `T-001` completed
- `T-002` completed
- Read `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`

**Files**
- Modify: `src-tauri/src/presentation_bridge/ipc.rs`
- Modify: `src-tauri/src/presentation_bridge/lifecycle.rs`
- Modify: `src-tauri/src/bin/presentation-bridge.rs`

## Steps

### Step 1: Write a failing test for mode/status serialization

Add a test that verifies `BridgeStatus` serializes:
- mode
- startup source
- version
- target app

### Step 2: Run tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result:
- new status test fails because the IPC/status shape is incomplete

### Step 3: Implement the fixed discovery and singleton rules

Add:
- fixed discovery artifact naming
- Unix socket or Windows localhost transport bootstrap
- lock or single-instance ownership
- stale endpoint recovery
- `ping`
- `status`

Do not add `apply_config` in this subtask yet.

### Step 4: Wire the binary to start the IPC server

Update the bridge entrypoint so it:
- acquires ownership,
- binds IPC,
- reports healthy startup through status.

### Step 5: Re-run Rust tests and checks

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml --bin presentation-bridge
```

Expected result:
- status tests pass
- bridge binary still compiles

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/presentation_bridge/ipc.rs src-tauri/src/presentation_bridge/lifecycle.rs src-tauri/src/bin/presentation-bridge.rs && git commit -m "feat(bridge): add singleton ipc and status"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/presentation_bridge/ipc.rs src-tauri/src/presentation_bridge/lifecycle.rs src-tauri/src/bin/presentation-bridge.rs
```
