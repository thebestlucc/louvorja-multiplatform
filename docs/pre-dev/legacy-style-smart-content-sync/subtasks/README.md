# Legacy-Style Smart Content Sync Zero-Context Tasks

This folder contains the zero-context execution pack for `legacy-style-smart-content-sync`.

## Current Status

- `tasks.md` is a **Gate 7 draft** derived from the approved design plan.
- The subtasks below are the **Gate 8 execution pack** for the current task map.
- If you need strict Large Track compliance before execution, backfill Gates 0-6 first.

## Read Before Starting

1. [CONTEXT.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/CONTEXT.md)
2. [tasks.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/pre-dev/legacy-style-smart-content-sync/tasks.md)
3. [docs/plans/2026-03-08-legacy-style-smart-content-sync.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/plans/2026-03-08-legacy-style-smart-content-sync.md)

## Execution Order

1. `T-001/ST-001-1-sync-foundation.md`
2. `T-002/ST-002-1-shared-importer-refactor.md`
3. `T-003/ST-003-1-sync-planner.md`
4. `T-004/ST-004-1-sync-executor-and-runtime.md`
5. `T-005/ST-005-1-operator-sync-ux.md`
6. `T-006/ST-006-1-hardening-and-rollout-safeguards.md`

## Global Rules

- Run the verification commands in each subtask before committing.
- Do not merge app-updater behavior into content-sync behavior.
- If remote manifest endpoints are unavailable, preserve the degraded fallback path instead of blocking the feature.
- If execution discovers a design gap, update the design doc before continuing.
