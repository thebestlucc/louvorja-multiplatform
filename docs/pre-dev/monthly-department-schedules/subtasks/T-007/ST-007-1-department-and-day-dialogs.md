# ST-007-1: Add Department Management And Day Details Editing

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Let the user manage departments and members, set responsible departments, and manually edit assignments without losing generated data.

**Prerequisites**
- `T-006` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm schedule components directory exists:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && find src/components/schedules -maxdepth 1 -type f | sed -n '1,40p'
  ```

**Files**
- Modify: `src/routes/utilities/schedules.tsx`
- Create: `src/components/schedules/department-manager-dialog.tsx`
- Create: `src/components/schedules/department-form.tsx`
- Create: `src/components/schedules/member-list-editor.tsx`
- Create: `src/components/schedules/day-details-dialog.tsx`
- Create: `src/components/schedules/day-department-card.tsx`

## Steps

### Step 1: Build department management dialog

Create:
- `department-manager-dialog.tsx`
- `department-form.tsx`
- `member-list-editor.tsx`

Required capabilities:
- list built-in and custom departments
- edit icon, color, localized names, active flag, and default `people_per_day`
- add custom departments
- delete custom departments only
- add, remove, and reorder department members

Implementation rule:
- active locale name is required for custom departments
- do not allow deletion when `isSystem` is true

### Step 2: Build day details dialog

Create:
- `day-details-dialog.tsx`
- `day-department-card.tsx`

Required capabilities:
- open by clicking a selected day
- set `responsible_department_id`
- view participating departments for the day
- add or remove assignees
- reorder assignees
- change `people_per_day` for that day/department

### Step 3: Persist manual override behavior

When the user saves manual assignments:
- call the day assignment mutation
- ensure backend write path marks `manual_override = 1`
- show the dialog state as manually edited

Add one explicit action in the UI:
- `Reset to generated`

That action should:
- clear the manual override for the selected day/department
- allow the next generation run to rewrite the assignments

### Step 4: Wire dialogs into the schedule route

Update `src/routes/utilities/schedules.tsx` to:
- open department manager from toolbar
- open day details from day cell click
- invalidate and refresh month detail after saves

### Step 5: Build and manually verify

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Manual verification:
- create a custom department
- add members
- set one day responsible department
- edit assignments
- close and reopen the route
- confirm all edits persisted

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/routes/utilities/schedules.tsx src/components/schedules/department-manager-dialog.tsx src/components/schedules/department-form.tsx src/components/schedules/member-list-editor.tsx src/components/schedules/day-details-dialog.tsx src/components/schedules/day-department-card.tsx && git commit -m "feat(schedule): add department management and day editing dialogs"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/routes/utilities/schedules.tsx src/components/schedules/department-manager-dialog.tsx src/components/schedules/department-form.tsx src/components/schedules/member-list-editor.tsx src/components/schedules/day-details-dialog.tsx src/components/schedules/day-department-card.tsx
```
