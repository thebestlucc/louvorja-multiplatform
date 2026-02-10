# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## LouvorJA Multiplatform

## Project Overview

Church worship desktop app migrating from Delphi to **Tauri 2 + React 19 + Rust**.
10-phase roadmap in `.specs/` directory (01–11). PRD at `PRD.md`.

**Phases 0–3 are COMPLETE.** Phase 4+ is pending.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4 |
| Routing | TanStack Router (file-based, Vite plugin) |
| Server state | TanStack Query |
| Client state | Zustand |
| UI | Radix UI primitives, class-variance-authority (CVA), cmdk, sonner |
| i18n | i18next (3 locales: `en.json`, `pt.json`, `es.json`) |
| Backend | Tauri 2.9.4, Rust, rusqlite (bundled), thiserror, chrono, uuid |
| Archive | zip 2.1 (.slja), quick-xml 0.36 (.pptx import) |
| Audio | rodio 0.19 |
| DnD | @dnd-kit/core + sortable + utilities |

## Commands

```bash
# Package manager — ALWAYS use pnpm, NEVER npm
pnpm install              # install deps
pnpm add <pkg>            # add frontend dep
pnpm tauri add <plugin>   # add Tauri plugin (auto-registers in Cargo + permissions + init)

# Build & check
pnpm vite build           # frontend build (also regenerates routeTree.gen.ts)
npx tsc --noEmit          # TypeScript check only
cargo build --manifest-path src-tauri/Cargo.toml  # Rust build only
pnpm tauri dev             # full dev mode (frontend + Rust)

# IMPORTANT: After adding new TanStack Router routes, run `pnpm vite build`
# BEFORE `npx tsc --noEmit` — the Vite plugin generates routeTree.gen.ts
# and tsc will fail on stale route types otherwise.
```

## Project Structure

```
src/                          # Frontend (React)
├── components/
│   ├── layout/               # sidebar, header, status-bar
│   ├── music/                # hymn-search, hymn-card, album-card, lyrics-display,
│   │                         # audio-controls, audio-sync-editor
│   ├── slides/               # slide-renderer, slide-thumbnail, slide-list, slide-editor,
│   │                         # projector-view, background-picker, aspect-ratio-selector,
│   │                         # transition-selector
│   └── ui/                   # Radix-based primitives (button, card, badge, input, etc.)
├── hooks/                    # use-slides, use-keyboard, use-monitors, use-audio, use-presentation
├── lib/
│   ├── tauri.ts              # Typed `invoke()` wrappers — one function per Tauri command
│   ├── queries.ts            # TanStack Query hooks (useQuery/useMutation wrappers)
│   └── utils.ts              # cn() helper
├── locales/                  # en.json, pt.json, es.json
├── routes/                   # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (sidebar + header + bare routes for /projector, /return)
│   ├── index.tsx             # Dashboard home
│   ├── hymnal/               # route.tsx, index.tsx, $hymnId.tsx
│   └── presentations/        # route.tsx, index.tsx, $presentationId.tsx
├── stores/                   # Zustand stores (presentation-store, display-store, audio-store, ui-store)
└── types/                    # TypeScript type definitions

src-tauri/src/                # Backend (Rust)
├── lib.rs                    # Tauri setup, command registration, plugin init
├── state.rs                  # AppState (db, current_slide, projector_open), AudioState
├── error.rs                  # AppError enum (Database, Io, SerdeJson, NotFound, Internal, Tauri)
├── commands/                 # Tauri command handlers (one module per domain)
│   ├── music.rs, display.rs, slides.rs, audio.rs, bible.rs, liturgy.rs, ...
├── db/
│   ├── migrations.rs         # Schema versioning (schema_version table, migrate_v1/v2/v3)
│   ├── models.rs             # All data structs (Hymn, Album, Presentation, Slide, SlideContent, etc.)
│   └── queries/              # DB query functions (one module per domain)
│       ├── music.rs, slides.rs, bible.rs, liturgy.rs, settings.rs
├── archive/                  # .slja read/write + .pptx import
│   ├── mod.rs, manifest.rs, pptx.rs
├── audio/                    # rodio player, sync timeline
└── display/, streaming/      # Stubs for future phases
```

## Architecture Patterns

### Rust Side

- **Error handling:** All functions return `Result<T, AppError>`. Stubs use `Err(AppError::Internal("Not implemented".into()))` — never `todo!()` (panics crash the app).
- **Commands:** Each `#[tauri::command]` takes `state: tauri::State<'_, AppState>`, locks `state.db` mutex, delegates to `db::queries::*`.
- **Imports:** `use tauri::Manager;` for `app.path()`, `app.manage()`, `app.get_webview_window()`. `use tauri::Emitter;` for `app.emit()`.
- **Serde:** Use `#[serde(rename_all = "camelCase")]` on structs returned to frontend for consistent JS naming.
- **SlideContent model:** Flat struct on Rust side (slide_type + optional fields). Discriminated union on TS side with converter functions (`slideContentToFlat` / `flatToSlideContent`).
- **DB migrations:** Versioned in `migrations.rs`. Each version checks `schema_version` table. New tables/columns go in `migrate_vN`.
- **Projector window:** Built dynamically with `WebviewWindowBuilder`: hidden → position → sleep(150ms) → show → fullscreen.

### Frontend Side

