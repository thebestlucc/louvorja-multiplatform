# ST-005-1: Build The Operator Sync UX

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Replace the startup toast-only behavior with a modal-driven content sync flow, plus settings/report/status UI.

**Prerequisites**
- Read [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
- Complete `T-004/ST-004-1-sync-executor-and-runtime.md`

**Files**
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/layout/status-bar.tsx`
- Modify: `src/routes/settings/index.tsx`
- Modify: `src/lib/tauri.ts`
- Modify: `src/lib/queries.ts`
- Create: `src/types/content-sync.ts`
- Create: `src/stores/content-sync-store.ts`
- Create: `src/components/content-sync/content-sync-modal.tsx`
- Create: `src/components/content-sync/content-sync-report.tsx`

## Steps

### Step 1: Add a failing UI test or hook-level test for startup trigger behavior

Write a test that asserts:
- no prompt on bare routes,
- prompt opens when summary says updates exist,
- degraded mode offers full-sync fallback instead of smart sync actions.

### Step 2: Run the frontend test/typecheck command and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected result:
- typecheck fails because the content-sync frontend surface does not exist yet

### Step 3: Add bindings, hooks, and store

Create the TS types, Tauri wrappers, query hooks, and store state needed by the new UI flow.

### Step 4: Add the modal and report components

Implement:
- current vs remote version display,
- changed counts,
- action buttons,
- degraded fallback messaging,
- post-run report summary.

### Step 5: Wire startup, status bar, and settings

Update:
- startup check in `__root.tsx`,
- status bar indicator,
- settings page manual actions and toggles.

### Step 6: Re-run typecheck and any targeted tests

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected result:
- the new frontend surface compiles cleanly

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/routes/__root.tsx src/components/layout/status-bar.tsx src/routes/settings/index.tsx src/lib/tauri.ts src/lib/queries.ts src/types/content-sync.ts src/stores/content-sync-store.ts src/components/content-sync && git commit -m "feat(sync): add operator sync prompt and report ux"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/routes/__root.tsx src/components/layout/status-bar.tsx src/routes/settings/index.tsx src/lib/tauri.ts src/lib/queries.ts src/types/content-sync.ts src/stores/content-sync-store.ts src/components/content-sync
```
