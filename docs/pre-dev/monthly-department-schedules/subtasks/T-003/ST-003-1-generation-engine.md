# ST-003-1: Implement The Schedule Generation Engine

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Implement deterministic monthly assignment generation with no repeats before pool exhaustion and protection for manual overrides.

**Prerequisites**
- `T-002` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm the query scaffold exists:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "get_or_create_schedule_month|replace_schedule_month_days|save_day_assignments" src-tauri/src/db/queries/schedules.rs
  ```

**Files**
- Modify: `src-tauri/src/db/queries/schedules.rs`

## Steps

### Step 1: Add failing generation tests

In `src-tauri/src/db/queries/schedules.rs`, add tests with these exact names:
- `generation_does_not_repeat_before_pool_exhaustion`
- `generation_wraps_when_member_pool_is_smaller_than_required_slots`
- `generation_skips_manual_overrides_by_default`
- `generation_overwrites_manual_overrides_when_requested`

Test setup should:
- create month `2026-03`
- create selected service days
- create one or more departments and ordered members
- attach departments to days
- call the generation function
- assert exact member order written to assignments

### Step 2: Run the tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test generation_ --lib
```

Expected result:
- the new generation tests fail

### Step 3: Implement `generate_schedule_month`

In `src-tauri/src/db/queries/schedules.rs`, implement a generation function that:
- accepts `year`, `month`, and `overwrite_manual`
- loads active members ordered by `sort_order`
- loads selected day/department rows ordered by service date then department order
- skips rows with `manual_override = 1` when `overwrite_manual` is `false`
- clears only the assignments that are allowed to regenerate
- rotates through the member list and fills `people_per_day`
- never duplicates a member inside one department/day
- wraps when the pool is exhausted

### Step 4: Ensure manual-save behavior sets override state

Update the write path that persists manual assignments so it:
- replaces assignments for the target `schedule_day_department_id`
- sets `manual_override = 1`
- keeps assignment order equal to the submitted list order

### Step 5: Re-run the targeted tests

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test generation_ --lib
```

Expected result:
- all four generation tests pass

### Step 6: Run the full schedule query suite

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri && cargo test db::queries::schedules --lib
```

Expected result:
- full query suite passes

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/db/queries/schedules.rs && git commit -m "feat(schedule): implement assignment generation engine"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/db/queries/schedules.rs
```
