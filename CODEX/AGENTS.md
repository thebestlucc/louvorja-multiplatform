# AGENTS.md

This file provides guidance to Codex when working with code in this repository.
CODEX_MAX_OUTPUT_TOKENS=20000

## LouvorJA Multiplatform

## Project Overview

Church worship desktop app migrating from Delphi to **Tauri 2 + React 19 + Rust**.
10-phase roadmap in `.specs/` directory (01–11). PRD at `PRD.md`.

**Phases 0–6 are COMPLETE.** Phase 7+ is pending.

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
│   ├── display/              # projector-controls
│   ├── layout/               # sidebar, header, status-bar
│   ├── music/                # hymn-search, hymn-card, album-card, lyrics-display,
│   │                         # audio-controls, audio-sync-editor
│   ├── services/             # service-item-list, service-timeline, add-item-modal
│   ├── slides/               # slide-renderer, slide-thumbnail, slide-list, slide-editor,
│   │                         # projector-view, background-picker, aspect-ratio-selector,
│   │                         # transition-selector
│   ├── streaming/            # streaming preview panels, SSE event handlers
│   └── ui/                   # Radix-based primitives (button, card, badge, input, etc.)
├── hooks/                    # use-slides, use-keyboard, use-monitors, use-audio, use-presentation, use-service
├── lib/
│   ├── tauri.ts              # Typed `invoke()` wrappers — one function per Tauri command
│   ├── queries.ts            # TanStack Query hooks (useQuery/useMutation wrappers)
│   └── utils.ts              # cn() helper
├── locales/                  # en.json, pt.json, es.json
├── routes/                   # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (sidebar + header + bare routes for /projector, /return)
│   ├── index.tsx             # Dashboard home
│   ├── hymnal/               # route.tsx, index.tsx, $hymnId.tsx
│   ├── presentations/        # route.tsx, index.tsx, $presentationId.tsx
│   └── services/             # route.tsx, index.tsx, $serviceId.tsx
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

9. **Conditional hooks in root layout:** Never call hooks after an early `return` in a component. For bare routes (e.g., `/projector`, `/return`), pass `{ enabled: false }` to hooks instead:
   ```ts
   const isBareRoute = BARE_ROUTES.includes(pathname);
   useKeyboard({ enabled: !isBareRoute }); // always called, conditionally active
   if (isBareRoute) return <Outlet />;
   ```

### General

