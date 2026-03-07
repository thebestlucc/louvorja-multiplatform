---
feature: monthly-department-schedules
gate: 8
date: 2026-03-06
status: complete
completed_on: 2026-03-07
source_design: docs/plans/2026-03-06-monthly-department-schedules-design.md
source_plan: docs/plans/2026-03-06-monthly-department-schedules.md
---

# Monthly Department Schedules - Task Pack

This directory turns the approved design into incremental, zero-context implementation tasks.

## Start Here

Before any implementation session:
1. Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`.
2. Read only the next pending subtask file listed below.
3. Execute one subtask at a time.
4. Update this file when the subtask is complete.

This pack is now historical. The feature was implemented and verified on `2026-03-07`.

## Invariants

Do not change these decisions during implementation:
- V1 is calendar-first and month-scoped.
- Selected service dates are stored explicitly in DB.
- Responsible department is stored on `schedule_days`.
- Manual overrides are stored on `schedule_day_departments`.
- V1 printing uses the browser/OS print dialog only.
- No attendance, reminders, analytics, or volunteer confirmations in this feature.
- V1 does not require search.
- If search is added later, FTS5 must be implemented in SQLite migrations/triggers, not in Rust-side manual index maintenance.
- Do not modify existing hymns or collections search flows as part of this feature unless a concrete regression fix is required.

## Execution Order

### Backend foundation
- [x] `T-001` Schema, seed data, and migration safety
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-001/ST-001-1-schema-and-seed.md`
- [x] `T-002` Rust models and query scaffold
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-002/ST-002-1-models-and-query-scaffold.md`
- [x] `T-003` Generation algorithm and Rust tests
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-003/ST-003-1-generation-engine.md`
- [x] `T-004` Tauri commands, Specta bindings, and frontend hooks
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-004/ST-004-1-tauri-api-surface.md`

### Frontend foundation
- [x] `T-005` i18n, utilities navigation, and schedule route shell
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-005/ST-005-1-i18n-nav-and-route-shell.md`
- [x] `T-006` Calendar grid, month toolbar, and day selection persistence
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-006/ST-006-1-calendar-and-day-selection.md`

### Editing workflows
- [x] `T-007` Department management, member ordering, and day details overrides
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-007/ST-007-1-department-and-day-dialogs.md`

### Output workflow
- [x] `T-008` Print preview, A4 layout packing, and final acceptance checks
  - File: `docs/pre-dev/monthly-department-schedules/subtasks/T-008/ST-008-1-print-preview-and-acceptance.md`

## Dependency Rules

- `T-001` blocks everything else.
- `T-002` depends on `T-001`.
- `T-003` depends on `T-002`.
- `T-004` depends on `T-002` and `T-003`.
- `T-005` depends on `T-004`.
- `T-006` depends on `T-005`.
- `T-007` depends on `T-006`.
- `T-008` depends on `T-007`.

## Global Verification

Executed final verification:

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test db::queries::schedules --lib
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm lint:i18n
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Observed result on `2026-03-07`:
- Rust schedule tests passed.
- existing frontend tests passed.
- i18n validation passed.
- application build succeeded.
