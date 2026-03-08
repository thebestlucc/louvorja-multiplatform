# ST-006-1: Add Bridge OS Autostart Registration

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Register `presentation-bridge` to start with the OS independently from LouvorJA app autostart.

**Prerequisites**
- `T-005` completed
- Read the autostart sections in `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`
- Confirm existing app autostart code is separate:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "autostart" src/routes/settings/index.tsx src-tauri/src/lib.rs
  ```

**Files**
- Modify: `src-tauri/src/commands/presentation_bridge.rs`
- Modify: bridge platform registration module(s) under `src-tauri/src/presentation_bridge/`

## Steps

### Step 1: Add a failing test for default autostart intent

Add a small test around bridge config/state that verifies:
- `startWithOs` false means no autostart registration should be attempted

### Step 2: Run tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result:
- the new autostart intent test fails

### Step 3: Add bridge autostart registration commands

Add:
- `bridge_register_autostart`
- `bridge_unregister_autostart`

Keep them separate from LouvorJA’s existing app autostart.

### Step 4: Implement Windows-first registration

Implement only the Windows-required registration path for MVP. Non-Windows may return unsupported until their bridge adapters exist.

### Step 5: Re-run verification

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected result:
- tests pass
- autostart commands compile

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/commands/presentation_bridge.rs src-tauri/src/presentation_bridge && git commit -m "feat(bridge): add bridge os autostart registration"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/commands/presentation_bridge.rs src-tauri/src/presentation_bridge
```
