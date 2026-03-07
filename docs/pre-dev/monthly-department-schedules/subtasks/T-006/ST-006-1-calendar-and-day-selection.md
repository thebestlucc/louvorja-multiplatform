# ST-006-1: Build The Calendar, Month Toolbar, And Day Selection Persistence

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Let the user pick a month, apply weekday patterns, toggle selected dates, and see selected days persisted in the calendar view.

**Prerequisites**
- `T-005` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm the schedule route exists:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "createFileRoute\\(\"/utilities/schedules\"" src/routes/utilities/schedules.tsx
  ```

**Files**
- Modify: `src/routes/utilities/schedules.tsx`
- Create: `src/components/schedules/month-toolbar.tsx`
- Create: `src/components/schedules/month-calendar.tsx`
- Create: `src/components/schedules/day-cell.tsx`
- Create: `src/components/schedules/month-pattern-picker.tsx`
- Create: `src/lib/schedules.ts`
- Test: `tests/schedules/calendar-helpers.test.ts`

## Steps

### Step 1: Add a failing helper test

Create `tests/schedules/calendar-helpers.test.ts` with tests for:
- `buildMonthGrid` returns a stable full-month matrix
- `getWeekdayPatternDates` returns all Sundays for a given year/month
- selected dates are normalized as `YYYY-MM-DD`

### Step 2: Run the test and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
```

Expected result:
- new schedule helper tests fail because helpers do not exist yet

### Step 3: Implement the schedule helpers

In `src/lib/schedules.ts`, add pure helpers:
- `buildMonthGrid`
- `toIsoDate`
- `getWeekdayPatternDates`
- `toggleSelectedDate`

Keep these helpers pure so they remain testable outside React.

### Step 4: Build the toolbar and calendar components

Create:
- `month-toolbar.tsx`
- `month-pattern-picker.tsx`
- `month-calendar.tsx`
- `day-cell.tsx`

Required UX:
- month/year controls
- pattern actions like `all Sundays`
- clickable day cells
- selected days visually distinct
- compact responsible-department placeholder slot

### Step 5: Wire persistence into the route

In `src/routes/utilities/schedules.tsx`:
- use the schedule month query
- use the save-days mutation
- when a day is toggled, persist the explicit day list
- when a weekday pattern is applied, convert it into explicit day rows before save

### Step 6: Re-run tests and build

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- new helper tests pass
- app builds successfully

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/routes/utilities/schedules.tsx src/components/schedules/month-toolbar.tsx src/components/schedules/month-calendar.tsx src/components/schedules/day-cell.tsx src/components/schedules/month-pattern-picker.tsx src/lib/schedules.ts tests/schedules/calendar-helpers.test.ts && git commit -m "feat(schedule): add calendar and day selection workflows"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/routes/utilities/schedules.tsx src/components/schedules/month-toolbar.tsx src/components/schedules/month-calendar.tsx src/components/schedules/day-cell.tsx src/components/schedules/month-pattern-picker.tsx src/lib/schedules.ts tests/schedules/calendar-helpers.test.ts
```
