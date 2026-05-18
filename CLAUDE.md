# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
CLAUDE_CODE_MAX_OUTPUT_TOKENS=20000

- When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.

---

## Agent skills

### Issue tracker

Issues and PRDs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical label strings (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context repo — `CONTEXT-MAP.md` at root points to per-context `CONTEXT.md` files. See `docs/agents/domain.md`.

---

## Project Overview

Church worship desktop app migrating from Delphi to **Tauri 2 + React 19 + Rust**.
Docs: `docs/phase-*/` (PRD/SPECS/TASKS/HANDOFF), `docs/architecture.md` (Mermaid), `docs/plans/architectural-improvements-plan.md`.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4 |
| Routing | TanStack Router (file-based, Vite plugin) |
| Server state | TanStack Query |
| Client state | Zustand |
| UI | Radix UI primitives, class-variance-authority (CVA), cmdk, sonner |
| i18n | i18next (3 locales: `en.json`, `pt.json`, `es.json`) |
| Backend | Tauri 2.9.4, Rust, rusqlite (bundled), r2d2 (connection pool), thiserror, chrono, uuid |
| Type gen | tauri-specta (auto-generates `src/lib/bindings.ts` from Rust types) |
| Archive | zip 2.1 (.slja), quick-xml 0.36 (.pptx import) |
| Audio | rodio 0.19 |
| DnD | @dnd-kit/core + sortable + utilities |
| Plugins | window-state, single-instance, global-shortcut, store, opener, clipboard-manager, autostart |

## Prerequisites

Node ≥ 20, pnpm ≥ 10, Rust stable (≥ 1.80). **GStreamer 1.24+ required** — `brew install gstreamer` on macOS, `libgstreamer1.0-dev` + plugins on Linux, official MSVC installer on Windows. See `CONTRIBUTING.md`.

## Commands

```bash
# ALWAYS use pnpm, NEVER npm or deno
pnpm install                                                          # all workspace deps
pnpm add --filter desktop <pkg>                                       # frontend dep
pnpm --filter desktop tauri add <plugin>                              # Tauri plugin
pnpm build                                                            # frontend build (regenerates routeTree.gen.ts)
pnpm --filter desktop exec tsc --noEmit                               # TS check only
cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml        # Rust only
pnpm dev                                                              # full dev (regenerates bindings.ts)
pnpm test
pnpm --filter desktop lint:i18n                                       # i18n key coverage
pnpm --filter remote-pwa dev|build|test

# After adding TanStack Router routes: run `pnpm build` BEFORE `tsc --noEmit`
# Do NOT run `deno` commands in this repo
```

## Project Structure

```
apps/
├── desktop/      # Tauri 2 desktop (React + Rust). See apps/desktop/CLAUDE.md.
├── remote-pwa/   # Companion PWA (React + WS). See apps/remote-pwa/CLAUDE.md.
└── admin-panel/  # Next.js CDN publishing tool (not in pnpm workspace).
```

## General Rules

- **i18n:** Add keys to ALL THREE locale files (`en.json`, `pt.json`, `es.json`). Missing keys render as raw strings.
- **Scaffolded code:** Before deleting `#[allow(dead_code)]` or unused items, check `docs/plans/` and `docs/pre-dev/`. Prefix unused Rust fields with `_` over deletion.
- **UI design:** Use `ui-ux-pro-max` skill before proposing interface changes.
- **CI/CD:** GitHub Actions, 5-platform matrix (macOS ARM/Intel, Linux x64/ARM, Windows). Ed25519 signing via `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- **Admin panel:** `apps/admin-panel/` — CDN pack publishing, R2 upload. `pnpm build` inside that dir.

## Self-Improvement Protocol

After completing any task, Claude MUST:

1. **Update `docs/phase-*/`** if a phase completed or progressed.
2. **Update `apps/desktop/CLAUDE.md` or `apps/remote-pwa/CLAUDE.md`** if new directories, components, routes, or patterns were added.
3. **Record new errors to avoid** in the appropriate sub-CLAUDE.md.
4. **Update memory files** (`~/.claude/projects/.../memory/MEMORY.md`) with session learnings that don't belong in CLAUDE.md.
5. **Keep all CLAUDE.md files concise** — remove outdated notes, prefer terse bullet points.
