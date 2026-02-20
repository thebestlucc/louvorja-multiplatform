# Settings Legacy Import Implementation Plan

> **For Agents:** REQUIRED SUB-SKILL: Use ring:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Legacy Database Import" section to Settings so users can import data from their old Delphi database at any time, not just during onboarding.

**Architecture:** Extract migration state from `onboardingStore` into a new shared `migrationStore`. Both onboarding and settings pages consume this store. The settings page renders the existing `ImportWizard` and `ImportProgress` components inline in a new section card. No new backend code needed.

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, i18next, Tauri plugin-dialog

**Global Prerequisites:**
- Environment: macOS/Windows/Linux, Node 18+, pnpm
- Tools: `pnpm --version` (8+), `cargo --version`
- State: On `main` branch, clean working tree

**Verification before starting:**
```bash
pnpm --version        # Expected: 8+
git status            # Expected: clean working tree (or only expected WIP changes)
pnpm vite build       # Expected: builds successfully
npx tsc --noEmit      # Expected: no errors
```

---

### Task 1: Create migration-store.ts

**Files:**
- Create: `src/stores/migration-store.ts`

**Prerequisites:**
- File must not exist yet: `src/stores/migration-store.ts`
- Types exist: `src/types/migration.ts` (MigrationReport, MigrationStatus)

**Step 1: Create the store file**

```ts
// src/stores/migration-store.ts
import { create } from "zustand";
import type { MigrationReport, MigrationStatus } from "../types/migration";

interface MigrationState {
  runId: string | null;
  sourcePath: string;
  status: MigrationStatus | "idle";
  report: MigrationReport | null;
  setMigrationRun: (runId: string, sourcePath: string) => void;
  setMigrationStatus: (status: MigrationStatus) => void;
  setMigrationReport: (report: MigrationReport | null) => void;
  clearMigration: () => void;
}

const initialState = {
  runId: null as string | null,
  sourcePath: "",
  status: "idle" as MigrationStatus | "idle",
  report: null as MigrationReport | null,
};

export const useMigrationStore = create<MigrationState>((set) => ({
  ...initialState,
  setMigrationRun: (runId, sourcePath) =>
    set({
      runId,
      sourcePath,
      status: "running",
      report: null,
    }),
  setMigrationStatus: (status) => set({ status }),
  setMigrationReport: (report) =>
    set({
      report,
      status: report?.status ?? "idle",
    }),
  clearMigration: () => set(initialState),
}));
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Expected output:** No errors (or only pre-existing errors unrelated to migration-store)

**If Task Fails:**
- Check import paths match: `../types/migration` relative to `src/stores/`
- Rollback: `rm src/stores/migration-store.ts`

---

### Task 2: Remove migration fields from onboarding-store.ts

**Files:**
- Modify: `src/stores/onboarding-store.ts` (entire file, 52 lines)

**Prerequisites:**
- Task 1 complete (migration-store.ts exists)

**Step 1: Replace the entire file content**

```ts
// src/stores/onboarding-store.ts
import { create } from "zustand";

type OnboardingMode = "fresh" | "import" | null;

interface OnboardingState {
  mode: OnboardingMode;
  setMode: (mode: OnboardingMode) => void;
  reset: () => void;
}

const initialState = {
  mode: null as OnboardingMode,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  reset: () => set(initialState),
}));
```

**Step 2: Verify TypeScript shows errors only in onboarding/import.tsx**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

**Expected output:** Errors in `src/routes/onboarding/import.tsx` referencing removed fields (`migrationRunId`, `migrationSourcePath`, etc.). This is expected and fixed in Task 3.

**If Task Fails:**
- Rollback: `git checkout -- src/stores/onboarding-store.ts`

---

### Task 3: Refactor onboarding/import.tsx to use migrationStore

**Files:**
- Modify: `src/routes/onboarding/import.tsx` (lines 20, 38-46)

**Prerequisites:**
- Task 1 and 2 complete

**Step 1: Replace the onboarding-store import with migration-store import**

Replace line 20:
```ts
import { useOnboardingStore } from "../../stores/onboarding-store";
```
with:
```ts
import { useOnboardingStore } from "../../stores/onboarding-store";
import { useMigrationStore } from "../../stores/migration-store";
```

**Step 2: Replace the store reads/writes inside OnboardingImportPage function**

Replace lines 38-46 (the store selectors block):
```ts
  const mode = useOnboardingStore((state) => state.mode);
  const runId = useOnboardingStore((state) => state.migrationRunId);
  const storedSourcePath = useOnboardingStore((state) => state.migrationSourcePath);
  const storedReport = useOnboardingStore((state) => state.migrationReport);
  const setMode = useOnboardingStore((state) => state.setMode);
  const setMigrationRun = useOnboardingStore((state) => state.setMigrationRun);
  const setMigrationStatus = useOnboardingStore((state) => state.setMigrationStatus);
  const setMigrationReport = useOnboardingStore((state) => state.setMigrationReport);
  const clearMigration = useOnboardingStore((state) => state.clearMigration);
