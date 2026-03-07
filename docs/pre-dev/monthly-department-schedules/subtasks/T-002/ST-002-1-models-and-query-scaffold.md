# ST-002-1: Add Rust Models And Query Scaffold

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Create schedule DTOs plus the query module that loads, saves, and nests month schedule data.

**Prerequisites**
- `T-001` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm the new tables exist in migration source:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "schedule_departments|schedule_months|schedule_assignments" src-tauri/src/db/migrations.rs
  ```

**Files**
- Modify: `src-tauri/src/db/models.rs`
- Modify: `src-tauri/src/db/queries/mod.rs`
- Create: `src-tauri/src/db/queries/schedules.rs`

## Steps

### Step 1: Add schedule DTOs to `models.rs`

Create serializable `specta::Type` structs for:
- `ScheduleDepartment`
- `ScheduleDepartmentMember`
- `ScheduleMonth`
- `ScheduleDay`
- `ScheduleDayDepartment`
- `ScheduleAssignment`
- `ScheduleMonthDetail`
- `ScheduleDepartmentInput`
- `ScheduleDayInput`
- `ScheduleGenerationRequest`
- `ScheduleAssignmentInput`

Field requirements:
- department DTO exposes icon, color, localized names, built-in flag, active flag, and `people_per_day`
- month detail DTO exposes nested days and department/member data
- use camelCase serde naming to match existing frontend bindings

### Step 2: Add a failing query smoke test

In `src-tauri/src/db/queries/schedules.rs`, create an in-memory test named `creates_and_reads_empty_schedule_month`.

The test should:
- open an in-memory SQLite connection
- call `run_migrations(&conn)`
- create or load month `2026-03`
- read the month detail payload
- assert the returned `year` and `month`
- assert the department list is seeded and non-empty
- assert the days list is empty initially

### Step 3: Export the new query module

In `src-tauri/src/db/queries/mod.rs`, add:
- `pub mod schedules;`

### Step 4: Implement the query scaffold

In `src-tauri/src/db/queries/schedules.rs`, add scaffold functions for:
- `list_schedule_departments`
- `upsert_schedule_department`
- `delete_schedule_department`
- `replace_department_members`
- `get_or_create_schedule_month`
- `replace_schedule_month_days`
- `get_schedule_month_detail`
- `save_day_assignments`
- helper functions that map DB rows into nested DTOs

Implementation rules:
- keep multi-table writes inside transactions
- reject deletion of `is_system = 1` departments
- return nested detail payloads instead of raw row arrays
- do not add schedule FTS rebuild/upsert functions in this module
- if search is introduced later, this module should read DB-managed FTS tables only

### Step 5: Run the new test and confirm success

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test creates_and_reads_empty_schedule_month --lib
```

Expected result:
- test passes

### Step 6: Run schedule query tests

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test db::queries::schedules --lib
```

Expected result:
- query module tests pass

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/db/models.rs src-tauri/src/db/queries/mod.rs src-tauri/src/db/queries/schedules.rs && git commit -m "feat(schedule): add models and schedule query scaffold"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/db/models.rs src-tauri/src/db/queries/mod.rs src-tauri/src/db/queries/schedules.rs
```
