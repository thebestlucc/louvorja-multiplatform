# Phase 10 PRD — Migration Tools & Deployment

## 1. Context

Phases 0–9 delivered the operational core of LouvorJA Multiplatform (music, Bible, services, projection, streaming, video, and utilities). The next adoption blocker is production onboarding for existing Delphi users and a repeatable release/deployment path.

## 2. Problem Statement

LouvorJA still lacks a first-run onboarding flow, structured migration tooling, and release/update infrastructure required for safe transition from legacy Desktop deployments.

Current pain points:
- Existing users do not have a guided migration path from legacy data.
- First-run experience is manual and error-prone.
- Update lifecycle is not integrated into the app.
- Release process is not yet codified as a reproducible pipeline.

## 3. Goals

1. Deliver a first-run onboarding wizard that routes users through setup and migration decisions.
2. Provide robust legacy data migration tooling with observable progress, cancellation, and report output.
3. Integrate app update checks/install flow for production deployments.
4. Add deployment/release automation baseline for multi-platform artifacts.
5. Preserve data integrity and avoid destructive operations by default.
6. Keep existing runtime flows (projector/return/streaming) stable while introducing migration/deployment capabilities.

## 4. Non-Goals

- No schema rewrite replacing current `schema_version` migration model.
- No custom cloud sync or remote migration execution in this phase.
- No forced auto-update without user confirmation.
- No destructive overwrite of existing app data without explicit user consent.

## 5. Users and Primary Jobs

### Primary users
- Worship operator migrating from legacy LouvorJA Desktop.
- Technical operator configuring first-run monitor and environment setup.
- Maintainer/releaser responsible for shipping signed builds.

### Jobs to be done
- Complete onboarding safely on first launch.
- Import legacy data with clear progress and outcome visibility.
- Recover gracefully from invalid/corrupted migration sources.
- Receive and apply app updates from trusted release channels.
- Produce release artifacts consistently across target platforms.

## 6. User Stories

1. As a first-time user, I want a guided onboarding flow so I can configure LouvorJA without guessing setup steps.
2. As a legacy Desktop user, I want to import my existing data safely so I can continue service operations without manual re-entry.
3. As an operator, I want migration progress and clear error reporting so I know what succeeded and what needs attention.
4. As an operator, I want to cancel migration safely so I can avoid partial/corrupt app state.
5. As a maintainer, I want updater + release pipeline support so we can ship reliable production updates.

## 7. Success Metrics

### Product metrics
- 100% of migration command APIs return typed success/error payloads.
- 0 destructive overwrite operations performed without explicit user action.
- 0 regressions in existing core projection/streaming flows.

### UX metrics
- First-run onboarding completion rate >= 90% in test cohort.
- Migration report always generated for completed/failed migration runs.
- Migration status visible within 1 second of command start.

### Operational metrics
- Single CI workflow can produce multi-platform release artifacts for tagged versions.
- Updater checks are non-blocking and do not delay app startup beyond accepted threshold.

## 8. Scope

### In scope
- Onboarding route flow and first-run gate.
- Migration domain contracts, backend commands, and progress/report lifecycle.
- Frontend migration UI flow (source selection, options, progress, cancellation, summary).
- Updater plugin integration and update notification component.
- Help route + guided tour baseline.
- Release workflow and associated deployment documentation assets.

### Out of scope
- Remote/cloud migration services.
- End-user configurable release channels.
- Data model redesign beyond migration support contracts.
- Full documentation portal infrastructure outside in-app/help baseline.

## 9. Risks and Mitigations

1. Data loss or partial writes during migration.
   - Mitigation: transactional import boundaries, copy-first model, rollback on failures.
2. Invalid or incompatible legacy source files.
   - Mitigation: preflight validation and explicit per-domain error reporting.
3. Long-running imports freezing UX.
   - Mitigation: async migration execution + event-based progress reporting.
4. Update misconfiguration in production.
   - Mitigation: environment-scoped updater config and release checklist validation.
5. Regression risk to existing runtime modules.
   - Mitigation: explicit smoke matrix including streaming/projector/return flows.

## 10. Dependencies

- Existing Tauri command architecture in `src-tauri/src/commands/*`.
- Existing DB migration model in `src-tauri/src/db/migrations.rs`.
- Existing settings persistence model in `src-tauri/src/commands/settings.rs`.
- Existing monitor setup capabilities from Phase 6.
- Existing streaming/runtime stability baselines from Phases 7–9.

## 11. Phase Exit Criteria

Phase 10 is complete when:
1. First-run onboarding flow is fully functional and routes correctly.
2. Migration APIs and UI handle start/progress/cancel/report with transactional safety.
3. Legacy source import path is validated, observable, and recoverable on failure.
4. Updater integration is functional with user-controlled install flow.
5. Release pipeline baseline is committed and executable for tagged builds.
6. EN/PT/ES localization coverage exists for new onboarding/migration/updater/help surfaces.
7. Static checks pass and runtime smoke matrix confirms no regressions.
