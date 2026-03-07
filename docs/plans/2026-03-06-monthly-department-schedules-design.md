# Monthly Department Schedules - Design

**Date:** 2026-03-06
**Status:** Approved

## Overview

Add a new utility for building, storing, generating, and printing church department schedules by month.

The source of truth is a **month plan**:
- the user selects which days in the month matter
- each selected day can optionally declare one **responsible department** for the worship/service
- each department can have one or more assigned people on that day

This keeps the UX calendar-first while still supporting department-specific printouts.

## Product Boundaries

This feature intentionally stays simple:
- include: monthly schedule storage, auto-generation, manual reorder, custom departments, print/export-ready layout
- include: quick date selection patterns like "all Sundays" plus manual day toggles
- exclude: attendance, confirmations, reminders, notifications, analytics, and volunteer history dashboards

## Core UX

### Main screen

New utility route: `/utilities/schedules`

The screen has four primary areas:
- **Month toolbar**: year/month picker, generate, manage departments, print
- **Calendar grid**: full month view with selected service days highlighted
- **Day summary in cells**: responsible department chip plus compact assignment counters
- **Day details dialog**: opened by clicking a day, showing departments and assigned people for that specific date

### Day details dialog

For the selected date, the dialog allows the user to:
- change the service label if needed
- choose the responsible department for the worship/service
- view each participating department
- add/remove assigned people
- drag to reorder assigned people
- mark the day/department block as manually edited so regeneration does not overwrite it unless requested

### Department management

Departments are configurable from the same feature:
- built-in departments are seeded by migration
- custom departments can be created with icon, color, and localized names
- per-language names are optional outside the active language
- each department has an ordered member list and a default `people_per_day`

## Data Model

Use normalized SQLite tables instead of JSON blobs so generation, filtering, and printing stay predictable.

### `schedule_departments`

Stores built-in and custom departments.

Suggested columns:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `code TEXT NULL` - stable identifier for built-in departments like `music` or `multimedia`
- `name_pt TEXT NULL`
- `name_en TEXT NULL`
- `name_es TEXT NULL`
- `icon TEXT NOT NULL`
- `color TEXT NOT NULL`
- `people_per_day INTEGER NOT NULL DEFAULT 1`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `is_system INTEGER NOT NULL DEFAULT 0`
- `is_active INTEGER NOT NULL DEFAULT 1`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

Built-in rows are seeded for:
- `music`
- `multimedia`
- `reception`
- `deacons`
- `deaconesses`
- `communication`
- `cleaning`

### `schedule_department_members`

Ordered members for each department.

Suggested columns:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `department_id INTEGER NOT NULL REFERENCES schedule_departments(id) ON DELETE CASCADE`
- `name TEXT NOT NULL`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `is_active INTEGER NOT NULL DEFAULT 1`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

### `schedule_months`

One row per stored month.

Suggested columns:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `year INTEGER NOT NULL`
- `month INTEGER NOT NULL`
- `notes TEXT NULL`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

Unique index:
- `(year, month)`

### `schedule_days`

The selected days that belong to a stored month.

Suggested columns:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `schedule_month_id INTEGER NOT NULL REFERENCES schedule_months(id) ON DELETE CASCADE`
- `service_date TEXT NOT NULL`
- `label TEXT NULL`
- `source_kind TEXT NOT NULL DEFAULT 'manual'`
- `responsible_department_id INTEGER NULL REFERENCES schedule_departments(id) ON DELETE SET NULL`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

`source_kind` keeps only lightweight provenance such as `manual`, `weekday-pattern`, or `copied`.
The stored truth is still the explicit day row, not the original pattern.

### `schedule_day_departments`

Connects selected days to participating departments.

