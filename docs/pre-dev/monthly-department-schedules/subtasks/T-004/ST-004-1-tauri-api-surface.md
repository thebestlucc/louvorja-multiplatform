# ST-004-1: Expose The Schedule API Through Tauri, Specta, And React Query

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Add Tauri commands, regenerate typed bindings, and expose schedule queries/mutations to the frontend.

**Prerequisites**
- `T-003` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm the generation function exists:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "generate_schedule_month" src-tauri/src/db/queries/schedules.rs
  ```

**Files**
- Create: `src-tauri/src/commands/schedules.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri.ts`
- Modify: `src/lib/queries.ts`
- Modify: `src/lib/bindings.ts` (generated)

## Steps

### Step 1: Create the schedules command module

In `src-tauri/src/commands/schedules.rs`, add typed Tauri commands for:
- `list_schedule_departments`
- `save_schedule_department`
- `delete_schedule_department`
- `replace_schedule_department_members`
- `get_schedule_month`
- `save_schedule_month_days`
- `generate_schedule_month`
- `set_schedule_day_responsible_department`
- `save_schedule_day_assignments`

Implementation rule:
- command bodies should only acquire the DB connection and call query functions

### Step 2: Register the module

Update:
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

Required changes:
- export `pub mod schedules;`
- add every new command to `tauri_specta::collect_commands!`

### Step 3: Regenerate bindings

Run the app once in debug mode so Specta rewrites `src/lib/bindings.ts`.

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm tauri dev
```

Expected result:
- app starts
- `src/lib/bindings.ts` contains schedule DTOs and commands

### Step 4: Add frontend Tauri wrappers

In `src/lib/tauri.ts`, add wrapper functions for every schedule command.

Naming rule:
- follow existing wrapper style: `getScheduleMonth`, `saveScheduleDepartment`, `generateScheduleMonth`

### Step 5: Add React Query hooks

In `src/lib/queries.ts`:
- add `queryKeys.schedule.departments`
- add `queryKeys.schedule.month(year, month)`
- add `useScheduleDepartments`
- add `useScheduleMonth`
- add mutations for all write operations
- invalidate month and department queries after successful writes

Do not add search commands, search query keys, or FTS bindings in this subtask. The approved V1 feature scope does not include schedule search.

### Step 6: Type-check with the new bindings

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- TypeScript build succeeds

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src-tauri/src/commands/schedules.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src/lib/tauri.ts src/lib/queries.ts src/lib/bindings.ts && git commit -m "feat(schedule): expose Tauri API and query hooks"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src-tauri/src/commands/schedules.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src/lib/tauri.ts src/lib/queries.ts src/lib/bindings.ts
```
