# LouvorJA Multiplatform

A cross-platform church worship management desktop application built with **Tauri 2**, **React 19**, and **Rust**. Migrating from the legacy [Delphi version](https://github.com/louvorja/desktop) to run on Windows, macOS, and Linux.

## Features

- **Hymnal** -- Browse, search (FTS5), and project hymn lyrics with multi-slide display
- **Presentation Editor** -- Create and edit slide decks with drag-and-drop reordering, import `.pptx` files
- **Audio Playback** -- Play audio files with slide synchronization via rodio engine
- **Bible** -- Full-text search across Bible versions with verse projection
- **Worship Services** -- Service scheduling with drag-and-drop timeline and item projection
- **Multi-Monitor** -- Projector, return monitor, and Playing now screen with per-monitor assignment
- **Live Streaming** -- HTTP server with SSE for remote viewers (music, bible, return channels)
- **Video/Multimedia** -- Video slides with managed media paths
- **Projector Output** -- Dedicated projector window with fullscreen support, real-time slide events, black/logo overlays
- **Archive Format** -- Custom `.slja` archive format (ZIP-based) for portable presentations
- **Auto-Updates** -- Service-aware update guard that never interrupts live projection
- **Internationalization** -- Portuguese, English, and Spanish (i18next)
- **Themes** -- 5 color themes via CSS custom properties (Azure, White, Gray, Orange, Black)
- **Command Palette** -- Quick access via Cmd+K / Ctrl+K

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

## Installation

Download the latest release for your platform from the [Releases page](https://github.com/nickksoares/louvorja-multiplataform/releases).

| Platform | File | Guide |
|----------|------|-------|
| Windows | `LouvorJA_x.x.x_x64-setup.exe` | [English](docs/installation/windows.md) / [Portugues](docs/installation/windows-pt.md) / [Espanol](docs/installation/windows-es.md) |
| macOS (Apple Silicon) | `LouvorJA_x.x.x_aarch64.dmg` | [English](docs/installation/macos.md) / [Portugues](docs/installation/macos-pt.md) / [Espanol](docs/installation/macos-es.md) |
| macOS (Intel) | `LouvorJA_x.x.x_x64.dmg` | [English](docs/installation/macos.md) / [Portugues](docs/installation/macos-pt.md) / [Espanol](docs/installation/macos-es.md) |
| Linux (x64) | `.AppImage` or `.deb` | [English](docs/installation/linux.md) / [Portugues](docs/installation/linux-pt.md) / [Espanol](docs/installation/linux-es.md) |
| Linux (ARM) | `.AppImage` or `.deb` | [English](docs/installation/linux.md) / [Portugues](docs/installation/linux-pt.md) / [Espanol](docs/installation/linux-es.md) |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://rustup.rs/) stable toolchain
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

### Getting Started

```bash
# Clone
git clone https://github.com/louvorja/multiplataform.git
cd multiplataform

# Install frontend dependencies
pnpm install

# Run in development mode (frontend + Rust backend)
pnpm tauri dev
```

### Scripts

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
├── audio/                      # Audio player, sync timeline
├── display/                    # Multi-monitor window management
├── streaming/                  # SSE streaming server
└── video/                      # Video path + metadata helpers

docs/                           # Documentation
├── archive/                    # Archived legacy docs and generated reports
├── installation/               # User installation guides (3 platforms × 3 languages)
├── phase-*/                    # Feature packages (PRD, SPECS, TASKS, HANDOFF, LEARNINGS)
├── plans/                      # Scoped implementation plans and design notes
├── pre-dev/                    # Pre-development planning documents
└── *.md                        # Cross-cutting reference and maintainer guides
CLAUDE.md                       # AI assistant context and patterns
```

## Documentation Map

- Documentation index: [docs/README.md](./docs/README.md)
- Live delivery tracker: [PROGRESS.md](./PROGRESS.md)
- Installation guides: [docs/installation/](./docs/installation/)
- Maintainer and user guides: [docs/code-signing-guide.md](./docs/code-signing-guide.md), [docs/USER_GUIDE.md](./docs/USER_GUIDE.md), [docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)
- Active feature packages: [docs/](./docs/) (see `phase-*`, `pre-dev/`, and `plans/`)
- Archived legacy/generated docs: [docs/archive/](./docs/archive/)
- Latest completed handoffs:
  - [docs/phase-11-hymn-crud-collections/HANDOFF.md](./docs/phase-11-hymn-crud-collections/HANDOFF.md)
  - [docs/phase-12-monitor-screen-assignment/HANDOFF.md](./docs/phase-12-monitor-screen-assignment/HANDOFF.md)

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

Current delivery status is maintained in [PROGRESS.md](./PROGRESS.md).

See [docs/README.md](./docs/README.md) for the current documentation taxonomy and source-of-truth rules.

## Contributing

1. Read [docs/README.md](./docs/README.md), then the relevant `docs/phase-*`, `docs/pre-dev/`, or `docs/plans/` package before starting work
2. Follow existing code patterns (see `CLAUDE.md` for documented conventions)
3. Use `pnpm` as the package manager
4. Ensure `pnpm build` and `cargo build` pass before submitting PRs
5. Add i18n keys to all three locale files (`en.json`, `pt.json`, `es.json`)

## License

[MIT](LICENSE)
