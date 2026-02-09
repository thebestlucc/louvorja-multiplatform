# LouvorJA Multiplatform — Implementation Progress

> Tracking the migration from Delphi to Tauri 2 + React 19 + Rust.
> Total estimated effort: 25–27 weeks across 11 phases.

---

## Overview

| Phase | Spec | Name | Status |
|:-----:|:----:|------|:------:|
| 0 | 01 | Foundation | COMPLETE |
| 1 | 02 | Music & Lyrics Core | COMPLETE |
| 2 | 03 | Audio Playback & Synchronization | COMPLETE |
| 3 | 04 | Presentation Editor & .slja Archive | Pending |
| 4 | 05 | Bible Module | Pending |
| 5 | 06 | Worship Service / Liturgy Manager | Pending |
| 6 | 07 | Multi-Monitor Display System | Pending |
| 7 | 08 | HTTP Streaming Server | Pending |
| 8 | 09 | Video & Multimedia | Pending |
| 9 | 10 | Utilities & Polish | Pending |
| 10 | 11 | Migration Tools & Deployment | Pending |

**Progress: 3 / 11 phases complete**

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

**Status:** Pending

Slide editor with drag-and-drop, custom .slja archive format, background picker, aspect ratio selection.

---

## Phase 4 — Bible Module (SPEC 05)

**Status:** Pending

Bible text display with multi-version support, book/chapter/verse navigation, full-text search with FTS5, multi-version comparison.

---

## Phase 5 — Worship Service / Liturgy Manager (SPEC 06)

**Status:** Pending

Worship service editor with drag-and-drop item management, service timeline, "Add to Service" integration across modules.

---

## Phase 6 — Multi-Monitor Display System (SPEC 07)

**Status:** Pending

Full multi-monitor support with operator, projector, and return monitor views. Monitor detection, configuration, and black/logo screen controls.

---

## Phase 7 — HTTP Streaming Server (SPEC 08)

**Status:** Pending

Embedded Rust HTTP server (tiny_http) with Server-Sent Events (SSE), QR code generation, streaming controls UI.

---

## Phase 8 — Video & Multimedia (SPEC 09)

**Status:** Pending

HTML5 video player, video slide support, video file validation, and format guidance.

---

## Phase 9 — Utilities & Polish (SPEC 10)

**Status:** Pending

Timer/chronometer utility, lottery/randomizer, clock display, command palette completion, 5 theme variants polish.

---

## Phase 10 — Migration Tools & Deployment (SPEC 11)

**Status:** Pending

First-run onboarding wizard, data migration from Delphi version (.ljd files), auto-updater integration, deployment configuration.
