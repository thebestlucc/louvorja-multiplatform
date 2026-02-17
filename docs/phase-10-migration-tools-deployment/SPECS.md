# Phase 10 Specs — Migration Tools & Deployment

## 1. Implementation Objective

Implement onboarding, migration, updater, help, and release pipeline capabilities required to move from an implementation-complete app to a production-adoption-ready product.

## 2. Baseline Gaps (Current Code)

1. Onboarding route tree is missing:
   - `src/routes/onboarding/*` does not exist.
2. Migration command/domain modules are missing:
   - `src-tauri/src/commands/migration.rs` does not exist.
   - `src-tauri/src/migration/*` does not exist.
3. Frontend migration types/wrappers/hooks are missing:
   - `src/types/migration.ts` does not exist.
   - no migration wrappers in `src/lib/tauri.ts`.
4. Updater plugin/config is not integrated:
   - `src-tauri/Cargo.toml` has no `tauri-plugin-updater` dependency.
   - `src-tauri/tauri.conf.json` has no updater block.
5. Help route and guided tour components are missing:
   - `src/routes/help/route.tsx` absent.
   - `src/components/help/guided-tour.tsx` absent.
6. Release workflow baseline is missing:
   - `.github/workflows/release.yml` absent.

## 3. Public API / Type Contract Changes

### 3.1 Rust command contract

Create `src-tauri/src/commands/migration.rs` with:
- `start_migration(old_db_path: String, options: MigrationOptions) -> Result<MigrationRunInfo, AppError>`
- `get_migration_progress(run_id: String) -> Result<MigrationProgress, AppError>`
- `cancel_migration(run_id: String) -> Result<(), AppError>`
- `get_migration_report(run_id: String) -> Result<MigrationReport, AppError>`

### 3.2 Rust migration domain additions

Create `src-tauri/src/migration/*` with:
- `MigrationOptions`
- `MigrationRunInfo`
- `MigrationProgress`
- `MigrationReport`
- `MigrationErrorItem`

Behavioral contract:
- import runs are tracked by `run_id`.
- cancellation is explicit and best-effort immediate.
- writes are transactional by domain (all-or-nothing per domain).
- final report always includes per-domain counts + errors.

### 3.3 Progress event contract

Emit Tauri event `migration-progress` with payload:
- `{ runId, step, completed, total, percent, etaSeconds, message }`

Contract rules:
1. `percent` range is `[0, 100]`.
2. `runId` is stable for the run lifetime.
3. event emission must be monotonic for `completed` per step.
4. no sensitive filesystem data in `message`.

### 3.4 Frontend wrapper contract

Update `src/lib/tauri.ts`:
- `startMigration(oldDbPath: string, options: MigrationOptions): Promise<MigrationRunInfo>`
- `getMigrationProgress(runId: string): Promise<MigrationProgress>`
- `cancelMigration(runId: string): Promise<void>`
- `getMigrationReport(runId: string): Promise<MigrationReport>`
- `checkForUpdates(): Promise<UpdateInfo | null>`
- `installUpdate(): Promise<void>`

### 3.5 Frontend type additions

Create `src/types/migration.ts`:
- `MigrationOptions`
- `MigrationRunInfo`
- `MigrationProgress`
- `MigrationReport`
- `MigrationErrorItem`
- `UpdateInfo`

### 3.6 First-run settings keys

Use settings keys:
- `app.firstRunCompleted`
- `migration.lastSourcePath`
- `migration.lastRunStatus`
- `migration.lastRunAt`
- `migration.lastReport`

Compatibility rule:
- keep existing `schema_version` table flow in `src-tauri/src/db/migrations.rs`; do not replace with settings-based schema tracking.

## 4. Technical Scope

### 4.1 Onboarding route architecture

Create routes:
- `src/routes/onboarding/route.tsx`
- `src/routes/onboarding/welcome.tsx`
- `src/routes/onboarding/import.tsx`
- `src/routes/onboarding/monitors.tsx`
- `src/routes/onboarding/complete.tsx`

Requirements:
1. step progress indicator.
2. back/next navigation with guard checks.
3. language selection available at onboarding start.
4. explicit “Start fresh” path.

### 4.2 First-run gate and bootstrap integration

Update app startup routing in:
- `src/main.tsx`
- `src/routes/__root.tsx` (if route-level redirection is needed)
- backend setup in `src-tauri/src/lib.rs`

