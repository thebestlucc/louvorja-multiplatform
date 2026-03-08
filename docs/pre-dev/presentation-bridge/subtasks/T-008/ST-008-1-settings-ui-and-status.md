# ST-008-1: Add Bridge Settings UI And Status

> **For Agents:** REQUIRED SUB-SKILL: Use `ring:executing-plans`

**Goal:** Add a user-facing settings surface for enabling the bridge, turning on OS autostart, editing shortcuts, and viewing bridge status.

**Prerequisites**
- `T-005` completed
- `T-006` completed
- Read `docs/pre-dev/presentation-bridge/CONTEXT.md`
- Confirm current settings route structure:
  ```bash
  cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && sed -n '150,260p' src/routes/settings/index.tsx
  ```

**Files**
- Modify: `src/routes/settings/index.tsx`
- Modify: `src/components/settings/shortcuts-tab.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`

## Steps

### Step 1: Add a failing UI assertion target

Add or update a unit test so settings UI must expose:
- enable bridge
- start bridge with OS
- target app
- next shortcut
- previous shortcut
- running status

### Step 2: Run tests and confirm failure

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test:unit
```

Expected result:
- UI coverage fails or missing bridge settings behavior

### Step 3: Add the bridge settings card

Keep it separate from the existing LouvorJA app autostart control. The UI must clearly distinguish:
- launching LouvorJA with OS
- starting `presentation-bridge` with OS

### Step 4: Add localized copy

Use the `i18n-key` workflow when implementing locale keys so all three locale files stay aligned.

### Step 5: Surface bridge status

Show one of:
- `Running (managed)`
- `Running (independent)`
- `Not running`
- `Version mismatch`
- `Error`

### Step 6: Re-run verification

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test:unit
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
```

Expected result:
- settings UI coverage passes
- build succeeds

### Step 7: Commit

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git add src/routes/settings/index.tsx src/components/settings/shortcuts-tab.tsx src/locales/en.json src/locales/pt.json src/locales/es.json && git commit -m "feat(bridge): add settings ui and bridge status"
```

## Rollback

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && git restore --worktree --staged src/routes/settings/index.tsx src/components/settings/shortcuts-tab.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
```
