# LouvorJA Multiplatform — Implementation Progress

> Tracking the migration from Delphi to Tauri 2 + React 19 + Rust.
> Total estimated effort: 27–30 weeks across 12 phases.

---

## Overview

| Phase | Spec | Name | Status |
|:-----:|:----:|------|:------:|
| 0 | 01 | Foundation | COMPLETE |
| 1 | 02 | Music & Lyrics Core | COMPLETE |
| 2 | 03 | Audio Playback & Synchronization | COMPLETE |
| 3 | 04 | Presentation Editor & .slja Archive | COMPLETE |
| 4 | 05 | Bible Module | COMPLETE |
| 5 | 06 | Worship Service / Liturgy Manager | COMPLETE |
| 6 | 07 | Multi-Monitor Display System | COMPLETE |
| 7 | 08 | HTTP Streaming Server | COMPLETE |
| 8 | 09 | Video & Multimedia | COMPLETE |
| 9 | 10 | Utilities & Polish | COMPLETE |
| 10 | 11 | Migration Tools & Deployment | COMPLETE |
| 11 | 12 | Hymn CRUD + Collections + Hybrid Cache Covers | IN PROGRESS |

**Progress: 11 / 12 phases complete (Phase 11 in progress)**

### Documentation Source of Truth

Feature decisions and implementation tracking must live under `docs/phase-*` with this structure:
- `PRD.md`
- `SPECS.md`
- `TASKS.md`
- `HANDOFF.md` (completed when implementation closes)

Reference index:
- `docs/README.md`

---

## Phase 0 — Foundation (SPEC 01)

**Status:** COMPLETE

Project infrastructure and scaffolding for the entire application.

### What was done
- **Tauri 2.9.4** project setup with Rust backend and React 19 frontend
- **Vite 7** build tooling with TypeScript 5.8
- **TanStack Router** file-based routing with Vite plugin (`routeTree.gen.ts` auto-generation)
- **TanStack Query** for server state management
- **Zustand** stores: `presentation-store`, `audio-store` (placeholder)
- **Tailwind CSS v4** with `@theme` directive, CSS custom properties for 5 themes (azure/white/gray/orange/black)
- **Radix UI** primitives: Button, Badge, Slider, Dialog, etc. with CVA pattern
- **i18next** setup with pt/en/es locale files
- **SQLite** database initialization with `rusqlite` (bundled), schema v1 migrations
- **Rust module structure**: commands (music, bible, slides, liturgy, audio, display, streaming, settings, timer, utility), db (models, queries, migrations), audio, archive, display, streaming, state, error
- **Error handling**: `AppError` enum with Serialize for Tauri command returns
- All Phase 1–10 Rust commands stubbed with `Err(AppError::Internal("Not implemented"))`
- **Command palette** (cmdk) integration
- **Layout**: sidebar navigation, status bar, main content area

### Files created
- 70+ files across `src-tauri/src/`, `src/components/`, `src/routes/`, `src/stores/`, `src/types/`, `src/lib/`, `src/locales/`, `src/hooks/`

---

## Phase 1 — Music & Lyrics Core (SPEC 02)

**Status:** COMPLETE

Hymn browsing, search, lyrics display, and basic slide projection.

### What was done

#### Rust Backend
- `SlideContent` model (flat struct with `slide_type`, `text`, `title`, `subtitle`, etc.)
- `AppState` with `current_slide: Mutex<Option<SlideContent>>` and `projector_open: Mutex<bool>`
- Music DB queries: FTS5 full-text search on hymns, search by number, get by ID, albums, hymns by album
- Display commands: `open_projector_window` (dynamic WebviewWindow), `close_projector_window`, `open_return_window`, `close_return_window`, `set_current_slide` (with Tauri event emission), `get_available_monitors`, `set_monitor_config`

#### Frontend
- **Tauri wrappers**: `searchHymns`, `getHymn`, `getAlbums`, `getHymnsByAlbum`, `getAvailableMonitors`, `openProjectorWindow`, `closeProjectorWindow`, `setCurrentSlide`
- **TanStack Query hooks**: `useHymns`, `useHymn`, `useAlbums`, `useHymnsByAlbum`, `useMonitors`, `useProjectSlide`
- **Music components**: `HymnSearch` (search input + results), `HymnCard`, `AlbumCard`, `LyricsDisplay` (stanza-by-stanza with active highlight)
- **Slide components**: `SlideRenderer`, `SlideThumbnail`, `SlideList`, `ProjectorView`
- **Routes**: `hymnal/` directory layout with index and `$hymnId` detail, `/projector` (fullscreen), `/return` (bare rendering in `__root.tsx`)
- **Hooks**: `useSlides` (slides navigation), `useKeyboard` (arrow/space/pgdn/esc/F5 shortcuts), `useMonitors` (projector toggle)
- **Presentation store**: `slides[]`, `activeSlideIndex`, `nextSlide()`, `prevSlide()`, `setSlides()`
- **i18n**: `hymnal.*` keys in pt/en/es