```
with:
```ts
  const mode = useOnboardingStore((state) => state.mode);
  const setMode = useOnboardingStore((state) => state.setMode);
  const runId = useMigrationStore((state) => state.runId);
  const storedSourcePath = useMigrationStore((state) => state.sourcePath);
  const storedReport = useMigrationStore((state) => state.report);
  const setMigrationRun = useMigrationStore((state) => state.setMigrationRun);
  const setMigrationStatus = useMigrationStore((state) => state.setMigrationStatus);
  const setMigrationReport = useMigrationStore((state) => state.setMigrationReport);
  const clearMigration = useMigrationStore((state) => state.clearMigration);
```

**Step 3: Update handleStartImport**

In `handleStartImport` (around line 141), the call `setMode("import")` still uses onboardingStore which is correct. No change needed.

**Step 4: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Expected output:** No errors related to migration or onboarding files.

**If Task Fails:**
- Check that `useMigrationStore` field names match: `runId` (not `migrationRunId`), `sourcePath` (not `migrationSourcePath`), `report` (not `migrationReport`)
- Rollback: `git checkout -- src/routes/onboarding/import.tsx`

---

### Task 4: Code Review Checkpoint

1. **Dispatch all 5 reviewers in parallel:**
   - REQUIRED SUB-SKILL: Use ring:requesting-code-review
   - All reviewers run simultaneously (ring:code-reviewer, ring:business-logic-reviewer, ring:security-reviewer, ring:test-reviewer, ring:nil-safety-reviewer)
   - Wait for all to complete

2. **Handle findings by severity (MANDATORY):**

**Critical/High/Medium Issues:**
- Fix immediately (do NOT add TODO comments for these severities)
- Re-run all 5 reviewers in parallel after fixes
- Repeat until zero Critical/High/Medium issues remain

**Low Issues:**
- Add `TODO(review):` comments in code at the relevant location

**Cosmetic/Nitpick Issues:**
- Add `FIXME(nitpick):` comments in code at the relevant location

3. **Proceed only when:**
   - Zero Critical/High/Medium issues remain

---

### Task 5: Add i18n keys to en.json

**Files:**
- Modify: `src/locales/en.json`

**Prerequisites:**
- None (independent of other tasks, but ideally do after Task 1-3)

**Step 1: Add keys under the `settings` object**

Find the closing of the existing `settings` section keys and add a new `legacyImport` block. Add these keys inside the existing `"settings": { ... }` object, after the last existing settings key:

```json
    "legacyImport": {
      "title": "Legacy Database Import",
      "description": "Import data from an older LouvorJA (Delphi) database into this installation."
    }
```

**Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json','utf8')); console.log('OK')"`

**Expected output:** `OK`

**If Task Fails:**
- JSON syntax error: check trailing commas, missing commas before the new block
- Rollback: `git checkout -- src/locales/en.json`

---

### Task 6: Add i18n keys to pt.json

**Files:**
- Modify: `src/locales/pt.json`

**Step 1: Add keys under the `settings` object (same structure as en.json)**

```json
    "legacyImport": {
      "title": "Importar Banco de Dados Legado",
      "description": "Importe dados de um banco de dados LouvorJA (Delphi) mais antigo para esta instalacao."
    }
```

**Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/pt.json','utf8')); console.log('OK')"`

**Expected output:** `OK`

---

### Task 7: Add i18n keys to es.json

**Files:**
- Modify: `src/locales/es.json`

**Step 1: Add keys under the `settings` object**

```json
    "legacyImport": {
      "title": "Importar Base de Datos Legada",
      "description": "Importe datos desde una base de datos LouvorJA (Delphi) anterior a esta instalacion."
    }
```

**Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/es.json','utf8')); console.log('OK')"`

**Expected output:** `OK`

---

### Task 8: Add Legacy Import section to settings/index.tsx

**Files:**
- Modify: `src/routes/settings/index.tsx`

**Prerequisites:**
- Tasks 1-3, 5-7 complete
- `src/stores/migration-store.ts` exists
- i18n keys exist in all 3 locale files

**Step 1: Add new imports at the top of the file**

Add these imports alongside existing ones at the top of `src/routes/settings/index.tsx`:

After the existing lucide-react import (line 6), add `Database` to the icon imports:
```ts
import { Wifi, Palette, Languages, Film, FolderOpen, Monitor, Upload, X, Database } from "lucide-react";
```

Add these new imports after the existing import block (after line 34):
```ts
import { open as openMigrationDialog } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { ImportWizard } from "../../components/migration/import-wizard";
import { ImportProgress } from "../../components/migration/import-progress";
import { useMigrationStore } from "../../stores/migration-store";
import {
  useCancelMigration,
  useMigrationProgress,
  useMigrationReport,
  useStartMigration,
} from "../../lib/queries";
import type {
  MigrationOptions,
  MigrationProgress as MigrationProgressType,
  MigrationProgressEvent,
} from "../../types/migration";
```

Note: `openFileDialog` is already imported on line 2. We need a second import alias `openMigrationDialog` because the existing `openFileDialog` is used by projector image pickers. Alternatively, reuse the existing `open as openFileDialog` import -- that is simpler. Since `openFileDialog` is already imported, we do NOT need a second import. Remove the `openMigrationDialog` line and use `openFileDialog` directly.

Corrected imports to add (after line 34):
```ts
import { listen } from "@tauri-apps/api/event";
import { ImportWizard } from "../../components/migration/import-wizard";
import { ImportProgress } from "../../components/migration/import-progress";
import { useMigrationStore } from "../../stores/migration-store";
import {
  useCancelMigration,
  useMigrationProgress,
  useMigrationReport,
  useStartMigration,
} from "../../lib/queries";
import type {
  MigrationOptions,
  MigrationProgress as MigrationProgressType,
  MigrationProgressEvent,
} from "../../types/migration";
```

**Step 2: Add migration default options constant**

After the `Route` export (line 36-38), add:
```ts
const defaultMigrationOptions: MigrationOptions = {
  includeHymns: true,
  includeBible: true,
  includeFavorites: true,
  includeServices: true,
  includeSettings: true,
  replaceExisting: false,
};
```

**Step 3: Add migration state and hooks inside SettingsIndex function**

Inside the `SettingsIndex` function, after the existing state declarations (after line 75, before `const projectorLogoPreviewSrc`), add:

```ts
  // --- Legacy Import state ---
  const migRunId = useMigrationStore((s) => s.runId);
  const migStoredSourcePath = useMigrationStore((s) => s.sourcePath);
  const migStoredReport = useMigrationStore((s) => s.report);
  const setMigrationRun = useMigrationStore((s) => s.setMigrationRun);
  const setMigrationStatus = useMigrationStore((s) => s.setMigrationStatus);
  const setMigrationReport = useMigrationStore((s) => s.setMigrationReport);
  const clearMigration = useMigrationStore((s) => s.clearMigration);
  const startMigrationMutation = useStartMigration();
  const cancelMigrationMutation = useCancelMigration();
  const [migSourcePath, setMigSourcePath] = useState("");
  const [migOptions, setMigOptions] = useState<MigrationOptions>(defaultMigrationOptions);
  const [migError, setMigError] = useState<string | null>(null);
  const [migEventProgress, setMigEventProgress] = useState<MigrationProgressType | null>(null);
  const migProgressQuery = useMigrationProgress(migRunId, { enabled: Boolean(migRunId) });
  const migShouldLoadReport = Boolean(
    migRunId
      && migProgressQuery.data
      && migProgressQuery.data.status !== "running"
      && migProgressQuery.data.status !== "cancelling",
  );
  const migReportQuery = useMigrationReport(migRunId, { enabled: migShouldLoadReport });
  const migProgress = migProgressQuery.data ?? migEventProgress;
  const migEffectiveReport = migReportQuery.data ?? migStoredReport;
  const migIsRunning = migProgress?.status === "running" || migProgress?.status === "cancelling";
  const migShowProgress = Boolean(migRunId && (migIsRunning || migEffectiveReport || migProgress));
```

