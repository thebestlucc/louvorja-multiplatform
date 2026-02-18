# LouvorJA Multiplatform

A cross-platform church worship management desktop application built with **Tauri 2**, **React 19**, and **Rust**. Migrating from the legacy [Delphi version](https://github.com/louvorja/desktop) to run on Windows, macOS, and Linux.

## Features

- **Hymnal** -- Browse, search (FTS5), and project hymn lyrics with multi-slide display
- **Presentation Editor** -- Create and edit slide decks with drag-and-drop reordering, import `.pptx` files
- **Audio Playback** -- Play audio files with slide synchronization via rodio engine
- **Projector Output** -- Dedicated projector window with fullscreen support and real-time slide events
- **Archive Format** -- Custom `.slja` archive format (ZIP-based) for portable presentations
- **Internationalization** -- Portuguese, English, and Spanish (i18next)
- **Themes** -- 5 color themes via CSS custom properties (Azure, White, Gray, Orange, Black)
- **Command Palette** -- Quick access via Cmd+K / Ctrl+K

### Planned

- Bible verse projection with FTS5 search
- Worship service scheduling with drag-and-drop timeline
- Multi-monitor management (operator, projector, return)
- HTTP live streaming with SSE for remote viewers
- Video/multimedia slide support
- Data migration wizard from Delphi version
- Auto-updater

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 19 + TypeScript 5.8 | UI framework |
| Vite 7 | Build tool |
| Tailwind CSS v4 | Styling with `@theme` directive |
| TanStack Router | File-based type-safe routing |
| TanStack Query | Server state, caching, invalidation |
| Zustand | Client-only state (UI, display, audio) |
| Radix UI | Accessible UI primitives |
| class-variance-authority | Component style variants |
| @dnd-kit | Drag-and-drop |
| i18next | Internationalization |
| cmdk | Command palette |
| sonner | Toast notifications |
| lucide-react | Icons |

### Backend

| Technology | Purpose |
|---|---|
| Tauri 2.9.4 | Desktop framework + IPC |
| Rust (stable) | Backend language |
| rusqlite (bundled) | SQLite database |
| rodio 0.19 | Audio playback engine |
| zip 2.1 | `.slja` archive handling |
| quick-xml 0.36 | `.pptx` XML parsing |
| thiserror | Error types |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://rustup.rs/) stable toolchain
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

## Getting Started

```bash
# Clone
git clone https://github.com/louvorja/multiplataform.git
cd multiplataform

# Install frontend dependencies
pnpm install

# Run in development mode (frontend + Rust backend)
pnpm tauri dev
```

## Scripts

```bash
pnpm dev              # Start Vite dev server only (no Rust)
pnpm build            # Build frontend (tsc + vite build)
pnpm tauri dev        # Full dev mode (frontend + Rust hot-reload)
pnpm tauri build      # Production build (generates installer)
```

## Project Structure

```
src/                            # React frontend
├── components/
│   ├── layout/                 # Sidebar, Header, StatusBar
│   ├── music/                  # Hymn search, cards, lyrics, audio controls
│   ├── slides/                 # Renderer, editor, thumbnails, projector view
│   └── ui/                     # Reusable Radix-based primitives
├── hooks/                      # Custom React hooks
├── lib/
│   ├── tauri.ts                # Typed Tauri invoke() wrappers
│   ├── queries.ts              # TanStack Query hooks
│   └── utils.ts                # Utilities (cn helper)
├── locales/                    # i18n JSON files (en, pt, es)
├── routes/                     # TanStack Router file-based routes
├── stores/                     # Zustand stores
└── types/                      # TypeScript type definitions

src-tauri/src/                  # Rust backend
├── lib.rs                      # Tauri app setup, command registration
├── state.rs                    # AppState, AudioState
├── error.rs                    # AppError enum
├── commands/                   # Tauri command handlers (per domain)
├── db/
│   ├── migrations.rs           # Versioned schema migrations
│   ├── models.rs               # Data structs
│   └── queries/                # SQL query functions (per domain)
├── archive/                    # .slja and .pptx file handling
└── audio/                      # Audio player, sync timeline

docs/                           # Phase documentation source of truth (phase-*/PRD,SPECS,TASKS,HANDOFF)
PRD.md                          # Product Requirements Document
CLAUDE.md                       # AI assistant context and patterns
```

## Documentation Map

- Live delivery tracker:
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`
- Documentation index and conventions:
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/README.md`
- Phase packages (PRD, SPECS, TASKS, HANDOFF):
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-*`
- Latest completed handoffs:
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/HANDOFF.md`
  - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-12-monitor-screen-assignment/HANDOFF.md`

## Roadmap

| Phase | Feature |
|-------|---------|
| 0 | Foundation (routing, state, DB, error handling) |
| 1 | Music & Lyrics (hymnal, search, projection) |
| 2 | Audio Playback (rodio, sync points) |
| 3 | Presentation Editor (.slja, .pptx, drag-and-drop) |
| 4 | Bible (versions, search, projection) |
| 5 | Liturgy (service scheduling, timeline) |
| 6 | Multi-Monitor (projector, return monitor) |
| 7 | Streaming (HTTP server, SSE) |
| 8 | Video & Multimedia |
| 9 | Utilities & Polish (timer, themes, command palette) |
| 10 | Migration & Deployment (onboarding, auto-update) |
| 11 | Hymn CRUD + Collections + Hybrid Cache Covers |
| 12 | Monitor Assignment in Settings |

Current delivery status is maintained in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/PROGRESS.md`.

See `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/README.md` and `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-*` for phase decisions and implementation records.

## Contributing

1. Read the relevant phase package in `docs/phase-*` before starting work on a phase
2. Follow existing code patterns (see `CLAUDE.md` for documented conventions)
3. Use `pnpm` as the package manager
4. Ensure `pnpm build` and `cargo build` pass before submitting PRs
5. Add i18n keys to all three locale files (`en.json`, `pt.json`, `es.json`)

## License

[MIT](LICENSE)
