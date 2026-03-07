# ST-001-1: Add Schedule Schema And Seed Default Departments

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Add SQLite migration `v22` with the schedule tables, indexes, and seeded built-in departments.

**Prerequisites**
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`.
- Confirm current migration head:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "version \\) VALUES \\(20\\)|current_version < 20" src-tauri/src/db/migrations.rs
  ```
- Expected result: at least one match proving the current migration head is `20`.

**Files**
- Modify: `src-tauri/src/db/migrations.rs`
- Test: `src-tauri/src/db/migrations.rs`

## Steps

### Step 1: Add a failing migration smoke test

Add a `#[cfg(test)]` module to `src-tauri/src/db/migrations.rs` with one test named `creates_schedule_schema_and_seeds_departments`.

The test should:
- open an in-memory SQLite connection
- call `run_migrations(&conn)`
- assert that each new table exists in `sqlite_master`
- assert that exactly seven seeded rows exist in `schedule_departments`
- assert that codes `music`, `multimedia`, `reception`, `deacons`, `deaconesses`, `communication`, and `cleaning` are present

### Step 2: Run the test and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test creates_schedule_schema_and_seeds_departments --lib
```

Expected result:
- test fails because the new tables do not exist yet

### Step 3: Implement `migrate_v22`

In `src-tauri/src/db/migrations.rs`:
- add a new `if current_version < 22` block in `run_migrations`
- create `fn migrate_v22(conn: &Connection) -> Result<(), AppError>`
- inside `migrate_v22`, create these tables:
  - `schedule_departments`
  - `schedule_department_members`
  - `schedule_months`
  - `schedule_days`
  - `schedule_day_departments`
  - `schedule_assignments`
- add these indexes:
  - unique `(year, month)` on `schedule_months`
  - unique `(schedule_month_id, service_date)` on `schedule_days`
  - unique `(schedule_day_id, department_id)` on `schedule_day_departments`
  - unique `(schedule_day_department_id, member_id)` on `schedule_assignments`
  - unique non-null `code` on `schedule_departments`
- seed the seven built-in departments with `INSERT OR IGNORE`

Required seeded defaults:
- `music`
- `multimedia`
- `reception`
- `deacons`
- `deaconesses`
- `communication`
- `cleaning`

Use:
- text icon ids
- hex color strings
- `people_per_day = 1`
- ordered `sort_order`
- `is_system = 1`
- `is_active = 1`

Do not add schedule FTS tables in this subtask. No approved V1 UI requires schedule search yet. If search is introduced later, it must be added as a separate database-level migration with triggers.

### Step 4: Re-run the test and confirm success

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test creates_schedule_schema_and_seeds_departments --lib
```

Expected result:
- test passes

### Step 5: Run the migration file test suite

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test migrations --lib
```

Expected result:
- migration tests pass

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/db/migrations.rs && git commit -m "feat(schedule): add monthly schedule schema and seed departments"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/db/migrations.rs
```
