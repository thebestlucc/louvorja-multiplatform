# Legacy-Style Smart Content Sync Context

## Status

This feature should be treated as a **Large Track** pre-dev item.

The current execution pack in this folder is a **Gate 7 / Gate 8 draft derived from the approved design plan**, not a full 10-gate pre-dev package.

If strict Ring process compliance is required before execution, backfill these gates first:

1. `research.md`
2. `prd.md`
3. `feature-map.md`
4. `trd.md`
5. `api-design.md`
6. `data-model.md`
7. `dependency-map.md`

## Canonical Design Input

- [docs/plans/2026-03-08-legacy-style-smart-content-sync.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/plans/2026-03-08-legacy-style-smart-content-sync.md)
- [docs/archive/legacy/legacy-fetcher-architecture.md](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/archive/legacy/legacy-fetcher-architecture.md)
- [src-tauri/src/legacy_fetch/mod.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/legacy_fetch/mod.rs)
- [src-tauri/src/commands/legacy_fetch.rs](/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/legacy_fetch.rs)

## Problem Statement

The current app can detect that remote content changed, but it cannot answer:

- what changed,
- what should be repaired,
- what can be safely updated selectively,
- what should fall back to a full sync.

Legacy Delphi behavior was stronger because it combined version awareness with a more explicit operator-facing update flow.

## Target Outcome

Deliver a manifest-aware content sync flow that:

- checks remote content updates on startup,
- computes a sync plan for hymns, API collections, and managed media,
- allows selective sync or full sync fallback,
- records sync metadata and run reports,
- repairs missing local assets,
- keeps the existing legacy fetch path working.

## Guardrails

- Do not mix app binary update logic with content sync logic.
- Do not auto-delete user-authored content.
- Do not break the current full-fetch wizard while introducing selective sync.
- Prefer degraded fallback over partial failure when remote manifest endpoints are unavailable.
