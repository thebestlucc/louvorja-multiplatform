# Phase 11 PRD — Hymn CRUD + Collections + Hybrid Cache Covers

## 1. Context

Phase 10 delivered onboarding, migration, updater, and release pipeline baselines. The next product gap is content library management quality: hymn write operations are still weak, there is no dedicated collections module for non-hymnal songs, and cover assets are inconsistent across surfaces.

## 2. Problem Statement

Operators need reliable song-library workflows that support:
- full hymn CRUD with transactional persistence.
- user-managed collections for `.slja` and `.pptx` songs.
- sync-safe cache behavior when source files change or disappear.
- consistent visual identity through cover images for hymns and collections.

Without these capabilities, users are forced into manual workarounds and runtime risk increases in live operation.

## 3. Goals

1. Implement real hymn CRUD (`create`, `update`, `delete`) with validation and persistence.
2. Deliver a dedicated `Collections` module separate from `Presentations`.
3. Use `Hybrid cache` as the canonical collections storage model.
4. Support cover upload/fallback for hymns and collections across key UI surfaces.
5. Implement sync visibility and recovery (`in_sync`, `stale`, `missing_source`, `error`) for collection songs.
6. Add setting `collections.autoCheckSourceOnOpen` (default `true`) with user toggle in `/settings`.
7. Keep projection/return/streaming flows stable.
8. Consolidate phase documentation governance so feature decisions have one source of truth in `docs/phase-*`.

## 4. Non-Goals

- No merge of `Collections` into `Presentations`.
- No blob-based storage for covers.
- No mandatory source-file availability at runtime (cache fallback remains valid behavior).
- No destructive overwrite flow without explicit user action.

## 5. Users and Primary Jobs

### Primary users
- Worship operator curating hymn and extra-song libraries.
- Service planner preparing mixed flows (hymns + imported song decks).

### Jobs to be done
- Create/edit/delete hymns quickly and safely.
- Create collections, import songs, and open cached versions reliably.
- Detect stale source files and resync only when needed.
- See covers consistently in list/detail/selection surfaces.

## 6. Locked Product Decisions

1. Collections storage model: `Hybrid cache`.
2. Sync behavior: `Auto-check on open`, toggleable in settings.
3. Domain split: `Collections` and `Presentations` remain separate modules.
4. Covers: upload + automatic fallback for hymn/collection surfaces.

## 7. Success Metrics

### Product and reliability
- 100% of hymn CRUD commands return typed success/error results.
- Collection import supports `.slja` and `.pptx` with deterministic cached presentation linkage.
- Sync status transitions are correct for changed and missing sources.
- Existing projection runtime shows no regressions after rollout.

### UX
- Cover rendering appears in target surfaces with graceful fallback.
- Resync path is reachable in <=2 interactions from collection detail.
- Auto-check behavior is visible and user-controllable in `/settings`.

### Engineering quality
- Path/type/size validation is enforced for cover upload and source import.
- Static checks pass (`tsc`, `cargo check`, `vite build`).

## 8. Risks and Mitigations

1. Source-file drift or deletion:
   - Mitigation: persisted hash/mtime metadata + sync status + cache fallback.
2. Invalid or unsafe file input:
   - Mitigation: extension whitelist, size limits, canonical path checks, typed error mapping.
3. Performance degradation during sync checks:
   - Mitigation: check on open only (toggleable), targeted status updates.
4. Navigation/domain confusion:
   - Mitigation: explicit menu separation and route boundaries for collections vs presentations.

## 9. Dependencies

- Existing archive import stack (`.slja` and `.pptx`).
- Existing slides/presentations persistence.
- Existing settings infrastructure.
- Existing i18n architecture (`en/pt/es` JSON files).

## 10. Phase Exit Criteria

Phase 11 is complete when:
1. Hymn CRUD is fully implemented and no longer stubbed.
2. Collections backend and frontend workflows are operational with hybrid cache behavior.
3. Cover upload/fallback works for hymns and collections.
4. Auto-check-on-open and manual resync flows are operational.
5. EN/PT/ES keys cover all new phase surfaces.
6. `docs/phase-*` is the declared source of truth for feature decisions, with tracking/docs-agent files updated accordingly.
7. Phase folder contains `PRD.md`, `SPECS.md`, `TASKS.md`, and `HANDOFF.md`.
8. Static checks and smoke matrix pass.
