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
| Windows (64-bit) | `LouvorJA_x.x.x_x64-setup.exe` | [English](docs/installation/windows.md) / [Portugues](docs/installation/windows-pt.md) / [Espanol](docs/installation/windows-es.md) |
| **Windows (32-bit)** | **`LouvorJA_x.x.x_x86-setup.exe`** | Same guides above — requires Windows 10+ |
| macOS (Apple Silicon) | `LouvorJA_x.x.x_aarch64.dmg` | [English](docs/installation/macos.md) / [Portugues](docs/installation/macos-pt.md) / [Espanol](docs/installation/macos-es.md) |
| macOS (Intel) | `LouvorJA_x.x.x_x64.dmg` | [English](docs/installation/macos.md) / [Portugues](docs/installation/macos-pt.md) / [Espanol](docs/installation/macos-es.md) |
| Linux (x64) | `.AppImage` or `.deb` | [English](docs/installation/linux.md) / [Portugues](docs/installation/linux-pt.md) / [Espanol](docs/installation/linux-es.md) |
| Linux (ARM) | `.AppImage` or `.deb` | [English](docs/installation/linux.md) / [Portugues](docs/installation/linux-pt.md) / [Espanol](docs/installation/linux-es.md) |

> **Older hardware:** Windows 32-bit builds are provided for machines with 32-bit Windows 10. Windows 7/8 is not supported (WebView2 requirement).

### Video playback runtime (GStreamer)

Video slides, YouTube offline playback, and the persistent video player run on a Rust GStreamer pipeline.

- **macOS DMG / Windows installers:** ship the required GStreamer plugins and core libraries inside the app bundle — no extra install needed.
- **Linux (AppImage/deb/rpm):** install the system GStreamer packages so video playback has codecs and element factories. The deb/rpm packages already declare these as dependencies; AppImage users must install manually on the host:
  ```bash
  # Debian / Ubuntu
  sudo apt install gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
                   gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
                   gstreamer1.0-libav gstreamer1.0-nice
  # Fedora / RHEL
  sudo dnf install gstreamer1-plugins-base gstreamer1-plugins-good \
                   gstreamer1-plugins-bad-free gstreamer1-plugins-ugly \
                   gstreamer1-libav gstreamer1-plugin-libnice
  ```
  Ubuntu 22.04 LTS and later ship most of these in the default desktop install; only `gstreamer1.0-plugins-ugly` and `gstreamer1.0-nice` are typically missing.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://rustup.rs/) stable toolchain
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

#### Video pipeline (GStreamer)

The Rust video pipeline links against GStreamer 1.24+ at compile time. Install on the host before running `pnpm tauri dev` or `cargo build`:

- **macOS:** `brew install gstreamer`
- **Windows:** install the official MSVC GStreamer **runtime + development** installers (1.24 or later) from <https://gstreamer.freedesktop.org/download/>
- **Linux (Debian/Ubuntu):** `sudo apt install libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-nice`

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
pnpm tauri build      # Production build — Windows x64, macOS, Linux
```

### Building for Windows 32-bit

```bash
rustup target add i686-pc-windows-msvc
pnpm tauri build --target i686-pc-windows-msvc
```

Produces a 32-bit NSIS installer that runs on Windows 10+ (32-bit).

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

## Documentation

- [Architecture](./docs/architecture.md) — system architecture diagram
- [Installation guides](./docs/installation/) — 3 platforms × 3 languages
- [User Guide](./docs/USER_GUIDE.md) — end-user documentation
- [Migration Guide](./docs/MIGRATION_GUIDE.md) — migrating from Delphi version
- [Code Signing Guide](./docs/code-signing-guide.md) — maintainer reference
- [Updater Setup](./docs/UPDATER_SETUP.md) — auto-update configuration

## Contributing

1. Follow existing code patterns (see `CLAUDE.md` for documented conventions)
3. Use `pnpm` as the package manager
4. Ensure `pnpm build` and `cargo build` pass before submitting PRs
5. Add i18n keys to all three locale files (`en.json`, `pt.json`, `es.json`)

## License

[MIT](LICENSE)
