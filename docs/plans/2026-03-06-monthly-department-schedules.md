# Monthly Department Schedules Implementation Plan

**Goal:** Add a calendar-first utility for creating, generating, storing, and printing monthly church department schedules, including custom departments, multiple assignees per date, responsible-department selection per service day, and A4-ready print output.

**Architecture:** SQLite-backed month-plan model in Rust, exposed through new Tauri schedule commands and consumed by a new utilities route in React. Month data is normalized into days, participating departments, and ordered assignments. Printing is handled by an in-app print-preview dialog that uses the OS print dialog for printers and PDF destinations.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query, Tauri 2, Rust, rusqlite, Specta, i18next, Tailwind v4, dnd-kit

**Important decision:** V1 does not add a native PDF engine. `Print` and `Save as PDF` both go through the OS print dialog from the print-preview UI. That keeps scope controlled while still supporting installed/network printers and PDF destinations.

**Architecture constraint:** V1 does not require schedule search. If full-text search is added later, FTS5 must be created and maintained at the database level via migrations and triggers, not through Rust-side manual rebuild/upsert helpers. The only current exception in the app remains collection-song search because of its multi-table aggregation.

## Implementation Outcome

Status on `2026-03-07`: complete.

Delivered behavior:
- calendar-first monthly schedule utility at `/utilities/schedules`
- explicit day selection plus weekday patterns
- department management with custom departments, ordering, active state, localized names, and member ordering
- month generation with manual override preservation and optional department-side member randomization
- day details editing with responsible department selection
- in-app confirmation dialogs and success toasts for destructive/save flows
- A4 print preview with multi-department packing, persisted print order, and OS print dialog handoff

Implementation deltas from the initial draft:
- the base schedule schema landed at migration `v22`
- the current repository migration head is `v24`
- `src/lib/bindings.ts` is exported with a `// @ts-nocheck` header because the current `tauri-specta` RC emits unused event/channel globals that fail this repo's `noUnusedLocals` build setting

Final verification executed:

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test db::queries::schedules --lib
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm lint:i18n
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Observed result:
- all schedule Rust tests passed
- frontend unit tests passed
- locale validation passed
- full frontend build passed

## Verification Commands

Run these after implementation:

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test db::queries::schedules --lib
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm lint:i18n
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected outcomes:
- Rust tests for schedule generation and persistence pass
- frontend unit tests still pass
- locale validation passes
- Vite + Tauri types compile successfully

## Task 1: Add the database schema and seed default departments

**Target:** backend  
**Working Directory:** `.`  
**Agent:** `ring:backend-engineer-typescript` is not applicable here; use `ring:general-purpose` or direct implementation

**Files to modify**
- `src-tauri/src/db/migrations.rs`

**Implementation**
- Add `migrate_v22` and bump `run_migrations` to version `22`.
- Create these tables:
  - `schedule_departments`
  - `schedule_department_members`
  - `schedule_months`
  - `schedule_days`
  - `schedule_day_departments`
  - `schedule_assignments`
- Add indexes:
  - unique month index on `(year, month)`
  - unique day index on `(schedule_month_id, service_date)`
  - unique day-department index on `(schedule_day_id, department_id)`
  - unique assignment index on `(schedule_day_department_id, member_id)`
  - partial unique index for built-in department `code`
- Seed built-in departments with stable codes, icon names, colors, and sort order:
  - `music`
  - `multimedia`
  - `reception`
  - `deacons`
  - `deaconesses`
  - `communication`
  - `cleaning`

**Implementation notes**
- Use nullable localized name columns (`name_pt`, `name_en`, `name_es`) so custom departments can override any locale without JSON parsing in SQL.
- Store colors as hex strings.
- Store icons as stable string ids that the frontend can resolve through a local icon registry.
- Do not add schedule FTS tables in this task. No current UI requires search, and introducing search must be a separate DB-level migration task.

**Verification**
- Start the app once against a fresh database and confirm version 22 completes.
- Open the DB and verify seven seeded departments exist.

## Task 2: Add Rust models for schedules

**Target:** backend  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to modify**
- `src-tauri/src/db/models.rs`