### Key patterns established
- `SlideContent` uses flat struct on Rust side, discriminated union on TS side with converter functions
- Dynamic `WebviewWindowBuilder` for projector: hidden → position → sleep(150ms) → show → fullscreen
- `useRouterState` to detect current pathname in `__root.tsx` for bare rendering

---

## Phase 2 — Audio Playback & Synchronization (SPEC 03)

**Status:** COMPLETE

Rodio audio engine, playback controls, audio-slide synchronization with sync point editor.

### What was done

#### Rust Backend
- **rodio 0.19** dependency added
- `AudioPlayer` struct: `Sink`, `OutputStream`, `OutputStreamHandle`, play/pause/resume/stop/seek/set_volume/position_ms/duration_ms/is_playing/is_paused
  - `unsafe impl Send + Sync` for `AudioPlayer` (required by Tauri `State`; cpal `OutputStream` is not Send/Sync, but access is protected by `Mutex`)
  - Duration read via `rodio::Source::total_duration()` from a separate `Decoder` instance
- `SyncTimeline` struct: sorted `Vec<SyncPoint>`, methods `slide_at(position_ms)`, `add_point`, `remove_point`, `update_point`, `to_vec`
- `SyncPoint` struct: `slide_index: usize`, `timestamp_ms: u64` with `#[serde(rename_all = "camelCase")]`
- `AudioState`: `player: Mutex<AudioPlayer>`, `sync_timeline: Mutex<Option<SyncTimeline>>`
- **DB migration v2**: `audio_sync_points` table (hymn_id, slide_index, timestamp_ms) + index
- **Sync point queries**: `get_sync_points(conn, hymn_id)`, `save_sync_points(conn, hymn_id, points)` (DELETE + INSERT)
- **10 Tauri commands**: `audio_play`, `audio_pause`, `audio_resume`, `audio_stop`, `audio_seek`, `audio_set_volume`, `audio_get_position`, `audio_get_status`, `get_sync_points`, `save_sync_points`
- `AudioStatusPayload` with `#[serde(rename_all = "camelCase")]` for TS compatibility

#### Frontend
- **Types**: `SyncPoint`, `PlaybackMode` (`sung`/`karaoke`/`silent`), `AudioStatusPayload`
- **Tauri wrappers**: `audioPlay`, `audioPause`, `audioResume`, `audioStop`, `audioSeek`, `audioSetVolume`, `audioGetPosition`, `audioGetStatus`, `getSyncPoints`, `saveSyncPoints`
- **TanStack Query**: `useSyncPoints(hymnId)` query, `useSaveSyncPoints()` mutation with cache invalidation
- **Audio store** (enhanced): playback mode, sync points, 100ms polling interval calling `audioGetStatus()`, auto-slide-advance (crosses sync point → `usePresentationStore.setActiveSlideIndex`), auto-stop on playback end
- **`useAudio` hook**: wraps store + Tauri commands, exposes `play`, `pause`, `resume`, `stop`, `seek`, `setVolume`, `togglePlayPause`, state getters
- **`AudioControls` component**: play/pause button, stop button, progress slider (Radix Slider), volume slider with mute toggle, time display (mm:ss), playback mode selector (sung/karaoke/silent)
- **`AudioSyncEditor` component**: progress bar with sync point markers, record mode (tap to mark timestamps per slide), edit mode (drag sliders or remove), clear all, save/discard controls
- **i18n**: `audio.*` keys in en/pt/es (play, pause, stop, resume, volume, mute, unmute, progress, sung, karaoke, silent, syncEditor, record, preview, clearAll, save, discard)
- **Route integration**: `hymnal/$hymnId.tsx` now renders `AudioControls` when `hymn.audio_path` exists, with optional `AudioSyncEditor` toggle

