# ST-007-1: Move External Shortcut Ownership Into The Bridge

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Ensure bridge-owned next/previous shortcuts are no longer driven by LouvorJA’s current global shortcut flow.

**Prerequisites**
- `T-005` completed
- `T-006` completed
- Read `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`
- Confirm the current app-owned shortcut path:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && sed -n '1,220p' src/hooks/use-keyboard.ts
  ```

**Files**
- Modify: `src/hooks/use-keyboard.ts`
- Modify: `src/lib/shortcut-definitions.ts`
- Modify: `src-tauri/src/bin/presentation-bridge.rs`
- Modify: `src-tauri/src/presentation_bridge/config.rs`

## Steps

### Step 1: Add a failing frontend test or assertion target

Add coverage at the closest existing shortcut test location so the app no longer treats bridge-owned next/previous global events as local slide navigation when bridge mode is enabled.

### Step 2: Run tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test:unit
```

Expected result:
- shortcut behavior test fails or is missing the bridge-mode behavior

### Step 3: Move ownership rules into code

Make these changes:
- bridge registers its own next/previous shortcuts
- LouvorJA stops registering conflicting bridge-owned global slide shortcuts
- local in-app next/previous behavior remains unchanged

### Step 4: Keep unrelated global shortcuts untouched

Do not break:
- command palette
- shortcuts help
- display black/logo actions

### Step 5: Re-run verification

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test:unit
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected result:
- tests/build pass
- no duplicate bridge shortcut owner remains

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/hooks/use-keyboard.ts src/lib/shortcut-definitions.ts src-tauri/src/bin/presentation-bridge.rs src-tauri/src/presentation_bridge/config.rs && git commit -m "feat(bridge): move external shortcut ownership into bridge"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/hooks/use-keyboard.ts src/lib/shortcut-definitions.ts src-tauri/src/bin/presentation-bridge.rs src-tauri/src/presentation_bridge/config.rs
```
