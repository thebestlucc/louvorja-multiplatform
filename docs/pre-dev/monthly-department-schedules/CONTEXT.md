---
feature: monthly-department-schedules
date: 2026-03-06
status: active-context
---

# Monthly Department Schedules - Context Handoff

Use this file to recover context before starting any implementation subtask.

## Feature Summary

Build a new utility at `/utilities/schedules` that lets the user:
- select service dates for a month
- define a responsible department for each selected day
- generate fair department assignments from ordered member lists
- manually edit and reorder assigned people
- store the month in SQLite
- print one or more department schedules in A4 format

## Scope Guard

Include:
- monthly storage
- weekday pattern helpers such as `all Sundays`
- custom departments with optional localized names
- multiple assigned people per day
- print preview with OS print dialog

Exclude:
- attendance
- reminders
- confirmations
- analytics
- volunteer history dashboards

## Approved Data Model

Create these tables in migration `v22`:
- `schedule_departments`
- `schedule_department_members`
- `schedule_months`
- `schedule_days`
- `schedule_day_departments`
- `schedule_assignments`

Core ownership:
- `schedule_months` owns the month shell
- `schedule_days` stores explicit selected dates
- `schedule_days.responsible_department_id` stores the worship/service owner
- `schedule_day_departments` links participating departments to a selected day
- `schedule_day_departments.manual_override` protects manual edits from regeneration
- `schedule_assignments` stores ordered member assignments

## Built-In Departments

Seed these stable department codes:
- `music`
- `multimedia`
- `reception`
- `deacons`
- `deaconesses`
- `communication`
- `cleaning`

Each seeded row needs:
- icon id
- color
- `people_per_day`
- sort order
- system flag

## Generation Rules

For one department:
- use active members ordered by `sort_order`
- assign `people_per_day` members per selected date
- do not repeat a member until the pool is exhausted
- when the pool is smaller than required slots, wrap and continue
- skip `manual_override = 1` rows unless overwrite is explicitly requested

Example:
- members: `Ana`, `Bruno`, `Carla`
- people per day: `2`
- selected dates: `4`
- output order:
  - day 1 -> `Ana`, `Bruno`
  - day 2 -> `Carla`, `Ana`
  - day 3 -> `Bruno`, `Carla`
  - day 4 -> `Ana`, `Bruno`

## Localization Rules

Built-in departments:
- use stable `code`
- render from locale files when DB localized values are absent

Custom departments:
- require name in active locale
- other locale names optional
- fallback order:
  1. requested locale
  2. active locale
  3. first non-empty stored locale

## Print Rules

V1 print/export is intentionally simple:
- render an in-app print preview
- use A4 portrait defaults
- stack department sections vertically
- let multiple departments share the same page when space allows
- use OS print dialog for installed printers, network printers, and PDF output

Do not add:
- native PDF engine
- printer discovery plugin
- custom spooler integration

## FTS Policy

V1 does not require search for schedules, departments, or members.

If search is added later:
- implement FTS5 at the database level through migrations
- use SQLite-managed triggers or external-content FTS patterns
- do not add Rust-side schedule FTS rebuild/upsert helpers
- do not modify existing hymns or collections search code for this feature unless a regression fix is explicitly required

Current exception:
- collection-song search can stay app-managed because it aggregates multiple tables and derived slide content

## Expected Backend Files

- `src-tauri/src/db/migrations.rs`
- `src-tauri/src/db/models.rs`
- `src-tauri/src/db/queries/mod.rs`
- `src-tauri/src/db/queries/schedules.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/commands/schedules.rs`
- `src-tauri/src/lib.rs`

## Expected Frontend Files

- `src/lib/tauri.ts`
- `src/lib/queries.ts`
- `src/lib/bindings.ts` (generated)
- `src/routes/utilities/route.tsx`
- `src/routes/utilities/index.tsx`
- `src/routes/utilities/schedules.tsx`
- `src/components/schedules/*`
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`
- `global.css`

## Session Recovery Rule

If implementation is interrupted:
1. reopen this file
2. reopen `docs/pre-dev/monthly-department-schedules/TASKS.md`
3. resume from the next unchecked subtask only

Do not re-open the full design/plan unless a decision is actually unclear.
