# ST-005-1: Add I18n, Utilities Navigation, And The Schedule Route Shell

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Make the new feature discoverable and create the minimal schedule screen shell with no broken routes.

**Prerequisites**
- `T-004` completed
- Read `docs/pre-dev/monthly-department-schedules/CONTEXT.md`
- Confirm the typed schedule hooks exist:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && rg -n "useScheduleMonth|useScheduleDepartments" src/lib/queries.ts
  ```

**Files**
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`
- Modify: `src/routes/utilities/route.tsx`
- Modify: `src/routes/utilities/index.tsx`
- Create: `src/routes/utilities/schedules.tsx`

## Steps

### Step 1: Add locale keys in all three locale files

Add a `utilities.schedules` namespace with:
- title
- subtitle
- month picker labels
- generate labels
- day selection labels
- department management labels
- responsible department labels
- print labels
- empty states

Also add:
- `utilities.nav.schedules`
- overview card title and description

### Step 2: Validate i18n and confirm failure-free JSON

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm lint:i18n
```

Expected result:
- locale validation passes

### Step 3: Add utilities nav and overview links

Update:
- `src/routes/utilities/route.tsx`
- `src/routes/utilities/index.tsx`

Required changes:
- add the schedules nav item
- add the schedules overview card
- use a distinct icon that fits scheduling

### Step 4: Create the route shell

Create `src/routes/utilities/schedules.tsx` with:
- current month/year state
- `useScheduleMonth` query
- `useScheduleDepartments` query
- placeholder toolbar container
- placeholder calendar section
- empty-state or loading states

Do not implement the full feature here yet. This task only establishes the route shell.

### Step 5: Build and verify the route exists

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- build succeeds
- generated route typing includes `/utilities/schedules`

### Step 6: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/locales/en.json src/locales/pt.json src/locales/es.json src/routes/utilities/route.tsx src/routes/utilities/index.tsx src/routes/utilities/schedules.tsx && git commit -m "feat(schedule): add i18n, utilities nav, and route shell"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/locales/en.json src/locales/pt.json src/locales/es.json src/routes/utilities/route.tsx src/routes/utilities/index.tsx src/routes/utilities/schedules.tsx
```