Suggested columns:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `schedule_day_id INTEGER NOT NULL REFERENCES schedule_days(id) ON DELETE CASCADE`
- `department_id INTEGER NOT NULL REFERENCES schedule_departments(id) ON DELETE CASCADE`
- `people_per_day INTEGER NOT NULL`
- `manual_override INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

Unique index:
- `(schedule_day_id, department_id)`

### `schedule_assignments`

Ordered people assigned to one department on one day.

Suggested columns:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `schedule_day_department_id INTEGER NOT NULL REFERENCES schedule_day_departments(id) ON DELETE CASCADE`
- `member_id INTEGER NOT NULL REFERENCES schedule_department_members(id) ON DELETE CASCADE`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`

Unique index:
- `(schedule_day_department_id, member_id)`

## Generation Rules

The scheduler is intentionally deterministic and simple.

### Inputs

Generation uses:
- the selected month
- explicit selected days
- the departments participating in that month
- each department's ordered member list
- `people_per_day` for each day/department pair

### Output rule

For a single department:
- rotate through the member list in order
- do not repeat a person until the pool is exhausted
- allow multiple assignees per day
- if the number of required assignment slots is larger than the member pool, wrap and continue

Example:
- members: `Ana`, `Bruno`, `Carla`
- people per day: `2`
- selected days: `4`

Result:
- day 1 -> `Ana`, `Bruno`
- day 2 -> `Carla`, `Ana`
- day 3 -> `Bruno`, `Carla`
- day 4 -> `Ana`, `Bruno`

### Manual edits

If the user edits assignees for one department on one day:
- set `manual_override = 1` on that `schedule_day_departments` row
- subsequent generation skips that row unless the user explicitly asks to overwrite manual edits

This keeps "generate, then fine-tune" safe.

## Localization Model

Built-in departments use stable `code` values and default locale keys in `src/locales/*.json`.

Custom departments store names per language in DB columns:
- active language is required
- other language columns are optional
- UI falls back in this order:
  1. requested locale name
  2. active language name
  3. first non-empty localized value
  4. built-in locale key from `code`

## Search And FTS Policy

V1 does not require full-text search for schedules, departments, or members.

If search is introduced later:
- FTS5 must be implemented at the SQLite migration level
- prefer DB-managed FTS tables and triggers, following the `hymns_fts` pattern
- do not maintain schedule FTS documents from Rust query functions
- do not add app-managed rebuild or upsert helpers for schedule search

The existing exception remains `collections_fts` for collection songs, because that index aggregates multiple tables and derived slide content.

## Printing And PDF

V1 uses a **print-preview dialog inside the app** with A4 portrait defaults.

Layout rules:
- section header per department with icon, bold title, and department color
- stacked sections on the page
- if a section does not fill the page, the next department starts below it on the same A4
- use `break-inside: avoid` to prevent one department block from splitting awkwardly

V1 print/export path:
- `Print` opens the OS print dialog
- installed and network printers are handled by the OS print dialog
- `Save as PDF` or PDF printers are also handled through the same print dialog

This avoids adding a native PDF engine in the first version while still meeting the user flow.

## Architecture Notes

### Backend

Add a dedicated schedules module instead of putting this into the existing generic utility commands.

Planned Rust modules:
- `src-tauri/src/db/queries/schedules.rs`
- `src-tauri/src/commands/schedules.rs`

### Frontend

Keep the UI in the existing utilities section.

Planned frontend areas:
- route shell in `src/routes/utilities/schedules.tsx`
- reusable components in `src/components/schedules/`
- hooks in `src/lib/queries.ts`
- typed Tauri wrappers in `src/lib/tauri.ts`

## File Touchpoints

Expected files:

**Backend**
- `src-tauri/src/db/migrations.rs`
- `src-tauri/src/db/models.rs`
- `src-tauri/src/db/queries/mod.rs`
- `src-tauri/src/db/queries/schedules.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/commands/schedules.rs`
- `src-tauri/src/lib.rs`

**Frontend**
- `src/lib/bindings.ts`
- `src/lib/tauri.ts`
- `src/lib/queries.ts`
- `src/routes/utilities/route.tsx`
- `src/routes/utilities/index.tsx`
- `src/routes/utilities/schedules.tsx`
- `src/components/schedules/*`
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`