### Key patterns established
- `rodio::OutputStream` is not Send/Sync — wrap with `unsafe impl Send/Sync` + `Mutex`
- `#[serde(rename_all = "camelCase")]` on Rust structs returned to TS frontend
- Import `rodio::Source` trait to access `total_duration()` on `Decoder`
- Frontend polling (100ms interval) for audio status instead of Tauri events

---

## Phase 3 — Presentation Editor & .slja Archive (SPEC 04)

**Status:** COMPLETE

Slide editor with drag-and-drop, custom .slja archive format, .pptx import support, background picker, aspect ratio selection.

### What was done

#### Rust Backend
- **zip 2.1** dependency for .slja (ZIP-based) archive read/write
- **quick-xml 0.36** dependency for .pptx XML parsing
- **tempfile 3** dependency for archive operations
- **tauri-plugin-dialog** for native file open/save dialogs
- **Archive module** (`archive/mod.rs`): `read_slja()`, `write_slja()`, `import_presentation()` (auto-detects .slja vs .pptx)
- **PPTX parser** (`archive/pptx.rs`): reads .pptx ZIP files, extracts slide text from XML (handles namespaced `a:t` tags), extracts media files
- **Manifest** (`archive/manifest.rs`): `Manifest` struct with `from_json()`/`to_json()`, fields: title, author, aspect_ratio, slide_count, created_at, updated_at
- **DB queries** (`db/queries/slides.rs`): full CRUD for presentations and slides — get_presentations, get_presentation_by_id, insert/update/delete_presentation, get_slides, insert/update/delete_slide, update_slide_orders
- **Slide commands** (`commands/slides.rs`): 12 Tauri commands replacing stubs — get_presentations, get_presentation, create_presentation, update_presentation, delete_presentation, get_slides, create_slide, update_slide, delete_slide, reorder_slides, import_slja, export_slja

#### Frontend
- **Types**: `SlideRow` interface (raw DB row with string content), `parseSlideRow()` converter
- **Tauri wrappers**: 12 typed invoke functions for all presentation/slide CRUD + import/export
- **TanStack Query hooks**: `usePresentations`, `usePresentation`, `useSlides`, mutations for create/update/delete/reorder/import/export with cache invalidation
- **`usePresentation2` hook**: loads presentation + slides by ID, provides slide CRUD actions (add, delete, duplicate, reorder, update content), debounced auto-save (1s), active slide tracking
- **Slide components**:
  - `SlideEditor`: type selector (cover/lyrics/pause/text/image), type-specific form fields, live preview via `SlideRenderer`
  - `SlideList` (updated): `@dnd-kit/sortable` drag-and-drop reordering, add/duplicate/delete buttons on hover, grip handle
  - `BackgroundPicker`: tabs for solid/image/gradient, preset color grid, custom color picker, 9-position grid, opacity slider
  - `AspectRatioSelector`: visual ratio cards (16:9, 4:3, free)
  - `TransitionSelector`: type dropdown (none/fade/slide variants), duration slider (100-2000ms)
- **Routes**:
  - `presentations/route.tsx`: layout with `<Outlet />`
  - `presentations/index.tsx`: presentation list with grid cards, search/filter, create new, import .slja/.pptx, export/delete context menu
  - `presentations/$presentationId.tsx`: 3-panel editor (slide list | slide editor | properties panel), toolbar with title editing, export, preview
- **Dependencies**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@tauri-apps/plugin-dialog`
- **i18n**: `presentations.*` keys in en/pt/es (40+ keys for all UI labels)

### Key patterns established
- `SlideRow` → `Slide` conversion via `parseSlideRow()` (content JSON string → parsed discriminated union)
- Archive format auto-detection by file extension (.slja vs .pptx)
- Debounced auto-save in presentation hook (1s after last content change)
- `@dnd-kit` sortable with per-item grip handle and action overlays

---

## Phase 4 — Bible Module (SPEC 05)

**Status:** COMPLETE

Bible text display with multi-version support, book/chapter/verse navigation, full-text search with FTS5, multi-version comparison.

### What was done

#### Rust Backend
- **DB migration v3**: Seeded sample ARA (Almeida Revista e Atualizada) version with Genesis 1–3 (~80 verses)
- **DB models**: `BibleVersion`, `Book`, `Verse`, `BibleSearchResult` structs with `#[serde(rename_all = "camelCase")]`; `BOOK_NAMES_PT`/`BOOK_NAMES_EN` constants
- **DB queries** (`db/queries/bible.rs`): `get_versions`, `get_books`, `get_verses`, `get_verse_range`, `search_bible_text` (FTS5 with LIKE fallback), `get_chapter_count`, `import_bible_version` (bulk insert + FTS rebuild)
- **7 Tauri commands**: `get_bible_versions`, `get_books`, `get_verses`, `get_verse_range`, `search_bible`, `project_bible_verse`, `import_bible_version`
- **`get_current_slide`** command added for projector window to fetch current slide on mount (fixes race condition)
- **Projector state sync**: `open_projector_window` and `close_projector_window` emit `"projector-state-changed"` event so frontend Zustand store stays in sync
- **HiDPI fix**: Projector window now uses logical pixels (physical / scale_factor) for correct sizing on Retina displays
- **No OS fullscreen**: Projector uses decorationless full-size window instead of `set_fullscreen(true)`, so ESC is not intercepted by macOS

