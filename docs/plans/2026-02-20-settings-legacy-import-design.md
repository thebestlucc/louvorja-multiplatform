# Settings: Legacy Database Import — Design

**Date:** 2026-02-20

## Summary

Add a "Import Legacy Database" section to the Settings page so users who skipped onboarding or want to re-import data can access the migration wizard at any time.

## Architecture Decisions

- **State model:** New `useMigrationStore` (Zustand) — replaces the migration fields currently in `onboardingStore`. Both onboarding and settings share this store.
- **UI placement:** Inline section in `settings/index.tsx` (right column, below Projector Screens), using the same `<section>` card pattern as existing sections.
- **No new Tauri commands** — all migration commands already exist.

## Components

### New: `src/stores/migration-store.ts`

```ts
interface MigrationState {
  runId: string | null;
  sourcePath: string;
  status: string | null;
  report: MigrationReport | null;
  setMigrationRun: (runId: string, sourcePath: string) => void;
  setMigrationStatus: (status: string) => void;
  setMigrationReport: (report: MigrationReport) => void;
  clearMigration: () => void;
}
```

### Modified: `src/stores/onboarding-store.ts`

Remove migration fields (`migrationRunId`, `migrationSourcePath`, `migrationReport`, `migrationStatus`) and their actions. Keep only onboarding flow state (`mode`, `firstRun`, etc.).

### Modified: `src/routes/onboarding/import.tsx`

Replace `useOnboardingStore` migration field reads/writes with `useMigrationStore`.

### Modified: `src/routes/settings/index.tsx`

Add new `<section>` at the bottom of the right column:
- Icon: `Database` (lucide-react)
- Title: `t("settings.legacyImport.title")`
- Renders `<ImportWizard>` when no active run, `<ImportProgress>` when run is active
- Local state: `sourcePath`, `options`, `errorMessage`, `eventProgress` (same pattern as onboarding import page)

### Modified: `src/locales/en.json`, `pt.json`, `es.json`

New keys under `settings.legacyImport`:
- `title`, `description`, `sourcePath`, `browse`, `startImport`, `startFresh`
- `includeHymns`, `includeBible`, `includeFavorites`, `includeServices`, `includeSettings`
- `replaceExisting`, `domainTitle`, `domainsSelected`, `domainsNoneSelected`
- `progressTitle`, `waiting`, `cancel`, `continue`, `retry`
- `statusRunning`, `statusCompleted`, `statusFailed`, `statusCancelled`
- `summaryTitle`, `summaryErrors`, `summaryNoErrors`

## Data Flow

1. User clicks "Browse" → `openFileDialog` → sets `sourcePath`
2. User clicks "Start Import" → `useStartMigration` mutation → stores `runId` in `migrationStore`
3. `listen("migration-progress")` event → updates local `eventProgress` state
4. `useMigrationProgress(runId)` polls → when terminal status → `useMigrationReport` fetches → stored in `migrationStore`
5. "Continue" / "Retry" → `clearMigration()` resets store → wizard shown again

## File Checklist

- [ ] `src/stores/migration-store.ts` — create
- [ ] `src/stores/onboarding-store.ts` — remove migration fields
- [ ] `src/routes/onboarding/import.tsx` — use migrationStore
- [ ] `src/routes/settings/index.tsx` — add Legacy Import section
- [ ] `src/locales/en.json`, `pt.json`, `es.json` — add i18n keys
