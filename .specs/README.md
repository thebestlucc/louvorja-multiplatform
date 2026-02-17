# LouvorJA Multiplatform — Legacy Specification Files

> Status: archived reference only.
> Canonical source of truth for feature decisions is `docs/phase-*` (see `docs/README.md`).

This directory contains historical specifications used during early project phases.

## Overview

Each spec file corresponds to a phase in the development roadmap outlined in the `PRD.md`. The specs provide file-level implementation details, including:

- **Files to CREATE** — New files that need to be created
- **Files to UPDATE** — Existing files that need modifications
- **What needs to be done** — Detailed requirements for each file

## Specification Files

| Spec File | Phase | Focus Area | Weeks |
|---|---|---|---|
| [foundation.01.spec.md](./foundation.01.spec.md) | 0 | Project infrastructure, tooling, architectural skeleton | 1–2 |
| [music-lyrics.02.spec.md](./music-lyrics.02.spec.md) | 1 | Hymn browsing, lyrics display, basic slide projection | 3–5 |
| [audio-playback.03.spec.md](./audio-playback.03.spec.md) | 2 | Audio playback engine (rodio), audio-slide synchronization | 6–7 |
| [presentation-editor.04.spec.md](./presentation-editor.04.spec.md) | 3 | Slide creation/editing, .slja archive support | 8–10 |
| [bible.05.spec.md](./bible.05.spec.md) | 4 | Bible text display, multi-version support, search | 11–12 |
| [liturgy.06.spec.md](./liturgy.06.spec.md) | 5 | Worship service/liturgy management with drag-and-drop | 13–15 |
| [multi-monitor.07.spec.md](./multi-monitor.07.spec.md) | 6 | Multi-monitor support (operator, projector, return) | 16–18 |
| [streaming.08.spec.md](./streaming.08.spec.md) | 7 | HTTP streaming server for live content | 19–20 |
| [video-multimedia.09.spec.md](./video-multimedia.09.spec.md) | 8 | Video playback support | 21–22 |
| [utilities-polish.10.spec.md](./utilities-polish.10.spec.md) | 9 | Utilities (timer, lottery, clock) and polish | 23–24 |
| [migration-deployment.11.spec.md](./migration-deployment.11.spec.md) | 10 | Migration tools, deployment, first-run wizard | 25–27 |

## How to Use These Specs

### For Developers

1. **Start with Phase 0** — foundation.01.spec.md sets up the entire project structure
2. **Follow the phases sequentially** — each phase builds on the previous one
3. **Use the spec as a checklist** — mark files as complete as you implement them
4. **Reference the PRD** — these specs are derived from `PRD.md` and should be read together

### For AI Assistants

When implementing a feature:

1. Read the corresponding spec file completely
2. Note all "Files to CREATE" and "Files to UPDATE"
3. Implement files in dependency order (models → queries → commands → frontend)
4. Cross-reference with the PRD for architectural context
5. Ensure type safety between Rust backend and TypeScript frontend

### Spec File Format

Each spec follows this structure:

```markdown
# SPEC XX — Feature Name

**Phase:** N
**Goal:** Brief description of the phase goal

---

## Files to CREATE

### Category

#### `path/to/file.ext`
- Bullet point list of what needs to be implemented in this file
- Functions, components, types, etc.
- Relationships to other files

## Files to UPDATE

### Category

#### `path/to/existing/file.ext`
- Bullet point list of changes needed
- What to add/modify
- Integration points
```

## Implementation Strategy

### Recommended Order Within a Phase

1. **Backend First** (Rust)
   - Create database migrations
   - Define models/structs
   - Implement database queries
   - Implement Tauri commands
   - Register commands in `lib.rs`

2. **Frontend Types** (TypeScript)
   - Define types matching backend models
   - Create Tauri invoke wrappers
   - Set up TanStack Query keys

3. **Frontend Components** (React)
   - Create UI components
   - Implement hooks
   - Build routes/pages
   - Connect to backend via queries/mutations

4. **Testing**
   - Write Rust unit tests
   - Write React component tests
   - Write E2E tests for critical flows

### Dependency Notes

- **Phase 0 is required** before any other phase
- **Phase 1 (Music)** is independent and can be done first
- **Phase 2 (Audio)** depends on Phase 1
- **Phase 3 (Presentations)** depends on Phase 1
- **Phase 4 (Bible)** is independent
- **Phase 5 (Liturgy)** depends on Phases 1, 3, and 4
- **Phase 6 (Multi-Monitor)** can be done alongside other phases
- **Phase 7 (Streaming)** depends on Phase 6
- **Phase 8 (Video)** depends on Phase 3
- **Phase 9 (Utilities)** is mostly independent
- **Phase 10 (Migration)** should be last, depends on all data features

## Cross-Cutting Concerns

These aspects span multiple specs:

### Error Handling
- All Rust functions return `Result<T, AppError>`
- Frontend displays errors via toast notifications (sonner)
- Critical errors shown in modal dialogs

### State Management
- **Zustand** for client-side UI state
- **TanStack Query** for all backend data (cache, invalidation, optimistic updates)
- **Tauri Events** for real-time updates (slide changes, audio position)

### Styling
- **Tailwind CSS v4** with CSS-first configuration
- **Radix UI** primitives for accessible components
- **5 theme variants** via CSS custom properties

### Internationalization
- **i18next** with JSON translation files
- Support for: Portuguese (pt), Spanish (es), English (en)
- Default language: Portuguese

### Keyboard Shortcuts
- Implemented in `use-keyboard.ts` hook
- Discoverable via Cmd+/ shortcut
- Context-aware (different shortcuts in different views)

## Questions or Issues?

If you encounter ambiguity in a spec:

1. Check the `PRD.md` for architectural context
2. Look for similar patterns in other spec files
3. Ask for clarification or make a reasonable decision and document it

## Contributing to Specs

If you notice missing details or improvements:

1. Update the relevant spec file
2. Ensure consistency with the PRD
3. Update this README if adding a new spec file
4. Keep the spec focused on **what** needs to be done, not **how** to implement it (leave room for developer judgment)

---

**Last Updated:** 2026-02-08
**Based on:** PRD.md v1.0