**Step 4: Add migration useEffects**

After the existing `useEffect` blocks (after the monitor assignment useEffect around line 187), add:

```ts
  useEffect(() => {
    if (migStoredSourcePath) setMigSourcePath(migStoredSourcePath);
  }, [migStoredSourcePath]);

  useEffect(() => {
    if (!migProgress) return;
    setMigrationStatus(migProgress.status);
  }, [migProgress, setMigrationStatus]);

  useEffect(() => {
    if (!migReportQuery.data) return;
    setMigrationReport(migReportQuery.data);
  }, [migReportQuery.data, setMigrationReport]);

  useEffect(() => {
    if (!migRunId) {
      setMigEventProgress(null);
      return;
    }

    const unlisten = listen<MigrationProgressEvent>("migration-progress", (event) => {
      if (event.payload.runId !== migRunId) return;
      setMigEventProgress((previous) => ({
        runId: event.payload.runId,
        step: event.payload.step,
        completed: event.payload.completed,
        total: event.payload.total,
        percent: event.payload.percent,
        etaSeconds: event.payload.etaSeconds,
        message: event.payload.message,
        status: previous?.status ?? "running",
        updatedAt: previous?.updatedAt ?? new Date().toISOString(),
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [migRunId]);
```

**Step 5: Add migration handler functions**

After the existing handler functions (after `openMonitorWindowTemporarily`, around line 418), add:

```ts
  const handleStartMigration = async () => {
    setMigError(null);
    try {
      const run = await startMigrationMutation.mutateAsync({
        oldDbPath: migSourcePath.trim(),
        options: migOptions,
      });
      setMigrationRun(run.runId, migSourcePath.trim());
      setMigrationReport(null);
      setMigEventProgress(null);
    } catch (error) {
      setMigError(String(error));
    }
  };

  const migProgressLabels = {
    title: t("migration.progress.title"),
    waiting: t("migration.progress.waiting"),
    cancel: t("migration.progress.cancel"),
    continue: t("migration.progress.continue"),
    retry: t("migration.progress.retry"),
    statusRunning: t("migration.progress.statusRunning"),
    statusCompleted: t("migration.progress.statusCompleted"),
    statusFailed: t("migration.progress.statusFailed"),
    statusCancelled: t("migration.progress.statusCancelled"),
    summaryTitle: t("migration.progress.summaryTitle"),
    summaryErrors: t("migration.progress.summaryErrors"),
    summaryNoErrors: t("migration.progress.summaryNoErrors"),
  };
```

**Step 6: Add the Legacy Import section JSX**

Inside the JSX return, after the closing `</section>` of the "Projector Screens" section (line 865) and before the closing `</div>` of the right column (line 866), add:

```tsx
      {/* Legacy Database Import Section */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.legacyImport.title")}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t("settings.legacyImport.description")}</p>

        {!migShowProgress ? (
          <ImportWizard
            title={t("migration.wizard.title")}
            description={t("migration.wizard.description")}
            sourcePath={migSourcePath}
            options={migOptions}
            loading={startMigrationMutation.isPending}
            errorMessage={migError}
            onSourcePathChange={setMigSourcePath}
            onBrowseSourcePath={async () => {
              const selected = await openFileDialog({
                multiple: false,
                title: t("migration.wizard.browse"),
                filters: [
                  {
                    name: "SQLite",
                    extensions: ["db", "sqlite", "sqlite3"],
                  },
                ],
              });
              if (typeof selected === "string") {
                setMigSourcePath(selected);
                setMigError(null);
              }
            }}
            onOptionsChange={setMigOptions}
            onStartImport={() => void handleStartMigration()}
            onStartFresh={() => {
              clearMigration();
              setMigSourcePath("");
              setMigOptions(defaultMigrationOptions);
              setMigError(null);
              setMigEventProgress(null);
            }}
            labels={{
              sourcePath: t("migration.wizard.sourcePath"),
              browse: t("migration.wizard.browse"),
              startImport: t("migration.wizard.startImport"),
              startFresh: t("migration.wizard.startFresh"),
              includeHymns: t("migration.wizard.includeHymns"),
              includeBible: t("migration.wizard.includeBible"),
              includeFavorites: t("migration.wizard.includeFavorites"),
              includeServices: t("migration.wizard.includeServices"),
              includeSettings: t("migration.wizard.includeSettings"),
              replaceExisting: t("migration.wizard.replaceExisting"),
              domainTitle: t("migration.wizard.domainTitle"),
              domainsSelected: t("migration.wizard.domainsSelected"),
              domainsNoneSelected: t("migration.wizard.domainsNoneSelected"),
            }}
          />
        ) : null}

        {migShowProgress ? (
          <ImportProgress
            progress={migProgress}
            report={migEffectiveReport}
            loadingReport={migReportQuery.isLoading}
            cancelling={cancelMigrationMutation.isPending}
            labels={migProgressLabels}
            onCancel={() => {
              if (!migRunId) return;
              cancelMigrationMutation.mutate(migRunId);
            }}
            onContinue={() => {
              clearMigration();
              setMigSourcePath("");
              setMigOptions(defaultMigrationOptions);
              setMigEventProgress(null);
            }}
            onRetry={() => {
              clearMigration();
              setMigEventProgress(null);
            }}
          />
        ) : null}
      </section>
```

