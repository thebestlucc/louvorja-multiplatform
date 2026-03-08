# Presentation Bridge Zero-Context Tasks

This folder contains the zero-context execution pack for `presentation-bridge`.

## Current status

- T-001 through T-009 are implemented in the current worktree.
- The remaining open item is the Windows manual acceptance checklist from `T-009`.
- Canonical repo-level progress is tracked in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`.

## Execution Order

1. `T-001/ST-001-1-scaffold-bridge-binary.md`
2. `T-002/ST-002-1-bundle-sidecar-and-launcher.md`
3. `T-003/ST-003-1-ipc-singleton-and-status.md`
4. `T-004/ST-004-1-managed-vs-independent-lifecycle.md`
5. `T-005/ST-005-1-config-persistence-and-manager-commands.md`
6. `T-006/ST-006-1-bridge-os-autostart.md`
7. `T-007/ST-007-1-move-shortcut-ownership-to-bridge.md`
8. `T-008/ST-008-1-settings-ui-and-status.md`
9. `T-009/ST-009-1-powerpoint-adapter-and-e2e.md`

## Global Rules

- Read `docs/pre-dev/presentation-bridge/CONTEXT.md` before starting any subtask.
- Read `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md` before changing lifecycle or IPC behavior.
- Run the verification commands listed in each subtask before committing.
- If a subtask would violate the design doc, stop and update the plan/docs first.