Requirements:
1. detect first run via `app.firstRunCompleted`.
2. route first-run users to onboarding.
3. keep non-first-run startup path unchanged.

### 4.3 Backend migration core

Create/update:
- `src-tauri/src/migration/mod.rs`
- `src-tauri/src/migration/hymn_importer.rs`
- `src-tauri/src/migration/service_importer.rs`
- `src-tauri/src/commands/migration.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

Requirements:
1. preflight validation of source path/file.
2. read-only source connection.
3. target write transactions per domain.
4. report-level error aggregation.
5. cancellation checkpoints between domain units.

### 4.4 Frontend migration UI workflow

Create/update:
- `src/components/migration/import-wizard.tsx`
- `src/components/migration/import-progress.tsx`
- `src/lib/queries.ts`
- onboarding import step route

Requirements:
1. source picker + options selection.
2. progress display by step/domain.
3. cancel action with post-cancel state reconciliation.
4. final summary report UI.

### 4.5 Monitor onboarding step

Reuse existing monitor capabilities from Phase 6 within:
- `src/routes/onboarding/monitors.tsx`

Requirements:
1. detect monitor set.
2. assign roles.
3. optional skip path.
4. test configuration action.

### 4.6 Updater integration

Update:
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `src/components/update-notification.tsx`

Requirements:
1. updater plugin registration.
2. check/install wrappers exposed to frontend.
3. non-blocking update check behavior.
4. user action controls: update now, remind later, skip version.

### 4.7 Help and guided tour

Create:
- `src/routes/help/route.tsx`
- `src/components/help/guided-tour.tsx`

Requirements:
1. searchable help entry point.
2. guided tour with skip/next controls.
3. no interference with projector/return runtime flows.

### 4.8 Release/deployment pipeline

Create:
- `.github/workflows/release.yml`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `docs/MIGRATION_GUIDE.md`
- `docs/USER_GUIDE.md`

Requirements:
1. tagged release workflow baseline.
2. artifact generation matrix (Windows/macOS/Linux).
3. updater metadata generation support.
4. required secret placeholders documented.

### 4.9 Data safety and security model

1. copy-first import strategy; never mutate source DB.
2. domain transaction boundaries with rollback on domain failure.
3. explicit user confirmation before any overwrite operation.
4. redact sensitive path/system details in user-facing errors.
5. bounded progress polling/event updates to avoid UI overload.

### 4.10 Compatibility constraints

1. preserve existing `schema_version` table process.
2. preserve all existing command signatures outside migration scope.
3. preserve existing projector/return/streaming runtime behavior.
4. preserve current localization architecture (EN/PT/ES JSON).

## 5. Delivery Sequence

1. Batch 0 — phase gate sync + doc references.
2. Batch 1 — migration domain contracts.
3. Batch 2 — backend migration core.
4. Batch 3 — onboarding routing + first-run gate.
5. Batch 4 — migration UI workflow.
6. Batch 5 — monitor setup onboarding.
7. Batch 6 — updater integration.
8. Batch 7 — help + guided tour.
9. Batch 8 — release pipeline assets.
10. Batch 9 — localization + accessibility pass.
11. Batch 10 — hardening and resilience pass.
12. Batch 11 — final verification + closure.

## 6. Acceptance Criteria

1. First-run users are routed to onboarding reliably.
2. “Start fresh” onboarding path completes and persists first-run completion.
3. Migration API supports start/progress/cancel/report using run IDs.
4. Migration report is available for success and failure outcomes.
5. Updater checks/install actions are integrated and user-controlled.
6. Help route and guided tour are available and functional.
7. Release workflow baseline exists for tagged builds.
8. New i18n keys for EN/PT/ES are complete for Phase 10 surfaces.
9. Existing projection/streaming flows show no regressions.
10. Static checks and smoke matrix pass.

## 7. Verification Plan

### Static checks
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`

### Runtime smoke
1. First run opens onboarding and can complete all steps.
2. Start-fresh path skips migration and lands on main app.
3. Valid legacy source migrates supported domains and returns accurate counts.
4. Invalid source fails safely with actionable error messaging.
5. Cancel migration mid-run leaves target data consistent.
6. Re-run migration after failure produces deterministic new run/report.
7. Update check with no updates remains silent/non-blocking.
8. Update check with update available shows action choices.
9. Core streaming/projector/return behavior remains unchanged.

## 8. Deferrals

- Custom release channel management for end users.
- Remote/cloud migration execution.
- Automated data merge conflict resolution UI.
- Full external docs portal platform.