**Step 7: Verify TypeScript compiles**

Run: `pnpm vite build 2>&1 | tail -5 && npx tsc --noEmit --pretty 2>&1 | head -20`

**Expected output:** Build succeeds, no TypeScript errors.

**If Task Fails:**
1. **Import errors:** Check that `Database` is in the lucide-react import, that `listen` is imported from `@tauri-apps/api/event`
2. **Type errors:** Verify `MigrationProgressType` alias matches the type name in `types/migration.ts`
3. **Rollback:** `git checkout -- src/routes/settings/index.tsx`

---

### Task 9: Commit all changes

**Prerequisites:**
- Tasks 1-8 complete, TypeScript compiles cleanly

**Step 1: Stage and commit**

```bash
git add src/stores/migration-store.ts src/stores/onboarding-store.ts src/routes/onboarding/import.tsx src/routes/settings/index.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat: add Legacy Database Import section to Settings page

Extract migration state from onboarding-store into dedicated migration-store.
Add inline import wizard/progress in Settings right column.
Add i18n keys for all 3 locales."
```

**Step 2: Verify commit**

Run: `git log --oneline -1`

**Expected output:** Commit with message starting with `feat: add Legacy Database Import`

---

### Task 10: Code Review Checkpoint

1. **Dispatch all 5 reviewers in parallel:**
   - REQUIRED SUB-SKILL: Use ring:requesting-code-review
   - All reviewers run simultaneously (ring:code-reviewer, ring:business-logic-reviewer, ring:security-reviewer, ring:test-reviewer, ring:nil-safety-reviewer)
   - Wait for all to complete

2. **Handle findings by severity (MANDATORY):**

**Critical/High/Medium Issues:**
- Fix immediately (do NOT add TODO comments for these severities)
- Re-run all 5 reviewers in parallel after fixes
- Repeat until zero Critical/High/Medium issues remain

**Low Issues:**
- Add `TODO(review):` comments in code at the relevant location

**Cosmetic/Nitpick Issues:**
- Add `FIXME(nitpick):` comments in code at the relevant location

3. **Proceed only when:**
   - Zero Critical/High/Medium issues remain

---

### Task 11: Final verification

**Step 1: Full build check**

Run: `pnpm vite build 2>&1 | tail -5`

**Expected output:** Build completes successfully.

**Step 2: TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Expected output:** No errors.

**Step 3: Run dev mode and manually verify**

Run: `pnpm tauri dev`

**Manual verification checklist:**
- Navigate to Settings page
- Scroll right column: "Legacy Database Import" section visible below Projector Screens
- Database icon and title shown
- Description text visible
- ImportWizard form renders with Browse button and domain checkboxes
- Browse button opens file dialog filtered to .db/.sqlite/.sqlite3
- "Start fresh instead" button resets the form
- Navigate to onboarding import page: still works with migrationStore

**If Task Fails:**
- Check browser console for runtime errors
- Verify i18n keys exist in all 3 locale files
- Verify imports resolve correctly

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/stores/migration-store.ts` |
| Modify | `src/stores/onboarding-store.ts` |
| Modify | `src/routes/onboarding/import.tsx` |
| Modify | `src/routes/settings/index.tsx` |
| Modify | `src/locales/en.json` |
| Modify | `src/locales/pt.json` |
| Modify | `src/locales/es.json` |