**Implementation**
- Add serializable `specta::Type` models for:
  - `ScheduleDepartment`
  - `ScheduleDepartmentMember`
  - `ScheduleMonth`
  - `ScheduleDay`
  - `ScheduleDayDepartment`
  - `ScheduleAssignment`
  - `ScheduleMonthDetail`
  - `ScheduleDepartmentInput`
  - `ScheduleGenerationRequest`
  - `ScheduleAssignmentInput`
- Prefer nested DTOs for read APIs so the frontend does not need to manually stitch rows together.

**Required fields**
- `ScheduleDepartment` should expose icon, color, `peoplePerDay`, built-in flag, active flag, and localized names.
- `ScheduleMonthDetail` should expose:
  - month metadata
  - departments with members
  - days with responsible department and nested assignments

**Verification**
- `cargo test` compiles after the model additions.

## Task 3: Create the schedule query module

**Target:** backend  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to create/modify**
- Create: `src-tauri/src/db/queries/schedules.rs`
- Modify: `src-tauri/src/db/queries/mod.rs`

**Implementation**
- Add query functions for:
  - listing departments with members
  - creating and updating departments
  - deleting custom departments
  - reordering department members
  - fetching or creating a month row by `year + month`
  - replacing month day selections
  - setting responsible department for a day
  - replacing manual assignments for one day/department
  - building the nested month detail payload
- Keep transaction boundaries inside the query layer for multi-table writes.
- Do not add query-layer FTS maintenance helpers for schedules. If search appears in a later task, the query layer should only read DB-managed FTS tables.

**Recommended function set**

```rust
pub fn list_schedule_departments(conn: &Connection) -> Result<Vec<ScheduleDepartment>, AppError>;
pub fn upsert_schedule_department(conn: &Connection, input: &ScheduleDepartmentInput) -> Result<ScheduleDepartment, AppError>;
pub fn delete_schedule_department(conn: &Connection, id: i64) -> Result<(), AppError>;
pub fn replace_department_members(conn: &Connection, department_id: i64, members: &[String]) -> Result<(), AppError>;
pub fn get_or_create_schedule_month(conn: &Connection, year: i32, month: i32) -> Result<ScheduleMonth, AppError>;
pub fn replace_schedule_month_days(conn: &Connection, month_id: i64, days: &[ScheduleDayInput]) -> Result<(), AppError>;
pub fn get_schedule_month_detail(conn: &Connection, year: i32, month: i32) -> Result<ScheduleMonthDetail, AppError>;
pub fn save_day_assignments(conn: &Connection, day_department_id: i64, member_ids: &[i64]) -> Result<(), AppError>;
```

**Verification**
- Add a small in-memory SQLite smoke test for department CRUD plus month creation.

## Task 4: Implement the generation algorithm in Rust

**Target:** backend  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to modify**
- `src-tauri/src/db/queries/schedules.rs`

**Implementation**
- Add `generate_schedule_month` in the query module.
- For each department:
  - load active members ordered by `sort_order`
  - load the selected month days linked to that department
  - skip rows marked `manual_override = 1` unless `overwrite_manual` is requested
  - assign `people_per_day` members in rotation order
  - prevent repeats until the member pool is exhausted
  - when the pool is smaller than the required total slots, wrap and continue
- Regeneration should replace existing non-manual assignments for the targeted rows.

**Algorithm guardrails**
- empty member list should not panic; return a validation error
- duplicate member assignments for the same department/day must never be written
- manual assignment edits should flip `manual_override = 1`

**Tests to add**
- no repeat before pool exhaustion
- wraps correctly when members < required slots
- multiple assignees per day preserve order
- regenerate skips manual overrides by default
- regenerate overwrites manual rows only when requested

**Verification**
- `cargo test db::queries::schedules --lib`

## Task 5: Expose schedule commands through Tauri and Specta

**Target:** backend  
**Working Directory:** `.`  
**Agent:** `ring:general-purpose`