- **Tauri wrappers** (`lib/tauri.ts`): One typed async function per command. `invoke<ReturnType>("command_name", { args })`.
- **Query hooks** (`lib/queries.ts`): `useQuery` for reads (with `queryKey` arrays), `useMutation` with `onSuccess` → `queryClient.invalidateQueries`.
- **Components:** Use CVA pattern with exported `*Variants` functions for style variants (see Button, Badge).
- **Styling:** Tailwind v4 with `@theme` directive for custom tokens. CSS custom properties for 5 themes (azure/white/gray/orange/black). Use `var(--token)` to consume.
- **Routes:** File-based via TanStack Router Vite plugin. Directory-based for nested routes (e.g., `hymnal/route.tsx` + `hymnal/index.tsx` + `hymnal/$hymnId.tsx`).
- **Zustand stores:** Client-only UI state. `usePresentationStore` for slide projection state, `useDisplayStore` for monitor/window state, `useUIStore` for sidebar, `useAudioStore` for playback polling.

## Common Errors to Avoid

### Rust

1. **quick-xml temporary lifetime:** `e.name().as_ref()` fails — `.name()` returns a temporary. Always bind first:
   ```rust
   let name = e.name();
   let name_ref = name.as_ref();
   ```

2. **rodio OutputStream not Send/Sync:** Wrap `AudioPlayer` with `unsafe impl Send for AudioPlayer {}` + `unsafe impl Sync for AudioPlayer {}` and protect with `Mutex`.

3. **rodio Source trait:** Import `use rodio::Source;` to access `.total_duration()` on `Decoder`.

4. **Tauri command registration:** Every new `#[tauri::command]` must be added to the `.invoke_handler(tauri::generate_handler![...])` in `lib.rs`.

5. **Tauri plugin registration:** Use `pnpm tauri add <plugin>` — it adds Cargo dep, permissions config, AND `app.plugin(tauri_plugin_*::init())` automatically.

### TypeScript / React

1. **React 19 useRef:** Requires explicit initial value. Use `useRef<T>(undefined)` not `useRef<T>()`.

2. **TanStack Router route generation:** After adding/renaming route files, run `pnpm vite build` before `npx tsc --noEmit`. The Vite plugin generates `routeTree.gen.ts` — stale types cause TS errors.

3. **Converting flat route to directory route:** Delete the `.tsx` file, create `route.tsx` (layout with `<Outlet />`) + `index.tsx` (list page) + `$paramId.tsx` (detail page).

4. **Unused destructured variables in mutations:** Instead of `mutationFn: ({ id, contentJson, presentationId })` where `presentationId` is only needed for invalidation, use a single `vars` parameter:
   ```ts
   mutationFn: (vars) => updateSlide(vars.id, vars.contentJson),
   onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["slides", vars.presentationId] }),
   ```

5. **Stale closures in Zustand + setTimeout/useCallback:** When a callback captures Zustand state and is used after an async delay (e.g., `setTimeout`), the captured state is stale. Use `usePresentationStore.getState()` inside the callback for fresh reads:
   ```ts
   const goToSlide = useCallback(async (index: number) => {
     const state = usePresentationStore.getState();  // fresh!
     if (index >= 0 && index < state.slides.length) {
       state.setActiveSlideIndex(index);
       await projectSlide(state.slides[index]);
     }
   }, [projectSlide]);
   ```

6. **Dead key / IME composition (ç, ñ, accents on Mac):** When an input's value is bound to server-refetched data, a refetch mid-composition breaks the dead key sequence. Fix: use local state with a dirty ref that prevents server sync while typing:
   ```ts
   const [localValue, setLocalValue] = useState("");
   const dirtyRef = useRef(false);
   useEffect(() => {
     if (serverData && !dirtyRef.current) setLocalValue(serverData.value);
   }, [serverData]);
   const handleChange = (val: string) => {
     setLocalValue(val);
     dirtyRef.current = true;
     // debounced save, then dirtyRef.current = false
   };
   ```

7. **Optimistic local state pattern:** For responsive typing in editors, don't bind inputs directly to TanStack Query data. Use a local `Record<id, EditedValue>` state merged with server data, with per-item debounced saves. See `use-presentation.ts` for the reference implementation.

8. **Package manager:** This project uses **pnpm**. Running `npm install` will fail or create conflicts.

### General

- **i18n:** Always add keys to ALL THREE locale files (`en.json`, `pt.json`, `es.json`). Missing keys render as raw key strings.
- **New Tauri commands checklist:** (1) Add query in `db/queries/*.rs`, (2) Add command in `commands/*.rs`, (3) Register in `lib.rs` handler, (4) Add wrapper in `lib/tauri.ts`, (5) Add hook in `lib/queries.ts`.
- **Projector event flow:** `setCurrentSlide` (Rust) → `app.emit("slide-changed", &slide_data)` → `ProjectorView` listens via `listen<SlideContentFlat>("slide-changed")` → converts with `flatToSlideContent`.
- **Link navigation:** Always use TanStack Router `<Link to="/path">` for internal navigation, never `<a href>` or `window.location`.

## Phase Status

| Phase | Spec | Status |
|-------|------|--------|
| 0 | Foundation (01) | COMPLETE |
| 1 | Music & Lyrics (02) | COMPLETE |
| 2 | Audio Playback (03) | COMPLETE |
| 3 | Presentation Editor (04) | COMPLETE |
| 4 | Bible (05) | Pending |
| 5 | Liturgy/Services (06) | Pending |
| 6 | Multi-Monitor (07) | Pending |
| 7 | Streaming (08) | Pending |
| 8 | Video/Multimedia (09) | Pending |
| 9 | Utilities & Polish (10) | Pending |
| 10 | Migration & Deploy (11) | Pending |
