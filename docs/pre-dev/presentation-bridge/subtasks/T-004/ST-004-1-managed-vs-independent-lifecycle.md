# ST-004-1: Implement Managed Vs Independent Lifecycle

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Make bridge mode explicit so managed bridges die with LouvorJA and independent bridges survive it.

**Prerequisites**
- `T-003` completed
- Read the lifecycle sections in `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`

**Files**
- Modify: `src-tauri/src/presentation_bridge/lifecycle.rs`
- Modify: `src-tauri/src/presentation_bridge/ipc.rs`
- Modify: `src-tauri/src/bin/presentation-bridge.rs`

## Steps

### Step 1: Add a failing lifecycle test

Write tests covering:
- managed mode requires supervision
- independent mode does not exit on supervisor disconnect

### Step 2: Run tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result:
- lifecycle supervision tests fail

### Step 3: Implement mode-specific supervision behavior

Add:
- supervisor heartbeat tracking
- disconnect handling
- parent-death fallback hook surface for managed mode
- no auto-exit on disconnect in independent mode

### Step 4: Make mode changes restart-boundary aware

Implement the runtime decision that lifecycle mode changes are not hot-applied. They must return restart-required.

### Step 5: Re-run tests and checks

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml --bin presentation-bridge
```

Expected result:
- managed vs independent tests pass

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/presentation_bridge/lifecycle.rs src-tauri/src/presentation_bridge/ipc.rs src-tauri/src/bin/presentation-bridge.rs && git commit -m "feat(bridge): add managed and independent lifecycle"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/presentation_bridge/lifecycle.rs src-tauri/src/presentation_bridge/ipc.rs src-tauri/src/bin/presentation-bridge.rs
```
