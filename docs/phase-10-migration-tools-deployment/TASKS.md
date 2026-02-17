# Phase 10 Tasks — Migration Tools & Deployment

## Summary
- Skill used: `ring:writing-plans`.
- Scope locked: **Full Spec 11**.
- This task file defines a decision-complete execution sequence for onboarding, migration, updater, help, and deployment pipeline work.

## Public APIs / Interfaces / Types Changes

1. Rust migration command contract in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/migration.rs`:
- `start_migration(old_db_path: String, options: MigrationOptions) -> Result<MigrationRunInfo, AppError>`
- `get_migration_progress(run_id: String) -> Result<MigrationProgress, AppError>`
- `cancel_migration(run_id: String) -> Result<(), AppError>`
- `get_migration_report(run_id: String) -> Result<MigrationReport, AppError>`

2. Rust migration domain contract in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/migration/*`:
- `MigrationOptions`
- `MigrationRunInfo`
- `MigrationProgress`
- `MigrationReport`
- `MigrationErrorItem`
- Transactional import behavior per domain.

3. Migration progress event contract:
- event name: `migration-progress`
- payload: `{ runId, step, completed, total, percent, etaSeconds, message }`

4. Frontend wrappers in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts`:
- `startMigration`
- `getMigrationProgress`
- `cancelMigration`
- `getMigrationReport`
- `checkForUpdates`
- `installUpdate`

5. Frontend migration types in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/migration.ts`:
- `MigrationOptions`
- `MigrationRunInfo`
- `MigrationProgress`
- `MigrationReport`
- `MigrationErrorItem`
- `UpdateInfo`

6. Settings keys:
- `app.firstRunCompleted`
- `migration.lastSourcePath`
- `migration.lastRunStatus`
- `migration.lastRunAt`
- `migration.lastReport`

## Execution Batches

### Batch 0 — Phase Gate Sync (planning start)
- Goal: align progress tracking with Phase 09 closure and Phase 10 planning kickoff.
- Implement:
1. Update `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`:
: Keep Phase 09 as `COMPLETE`.
: Set Phase 10 status to `IN PROGRESS (planning)`.
: Add references to Phase 10 PRD/SPECS/TASKS docs.
2. Create docs directory:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-10-migration-tools-deployment/`.
- Verify:
: File references resolve and markdown headings render correctly.

### Batch 1 — Migration Domain Contracts
- Goal: introduce migration data contracts and command signatures.
- Implement:
1. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/migration/mod.rs`.
2. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/migration.rs` with command stubs + typed structs.
3. Register command module in:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/mod.rs`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs`
- Verify:
: `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`.

### Batch 2 — Backend Migration Core
- Goal: implement source import engine with per-domain transactional boundaries.
- Implement:
1. Create importers:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/migration/hymn_importer.rs`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/migration/service_importer.rs`
2. Add source validation + run lifecycle management.
3. Implement progress + report generation.
4. Wire cancellation checkpoints.
- Verify:
: Domain import tests pass.
: Invalid source path produces controlled `AppError`.

### Batch 3 — Onboarding Routing + First-Run Gate
- Goal: ensure first-run users land in onboarding and completion state is persisted.
- Implement:
1. Create onboarding routes:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/route.tsx`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/welcome.tsx`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/import.tsx`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/complete.tsx`
2. Add first-run redirect logic in startup path.
3. Persist `app.firstRunCompleted` key.
- Verify:
: Fresh profile opens onboarding.
: Completed onboarding routes to main app on next launch.

### Batch 4 — Migration UI Workflow
- Goal: provide full user flow for import source selection, progress, cancel, and summary.
- Implement:
1. Create migration UI components:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/migration/import-wizard.tsx`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/migration/import-progress.tsx`
2. Add wrappers + query hooks:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/migration.ts`
- Verify:
: Progress updates and cancel path visible in UI.
: Summary report shown on finish/fail.

### Batch 5 — Monitor Setup Onboarding Step
- Goal: reuse monitor configuration flow inside onboarding.
- Implement:
1. Integrate monitor detection and role assignment into onboarding monitors step.
2. Add test configuration and skip-for-now controls.
- Verify:
: Monitor roles can be saved from onboarding.

### Batch 6 — Updater Integration
- Goal: wire updater support end-to-end.
- Implement:
1. Add updater dependency in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`.
2. Register updater plugin in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs`.
3. Add updater config in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/tauri.conf.json`.
4. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/update-notification.tsx`.
- Verify:
: update check/install paths callable without startup blocking.

### Batch 7 — Help Route and Guided Tour
- Goal: deliver in-app support surfaces.
- Implement:
1. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/help/route.tsx`.
2. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/help/guided-tour.tsx`.
- Verify:
: Help route searchable and guided tour navigation works.

### Batch 8 — Release Pipeline Assets
- Goal: establish reproducible release baseline.
- Implement:
1. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/.github/workflows/release.yml`.
2. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/CHANGELOG.md`.
3. Create `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/CONTRIBUTING.md`.
4. Create docs:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/MIGRATION_GUIDE.md`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/USER_GUIDE.md`
- Verify:
: workflow lints and required placeholders are documented.

### Batch 9 — Localization + Accessibility
- Goal: full text coverage and baseline accessibility.
- Implement:
1. Update locales:
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`
2. Add labels, keyboard paths, and focus states for new onboarding/migration/update/help surfaces.
- Verify:
: no missing key runtime errors.

### Batch 10 — Hardening
- Goal: enforce resilience and operational safety.
- Implement:
1. Stress invalid/corrupt source handling.
2. Validate cancellation idempotency.
3. Confirm report completeness and predictable rerun behavior.
4. Optimize long-run progress update cadence.
- Verify:
: repeated migration runs remain deterministic.

### Batch 11 — Final Validation + Closure
- Goal: complete Phase 10 with explicit evidence.
- Implement:
1. Execute static checks.
2. Execute manual smoke matrix.
3. Update `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md` to mark Phase 10 complete when all criteria pass.
- Verify:
: closure checklist fully satisfied.

## Test Cases and Scenarios

1. First run with empty data opens onboarding and completes to dashboard.
2. “Start fresh” path skips migration and persists first-run completion.
3. Valid legacy source migrates hymns/Bible/favorites/services/settings with accurate counts.
4. Invalid or corrupted source fails safely with actionable errors and no partial writes.
5. Cancel migration mid-run leaves target DB consistent.
6. Re-run after failed migration succeeds deterministically and writes a new report.
7. Updater check with no update remains silent and non-blocking.
8. Updater check with available update presents version info and action choices.
9. Existing projector/return/streaming service flows remain unchanged.
10. Static checks:
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`

## Assumptions and Defaults

1. Phase 10 scope is fixed to Full Spec 11.
2. Existing DB schema-version mechanism in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs` remains authoritative.
3. Legacy SQLite source support is mandatory; XML side-import is optional and explicitly reported when unavailable.
4. Import writes are transactional per domain with report-level error aggregation.
5. Updater secrets/endpoints are documented as placeholders and configured per environment.
6. No destructive overwrite is allowed without explicit user confirmation in onboarding.
7. Phase 10 closure requires full exit-criteria and validation-matrix pass.
