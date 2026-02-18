# Documentation Source of Truth

`docs/phase-*` is the canonical location for feature decisions and implementation records.

## Folder Pattern

Each phase folder must use:

- `docs/phase-{number}-{feature-name}/PRD.md`
- `docs/phase-{number}-{feature-name}/SPECS.md`
- `docs/phase-{number}-{feature-name}/TASKS.md`
- `docs/phase-{number}-{feature-name}/HANDOFF.md`

Notes:
- `HANDOFF.md` is completed when implementation is finished.
- `PRD.md`, `SPECS.md`, and `TASKS.md` are mandatory from planning start.
- `LEARNINGS.md` is strongly recommended when incidents or non-obvious engineering decisions are discovered during implementation.

## Active Phase Folders

1. `docs/phase-08-video-multimedia`
2. `docs/phase-09-utilities-polish`
3. `docs/phase-10-migration-tools-deployment`
4. `docs/phase-11-hymn-crud-collections`

## Realtime Engineering Rule

For live synchronization features (audio/timer/clock/projection/streaming), use event-driven pub/sub patterns. Do not use polling as the default mechanism.

## Legacy Specs

Legacy `.specs/*` documents are historical references only. New decisions and updates must be written in `docs/phase-*`.