#### Frontend
- **Types** (`types/bible.ts`): `BibleVersion`, `Book`, `Verse`, `BibleSearchResult` with camelCase fields
- **Tauri wrappers** (`lib/tauri.ts`): `getBibleVersions`, `getBooks`, `getVerses`, `getVerseRange`, `searchBible`, `projectBibleVerse`, `importBibleVersion`, `getCurrentSlide`
- **TanStack Query hooks** (`lib/queries.ts`): `useBibleVersions`, `useBooks`, `useVerses`, `useBibleSearch`, `useImportBible`
- **`useBible` hook** (`hooks/use-bible.ts`): Navigation state (version/book/chapter/verse selection), `projectSelectedVerses` (opens projector + sends slide via `setCurrentSlide`), `projectVerse` (single verse on double-click), `lastSelectedVerse` for scroll-to-verse
- **`useMonitorsControl` hook** (updated): Listens for `"projector-state-changed"` events to keep Zustand store in sync
- **`ProjectorView`** (updated): Fetches `getCurrentSlide()` on mount (race condition fix), ESC calls `closeProjectorWindow()` command
- **Bible components**:
  - `BookSelector`: Periodic-table layout (6×11 grid, 66 books, 10 color-coded categories), chapter number grid, verse number grid with selection highlighting, double-click to project
  - `VerseDisplay`: Paragraph-style verses with click-to-select, scroll-to-verse via refs, sticky header with opaque `bg-surface`, project button, double-click to project single verse
  - `BibleSearch`: Instant book name/abbreviation matching (accent-insensitive), reference parsing ("Gn 1:3"), debounced FTS text search (300ms), grouped results dropdown with `bg-surface`/`shadow-2xl`/`z-50`
  - `VersionComparison`: Side-by-side verse comparison across installed versions
- **Routes**: `bible/route.tsx` (layout), `bible/index.tsx` (two-panel: left verses + right periodic table/chapters/verses)
- **Keyboard navigation**: Arrow Right/Left (chapters, wraps across books), Arrow Down/Up (verse selection), Enter (project), ESC (close projector)
- **Slide renderer** (updated): Bible slide type with serif font, reference header, newline-separated verses with spacing
- **i18n**: `bible.*` keys in all 3 locale files (versions, books, chapters, verses, searchPlaceholder, noResults, loading, project, selectBook, selectChapter, comparison, etc.)

### Key patterns established
- Projector state sync via Rust events (`"projector-state-changed"`) instead of relying only on frontend state
- `getCurrentSlide()` on projector mount to handle race condition when slide is set before projector finishes loading
- Logical pixel conversion for HiDPI: `physical_size / scale_factor` for Tauri window positioning
- No OS fullscreen: decorationless full-size window avoids ESC interception on macOS
- Multi-strategy search: local book matching (instant) → reference parsing (instant) → debounced FTS5 + LIKE fallback (300ms)
- Double-click to project pattern: single click selects, double-click projects immediately

---

## Phase 5 — Worship Service / Liturgy Manager (SPEC 06)

**Status:** COMPLETE

Worship service editor with drag-and-drop item management, service timeline, "Add to Service" integration across modules.

---

## Phase 6 — Multi-Monitor Display System (SPEC 07)

**Status:** COMPLETE

Full multi-monitor support with operator, projector, and return monitor views. Monitor detection, configuration, and black/logo screen controls.

---

## Phase 7 — HTTP Streaming Server (SPEC 08)

**Status:** COMPLETE

Embedded Rust HTTP server (`std::net::TcpListener`) with Server-Sent Events (SSE), QR code generation, streaming controls UI.

---

## Phase 8 — Video & Multimedia (SPEC 09)

