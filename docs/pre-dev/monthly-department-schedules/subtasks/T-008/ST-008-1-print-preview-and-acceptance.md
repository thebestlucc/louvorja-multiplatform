# ST-008-1: Add Print Preview, A4 Packing, And Final Acceptance Checks

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Render printable department sections in A4 format and finish the feature with a reproducible acceptance checklist.

**Prerequisites**
- `T-007` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm the route exposes generated month data and day details:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "generateScheduleMonth|day-details|department-manager" src/routes/utilities/schedules.tsx src/components/schedules
  ```

**Files**
- Modify: `src/routes/utilities/schedules.tsx`
- Modify: `global.css`
- Create: `src/components/schedules/print-preview-dialog.tsx`
- Create: `src/components/schedules/print-department-section.tsx`

## Steps

### Step 1: Add a pure print-layout helper test

Create `tests/schedules/print-layout.test.ts` with assertions for:
- department sections preserve display order
- empty departments are excluded when not selected
- one printable payload can contain multiple departments

This is not a screenshot test. Keep it to pure transformation logic only.

### Step 2: Run the tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
```

Expected result:
- print helper tests fail because helper logic does not exist yet

### Step 3: Implement print preview components

Create:
- `print-preview-dialog.tsx`
- `print-department-section.tsx`

Required behavior:
- select one or more departments to print
- render a preview for the chosen month
- display department header with icon, color band, and bold title
- render dates and assigned names in a dense but readable format
- trigger `window.print()` from the dialog

### Step 4: Add print-specific CSS

In `global.css`, add print rules for:
- `@page { size: A4 portrait; margin: 12mm; }`
- hide app chrome in print mode
- keep schedule print root visible
- avoid awkward section splits with `break-inside: avoid`

### Step 5: Wire print preview into the route

Update `src/routes/utilities/schedules.tsx` to:
- open the print preview from the toolbar
- pass month detail and selected departments into the preview

### Step 6: Re-run tests and build

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- new print helper tests pass
- build succeeds

### Step 7: Run final manual acceptance

Use this exact checklist:
1. Open `/utilities/schedules`.
2. Select the current month.
3. Apply `all Sundays`.
4. Add one extra manual date.
5. Add members to `music` and `reception`.
6. Generate the month.
7. Open one day and set a responsible department.
8. Manually reorder one department assignment.
9. Regenerate without overwrite and confirm the manual assignment remains unchanged.
10. Open print preview and include multiple departments.
11. Confirm the preview stacks more than one department on the same A4 page when space allows.
12. Open the OS print dialog and confirm a PDF destination or installed printer can be chosen.

### Step 8: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/routes/utilities/schedules.tsx src/components/schedules/print-preview-dialog.tsx src/components/schedules/print-department-section.tsx global.css tests/schedules/print-layout.test.ts && git commit -m "feat(schedule): add print preview and final schedule workflow"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/routes/utilities/schedules.tsx src/components/schedules/print-preview-dialog.tsx src/components/schedules/print-department-section.tsx global.css tests/schedules/print-layout.test.ts
```