**Files to create/modify**
- Create: `src-tauri/src/commands/schedules.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Implementation**
- Add Tauri commands for:
  - `list_schedule_departments`
  - `save_schedule_department`
  - `delete_schedule_department`
  - `replace_schedule_department_members`
  - `get_schedule_month`
  - `save_schedule_month_days`
  - `generate_schedule_month`
  - `set_schedule_day_responsible_department`
  - `save_schedule_day_assignments`
- Register all commands in `commands/mod.rs` and `collect_commands!` in `src-tauri/src/lib.rs`.
- Keep command bodies thin: acquire connection, call query layer, return typed DTOs.

**Verification**
- Run the app in debug mode once so `src/lib/bindings.ts` regenerates with the new types and commands.

## Task 6: Add frontend wrappers and React Query hooks

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to modify**
- `src/lib/tauri.ts`
- `src/lib/queries.ts`
- `src/lib/bindings.ts` (generated)

**Implementation**
- Add wrapper functions for every new schedule command.
- Extend `queryKeys` with a `schedule` namespace:
  - departments
  - month detail by `year/month`
- Add mutations for:
  - department save/delete
  - member reorder
  - day selection save
  - month generation
  - responsible department update
  - day assignment save
- Invalidate month detail and department queries on success.
- Do not add search commands or FTS bindings in this batch. The current feature scope does not require them.

**Verification**
- TypeScript should compile without `any` bridges for schedule commands.

## Task 7: Add i18n keys and utility navigation entry

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to modify**
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`
- `src/routes/utilities/route.tsx`
- `src/routes/utilities/index.tsx`

**Implementation**
- Add `utilities.nav.schedules`.
- Add overview card copy and full schedule namespace, including:
  - screen title/subtitle
  - month toolbar labels
  - date pattern labels like `all Sundays`, `all Wednesdays`
  - day detail labels
  - department form labels
  - generation warnings
  - print labels
- Add the schedules item to the utilities nav and the utilities overview grid.

**Verification**
- `pnpm lint:i18n`
- manually confirm the new utility appears in the utilities overview and nav

## Task 8: Build the schedule screen shell and month toolbar

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to create**
- `src/routes/utilities/schedules.tsx`
- `src/components/schedules/month-toolbar.tsx`
- `src/components/schedules/month-pattern-picker.tsx`
- `src/components/schedules/schedule-empty-state.tsx`

**Implementation**
- Create the route component for `/utilities/schedules`.
- Fetch the selected month detail through React Query.
- Add toolbar controls:
  - month/year selector
  - button to add dates by weekday pattern
  - button to manage departments
  - button to generate
  - button to print
- If a month does not exist yet, create it lazily when the user first saves day selections.

**UX note**
- Default to the current month on first open.
- Keep the toolbar simple; avoid burying primary actions in overflow menus.

**Verification**
- Route loads without runtime errors.
- Switching month updates the query and screen state.

## Task 9: Build the calendar grid and selected-day interactions

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to create**
- `src/components/schedules/month-calendar.tsx`
- `src/components/schedules/day-cell.tsx`
- `src/lib/schedules.ts`

**Implementation**
- Build a full-month calendar grid from a helper in `src/lib/schedules.ts`.
- Show all calendar days, but visually emphasize only selected service days.
- Each selected day cell should show:
  - day number
  - responsible department chip when set
  - compact per-department count or initials summary
- Clicking an empty day toggles it into the month plan.
- Clicking a selected day opens the day details dialog.
- Pattern actions like `all Sundays` should generate explicit day rows, not only temporary UI state.

**Verification**
- Manual date toggle saves and survives page refresh.
- Pattern add/remove produces expected selected days in the month.

## Task 10: Build department management and member ordering UI

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to create**
- `src/components/schedules/department-manager-dialog.tsx`
- `src/components/schedules/department-form.tsx`
- `src/components/schedules/member-list-editor.tsx`

**Implementation**
- Add a dialog for built-in and custom departments.
- Allow:
  - editing icon, color, `people_per_day`, active state
  - editing localized names
  - adding/removing custom departments
  - adding/removing/reordering department members
- Reuse `@dnd-kit/sortable` for member ordering instead of inventing custom drag logic.

**Product rule**
- built-in departments cannot be deleted
- custom departments can be deleted
- for custom departments, require the active locale name before save

