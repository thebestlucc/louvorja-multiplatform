---
feature: legacy-style-smart-content-sync
gate: 7
date: 2026-03-08
status: draft
design_plan: /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/plans/2026-03-08-legacy-style-smart-content-sync.md
---

# Gate 7: Task Breakdown — Legacy-Style Smart Content Sync

> This Gate 7 document is derived from the design plan and is ready to be used as a draft execution map.
> For strict Large Track process compliance, Gates 0-6 should be backfilled before autonomous execution.

## Phase A: Sync Foundation

### TASK-001: Add content sync metadata and summary plumbing
**Category:** Foundation
**Feature:** F-001 (Content Sync Foundation)
**Priority:** P0 — Critical
**Value:** The app can detect remote content changes through a dedicated sync subsystem instead of relying only on a coarse startup toast.

**Dependencies:** None

**Success Criteria:**
- [ ] Sync metadata tables exist for state, entities, and run history
- [ ] New Rust models exist for content sync summary, plan items, and reports
- [ ] A `content_sync` backend module exists and compiles
- [ ] A summary command exists that can return either smart-sync info or degraded fallback info

**Files:**
- `src-tauri/src/db/migrations.rs`
- `src-tauri/src/db/models.rs`
- `src-tauri/src/db/queries/content_sync.rs`
- `src-tauri/src/content_sync/mod.rs`
- `src-tauri/src/commands/content_sync.rs`
- `src-tauri/src/lib.rs`

---

### TASK-002: Reuse import/update primitives across full fetch and smart sync
**Category:** Foundation
**Feature:** F-002 (Shared Import Primitives)
**Priority:** P0 — Critical
**Value:** Full sync, selective sync, and single-item restore all use the same safe upsert/media-write behavior.

**Dependencies:** TASK-001

**Success Criteria:**
- [ ] Shared importer helpers exist for hymn upsert, album collection upsert, link creation, and media download
- [ ] `legacy_fetch` continues to compile and behave the same from the outside
- [ ] `restore_hymn_from_api` and `restore_album_from_api` still work through the shared path

**Files:**
- `src-tauri/src/legacy_fetch/mod.rs`
- `src-tauri/src/commands/legacy_fetch.rs`
- `src-tauri/src/content_sync/importer.rs`

---

## Phase B: Planning And Execution

### TASK-003: Build a manifest-aware sync planner with degraded fallback
**Category:** Feature
**Feature:** F-003 (Sync Planning)
**Priority:** P0 — Critical
**Value:** Operators can see exactly what changed before updating content.

**Dependencies:** TASK-001, TASK-002

**Success Criteria:**
- [ ] Planner compares remote summary/manifest data against local metadata
- [ ] Planner can emit typed actions for create, update, relink, repair, and review-only delete
- [ ] Planner detects missing local media for API-managed content
- [ ] When remote manifest endpoints are unavailable, planner returns a full-sync-only degraded plan

**Files:**
- `src-tauri/src/content_sync/mod.rs`
- `src-tauri/src/db/models.rs`
- `src-tauri/src/db/queries/content_sync.rs`

---

### TASK-004: Execute selective sync runs with progress and reports
**Category:** Feature
**Feature:** F-004 (Sync Execution)
**Priority:** P0 — Critical
**Value:** The app can update only changed hymns/albums/media and produce an operator-readable report.

**Dependencies:** TASK-002, TASK-003

**Success Criteria:**
- [ ] Commands exist to plan, start, poll, cancel, and report content sync runs
- [ ] Execution updates API-managed hymns and collections safely
- [ ] Missing managed media can be repaired during execution
- [ ] Run history and final reports are persisted
- [ ] Full-sync fallback remains available

**Files:**
- `src-tauri/src/content_sync/mod.rs`
- `src-tauri/src/commands/content_sync.rs`
- `src-tauri/src/state.rs`
- `src-tauri/src/lib.rs`

---

## Phase C: Operator UX

### TASK-005: Add startup prompt, settings controls, and progress/report UI
**Category:** Feature
**Feature:** F-005 (Operator Sync UX)
**Priority:** P1 — High
**Value:** Operators get a legacy-style, understandable update flow instead of a passive toast.

**Dependencies:** TASK-001, TASK-003, TASK-004

**Success Criteria:**
- [ ] Startup flow shows current vs remote content version and changed counts
- [ ] Modal offers sync now, review, later, and degraded full-sync fallback actions
- [ ] Status bar shows sync progress when a run is active
- [ ] Settings page exposes “check now”, startup check toggle, and force full sync
- [ ] Post-run report UI is visible and localized

**Files:**
- `src/routes/__root.tsx`
- `src/components/content-sync/content-sync-modal.tsx`
- `src/components/content-sync/content-sync-report.tsx`
- `src/components/layout/status-bar.tsx`
- `src/routes/settings/index.tsx`
- `src/stores/content-sync-store.ts`
- `src/lib/tauri.ts`
- `src/lib/queries.ts`
- `src/types/content-sync.ts`

---

## Phase D: Hardening

### TASK-006: Add i18n, tests, and rollout safeguards
**Category:** Polish
**Feature:** F-006 (Production Hardening)
**Priority:** P1 — High
**Value:** The feature is safe to ship across supported locales and does not regress existing content flows.

**Dependencies:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005

**Success Criteria:**
- [ ] PT/EN/ES copy exists for summary, degraded mode, progress, and reports
- [ ] Backend tests cover planner/executor/degraded mode
- [ ] Frontend tests cover startup trigger, modal states, and report rendering
- [ ] Existing legacy fetch flow still passes smoke verification

**Files:**
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`
- `src-tauri/src/content_sync/mod.rs`
- `src-tauri/src/db/queries/content_sync.rs`
- `tests/content-sync-modal.test.tsx`
- `tests/content-sync-report.test.tsx`

---

## Execution Order

1. TASK-001
2. TASK-002
3. TASK-003
4. TASK-004
5. TASK-005
6. TASK-006

## Gate 7 Notes

- This feature is **Large Track** because it introduces new backend modules, new schema, new UI flow, and a new remote contract.
- The tasks above are intentionally value-delivering increments.
- Zero-context execution is provided in the `subtasks/` pack.