**Status:** COMPLETE

Delivered:
- Video slide model expanded (`videoPath`, autoplay/loop/muted, fullscreen/background mode, overlay text options)
- New backend video commands: `copy_video_to_media`, `get_video_metadata`, `resolve_media_path`
- Native metadata parsing for MP4/WebM with optional ffprobe fallback (Settings-controlled)
- Editor integration with `video-player`, `video-slide`, and `video-picker` components
- Projector/return rendering paths updated with video-aware render modes and non-autoplay next preview
- `.slja` import/export updated to include and remap media assets for video slides
- i18n keys added for EN/PT/ES video and ffprobe settings UI

Verification:
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit` passed
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml` passed
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build` passed
- MP4 metadata parsing hardened to avoid blocking import when duration atoms are missing/atypical

---

## Phase 9 — Utilities & Polish (SPEC 10)

**Status:** COMPLETE

Delivered:
- Utilities module completed with functional timer, clock, lottery, and text formatter routes under `src/routes/utilities/`.
- Projection lifecycle for utilities implemented with explicit project/clear behavior and previous slide/context restoration:
  - `src/hooks/use-utility-projection.ts`
  - utility projection payload contracts in `src/types/utilities.ts`
- New reusable utility components delivered:
  - `src/components/utilities/timer-display.tsx`
  - `src/components/utilities/clock-display.tsx`
  - `src/components/utilities/lottery-animation.tsx`
  - `src/components/utilities/keyboard-shortcuts-panel.tsx`
- Command palette expanded with utility routes and global actions (projector/return/overlay/projection clearing/shortcuts).
- Keyboard shortcuts help panel wired to `Cmd+/` / `Ctrl+/`.
- Status bar now includes compact timer status indicator and direct timer utility access.
- Localization expanded (EN/PT/ES) for utility projection controls, command palette actions, and shortcut panel content.

Verification:
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit` passed
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml` passed
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build` passed

Notes:
- Runtime smoke matrix is documented in `docs/phase-09-utilities-polish/SPECS.md` and should be executed on a local interactive run as final service-flow confirmation.

---

## Phase 10 — Migration Tools & Deployment (SPEC 11)

**Status:** COMPLETE

First-run onboarding wizard, data migration from legacy SQLite, updater contract, and deployment/release baseline.

Planning docs created:
- `docs/phase-10-migration-tools-deployment/PRD.md`
- `docs/phase-10-migration-tools-deployment/SPECS.md`
- `docs/phase-10-migration-tools-deployment/TASKS.md`

Implementation baseline delivered:
- Backend migration module and commands: `start_migration`, `get_migration_progress`, `cancel_migration`, `get_migration_report`
- Migration run state tracking with run-id, progress events (`migration-progress`), cancellation flag, and final report persistence keys
- Frontend migration contracts and wrappers in `src/types/migration.ts` and `src/lib/tauri.ts`
- First-run onboarding route tree under `src/routes/onboarding/*` with welcome/import/monitors/complete steps
- Root first-run gate redirecting non-onboarded users to `/onboarding/welcome`
- Help route and guided tour baseline (`src/routes/help/route.tsx`, `src/components/help/guided-tour.tsx`)
- Updater command contract + frontend notification component baseline
- Release baseline assets: `.github/workflows/release.yml`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/MIGRATION_GUIDE.md`, `docs/USER_GUIDE.md`

Validation status:
- Static checks green (`tsc`, `cargo check`, `vite build`)
- Runtime smoke evidence logged in `docs/phase-10-migration-tools-deployment/SMOKE-2026-02-17.md`
- Phase closure details recorded in `docs/phase-10-migration-tools-deployment/HANDOFF.md`

---

## Phase 11 — Hymn CRUD + Collections + Hybrid Cache Covers (SPEC 12)

**Status:** IN PROGRESS

Planning docs created:
- `docs/phase-11-hymn-crud-collections/PRD.md`
- `docs/phase-11-hymn-crud-collections/SPECS.md`
- `docs/phase-11-hymn-crud-collections/TASKS.md`

Current implementation focus:
- real hymn CRUD persistence with validation.
- collections domain (`Hybrid cache`) with source metadata and resync.
- cover upload + fallback rendering for hymns and collections.
- settings toggle for `collections.autoCheckSourceOnOpen`.
- docs normalization task to keep phase decisions in `docs/phase-*`.

Handoff path:
- `docs/phase-11-hymn-crud-collections/HANDOFF.md`
