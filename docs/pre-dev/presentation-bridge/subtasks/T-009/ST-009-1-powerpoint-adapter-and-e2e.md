# ST-009-1: Implement The Windows PowerPoint Adapter And Run End-To-End Checks

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Make `presentation-bridge` control an active PowerPoint slideshow and verify the full managed/independent flows manually on Windows.

**Prerequisites**
- `T-001` through `T-008` completed
- Read `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`
- Confirm the bridge binary compiles before adding adapter logic:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml --bin presentation-bridge
  ```

**Files**
- Modify: `src-tauri/src/presentation_bridge/powerpoint.rs`
- Modify: `src-tauri/src/bin/presentation-bridge.rs`
- Modify: `src-tauri/Cargo.toml`

## Steps

### Step 1: Add a failing adapter test or contract assertion

Add coverage for the adapter result surface so these outcomes are represented explicitly:
- PowerPoint not running
- slideshow not active
- next/previous command success

### Step 2: Run Rust tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result:
- adapter test fails because the PowerPoint implementation is still a stub

### Step 3: Implement Windows-first PowerPoint control

Use PowerPoint automation. Do not use generic key injection as the primary strategy.

If a fixed internal PowerShell helper is required for MVP, keep it:
- internal only
- non-configurable from user input
- limited to next/previous actions

### Step 4: Wire adapter calls into bridge commands

Make the bridge invoke the adapter when its registered shortcuts fire and when IPC `next` / `previous` commands are received.

### Step 5: Re-run verification

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml --bin presentation-bridge
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- adapter tests pass
- bridge binary compiles
- overall app build still succeeds

### Step 6: Run the Windows manual acceptance checklist

1. Enable the bridge in LouvorJA settings.
2. Set `Start presentation bridge with OS = false`.
3. Start LouvorJA and confirm it starts a managed bridge.
4. Open PowerPoint and start slideshow mode.
5. Press the configured clicker shortcut and confirm the slideshow advances.
6. Close LouvorJA and confirm the managed bridge exits.
7. Reopen LouvorJA and enable `Start presentation bridge with OS = true`.
8. Start or log into a fresh Windows session and confirm the bridge runs before LouvorJA.
9. Confirm PowerPoint advances even with LouvorJA closed.
10. Open LouvorJA and confirm it attaches to the existing independent bridge instead of spawning a duplicate.

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/presentation_bridge/powerpoint.rs src-tauri/src/bin/presentation-bridge.rs src-tauri/Cargo.toml && git commit -m "feat(bridge): add powerpoint adapter and e2e bridge flow"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/presentation_bridge/powerpoint.rs src-tauri/src/bin/presentation-bridge.rs src-tauri/Cargo.toml
```