- **i18n:** Always add keys to ALL THREE locale files (`en.json`, `pt.json`, `es.json`). Missing keys render as raw key strings.
- **New Tauri commands checklist:** (1) Add query in `db/queries/*.rs`, (2) Add command in `commands/*.rs`, (3) Register in `lib.rs` handler, (4) Add wrapper in `lib/tauri.ts`, (5) Add hook in `lib/queries.ts`.
- **Projector event flow:** `setCurrentSlide` (Rust) → `app.emit("slide-changed", &slide_data)` → `ProjectorView` listens via `listen<SlideContentFlat>("slide-changed")` → converts with `flatToSlideContent`.
- **Link navigation:** Always use TanStack Router `<Link to="/path">` for internal navigation, never `<a href>` or `window.location`.
- **Cross-module "Add to X" pattern:** When a module (e.g., Bible, Hymnal) needs to add items to another module (e.g., Services), use `usePresentationStore.activeServiceId` to check if a service is active, and `useAddServiceItem()` mutation to add. Show the button conditionally only when `activeServiceId` is set. See `hymn-card.tsx` and `verse-display.tsx` for reference.
- **Color-coded type maps:** When items have types (e.g., `ServiceItemType`), define parallel `Record<Type, string>` maps for icons, text colors, border colors, and bg colors. Keep them co-located in the component that uses them (e.g., `service-item-list.tsx`).
- **Tab switcher in panels:** For right-side panels with multiple views, use a simple state toggle (`useState<"tab1" | "tab2">`) with inline tab buttons styled via `cn()` + conditional `border-b-2 border-primary`. No need for a full tabs library.
- **Service item projection:** Items project to the projector via `setCurrentSlide()` with `SlideContentFlat`. Each item type maps to a slide_type: hymn→lyrics, bible→bible, annotation/url/file→text. Always check `isProjectorOpen` and call `toggleProjector()` first if closed.
- **Play Service mode:** Uses `isPlayingService` + `activeServiceItemIndex` in the presentation store. Toolbar shows prev/next/stop controls. The `useEffect` on `activeServiceItemIndex` auto-projects the current item. Stop resets index to -1.
- **Inline editing in lists:** Use local `useState` + `useRef` for focus management. Show save/cancel buttons (Check/X icons). Commit via `onEditItem` callback. Escape cancels, Enter saves.
- **Multi-monitor pattern:** `open_fullscreen_window()` helper in `display.rs` for reusable fullscreen window creation. `useMonitorsControl()` hook exposes projector, return, and overlay controls. Status bar uses `<ProjectorControls />` with icon buttons + green/gray status dots.
- **Overlay state:** Black/logo screen overlays managed in Rust state, synced via `"overlay-changed"` events. Projector view renders overlay layers with CSS fade transitions. Overlays are mutually exclusive (activating one deactivates the other).
- **Return monitor:** Two-panel layout (70/30 split) showing current + next slide. Context data (next slide, index, total, title) sent via `setSlideContext()` alongside `setCurrentSlide()`, wrapped in `projectSlideWithContext()` helper in `use-slides.ts`.
- **Keyboard shortcuts:** B=black screen, L=logo screen, F5=projector, Shift+F5=return monitor, Escape=clear projection.
- **Hymn projection gating:** The hymn detail page uses `isProjecting` boolean state to gate stanza/thumbnail clicks. When false, clicks only update `localActiveIndex` (UI highlight). When true, clicks call `goToSlide()` → projector/return/streaming. "Project" button starts, "Stop" button calls `clearCurrentSlide()`. See `$hymnId.tsx`.
- **Global search in command palette:** The `CommandPalette` uses `shouldFilter={!hasQuery}` on `Command.Dialog` to disable cmdk's built-in filter when the user types a search query. Dynamic results from `searchHymns()` and `searchBible()` are fetched with 300ms debounce, shown in `Command.Group` sections. No TanStack Query caching — transient UI uses direct `await` calls.
- **Streaming SSE pattern:** Use raw `std::net::TcpListener` with `TcpStream::write_all()` + `flush()` for SSE — never use buffered HTTP libraries (like tiny_http) for SSE as they buffer small writes. Set `TCP_NODELAY` on connections.
- **Streaming clear pattern:** When clearing slides, all 3 SSE channels (music/bible/return) must receive empty payloads. HTML templates must handle `null`/empty values explicitly (show "Waiting for content" state).

## Phase Status

| Phase | Spec | Status |
|-------|------|--------|
| 0 | Foundation (01) | COMPLETE |
| 1 | Music & Lyrics (02) | COMPLETE |
| 2 | Audio Playback (03) | COMPLETE |
| 3 | Presentation Editor (04) | COMPLETE |
| 4 | Bible (05) | COMPLETE |
| 5 | Liturgy/Services (06) | COMPLETE |
| 6 | Multi-Monitor (07) | COMPLETE |
| 7 | Streaming (08) | IN PROGRESS |
| 8 | Video/Multimedia (09) | Pending |
| 9 | Utilities & Polish (10) | Pending |
| 10 | Migration & Deploy (11) | Pending |

## Self-Improvement Protocol

After completing any task (feature, bugfix, refactor), Codex MUST:

1. **Update phase status** in the table above if a phase was completed or progressed.
2. **Update project structure** if new directories, components, or route groups were added.
3. **Record new patterns** in the "General" section above if a reusable pattern was established (e.g., cross-module integration, new UI pattern, new data flow).
4. **Record new errors to avoid** if a non-obvious bug was encountered and solved during implementation.
5. **Update memory files** (`~/.codex/projects/.../memory/MEMORY.md`) with session-specific learnings that don't belong in AGENTS.md.
6. **Keep AGENTS.md concise** — don't duplicate information, remove outdated notes, prefer terse bullet points over verbose explanations.

The goal: every session should leave the project in a better-documented state than it started, so future sessions (even with a fresh context) can onboard instantly.
