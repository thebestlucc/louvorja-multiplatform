# LouvorJA Multiplatform — Product Requirements Document

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Feature Inventory](#4-feature-inventory)
5. [Database Schema](#5-database-schema)
6. [Directory Structure](#6-directory-structure)
7. [Dependencies](#7-dependencies)
8. [Phased Roadmap](#8-phased-roadmap)
9. [Key Architectural Decisions](#9-key-architectural-decisions)
10. [Risk Assessment](#10-risk-assessment)
11. [Testing Strategy](#11-testing-strategy)

---

## 1. Product Overview

### What is LouvorJA?

LouvorJA is a desktop application used by churches for worship service management. It handles hymn/lyrics display, Bible verse projection, presentation authoring, audio playback with slide synchronization, multi-monitor output (operator/projector/return monitor), worship service scheduling, and live HTTP streaming for remote viewers.

### Why Migrate?

The current application ([github.com/louvorja/desktop](https://github.com/louvorja/desktop)) is built with Delphi/Object Pascal and runs exclusively on Windows. It depends on Windows-only libraries (BASS audio DLL, BusinessSkinForm, FireDAC) and uses a Ribbon UI pattern tied to the Windows platform.

**Migration goals:**

- **Cross-platform** — Run on Windows, macOS, and Linux
- **Modern stack** — Replace Delphi with Tauri 2 + React 19 + TypeScript + Rust
- **Maintainability** — Move from a monolithic Delphi codebase (33 forms, 1 data module) to a modular architecture with clear separation of concerns
- **Performance** — Native Rust backend for audio, database, and file I/O; lightweight webview frontend
- **Community** — Open the door for web-savvy contributors who know TypeScript/React

### Current State of the Scaffold

The existing Tauri project is a minimal scaffolding with:

- **Rust backend** (`src-tauri/src/lib.rs`): A single `greet` command and `tauri_plugin_opener`
- **React frontend** (`src/App.tsx`): A greeting form and basic `Button` component
- **Installed**: `@tauri-apps/api@^2`, `react@^19.1.0`, `tailwindcss@^4.1.17`, `clsx`, `tailwind-merge`
- **Rust deps**: `tauri@2.9.4`, `serde@1.0`, `serde_json@1.0`, `log@0.4`, `tauri-plugin-log@2`
- **Capabilities**: Only `core:default` for the `main` window

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.1.0 | UI framework |
| TypeScript | 5.8.3 | Type safety |
| Vite | 7.0.4 | Build tool |
| Tailwind CSS | 4.1.17 | Styling (v4 with CSS-first config) |
| TanStack Router | latest | Type-safe file-based routing |
| Zustand | latest | Client state (UI, theme, preferences) |
| TanStack Query | latest | Server state (data fetching, caching, invalidation) |
| Radix UI | latest | Accessible, unstyled UI primitives |
| lucide-react | latest | Icon library |
| cmdk | latest | Command palette (Cmd+K) |
| sonner | latest | Toast notifications |
| @dnd-kit | latest | Drag and drop |
| i18next + react-i18next | latest | Internationalization (pt, es, en) |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Tauri | 2.9.4 | Desktop app framework + IPC |
| Rust | stable | Backend language |
| rusqlite | 0.31 (bundled) | SQLite database access |
| rodio | 0.19 | Audio playback engine (replaces BASS) |
| zip | 2.1 | .slja archive handling |
| std::net (TcpListener/TcpStream) | Rust stdlib | Embedded HTTP streaming server (SSE) |
| thiserror | 1.0 | Error type definitions |
| tokio | 1.x | Async runtime |
| chrono | 0.4 | Date/time handling |
| uuid | 1.0 | Unique ID generation |
| rand | 0.8 | Random number generation (lottery) |

---

## 3. Architecture

### 3.1 High-Level Diagram

```
+------------------------------------------------------------------+
|                        Tauri Application                         |
|                                                                  |
|  +---------------------------+  +-----------------------------+  |
|  |    React Frontend (SPA)   |  |     Rust Backend (Core)     |  |
|  |                           |  |                             |  |
|  |  TanStack Router          |  |  Tauri Commands (IPC)       |  |
|  |  Zustand (client state)   |  |  SQLite (rusqlite)          |  |
|  |  TanStack Query (server)  |  |  Rodio (audio engine)       |  |
|  |  Tailwind CSS v4          |  |  zip crate (.slja files)    |  |
|  |  Radix UI (primitives)    |  |  TcpListener/TcpStream (streaming srv) |  |
|  |  Slide renderer (DOM)     |  |  File system operations     |  |
|  |                           |  |  Monitor management         |  |
|  +---------------------------+  +-----------------------------+  |
|                                                                  |
|  +---------------------------+  +-----------------------------+  |
|  | Projector Window (webview)|  | Return Monitor (webview)    |  |
|  | Fullscreen slide display  |  | Performer feedback display  |  |
|  +---------------------------+  +-----------------------------+  |
|                                                                  |
|  +---------------------------+                                   |
|  | HTTP Streaming Server     |                                   |
|  | (Rust-side, raw TCP + SSE) |                                   |
|  +---------------------------+                                   |
+------------------------------------------------------------------+
```

### 3.2 Frontend Architecture

**Routing** — TanStack Router provides type-safe routing with file-based route generation. Desktop apps have complex nested layouts (sidebar + content + slide preview) that benefit from TanStack Router's layout route system.

**State Management (two layers):**
- **Zustand** for client-only UI state: current slide index, view mode, panel states, theme, operator preferences. Small footprint, no boilerplate, works well with React 19.
- **TanStack Query** for all Rust backend data access. Every Tauri `invoke()` call is wrapped in a TanStack Query `queryFn`, providing caching, invalidation, optimistic updates, and loading/error states. This replaces the Delphi TDataSet/TClientDataSet pattern.

**Component Library** — Radix UI primitives (unstyled, accessible) styled with Tailwind CSS v4. The Delphi Ribbon UI is reimagined as a sidebar navigation + command palette (Cmd+K).

**Slide Rendering** — DOM-based rendering using React components and CSS transforms/transitions. This allows the same rendering code to work across operator view, projector window, return monitor, and HTTP streaming output.

### 3.3 Backend Architecture

All database access goes through typed Rust commands. The frontend never sees raw SQL — this avoids the security risk of exposing SQL via `tauri-plugin-sql`.

**Module structure:**

```
src-tauri/src/
  lib.rs                 -- App builder, plugin registration, command routing
  commands/
    mod.rs               -- Re-exports all command modules
    music.rs             -- Music/lyrics CRUD, search, hymnal queries
    bible.rs             -- Bible text queries, search, version management
    slides.rs            -- Slide/presentation management, .slja file I/O
    liturgy.rs           -- Worship service/schedule management
    audio.rs             -- Audio playback control (play, pause, seek, volume)
    display.rs           -- Window/monitor management commands
    streaming.rs         -- HTTP streaming server start/stop/config
    settings.rs          -- App preferences, themes, language
    timer.rs             -- Timer/chronometer state
    utility.rs           -- Lottery/randomizer, text formatting
  db/
    mod.rs               -- Database connection pool, migration runner
    migrations.rs        -- Schema migrations (versioned)
    models.rs            -- Struct definitions with serde Serialize/Deserialize
    queries/
      music.rs           -- Music-related SQL queries
      bible.rs           -- Bible-related SQL queries
      liturgy.rs         -- Liturgy-related SQL queries
      settings.rs        -- Settings/parameters queries
  audio/
    mod.rs               -- Audio engine wrapper around rodio
    player.rs            -- Playback state machine (idle, playing, paused, seeking)
    sync.rs              -- Audio-slide synchronization timing
  archive/
    mod.rs               -- .slja ZIP archive read/write
    manifest.rs          -- Archive manifest parsing
  display/
    mod.rs               -- Monitor detection, window lifecycle
  streaming/
    mod.rs               -- HTTP server for live streaming HTML endpoints
  state.rs               -- Tauri managed state definitions (AppState, AudioState)
  error.rs               -- Unified error type with From impls for all crate errors
```

### 3.4 Inter-Window Communication

The main window (operator) controls everything. Projector and return windows are separate Tauri webview windows. Communication flows through Rust:

```
Operator Window (React)
   │
   │ invoke("set_current_slide", { slideData })
   ▼
Rust Backend
   │
   │ app.emit("slide-changed", slidePayload)
   ▼
Projector Window (React, listens to "slide-changed")
Return Window (React, listens to "slide-changed" + extra metadata)
```

Slide content is sent as serialized JSON through Tauri events. Each window renders independently. This decoupled approach also serves the HTTP streaming server.

---

## 4. Feature Inventory

Complete mapping of the original Delphi application (33 forms + 1 data module) to the new architecture.

### 4.1 Music & Lyrics Management

**Original forms:** `fmMusica`, `fmBuscaMusica`, `fmLetra`, `fmListaMusica`, `fmMusicaOperador`, `fmMusicaRetorno`

| Original Capability | New Implementation |
|---|---|
| Hymn browsing by number/title | TanStack Query + Rust `search_hymns` command with SQLite FTS5 |
| Album/collection listing with cover art | Grid view at `/hymnal` route with album cards |
| Lyrics display and editing | `lyrics-display.tsx` component with configurable font/size/color |
| Multiple playback modes (sung, karaoke, silent) | Audio store mode selector; `rodio` backend handles playback |
| Audio-slide synchronization (BASS byte-position) | `audio/sync.rs` with millisecond-precision timestamps |
| Record/edit slide timing during playback | `audio-sync-editor.tsx` — tap to set timestamps while audio plays |
| Slide types: cover, lyrics, pause | Slide content JSON with `type` field |
| Operator controls for slide progression | Keyboard navigation (arrows, space, PgUp/PgDn) + UI controls |
| Performer feedback screen (current/next lyrics) | Return monitor webview window at `/return` route |
| TXT and XML slide format import | Rust import commands for legacy formats |

### 4.2 Presentation Authoring

**Original form:** `fmEditorSlides`

| Original Capability | New Implementation |
|---|---|
| Create/edit .slja presentations (ZIP archives) | `archive/` Rust module with `zip` crate |
| Add/delete/duplicate/merge slides | Slide list with `@dnd-kit` sortable + action buttons |
| Font customization (size, color, bold/italic) | Slide editor toolbar with Radix UI controls |
| Background images (9 position options) | Background picker with position grid |
| Three aspect ratios (free, 4:3, 16:9) | Aspect ratio selector in presentation settings |
| Audio linking with byte-position sync | Audio file attachment with sync editor |
| Real-time preview | Live preview panel alongside editor |
| Import text from files | File picker + Rust text import command |

### 4.3 Multi-Monitor Display System

**Original forms:** `fmMonitorBiblia`, `fmMonitorBibliaBusca`, `fmMonitorCronometro`, `fmMonitorCronometroCulto`, `fmMonitorRelogio`, `fmMonitorSorteio`, `fmMonitorSorteioNomes`, `fmMonitorTextoInterativo`, `fmMonitorMenuMusicas`, `fmMonitorPainelDinamico`, `fmIdentificaMonitores`

| Original Capability | New Implementation |
|---|---|
| Different content on different monitors | Separate Tauri webview windows per monitor role |
| Monitor detection and identification | Rust `available_monitors()` + config UI |
| Automatic monitor positioning | `WebviewWindow::builder()` with position/size from monitor info |
| Fade-out animations on closure | CSS transitions in webview windows |
| Configurable monitor assignments | `monitor_configs` table + settings UI |
| 3 window types: operator, projector, return | 3 routes: `/` (operator), `/projector`, `/return` |

**Monitor placement workaround** (Tauri limitation):
1. Detect monitors via `available_monitors()`
2. Create window hidden (`visible: false`)
3. Set position to target monitor coordinates
4. Set size to monitor dimensions
5. Make visible and set fullscreen
6. 100-200ms delay between steps
7. Fallback: manual drag to correct monitor

### 4.4 Worship Service / Liturgy

**Original forms:** `fmLiturgia`, `fmItensAgendados`

| Original Capability | New Implementation |
|---|---|
| Multi-item service organization | Service editor with `@dnd-kit` drag-and-drop |
| Item types: annotation, music, URL, file, scheduled | `service_items` table with `item_type` discriminator |
| XML-based storage | SQLite `services` + `service_items` tables |
| Color-coded items | CSS classes per item type |
| Category groupings | Item type categories with visual grouping |
| Service scheduling | Date-based service listing |
| "Add to current service" from any view | Global action button via presentation store |

### 4.5 Bible Content

**Original forms:** `fmMonitorBiblia`, `fmMonitorBibliaBusca`

| Original Capability | New Implementation |
|---|---|
| Multiple Bible versions | `bible_versions` + `bible_verses` tables |
| Book/chapter/verse navigation | Breadcrumb-style navigation UI |
| Full-text search | SQLite FTS5 index on verse text |
| Formatted verse display on projector | Bible slide type sent via Tauri events |
| Version comparison | Side-by-side verse display component |

### 4.6 Multimedia

**Original forms:** `fmVideoOn`, `fmPlayer`

| Original Capability | New Implementation |
|---|---|
| Video playback (web browser component) | HTML5 `<video>` element in webview (MP4, WebM) |
| Audio playback via BASS library | `rodio` Rust crate (MP3, WAV, FLAC, OGG) |
| Play/pause/stop/seek/volume | Rust audio commands + frontend controls |
| Progress tracking | Polling `position_ms()` from Rust via events |

### 4.7 Utilities

**Original forms:** `fmMonitorSorteio`, `fmMonitorSorteioNomes`, `fmMonitorCronometro`, `fmMonitorCronometroCulto`, `fmMonitorRelogio`, `fmFavoritos`, `fmFormatacao`

| Original Capability | New Implementation |
|---|---|
| Name lottery/randomizer | `/utilities/lottery` route with `rand` crate |
| Timer/chronometer | `/utilities/timer` route with Rust timer state |
| Clock display | Projectable clock component |
| Favorites management | `favorites` table + bookmark UI |
| Text formatting presets | Formatting dialog with Radix UI tabs |

### 4.8 Live Streaming

**Original form:** `fmTransmitir`

| Original Capability | New Implementation |
|---|---|
| HTTP server for content streaming | Raw `std::net::TcpListener` + SSE fanout |
| 3 endpoints: `/musica`, `/biblia`, `/retorno` | SSE-powered endpoints for real-time updates |
| Configurable IP/port (default 7070) | Settings UI + `settings` table |
| Shareable URLs | QR code generation (`qrcode` crate + `qrcode.react`) |
| OBS/vMix compatibility | Standard HTML output with auto-refresh |

### 4.9 Administration

**Original forms:** `fmHelp`, `fmAtualiza`, `fmNovaVersao`, `fmArquivosExcesso`, `fmArquivosFalta`, `fmIniciando`, `fmMenu`

| Original Capability | New Implementation |
|---|---|
| Help system (embedded browser) | Integrated documentation / guided tour |
| FTP-based update system | `tauri-plugin-updater` (auto-update) |
| Version checking | Built into Tauri updater |
| Excess/missing file detection | Replaced by Tauri's bundling — not needed |
| Startup initialization | Rust `setup()` hook in `lib.rs` |
| Localization (.translate files) | `i18next` with JSON translation files (pt, es, en) |
| 5 theme variants (Azure, White, Gray, Orange, Black) | CSS custom properties on `<html data-theme>` |
| First-run wizard | Onboarding flow: language → import → monitor setup |

---

## 5. Database Schema

Engine: SQLite via `rusqlite` (bundled). All access through typed Rust commands — no SQL exposed to frontend.

```sql
-- Music/Hymns
CREATE TABLE hymns (
  id INTEGER PRIMARY KEY,
  number INTEGER,
  title TEXT NOT NULL,
  album TEXT,
  artist TEXT,
  lyrics TEXT,
  audio_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Bible
CREATE TABLE bible_versions (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,   -- e.g. 'ARA', 'NVI', 'KJV'
  name TEXT NOT NULL,
  language TEXT NOT NULL
);

CREATE TABLE bible_verses (
  id INTEGER PRIMARY KEY,
  version_id INTEGER REFERENCES bible_versions(id),
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL
);

-- Presentations/Slides
CREATE TABLE presentations (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  aspect_ratio TEXT DEFAULT '16:9',
  archive_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE slides (
  id INTEGER PRIMARY KEY,
  presentation_id INTEGER REFERENCES presentations(id),
  sort_order INTEGER NOT NULL,
  content_json TEXT NOT NULL,   -- JSON: text, font, color, bg, transitions
  audio_timestamp_ms INTEGER    -- sync point for audio
);

-- Liturgy / Worship Service
CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE service_items (
  id INTEGER PRIMARY KEY,
  service_id INTEGER REFERENCES services(id),
  sort_order INTEGER NOT NULL,
  item_type TEXT NOT NULL,      -- 'hymn','bible','presentation','annotation','url','file'
  reference_id INTEGER,         -- FK to hymns/presentations depending on type
  metadata_json TEXT            -- Additional data (bible ref, URL, notes, etc.)
);

-- Favorites & Collections
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now'))
);

-- App Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Monitor Configuration
CREATE TABLE monitor_configs (
  id INTEGER PRIMARY KEY,
  monitor_name TEXT NOT NULL,
  role TEXT NOT NULL,            -- 'operator', 'projector', 'return'
  position_json TEXT             -- {x, y, width, height}
);
```

Indexes to add for performance:

```sql
CREATE INDEX idx_hymns_number ON hymns(number);
CREATE INDEX idx_hymns_title ON hymns(title);
CREATE INDEX idx_bible_verses_lookup ON bible_verses(version_id, book, chapter, verse);
CREATE INDEX idx_slides_presentation ON slides(presentation_id, sort_order);
CREATE INDEX idx_service_items_service ON service_items(service_id, sort_order);
CREATE INDEX idx_favorites_type ON favorites(item_type, reference_id);
```

Full-text search:

```sql
CREATE VIRTUAL TABLE hymns_fts USING fts5(title, lyrics, content=hymns, content_rowid=id);
CREATE VIRTUAL TABLE bible_fts USING fts5(text, content=bible_verses, content_rowid=id);
```

---

## 6. Directory Structure

### Frontend

```
src/
  main.tsx                         -- React entry point
  global.css                       -- Tailwind imports, CSS custom properties for themes
  routes/
    __root.tsx                     -- Root layout (sidebar + main content area)
    index.tsx                      -- Dashboard / home
    hymnal/
      route.tsx                    -- Hymnal layout
      index.tsx                    -- Hymnal list/search
      $hymnId.tsx                  -- Individual hymn view
    bible/
      route.tsx                    -- Bible layout
      index.tsx                    -- Bible navigation
    presentations/
      route.tsx                    -- Presentations layout
      index.tsx                    -- Presentation list
      $presentationId.tsx          -- Presentation editor
    services/
      route.tsx                    -- Worship service layout
      index.tsx                    -- Services list
      $serviceId.tsx               -- Service editor
    utilities/
      route.tsx                    -- Utilities layout
      timer.tsx                    -- Timer/chronometer
      lottery.tsx                  -- Name randomizer
    settings/
      route.tsx                    -- Settings page
    projector.tsx                   -- Projector window (fullscreen output)
    return.tsx                      -- Return monitor (performer feedback)
  components/
    ui/                            -- Primitive UI components
      button.tsx
      dialog.tsx
      input.tsx
      select.tsx
      tabs.tsx
      dropdown-menu.tsx
      tooltip.tsx
      scroll-area.tsx
      slider.tsx
      badge.tsx
      card.tsx
      command-palette.tsx
    layout/
      sidebar.tsx                  -- Main navigation sidebar
      header.tsx                   -- Top bar with search, clock, settings
      status-bar.tsx               -- Bottom status bar
    slides/
      slide-renderer.tsx           -- Renders a single slide (shared across all views)
      slide-editor.tsx             -- Editable slide with controls
      slide-thumbnail.tsx          -- Thumbnail preview
      slide-list.tsx               -- Sortable slide list
      projector-view.tsx           -- Fullscreen projector output
      return-view.tsx              -- Return monitor output
    music/
      hymn-card.tsx                -- Hymn list item
      hymn-search.tsx              -- Search with filters
      lyrics-display.tsx           -- Formatted lyrics view
      audio-controls.tsx           -- Play/pause/seek/volume
      audio-sync-editor.tsx        -- Timestamp sync editor
    bible/
      book-selector.tsx            -- Book/chapter/verse navigation
      verse-display.tsx            -- Formatted verse display
      bible-search.tsx             -- Full-text search
    services/
      service-editor.tsx           -- Drag-and-drop service builder
      service-item.tsx             -- Individual item in a service
      service-timeline.tsx         -- Visual timeline
    streaming/
      streaming-controls.tsx       -- Start/stop server, show URL/QR
  hooks/
    use-audio.ts                   -- Audio playback hook wrapping Tauri commands
    use-slides.ts                  -- Slide navigation and state
    use-monitors.ts                -- Monitor detection and window management
    use-theme.ts                   -- Theme switching
    use-keyboard.ts                -- Global keyboard shortcuts
    use-timer.ts                   -- Timer/chronometer hook
    use-bible.ts                   -- Bible navigation state
  stores/
    ui-store.ts                    -- Zustand: panels, sidebar, modals
    presentation-store.ts          -- Zustand: current presentation, active slide
    audio-store.ts                 -- Zustand: playback state synced from Rust
    display-store.ts               -- Zustand: monitor assignments, window states
    theme-store.ts                 -- Zustand: active theme, color variant
  lib/
    tauri.ts                       -- Typed invoke wrappers for all Tauri commands
    queries.ts                     -- TanStack Query keys and query/mutation factories
    utils.ts                       -- clsx/tailwind-merge helper (cn function)
    constants.ts                   -- App constants (aspect ratios, default settings)
    i18n.ts                        -- i18next configuration
  types/
    hymn.ts                        -- Hymn, Album, Lyrics types
    bible.ts                       -- BibleVersion, Book, Chapter, Verse types
    presentation.ts                -- Presentation, Slide, SlideContent types
    service.ts                     -- Service, ServiceItem types
    settings.ts                    -- Settings, MonitorConfig types
    audio.ts                       -- AudioState, PlaybackStatus types
```

### Backend (Rust)

```
src-tauri/
  src/
    lib.rs                         -- App builder, plugin registration
    commands/
      mod.rs                       -- Re-exports
      music.rs                     -- Music/lyrics CRUD, search
      bible.rs                     -- Bible queries, search
      slides.rs                    -- Slide/presentation management
      liturgy.rs                   -- Worship service management
      audio.rs                     -- Audio playback control
      display.rs                   -- Window/monitor management
      streaming.rs                 -- HTTP server control
      settings.rs                  -- App preferences
      timer.rs                     -- Timer/chronometer
      utility.rs                   -- Lottery, text formatting
    db/
      mod.rs                       -- Connection pool, migration runner
      migrations.rs                -- Schema migrations
      models.rs                    -- Data structures
      queries/
        music.rs
        bible.rs
        liturgy.rs
        settings.rs
    audio/
      mod.rs                       -- Audio engine wrapper
      player.rs                    -- Playback state machine
      sync.rs                      -- Audio-slide synchronization
    archive/
      mod.rs                       -- .slja ZIP archive read/write
      manifest.rs                  -- Archive manifest parsing
    display/
      mod.rs                       -- Monitor detection, window lifecycle
    streaming/
      mod.rs                       -- HTTP server for live streaming
    state.rs                       -- Managed state definitions
    error.rs                       -- Unified error type
  capabilities/
    default.json                   -- Tauri 2 permissions
  Cargo.toml
  tauri.conf.json
```

---

## 7. Dependencies

### Frontend (npm)

| Package | Purpose | Phase |
|---|---|---|
| `@tanstack/react-router` | Type-safe file-based routing | 0 |
| `@tanstack/react-query` | Server state / data fetching | 0 |
| `zustand` | Client state management | 0 |
| `@radix-ui/react-dialog` | Modal dialogs | 0 |
| `@radix-ui/react-dropdown-menu` | Dropdown menus | 0 |
| `@radix-ui/react-tabs` | Tab navigation | 0 |
| `@radix-ui/react-scroll-area` | Custom scrollbars | 0 |
| `@radix-ui/react-slider` | Audio slider | 0 |
| `@radix-ui/react-tooltip` | Tooltips | 0 |
| `@radix-ui/react-select` | Select dropdowns | 0 |
| `@radix-ui/react-toggle-group` | Toggle buttons | 0 |
| `lucide-react` | Icon library | 0 |
| `cmdk` | Command palette (Cmd+K) | 0 |
| `sonner` | Toast notifications | 0 |
| `i18next` | Internationalization | 0 |
| `react-i18next` | React i18n bindings | 0 |
| `@dnd-kit/core` | Drag and drop | 5 |
| `@dnd-kit/sortable` | Sortable lists | 5 |
| `qrcode.react` | QR code for streaming URLs | 7 |

### Backend (Rust crates)

| Crate | Purpose | Phase |
|---|---|---|
| `rusqlite` (bundled) | SQLite database access | 0 |
| `thiserror` | Error type definitions | 0 |
| `anyhow` | Error propagation | 0 |
| `tokio` (full) | Async runtime | 0 |
| `chrono` (serde) | Date/time handling | 0 |
| `uuid` (v4, serde) | Unique ID generation | 0 |
| `toml` | Config file parsing | 0 |
| `rodio` | Audio playback engine | 2 |
| `zip` | .slja archive read/write | 3 |
| `tempfile` | Temp file management for archives | 3 |
| `std::net` (TcpListener/TcpStream) | Embedded HTTP streaming server | 7 |
| `qrcode` | QR code generation | 7 |
| `rand` | Random number generation (lottery) | 9 |

### Capabilities (Tauri 2 Permissions)

```json
{
  "identifier": "default",
  "description": "LouvorJA default capabilities",
  "windows": ["main", "projector", "return"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-set-position",
    "core:window:allow-set-size",
    "core:window:allow-set-fullscreen",
    "core:window:allow-set-focus",
    "core:window:allow-available-monitors",
    "core:window:allow-current-monitor",
    "core:window:allow-start-dragging",
    "core:webview:allow-create-webview-window",
    "opener:default"
  ]
}
```

---

## 8. Phased Roadmap

### Phase 0 — Foundation (Weeks 1–2)

**Goal:** Establish project infrastructure, tooling, and architectural skeleton.

**Deliverables:**
- Project restructuring with the directory layout defined above
- TanStack Router setup with layout routes
- Zustand store skeleton (theme, UI state)
- Rust module structure with empty command handlers
- SQLite database initialization and migration framework using `rusqlite`
- Error handling pattern (`error.rs` with `thiserror`)
- Tauri capabilities updated for required permissions
- ESLint + Prettier + Biome configuration
- CI pipeline (GitHub Actions: `cargo check`, `cargo clippy`, `pnpm build`, `pnpm lint`)

### Phase 1 — Music & Lyrics Core (Weeks 3–5)

**Goal:** Deliver the primary use case — hymn browsing, lyrics display, and basic slide projection.

**Deliverables:**
- SQLite hymn database populated with hymnal data (import from existing Delphi SQLite DB)
- Hymn search by number, title, and full-text lyrics (FTS5)
- Lyrics slide renderer with configurable font, size, color, background
- Basic projector window — a second Tauri webview opened fullscreen on a selected monitor
- Keyboard navigation for slide advancement (arrows, space, PgUp/PgDn)
- Album/collection browsing with grid view

**Key Rust commands:**
```rust
search_hymns(query: String) -> Vec<Hymn>
get_hymn(id: i64) -> Hymn
get_albums() -> Vec<Album>
get_hymns_by_album(album: String) -> Vec<Hymn>
get_available_monitors() -> Vec<MonitorInfo>
open_projector_window(monitor_index: usize)
close_projector_window()
```

### Phase 2 — Audio Playback & Synchronization (Weeks 6–7)

**Goal:** Replace the Delphi BASS library audio with Rust-native `rodio` and implement audio-slide sync.

**Deliverables:**
- Audio engine in Rust using `rodio` — play, pause, stop, seek, volume
- Frontend audio controls component with progress bar
- Audio-slide synchronization via millisecond timestamps in the database
- Sync editor — operator taps/clicks to set timestamps while audio plays

**Audio player interface:**
```rust
pub struct AudioPlayer {
    sink: Option<Sink>,
    stream: OutputStream,
    stream_handle: OutputStreamHandle,
    current_file: Option<PathBuf>,
    duration_ms: Option<u64>,
}

// Methods: play, pause, resume, stop, seek, set_volume, position_ms, is_playing
```

**Format support:** MP3, WAV, FLAC, OGG natively. The BASS library supported more exotic formats — if users have uncommon formats, conversion guidance will be provided.

### Phase 3 — Presentation Editor & .slja Archive Support (Weeks 8–10)

**Goal:** Full slide creation/editing with the custom .slja archive format.

**Deliverables:**
- .slja archive reader/writer in Rust using the `zip` crate
- Slide editor UI: text editing, font/size/color, background selection, aspect ratio
- Slide transitions (fade, slide)
- Slide thumbnail generation
- Import existing .slja files from the Delphi version

**.slja archive structure:**
```
presentation.slja (ZIP)
  manifest.json              -- title, author, aspect ratio, slide count
  slides/
    001.json                 -- Slide content definition
    002.json
  media/
    background_001.png       -- Background images
    audio_track.mp3          -- Associated audio
  thumbnails/
    001.png                  -- Pre-rendered thumbnails
```

### Phase 4 — Bible Module (Weeks 11–12)

**Goal:** Bible text display with multi-version support and search.

**Deliverables:**
- Bible database with downloadable version packages (ships with ARA default)
- Book/chapter/verse navigation with breadcrumb UI
- Full-text search across Bible text with highlighted results
- Bible slide projection on projector window
- Multiple version comparison view

**Key Rust commands:**
```rust
get_bible_versions() -> Vec<BibleVersion>
get_books(version_id: i64) -> Vec<Book>
get_verses(version_id: i64, book: i32, chapter: i32) -> Vec<Verse>
search_bible(query: String, version_id: i64) -> Vec<SearchResult>
```

### Phase 5 — Worship Service / Liturgy Manager (Weeks 13–15)

**Goal:** Organize complete worship services with drag-and-drop.

**Deliverables:**
- Service editor with `@dnd-kit` drag-and-drop item reordering
- Item types: hymn, Bible reading, presentation, annotation, URL, file
- Service persistence to SQLite
- Import from Delphi XML service files
- Service template system — save and reuse common structures
- "Add to current service" button from hymn and Bible views

**Service editor layout:**
```
+--------------------------------------------------+
| Service: Sabbath Worship - Feb 8, 2026           |
+--------------------------------------------------+
| 1. [♪] Hymn #123 - Amazing Grace                |
| 2. [📖] Genesis 1:1-5 (ARA)                     |
| 3. [📊] Presentation: Welcome                    |
| 4. [📝] Prayer - Pastor Silva                    |
| 5. [♪] Hymn #456 - How Great Thou Art           |
| 6. [🔗] https://...                              |
+--------------------------------------------------+
|  [+ Add Item]  [Play Service]  [Export]           |
+--------------------------------------------------+
```

### Phase 6 — Multi-Monitor Display System (Weeks 16–18)

**Goal:** Full multi-monitor support with operator, projector, and return monitor views.

**Deliverables:**
- Monitor detection and configuration UI — detect all connected monitors, assign roles
- Projector window — fullscreen on designated monitor
- Return monitor window — fullscreen, shows performer-facing content (next lyrics, notes)
- Fade animations between slides (CSS transitions)
- Black screen / logo screen controls
- Monitor config persistence in SQLite

### Phase 7 — HTTP Streaming Server (Weeks 19–20)

**Goal:** Replace the Delphi HTTP server with a Rust-native streaming server.

**Deliverables:**
- Embedded HTTP server using raw `TcpListener`/`TcpStream`
- Endpoints: `/` (status), `/music`, `/bible`, `/return`
- Server-Sent Events (SSE) for real-time content updates
- Configurable port via settings
- QR code generation for easy mobile access

**Trade-off:** SSE over WebSocket. SSE is sufficient for one-directional content pushing (server → client) and simpler to implement than WebSocket.

### Phase 8 — Video & Multimedia (Weeks 21–22)

**Goal:** Video playback support.

**Deliverables:**
- Video playback via HTML5 `<video>` element (MP4, WebM)
- Video slide type in the presentation editor
- Video on projector window with synchronized playback controls

**Trade-off:** No FFmpeg bundling. For formats not supported by the webview (AVI, MKV), the app recommends conversion.

### Phase 9 — Utilities & Polish (Weeks 23–24)

**Goal:** Implement remaining utility features and polish the application.

**Deliverables:**
- Timer/chronometer — countdown and stopwatch with projector display option
- Clock display — projectable clock
- Name lottery/randomizer — input names, animated random selection
- Text formatting utilities
- 5 theme variants via CSS custom properties:
  - Azure (Blue): `--theme-primary: #0078d4`
  - White: light theme
  - Gray: neutral theme
  - Orange: warm theme
  - Black: `--theme-primary: #60cdff; --theme-bg: #1e1e1e`
- Keyboard shortcut system with discoverable shortcuts panel (Cmd+/)
- Command palette (Cmd+K) for quick access to any feature

**Theme implementation:**
```css
/* Theme variants applied via data attribute on <html> */
[data-theme="azure"] {
  --theme-primary: #0078d4;
  --theme-secondary: #106ebe;
  --theme-bg: #f3f2f1;
  --theme-surface: #ffffff;
  --theme-text: #323130;
}

[data-theme="black"] {
  --theme-primary: #60cdff;
  --theme-secondary: #0078d4;
  --theme-bg: #1e1e1e;
  --theme-surface: #2d2d2d;
  --theme-text: #e5e5e5;
}
```

### Phase 10 — Migration Tools & Deployment (Weeks 25–27)

**Goal:** Smooth transition for existing users and production-ready builds.

**Deliverables:**
- Data migration tool — imports from the old Delphi SQLite database:
  - Hymn library
  - Bible data
  - Favorites and collections
  - Worship service history (XML → SQLite)
  - Application settings
  - Monitor configurations
- Auto-updater using `tauri-plugin-updater`
- Installer configuration:
  - Windows: MSI / NSIS
  - macOS: DMG
  - Linux: AppImage / deb
- First-run wizard: language selection → data import → monitor setup
- Internationalization: Portuguese (default), Spanish, English
- Help system / integrated documentation

---

## 9. Key Architectural Decisions

### Decision 1: Rust-side database access vs. frontend SQL plugin

**Choice:** All database access through Rust Tauri commands.

**Rationale:** Type safety, security (no SQL injection from frontend), ability to add business logic in Rust, consistent error handling. The `tauri-plugin-sql` plugin is convenient but exposes raw SQL to the webview.

### Decision 2: TanStack Router vs. React Router

**Choice:** TanStack Router.

**Rationale:** Full type-safe routing including search parameters. File-based route generation reduces boilerplate. Better TypeScript inference. The desktop app has complex nested layouts (sidebar + content + slide preview) that benefit from TanStack Router's layout route system.

### Decision 3: Zustand vs. Redux vs. Jotai

**Choice:** Zustand for client state, TanStack Query for server/backend state.

**Rationale:** Zustand has minimal boilerplate, works naturally with React 19, and handles client-only state (UI panels, current selection, theme) simply. Redux is overkill. Jotai would also work but Zustand's store pattern is more intuitive for this use case.

### Decision 4: rodio vs. Web Audio API

**Choice:** `rodio` on the Rust side.

**Rationale:** The Web Audio API behaves differently across WebKit (macOS/Linux) and Chromium (Windows) webviews. `rodio` provides consistent cross-platform audio controlled from Rust. The frontend sends commands; Rust handles all audio I/O. This also enables background playback when the webview is not focused.

### Decision 5: DOM-based slide renderer vs. canvas

**Choice:** DOM-based rendering using React components and CSS.

**Rationale:** Canvas provides pixel-perfect rendering but complicates text editing, accessibility, and content reuse. DOM rendering allows the same component to work in the editor (interactive), projector (read-only), return monitor (different layout), and HTTP streaming output (plain HTML). CSS transitions handle fade animations naturally.

### Decision 6: raw TcpListener vs. tiny_http/axum for streaming

**Choice:** Raw `std::net::TcpListener` + `TcpStream` writes with explicit flush/heartbeat.

**Rationale:** SSE delivery must flush small chunks immediately; buffered HTTP abstractions caused delayed/inconsistent live updates. Raw TCP gives deterministic write/flush behavior, simpler heartbeat/disconnect control, and reliable low-latency LAN streaming. If requirements grow, evaluate `axum` with explicit streaming primitives.

### Decision 7: Sidebar + command palette vs. Ribbon UI

**Choice:** Sidebar navigation + command palette (Cmd+K).

**Rationale:** The Delphi Ribbon UI (Collections, Bible, Hymnal, Search, Utilities tabs) is a Windows-centric design. A sidebar with collapsible sections is more cross-platform, more modern, and more space-efficient. The command palette provides the quick-access functionality that the Ribbon's prominent buttons served. This also works better on smaller screens.

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Multi-monitor window placement fails on some platforms | **High** | Provide manual "move to monitor" UI; test extensively on Windows (primary target); add 100-200ms delays between position/visibility steps |
| `rodio` audio format compatibility gaps vs. BASS library | **Medium** | Document supported formats; provide conversion guidance; most worship audio is MP3 |
| .slja format reverse engineering difficulties | **Medium** | Get format documentation from original developer if possible; otherwise binary analysis of sample files |
| Large Bible text data increases app size | **Low** | Download Bible versions on demand; ship with one default version (ARA) |
| Tauri webview rendering differences (WebKit on macOS/Linux vs. Chromium on Windows) | **Medium** | Use CSS features with broad support; test on all three platforms in CI |
| Performance with large hymn databases (thousands of entries) | **Low** | SQLite handles this easily; add FTS5 full-text search index for fast queries |

---

## 11. Testing Strategy

### Unit Tests (Rust)

- Every database query function
- Every archive parser
- Audio state machine transitions
- Error type conversions
- Run with `cargo test`

### Integration Tests (Rust)

- Tauri command handlers tested with a mock `AppHandle`
- Database tests use in-memory SQLite
- Audio sync logic tested with mock audio positions

### Component Tests (React)

- **Vitest** + **React Testing Library**
- Focus areas: slide renderer, search components, service editor
- Zustand stores tested in isolation
- TanStack Query hooks tested with mock providers

### End-to-End Tests

- **tauri-driver** (WebDriver-based) for critical user flows:
  1. Search hymn → display slide → advance slide → verify projector content
  2. Create service → add items → reorder → save → reload
  3. Start audio → sync editor → set timestamps → verify sync
  4. Open projector on monitor → change content → verify display

### CI Pipeline

```yaml
# GitHub Actions
- cargo check
- cargo clippy -- -D warnings
- cargo test
- pnpm lint
- pnpm build
- pnpm test
```