**Verification**
- Create a custom department, close the dialog, reload the route, and verify persistence.

## Task 11: Build the day details dialog and manual override workflow

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to create**
- `src/components/schedules/day-details-dialog.tsx`
- `src/components/schedules/day-department-card.tsx`
- `src/components/schedules/assignment-chip-list.tsx`

**Implementation**
- The dialog should show one selected day in detail.
- For each participating department:
  - show assigned people
  - allow add/remove
  - allow drag reorder
  - allow changing `people_per_day` for that day only
- Add a responsible department selector at the day level.
- Saving a manual assignment change should mark that day/department block as `manual_override = 1`.
- Add an action to clear the manual override and return the block to generated state on the next regeneration.

**Verification**
- Edit one day manually, regenerate the month without overwrite, and confirm the edited day remains unchanged.

## Task 12: Build print preview and A4 layout packing

**Target:** frontend  
**Working Directory:** `.`  
**API Pattern:** direct  
**Agent:** `ring:frontend-engineer`

**Files to create**
- `src/components/schedules/print-preview-dialog.tsx`
- `src/components/schedules/print-department-section.tsx`
- optionally `src/components/schedules/print-layout.tsx`

**Files to modify**
- `src/routes/utilities/schedules.tsx`
- `global.css`

**Implementation**
- Build a print-preview dialog that renders only the schedule pack.
- Use `@media print` rules in `global.css` to hide app chrome and keep only the print canvas.
- A4 portrait default:
  - `@page { size: A4 portrait; margin: 12mm; }`
- Render department sections with:
  - colored header band
  - icon
  - bold title
  - table or list of dates and assigned names
- Pack sections top-to-bottom so multiple departments can share a page if space remains.
- The preview should allow selecting which departments to include before calling `window.print()`.

**Verification**
- Manual print preview check:
  - short departments share one page
  - long department starts on a new page when needed
  - OS print dialog opens and lists available printers

## Task 13: Add focused tests and regression coverage

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:qa-analyst`

**Files to create/modify**
- `src-tauri/src/db/queries/schedules.rs`
- `tests/` for small pure-TS helpers if needed

**Implementation**
- Keep algorithm tests in Rust where the generation logic lives.
- Add small TS tests only for pure frontend helpers such as calendar-grid generation or department name fallback if those helpers are extracted.
- Do not add snapshot-heavy UI tests for this first pass.

**Verification**
- Rust schedule tests pass.
- Existing TS tests still pass.

## Task 14: Final manual acceptance pass

**Target:** shared  
**Working Directory:** `.`  
**Agent:** `ring:qa-analyst`

**Acceptance script**
1. Open `/utilities/schedules`.
2. Select a month and add all Sundays.
3. Add one custom date manually.
4. Add members to `music` and `reception`.
5. Generate the month.
6. Open one day and set a responsible department.
7. Manually reorder assignees for one department on one day.
8. Regenerate without overwrite and confirm the manual day remains unchanged.
9. Open print preview, include multiple departments, and confirm more than one department can share the same A4 page.
10. Open the OS print dialog and confirm the user can pick an installed or network printer or a PDF destination.

## Failure Recovery

- If migration 22 fails on a dev database, delete the local app DB and recreate it before debugging UI issues.
- If the generated Specta bindings do not update, start the Tauri app in debug mode again and re-open `src/lib/bindings.ts`.
- If print CSS leaks into normal screens, isolate print rules under a wrapper class such as `.schedule-print-root`.
- If someone proposes schedule search mid-implementation, stop and add a new migration-level task instead of copying the app-managed `collections_fts` pattern into the schedule query layer.

## Zero-Context Test

Another engineer should be able to follow this plan without prior context and answer:
- which tables hold month, day, department, and assignment data
- how manual overrides survive regeneration
- where the utility route lives
- how print output works in V1

If any of those answers are unclear, tighten the plan before execution.

## Validation Note

The `ring:writing-plans` skill recommends validating this file with `default/lib/validate-plan-precedent.py`, but that validator is not present in the inspected workspace paths for this repository. Treat this plan as manually reviewed, not machine-validated.
