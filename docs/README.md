# Documentation Map

This repository no longer fits a phase-only documentation model. Use this index to decide where a document belongs and which files are still active.

## Source of Truth

- Implementation truth lives in `src/` and `src-tauri/`.
- Delivery status lives in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`.
- `docs/phase-*` remains the canonical package format for implemented or implementation-ready feature work.
- `docs/pre-dev/` is the canonical location for research, design, and task breakdowns before implementation.
- `docs/plans/` stores scoped implementation plans and design notes tied to a specific change.
- `docs/archive/` stores historical or generated material that should not be treated as active guidance.

## Folder Map

- `docs/installation/` - end-user installation guides by platform and language.
- `docs/phase-*` - feature packages with `PRD.md`, `SPECS.md`, `TASKS.md`, `HANDOFF.md`, and optional `LEARNINGS.md`.
- `docs/pre-dev/` - discovery/design packages for upcoming work.
- `docs/plans/` - dated or named implementation plans and design notes.
- `docs/archive/legacy/` - superseded plans, migration notes, and legacy architecture documents retained for reference.
- `docs/archive/handoffs/` - historical handoff notes that predate the current phase package structure.
- `docs/archive/reports/` - generated audits, refactor reports, and one-off analysis output.
- `docs/*.md` - cross-cutting reference or maintainer docs that are still active across multiple features.

## Repository Root Markdown

Only keep markdown files at the repository root when they have a clear repository-level function:

- `README.md` - public project entrypoint.
- `CONTRIBUTING.md` - contributor workflow for GitHub and local development.
- `CHANGELOG.md` - release notes.
- `PROGRESS.md` - canonical delivery tracker.
- `CLAUDE.md` and `GEMINI.md` - assistant/tool-specific repository instructions that must remain discoverable at the root.

Everything else should live under `docs/` or `docs/archive/`.

## Authoring Rules

- Prefer updating an existing document over creating a new loose markdown file at the repository root or `docs/` root.
- Put new feature planning under `docs/pre-dev/` or `docs/plans/`.
- Put feature packages under `docs/phase-{number}-{feature-name}/` when the work is tied to implementation delivery.
- Move obsolete or generated material into `docs/archive/` instead of leaving it mixed with active docs.
- When documentation disagrees with the implementation, update the docs to match the code that actually ships.

## Realtime Engineering Rule

For live synchronization features (audio, timer, clock, projection, streaming), use event-driven pub/sub patterns. Do not use polling as the default mechanism.

## Legacy Specs

Legacy `.specs/*` documents are historical references only. New work should be documented in `docs/phase-*`, `docs/pre-dev/`, or `docs/plans/` as appropriate.
