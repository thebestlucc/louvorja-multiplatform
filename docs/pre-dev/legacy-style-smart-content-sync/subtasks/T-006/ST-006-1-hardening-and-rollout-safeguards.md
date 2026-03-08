# ST-006-1: Harden The Feature For Rollout

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Add localization, tests, and rollout safeguards so smart content sync can ship without regressing existing fetch behavior.

**Prerequisites**
- Read [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
- Complete `T-005/ST-005-1-operator-sync-ux.md`

**Files**
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`
- Modify: `src-tauri/src/content_sync/mod.rs`
- Modify: `src-tauri/src/db/queries/content_sync.rs`
- Create: `tests/content-sync-modal.test.tsx`
- Create: `tests/content-sync-report.test.tsx`

## Steps

### Step 1: Add failing backend and frontend tests for degraded mode and report rendering

Write tests that cover:
- manifest unavailable degraded summary,
- selective sync plan classification,
- report rendering counts,
- modal action availability in degraded mode.

### Step 2: Run the relevant verification commands and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected result:
- failures indicate missing final tests/copy or incomplete behavior

### Step 3: Add i18n keys and final report/degraded messaging

Update PT/EN/ES with all sync-summary, degraded-mode, progress, and report copy.

### Step 4: Finalize tests and safety checks

Complete:
- backend planner/executor test coverage,
- frontend report/modal coverage,
- smoke verification that existing legacy fetch still compiles after the new sync path lands.

### Step 5: Run the final verification set

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo test --manifest-path src-tauri/Cargo.toml content_sync
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm exec tsc -p tsconfig.json --noEmit
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && node scripts/validate-i18n.mjs
```

Expected result:
- content sync tests pass
- TypeScript build is clean
- locale validation passes

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/locales/en.json src/locales/pt.json src/locales/es.json src-tauri/src/content_sync/mod.rs src-tauri/src/db/queries/content_sync.rs tests/content-sync-modal.test.tsx tests/content-sync-report.test.tsx && git commit -m "test(sync): harden smart content sync rollout"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/locales/en.json src/locales/pt.json src/locales/es.json src-tauri/src/content_sync/mod.rs src-tauri/src/db/queries/content_sync.rs tests/content-sync-modal.test.tsx tests/content-sync-report.test.tsx
```
