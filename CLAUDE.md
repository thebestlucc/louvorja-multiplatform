# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
CLAUDE_CODE_MAX_OUTPUT_TOKENS=20000

- When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.

---

## Design System Rules

### Component Organization

- **UI primitives** are in `src/components/ui/` — always check here first before creating new components
- **Feature components** are in `src/components/{domain}/` (e.g., `music/`, `slides/`, `services/`, `display/`, `streaming/`)
- **Layout components** (Sidebar, Header, StatusBar) are in `src/components/layout/`
- **File naming**: kebab-case (`dropdown-menu.tsx`), **export names**: PascalCase (`DropdownMenu`)
- **Variant objects**: exported separately as `{componentName}Variants` (e.g., `buttonVariants`, `badgeVariants`)
- **Props interfaces**: exported as `{ComponentName}Props`
- **All components must accept `className` prop** for composition via `cn()`

### Styling Rules

- **IMPORTANT**: Use Tailwind v4 utility classes — CSS-first config in `global.css` (no `tailwind.config.ts`)
- **IMPORTANT**: Never hardcode colors — always use design tokens: `bg-primary`, `text-foreground`, `border-border`, `bg-surface`, etc.
- **Color tokens** map to CSS custom properties (`var(--theme-*)`) that change per theme (azure/white/gray/orange/black)
- **Destructive color** (`text-destructive`, `bg-destructive`) is hardcoded red (`#dc2626`) — does NOT vary by theme
- **Spacing**: Use raw Tailwind scale (`p-6`, `gap-1.5`, `h-9`) — no custom spacing tokens
- **Border radius**: `rounded-sm` (4px), `rounded-md` (6px), `rounded-lg` (8px)
- **Typography**: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px); weights: `font-medium` (500), `font-semibold` (600), `font-bold` (700)
- **Font**: Inter (loaded via `@font-face` in `src/styles/fonts.css`)
- **Custom utility**: `writing-vertical-lr` available via `@utility` in `global.css`

### UI Primitives Inventory

| Component | Variants | Notes |
|-----------|----------|-------|
| `Button` | `variant`: default, outline, ghost, destructive; `size`: sm, md, lg, icon | CVA pattern |
| `Badge` | `variant`: default, secondary, outline, destructive | Simple function |
| `Input` | label?, error? | Adds `border-destructive` on error |
| `Textarea` | label?, error? | Same pattern as Input |
| `Card` | Compound: Header, Title, Description, Content, Footer | No variants |
| `Dialog` | Re-exports Radix + styled wrappers | Auto close button (X icon) |
| `DropdownMenu` | Re-exports Radix + styled wrappers | |
| `Select` | Re-exports Radix + styled wrappers | ChevronDown + Check icons |
| `Slider`, `Tabs`, `Tooltip`, `ScrollArea` | Radix wrappers | |
| `Table` | Compound: Header, Body, Row, Cell, etc. | Native HTML table |
| `Popover` | Custom (NOT Radix) — controlled, Escape/click-outside handling | |
| `HighlightedSnippet` | Renders `<mark>` HTML strings | |
| `AppToaster` | Sonner wrapper with dynamic layout | |

### Icon System

- **Library**: `lucide-react` (v0.563.0) — named imports, no icon fonts
- **IMPORTANT**: DO NOT install new icon packages — all icons come from lucide-react
- **Sizes**: `h-4 w-4` (16px) standard, `h-3 w-3` (12px) small, `h-3.5 w-3.5` (14px), `h-5 w-5` (20px)
- **Accessibility**: Decorative icons use `aria-hidden="true"`, interactive icons wrapped in buttons with `aria-label`

### Component Patterns

- **CVA Pattern** (Button, Badge): `cva("base")` + `VariantProps`, export `buttonVariants` + `ButtonProps`. See `src/components/ui/button.tsx`.
- **Radix Wrapper Pattern** (Dialog, Select, etc.): `forwardRef` + `cn("base-styles", className)` spread of props. See `src/components/ui/dialog.tsx`.
- **Input Pattern**: `forwardRef` with `label?` + `error?` props; adds `border-destructive` on error. See `src/components/ui/input.tsx`.

### Figma Implementation Flow

1. Run `get_design_context` for the node
2. Run `get_screenshot` for visual reference
3. Map Figma colors to project tokens (`primary`, `surface`, `muted-foreground`, etc.)
4. Check `src/components/ui/` for existing components before creating new ones
5. Translate Figma React output to project conventions:
   - Replace hardcoded colors with Tailwind token classes
   - Replace custom spacing with Tailwind scale
   - Use existing UI primitives from `src/components/ui/`
   - Apply CVA pattern if component needs variants
6. Validate against screenshot before completing

### Accessibility Rules

- **IMPORTANT**: All interactive elements must have `aria-label` or be properly labeled
- **IMPORTANT**: Use `aria-hidden="true"` on decorative icons
- **Color contrast**: All theme colors verified to meet WCAG AA (documented in `global.css` comments)
- **Focus rings**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` on interactive elements
- **Keyboard navigation**: All Radix primitives provide built-in keyboard support
- **Form inputs**: Must use `label` prop or explicit `<label htmlFor>` association

### State Management UI Patterns

- **Zustand stores**: Client-only UI state (12 stores in `src/stores/`)
- **Direct subscription**: `const { sidebarOpen } = useUIStore()`
- **Selector**: `const id = usePresentationStore((s) => s.activeLiturgyId)`
- **IMPORTANT**: Use `Store.getState()` inside async callbacks to avoid stale closures
- **Persistence**: Theme/language persisted to `localStorage`; UI state (sidebar, modals) is NOT persisted

### Layout Conventions

- **App shell**: Sidebar (left) + Header (top) + Content + StatusBar (bottom)
- **Sidebar**: `w-60` open / `w-14` collapsed, uses `<Link>` (TanStack Router), NOT `<a>`
- **Header**: `h-14`, command palette + date/time + theme/language controls
- **Status Bar**: `h-11`, version + projector + streaming + sync progress + slide passer indicator
- **Bare routes** (`/projector`, `/return`): Use `{ enabled: false }` pattern for hooks, return `<Outlet />` early

---

## Project Overview

Church worship desktop app migrating from Delphi to **Tauri 2 + React 19 + Rust**.
Roadmap and feature decisions are tracked in `docs/phase-*` folders (`PRD.md`, `SPECS.md`, `TASKS.md`, `HANDOFF.md`). Architecture diagram: `docs/architecture.md` (Mermaid). Architectural roadmap: `docs/plans/architectural-improvements-plan.md`.

**Phases 0–12 are COMPLETE** (including Monitor Screen Assignment). Playing Queue feature is also **COMPLETE** (all 5 tasks implemented).

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

Node ≥ 20, pnpm ≥ 10, Rust stable (≥ 1.80). Tauri 2 requires system WebView (WebKitGTK on Linux, WebView2 on Windows — macOS uses built-in WKWebView).

## Commands

```bash
# Package manager/tooling — ALWAYS use pnpm, NEVER npm or deno
pnpm install              # install deps
pnpm add <pkg>            # add frontend dep
pnpm tauri add <plugin>   # add Tauri plugin (auto-registers in Cargo + permissions + init)

# Build & check
pnpm vite build           # frontend build (also regenerates routeTree.gen.ts)
npx tsc --noEmit          # TypeScript check only
cargo build --manifest-path src-tauri/Cargo.toml  # Rust build only
pnpm tauri dev             # full dev mode (frontend + Rust); also regenerates bindings.ts via tauri-specta
pnpm test:unit            # run unit tests
pnpm lint:i18n            # validate i18n key coverage across all 3 locales

# IMPORTANT: Do not run `deno` commands in this repository.
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
│   │                         # audio-controls, audio-sync-editor, lyrics-modal
│   ├── services/             # service-item-list, service-timeline, add-item-modal
│   ├── slides/               # slide-renderer, slide-thumbnail, slide-list, slide-editor,
│   │                         # projector-view, background-picker, aspect-ratio-selector,
│   │                         # transition-selector
│   ├── online-videos/        # playlist-card, video-card, add-playlist-modal, api-key-setup,
│   │                         # playlist-picker, online-video-slide, video-follower-element,
│   │                         # persistent-video-player
│   ├── slide-passer/         # slide-passer-indicator, key-capture-dialog, test-clicker-dialog
│   ├── streaming/            # streaming preview panels, SSE event handlers
│   └── ui/                   # Radix-based primitives (button, card, badge, input, etc.)
├── hooks/                    # use-slides, use-keyboard, use-monitors, use-audio, use-presentation, use-service, use-youtube-events, use-video-source
├── lib/
│   ├── bindings.ts           # AUTO-GENERATED by tauri-specta — source of truth for IPC types (do not edit)
│   ├── tauri.ts              # Typed `invoke()` wrappers — one function per Tauri command
│   ├── queries.ts            # TanStack Query hooks (useQuery/useMutation wrappers)
│   ├── catcher.ts            # Async/sync error wrapper — use instead of try-catch
│   ├── store.ts              # Tauri plugin-store helpers (getPreference/setPreference/deletePreference)
│   ├── clipboard.ts          # copyToClipboard() wrapper for plugin-clipboard-manager
│   ├── monitor-resolution.ts # Shared helper for projector/return monitor role resolution
│   ├── update-errors.ts      # Pastoral error classifier for updater (network/disk/permission/generic)
│   ├── tauri/
│   │   └── video-server.ts   # Wrappers for start_video_server / get_video_server_status commands
│   └── utils.ts              # cn() helper
├── locales/                  # en.json, pt.json, es.json
├── routes/                   # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (sidebar + header + bare routes for /projector, /return)
│   ├── index.tsx             # Dashboard home
│   ├── hymnal/               # route.tsx, index.tsx, $hymnId.tsx
│   ├── presentations/        # route.tsx, index.tsx, $presentationId.tsx
│   ├── services/             # route.tsx, index.tsx, $serviceId.tsx
│   ├── collections/          # route.tsx (tab bar), online-videos/ (index, $playlistId)
│   └── playing-now/          # Playing now screen (slide preview + controls)
├── stores/                   # Zustand stores (presentation-store, display-store, audio-store, ui-store, queue-store, theme-store, content-sync-store)
└── types/                    # TypeScript type definitions

src-tauri/src/                # Backend (Rust)
├── lib.rs                    # Tauri setup, command registration, plugin init
├── state.rs                  # AppState (db, current_slide, projector_open, ytdlp), AudioState, YtdlpRuntimeState
├── error.rs                  # AppError enum (Database, Io, SerdeJson, NotFound, Internal, Tauri)
├── commands/                 # Tauri command handlers (one module per domain)
│   ├── music.rs, display.rs, slides.rs, audio.rs, bible.rs, liturgy.rs, youtube.rs, ...
├── db/
│   ├── migrations.rs         # Schema versioning (schema_version table, migrate_v1…v13; v13 = legacy Delphi import)
│   ├── models.rs             # All data structs (Hymn, Album, Presentation, Slide, SlideContent, etc.)
│   └── queries/              # DB query functions (one module per domain)
│       ├── music.rs, slides.rs, bible.rs, liturgy.rs, settings.rs, online_videos.rs
├── archive/                  # .slja read/write + .pptx import
│   ├── mod.rs, manifest.rs, pptx.rs
├── audio/                    # rodio player, sync timeline
├── content_sync/             # CDN manifest model (manifest.rs)
├── pack_sync/                # CDN pack download/extract (planner.rs, executor.rs)
├── display/, streaming/      # Multi-monitor display + SSE streaming server
├── youtube/                  # YouTube Data API v3 client (api.rs, parser.rs, thumbnails.rs)
├── ytdlp/                    # yt-dlp binary management + video download (binary.rs, downloader.rs)
└── video/                    # Video path + metadata parsing helpers
```

## Architecture Patterns

### Rust Side

- **Error handling:** All functions return `Result<T, AppError>`. Stubs use `Err(AppError::Internal("Not implemented".into()))` — never `todo!()` (panics crash the app).
- **Commands:** Each `#[tauri::command]` takes `state: tauri::State<'_, AppState>`, gets a connection from the `r2d2` pool (`state.db.get()?`), delegates to `db::queries::*`. Registered via `tauri_specta::collect_commands!` in `lib.rs`.
- **Database:** SQLite via rusqlite with r2d2 connection pool. WAL mode + foreign keys enabled by default via PRAGMAs in `migrations.rs`.
- **Imports:** `use tauri::Manager;` for `app.path()`, `app.manage()`, `app.get_webview_window()`. `use tauri::Emitter;` for `app.emit()`.
- **Serde:** Use `#[serde(rename_all = "camelCase")]` on structs returned to frontend for consistent JS naming.
- **SlideContent model:** Flat struct on Rust side (slide_type + optional fields). Discriminated union on TS side with converter functions (`slideContentToFlat` / `flatToSlideContent`).
- **DB migrations:** Versioned in `migrations.rs`. Each version checks `schema_version` table. New tables/columns go in `migrate_vN`.
- **Projector window:** Built dynamically with `WebviewWindowBuilder`: hidden → position → sleep(150ms) → show → fullscreen.
- **Same-process projection windows:** Projector ("projector") and return ("return") windows are created via `WebviewWindowBuilder` in the main Tauri process — NOT in separate child processes. Window creation (sleep + fullscreen retries) runs on a background thread (`std::thread::spawn`) to prevent IPC blocking on all OSes. The `open_fullscreen_window()` helper in `commands/display.rs` encapsulates this. `skip_taskbar(false)` ensures windows appear in the OS window switcher (alt+tab).

### Frontend Side

- **Typed bindings:** `src/lib/bindings.ts` is auto-generated by tauri-specta. Always import domain types (Hymn, Slide, etc.) from `@/lib/bindings` — never define manual interfaces for backend data.
- **Tauri wrappers** (`lib/tauri.ts`): Compatibility wrappers and complex multi-step IPC logic. `invoke<ReturnType>("command_name", { args })`.
- **Query hooks** (`lib/queries.ts`): `useQuery` for reads (with `queryKey` arrays), `useMutation` with `onSuccess` → `queryClient.invalidateQueries`.
- **Error handling:**
  - **Frontend:** Use `catcher.ts` to wrap async/sync operations: `const [data, err] = await catcher(promise, { notify: true })`. Use `{ notify: true }` to auto-show error toasts. Do NOT use manual try-catch. Exception: auto-generated files, Node scripts, SSE HTML templates.
  - **Rust Backend:** Use the `catcher` utilities (`src-tauri/src/utils/catcher.rs`) when you need to manually destructure a `Result` into `(data, error)` or when handling errors inside threads or closures where the `?` operator cannot be used.
- **Components:** Use CVA pattern with exported `*Variants` functions for style variants (see Button, Badge).
- **Styling:** Tailwind v4 with `@theme` directive for custom tokens. CSS custom properties for 5 themes (azure/white/gray/orange/black). Use `var(--token)` to consume.
- **Routes:** File-based via TanStack Router Vite plugin. Directory-based for nested routes (e.g., `hymnal/route.tsx` + `hymnal/index.tsx` + `hymnal/$hymnId.tsx`).
- **Zustand stores:** Client-only UI state. `usePresentationStore` for slide projection state, `useDisplayStore` for monitor/window state, `useUIStore` for sidebar, `useAudioStore` for playback polling, `useQueueStore` for playing queue, `useThemeStore` for theme/language. Stores are decoupled — use `Store.getState()` in async callbacks.

## Common Errors to Avoid

### Rust

1. **quick-xml temporary lifetime:** `e.name().as_ref()` fails — `.name()` returns a temporary. Always bind first:
   ```rust
   let name = e.name();
   let name_ref = name.as_ref();
   ```

2. **rodio OutputStream not Send/Sync:** Wrap `AudioPlayer` with `unsafe impl Send for AudioPlayer {}` + `unsafe impl Sync for AudioPlayer {}` and protect with `Mutex`.

3. **rodio Source trait:** Import `use rodio::Source;` to access `.total_duration()` on `Decoder`.

4. **Tauri command registration:** Every new `#[tauri::command]` must be added to `tauri_specta::collect_commands!` in `lib.rs` (this also regenerates `bindings.ts`). NOT `tauri::generate_handler!` — specta manages that.

5. **Tauri plugin registration:** Use `pnpm tauri add <plugin>` — it adds Cargo dep, permissions config, AND `app.plugin(tauri_plugin_*::init())` automatically.

6. **Windows IPC handler blocking:** Blocking ops (`sleep`, I/O) in `#[tauri::command]` hang the entire IPC bridge on Windows. **All long-running operations must `std::thread::spawn`** and return `Ok(())` immediately. See `commands/display.rs` `open_projector_window` for the pattern.

7. **`skip_taskbar(true)` hides from alt+tab:** Projector windows use `.skip_taskbar(false)` so they appear in the OS window switcher.

8. **Spawned threads/processes must exit on app shutdown:** Every `std::thread::spawn`, `std::process::Command`, or background worker started by the app **must terminate when the main process exits**. Patterns: (a) **Channel-based worker**: `mpsc::channel` + `OnceLock<Sender>` — when the process drops the static sender, `rx.recv()` returns `Err` and the worker loop exits (see `commands/slide_passer.rs`). (b) **Cancel flag**: `Arc<AtomicBool>` checked between work items (see `pack_sync/executor.rs`). (c) **One-shot thread**: for short-lived operations (<1s), bare `std::thread::spawn` is acceptable since the OS kills all threads on process exit. Never spawn long-lived loops without a shutdown mechanism.

### TypeScript / React

1. **React 19 useRef:** Requires explicit initial value. Use `useRef<T>(undefined)` not `useRef<T>()`.

2. **TanStack Router route generation:** After adding/renaming route files, run `pnpm vite build` before `npx tsc --noEmit`. The Vite plugin generates `routeTree.gen.ts` — stale types cause TS errors.

3. **Converting flat route to directory route:** Delete the `.tsx` file, create `route.tsx` (layout with `<Outlet />`) + `index.tsx` (list page) + `$paramId.tsx` (detail page).

4. **Unused destructured variables in mutations:** Use a single `vars` parameter instead of destructuring when some fields are only needed in `onSuccess`: `mutationFn: (vars) => updateSlide(vars.id, vars.contentJson), onSuccess: (_, vars) => queryClient.invalidateQueries(...)` .

5. **Stale closures in Zustand + setTimeout/useCallback:** Use `Store.getState()` inside async callbacks for fresh reads instead of captured state. See `use-slides.ts` `goToSlide`.

6. **Dead key / IME composition (ç, ñ, accents on Mac):** When input value is bound to server-refetched data, refetch mid-composition breaks dead keys. Fix: local state + `dirtyRef` that prevents server sync while typing. See `use-presentation.ts`.

7. **Optimistic local state pattern:** For responsive typing in editors, don't bind inputs directly to TanStack Query data. Use a local `Record<id, EditedValue>` state merged with server data, with per-item debounced saves. See `use-presentation.ts` for the reference implementation.

8. **Package manager/tooling:** This project uses **pnpm** for frontend commands. Do not use `npm` or `deno` in this repo.

10. **Unit tests for Tauri-dependent stores:** Stub Tauri IPC *before* importing the store: `(globalThis as any).window = { __TAURI_INTERNALS__: { invoke: () => Promise.resolve(null) } };` — required because plugin-store calls `invoke` at module load. See `tests/stores/slide-passer-store.test.ts`.

9. **Conditional hooks in root layout:** Never call hooks after an early `return`. For bare routes (`/projector`, `/return`), pass `{ enabled: false }` to hooks instead of calling them conditionally — `useKeyboard({ enabled: !isBareRoute })` always called, conditionally active.

### General

- **Don't delete scaffolded code:** Before removing `#[allow(dead_code)]` items or any apparently unused code, check `docs/plans/` and `docs/pre-dev/` for planned features that depend on it. Scaffolded structs, functions, and queries are often placed ahead of time for upcoming phases. Prefer prefixing unused fields with `_` (idiomatic Rust for deserialize-only fields) over deletion. When `#[allow(dead_code)]` is justified, keep it with a `///` doc comment pointing to the relevant plan (e.g., `/// Planned for album-import-collections feature (see docs/pre-dev/album-import-collections/)`).
- **i18n:** Always add keys to ALL THREE locale files (`en.json`, `pt.json`, `es.json`). Missing keys render as raw key strings.
- **UI design skill:** For UI/UX design tasks, use the `ui-ux-pro-max` skill before proposing or implementing interface changes.
- **Ring skill selection:** Automatically select and apply the correct Ring skill(s) based on the task context, using the minimal set required for the job.
- **Multi-agent orchestration:** When beneficial, automatically orchestrate multiple agents and use the appropriate Ring orchestration skills (for example `ring:using-ring` and `ring:dispatching-parallel-agents`).
- **New Tauri commands checklist:** (1) Add query in `db/queries/*.rs`, (2) Add command in `commands/*.rs`, (3) Register in `lib.rs` via `tauri_specta::collect_commands!` (regenerates `bindings.ts`), (4) **Add command name to the appropriate group in `src-tauri/permissions/commands.toml`** (omitting this causes "command not allowed / not found" at runtime even though the command compiled fine), (5) Add wrapper in `lib/tauri.ts` if needed or use `bindings.ts` directly, (6) Add hook in `lib/queries.ts`.
- **Monitor assignment pattern:** `src/lib/monitor-resolution.ts` is a shared helper for resolving projector/return monitor roles from saved settings. `src/lib/projection-playback.ts` coordinates projection startup using this resolver. All monitor-open commands use stable fingerprint-based `monitorId` (not transient index).
- **Projector event flow:** `setCurrentSlide` (Rust) → `app.emit("slide-changed", &slide_data)` → `ProjectorView` listens via `listen<SlideContentFlat>("slide-changed")` → converts with `flatToSlideContent`.
- **Link navigation:** Always use TanStack Router `<Link to="/path">` for internal navigation, never `<a href>` or `window.location`.
- **Cross-module "Add to X" pattern:** When a module (e.g., Bible, Hymnal) needs to add items to another module (e.g., Services), use `usePresentationStore.activeServiceId` to check if a service is active, and `useAddServiceItem()` mutation to add. Show the button conditionally only when `activeServiceId` is set. See `hymn-card.tsx` and `verse-display.tsx` for reference.
- **Color-coded type maps:** When items have types (e.g., `ServiceItemType`), define parallel `Record<Type, string>` maps for icons, text colors, border colors, and bg colors. Keep them co-located in the component that uses them (e.g., `service-item-list.tsx`).
- **Tab switcher in panels:** For right-side panels with multiple views, use a simple state toggle (`useState<"tab1" | "tab2">`) with inline tab buttons styled via `cn()` + conditional `border-b-2 border-primary`. No need for a full tabs library.
- **Service item projection:** Items project to the projector via `setCurrentSlide()` with `SlideContentFlat`. Each item type maps to a slide_type: hymn→lyrics, bible→bible, annotation/url/file→text. Always check `isProjectorOpen` and call `toggleProjector()` first if closed.
- **Dual liturgy projection paths:** `$serviceId.tsx::projectItem` (manual click) and `use-liturgy-playback.ts::projectItem` (playback auto-advance) are independent — both must handle every `itemType` or fall to `default: makeTextSlide(notes)`. `buildSlideData()` in the playback hook is a sync helper used only for *next-slide preview context*, not for actual projection. When adding a new `itemType`, update **all three**: both `projectItem` handlers and `buildSlideData`.
- **`online_video` notes JSON shape:** `{ videoId, videoUrl, videoSource, channelName, duration, downloadForOffline }`. Use `parseOnlineVideoNotes()` from `src/lib/utils.ts` to parse. Projection resolves local download via `findOnlineVideoByYtId(videoId)` — if `localPath` is set, use `source: "local"` + `offline_video` media item; otherwise `source: "youtube"` + `online_video` media item.
- **Shared file utilities:** `getFileExt(path)` and `parseOnlineVideoNotes(notes)` live in `src/lib/utils.ts`. Module-level `IMAGE_EXTS`/`VIDEO_EXTS`/`AUDIO_EXTS` Sets are defined per-file (liturgy hook + service route) — not yet centralized.
- **Play Service mode:** Uses `isPlayingService` + `activeServiceItemIndex` in the presentation store. Toolbar shows prev/next/stop controls. The `useEffect` on `activeServiceItemIndex` auto-projects the current item. Stop resets index to -1.
- **Inline editing in lists:** Use local `useState` + `useRef` for focus management. Show save/cancel buttons (Check/X icons). Commit via `onEditItem` callback. Escape cancels, Enter saves.
- **Overlay state:** Black/logo screen overlays managed in Rust state, synced via `"overlay-changed"` events. Overlays are mutually exclusive (activating one deactivates the other).
- **Keyboard shortcuts:** B=black screen, L=logo screen, F5=projector, Shift+F5=return monitor, Escape=clear projection.
- **Windows audio init pattern:** `OutputStream::try_default()` (rodio/WASAPI) can **block forever** on Windows with no audio device or driver issues. Always initialize audio in a background thread with a timeout (`mpsc::channel` + `recv_timeout`) so Tauri's `setup()` never hangs. A hanging `setup()` blocks the event loop, causing all `invoke()` calls to be stuck in pending — appearing as "communication not working".
- **Tauri v2 IPC bridge:** The bridge is `window.__TAURI_INTERNALS__`, NOT `window.__TAURI__`. The latter is only set when `withGlobalTauri: true` is configured. Using `window.__TAURI__` for debugging always shows "missing" in Tauri v2 and is misleading.
- **Content DB optional-table pattern:** Content DBs (Delphi legacy SQLite) may or may not have optional tables (`lyrics`, `categories`, `categories_albums`). Always probe `sqlite_master` before building SQL: `fn table_exists(conn) -> bool { conn.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", ...) }`. Build SQL dynamically with `format!()` — do NOT use `CASE WHEN` guards in SQL (SQLite validates all table names at `prepare()` time even inside unreachable branches).
- **Content DB hymnal category filter:** When `categories` + `categories_albums` tables exist, add `LEFT JOIN categories_albums ca ... LEFT JOIN categories cat ... AND (cat.slug IS NULL OR cat.slug = 'hymnal')` to filter the hymnal route. Absence of these tables → return all items (safe default). Used in `get_hymns_from_content_db` and `search_hymns_content_db` FTS branch only (not in detail queries like `get_hymn_by_id` or `get_collection_hymns`).
- **Content DB path contract:** `files` table stores `dir` + `name` separately (e.g. `dir='/covers'`, `name='brj.jpg'`). SQL concatenates `dir || '/' || name`. Rust `resolve_hymn_paths()` / `resolve_collection_paths()` strip leading `/` via `trim_start_matches('/')` and join with `app_data_dir`. CDN ZIP packs must extract files at matching paths (`covers/brj.jpg`, `musics/pt/.../song.mp3` inside the ZIP root).
- **Windows path separator normalization:** After `Path::join(...).to_string_lossy()` on Windows, backslashes break Tauri's asset protocol URLs. Always `.replace('\\', "/")` on Rust path strings sent to frontend. On the frontend, normalize `appDataDir` before building asset URLs: `(await getCachedAppDataDir()).replace(/\\/g, "/")`. Asset protocol scope in `tauri.conf.json` must include `$APPDATA/com.louvorja/**` (the app identifier directory) to serve files in the data dir.
- **Pack sync disk I/O pattern (low-end devices):** Background thread priority (`THREAD_MODE_BACKGROUND_BEGIN`), 3 max concurrent downloads, `BufWriter::with_capacity(256*1024)`, `FILE_FLAG_SEQUENTIAL_SCAN`, 64MB mmap, FTS5 `OPTIMIZE` after bulk inserts. See `pack_sync/executor.rs`.
- **Streaming SSE pattern:** Use raw `std::net::TcpListener` with `TcpStream::write_all()` + `flush()` for SSE — never use buffered HTTP libraries (like tiny_http) for SSE as they buffer small writes. Set `TCP_NODELAY` on connections.
- **Streaming clear pattern:** When clearing slides, all 3 SSE channels (music/bible/return) must receive empty payloads. HTML templates must handle `null`/empty values explicitly (show "Waiting for content" state).
- **Video media path contract:** Persist only managed relative paths (`media/videos/...`) in slide content. Resolve to absolute paths via the dedicated video HTTP server (`VideoServerState` in Rust, `useVideoSource()` hook in frontend). The server binds loopback-only, supports HTTP 206 range requests, and uses access-token auth. Projection windows are read-only — they poll `get_video_server_status` with `refetchInterval` until the main window starts the server via `start_video_server`. Never use `convertFileSrc` for downloaded videos (format-detection issues).
- **yt-dlp format contract:** Always force-remux downloads to proper MP4 (`--remux-video mp4`). Without this, yt-dlp may produce MPEG-TS files with a `.mp4` extension, causing "MP4 box exceeds container bounds" errors on metadata parsing and video playback failures. MPEG-TS detection falls back to FFprobe for metadata; magic byte check (`0x47` sync byte at offset 0) identifies misnamed files.
- **Presentation media player integration:** Standalone presentations (projected outside the queue) must call `useMediaPlayerStore.load(PresentationMediaItem)` to populate the store; otherwise `currentItem` stays null and `ControlBar` hides all controls. Fix: `ControlBar` shows slide navigation when `totalSlides` exists even if `currentItem` is null (split early-return guard into separate `hasTimeline`/`hasSlides` conditions). Slide navigation functions fall back to `usePresentationStore` when `currentItem` is null for backwards compatibility.
- **Service-aware update guard:** `UpdateNotification` subscribes to `usePresentationStore` via `.subscribe()` + `getState()`. Suppresses banner when `isProjectorOpen || isPlayingService || activeServiceId !== null`. Status bar indicator uses lightweight pub-sub callback (`onUpdateDeferredChange`) instead of a full store.
- **Pastoral error messaging:** `classifyUpdateError()` in `lib/update-errors.ts` pattern-matches error strings into 4 categories (network/disk/permission/generic), each with i18n keys for title/why/action/reassurance. Toasts use `duration: Infinity` so users must dismiss manually.
- **Legacy DB import:** `migrate_v13` in `migrations.rs` detects Delphi-schema tables (`musics`, `lyrics`, `albums`, `files`) and imports them into `hymns`. Idempotent: skips if `hymns` already has rows or if `musics` table is absent.
- **Tauri plugin-store:** For NEW preferences only (UI state, layout). Existing SQLite settings stay in SQLite. Use `src/lib/store.ts` helpers (`getPreference`/`setPreference`/`deletePreference`). Add `store:default` to `desktop.json` capabilities.
- **Clipboard:** Use `src/lib/clipboard.ts` `copyToClipboard()` — wraps `@tauri-apps/plugin-clipboard-manager`. Requires `clipboard-manager:allow-write-text` + `clipboard-manager:allow-read-text` in `desktop.json`. Never use `navigator.clipboard` directly (fails in Tauri webview without HTTPS).
- **Global shortcuts:** Registered in `lib.rs` `setup()` via `GlobalShortcutExt::on_shortcut()`, emitted as `"global-shortcut"` Tauri events with string payload. Listened in `use-keyboard.ts` second `useEffect`. Use `Alt+` modifier for global shortcuts to avoid interfering with typing.
- **Plugin capabilities split:** `pnpm tauri add` may add permissions to `default.json` OR `desktop.json` depending on when each file was created. Always verify `desktop.json` after adding plugins — missing permissions cause silent plugin failures (e.g., clipboard `NotAllowedError`).
- **Playing Queue pattern:** `useQueueStore` manages the ordered list of hymns for continuous playback. `use-playback-coordinator.ts` hook syncs queue index changes → auto-starts audio + slides. `useAudioStore` exposes an `onFinished` callback to trigger `queueStore.next()` on song completion. `PlayingQueue` component lives on the `/playing-now` route.
- **Cancellable async run pattern:** For long-running background operations (e.g. pack sync), store `active_run_id: Option<String>` + `cancel_flags: HashMap<String, Arc<AtomicBool>>` in a `Mutex<FooRuntimeState>` on `AppState`. The executor checks the flag between items; cancel command sets the flag. Progress events carry `run_id` so the frontend can ignore stale events.
- **Multi-language content DB:** `AppState.content_dbs: Arc<Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>` keyed by BCP 47 tag (e.g. `"pt-BR"`). Populated at startup by scanning for `content-*.db` files and after each pack sync. Access: `content_dbs.lock()?.get("pt-BR")`.
- **Manifest cache pattern:** CDN manifest is cached to `manifest_cache.json` in `app_data_dir`. `plan_pack_sync` loads the cache, skips the network fetch when `manifest.manifest_version == stored_version`. Pass `force_refresh: Some(true)` to bypass.
- **Preview-without-commit pattern:** Pass `preview_languages: Option<Vec<String>>` to `build_plan()` to compute what would be downloaded for a language selection without writing to DB. Used by the sync dialog to show pack list when the user checks a language before confirming.
- **Thumbnail layout guardrails:** In constrained flex layouts, apply `min-w-0` on every wrapper level (sortable item → thumbnail root → inner text). For long untrusted strings (filenames, hash-like IDs), prefer `break-all` with a clipped container over `whitespace-nowrap + truncate` in tiny cards. Validate at 100%/125%/150% zoom with scrollbar visible.
- **Realtime sync anti-pattern:** Never implement polling loops for live synchronization (audio/timer/clock/projection/streaming). Use event-driven pub/sub from Rust emitters to frontend listeners. If polling is temporarily unavoidable, document the rationale and removal plan.
- **Playback/editor separation:** Presentation editor flows must not mutate the active playback queue or projection synchronization lifecycle. Keep queue control in playback routes/hooks only.
- **CI/CD pipeline:** GitHub Actions with 5-platform matrix (macOS ARM/Intel, Linux x64/ARM, Windows). Uses `tauri-apps/tauri-action@v0` with Rust cache, Ed25519 signing, and draft releases. Signing env vars: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- **Admin panel:** Separate Next.js 14 App Router project at `admin-panel/`. Manages CDN pack publishing: file upload, `canonicalPackPath()` path normalization, `manifest.ts` types (`ContentManifest`, `ManifestPack` with `language` BCP 47 + `databases` per-language DB entries), R2 upload. Run with `pnpm build` inside `admin-panel/`.
- **Online Videos feature:** YouTube integration with playlist management, offline download via yt-dlp, and projector iframe rendering. Key patterns:
  - **YouTube API commands use spawned threads** (`std::thread::spawn`) with Tauri event emission on completion. Frontend `useYoutubeEvents()` hook listens to events and invalidates TanStack Query caches.
  - **yt-dlp binary management:** Auto-download from GitHub releases with SHA256 verification. Binary stored at `app_data_dir/bin/yt-dlp`. Uses cancellable async run pattern (same as pack sync).
  - **`online_video` slide type:** `SlideContent` has 4 optional fields (`videoUrl`, `videoId`, `videoSource`, `videoTitle`). YouTube: projector/return render follower iframes (muted). Local/downloaded: projector/return render `VideoFollowerElement` (muted HTML5 `<video>`) via `useVideoSource()` → video HTTP server; sync via one-shot `video-control-cmd` Tauri events (play/pause/seek).
  - **Persistent video player:** Fixed-position overlay in `__root.tsx`. `LocalVideoMaster` renders a hidden `<video>` for audio + broadcasts `video-state` events. YouTube uses hidden iframe. Master emits `video-control-cmd` to projector/return on play/pause/seek. Playing Now shows static thumbnail (no live video). `VideoFollowerElement` in `video-follower-element.tsx` is the muted HTML5 `<video>` used by projector/return windows.
  - **Video playback targets:** `useVideoPlayerStore.videoPlaybackTargets` (persisted via plugin-store) lets users choose which screens render live video (`"projector"` and/or `"return"`). Default: `["projector"]`. `VideoTargetToggle` in `control-bar.tsx` provides the UI. `OnlineVideoSlide` checks targets before rendering `LocalVideoFollower` or `YouTubePlayer` (falls back to thumbnail).
  - **YouTube API key** stored via plugin-store (`youtube_api_key`). Download quality stored as `youtube_download_quality` (720/1080/best).
  - **Sidebar collapsible sub-items:** `NavItem.children` array, expand/collapse state in `useUIStore`, hover popover in collapsed mode via Radix `Popover`.
  - **Collections route tab bar:** Conditional tab bar shown on `/collections` and `/collections/online-videos` index pages (not on detail pages). Static `online-videos` route takes priority over `$collectionId` dynamic segment.

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
| 7 | Streaming (08) | COMPLETE |
| 8 | Video/Multimedia (09) | COMPLETE |
| 9 | Utilities & Polish (10) | Pending |
| 10 | Migration & Deploy (11) | Pending |
| 11 | Projection Overhaul | COMPLETE |
| 12 | Monitor Screen Assignment | COMPLETE |
| — | Playing Queue | COMPLETE |
| — | Pack Sync (CDN) | IN PROGRESS |
| — | Online Videos (YouTube) | COMPLETE |

## Self-Improvement Protocol

After completing any task (feature, bugfix, refactor), Claude MUST:

1. **Update phase status** in the table above if a phase was completed or progressed.
2. **Update project structure** if new directories, components, or route groups were added.
3. **Record new patterns** in the "General" section above if a reusable pattern was established (e.g., cross-module integration, new UI pattern, new data flow).
4. **Record new errors to avoid** if a non-obvious bug was encountered and solved during implementation.
5. **Update memory files** (`~/.claude/projects/.../memory/MEMORY.md`) with session-specific learnings that don't belong in CLAUDE.md.
6. **Keep CLAUDE.md concise** — don't duplicate information, remove outdated notes, prefer terse bullet points over verbose explanations.

The goal: every session should leave the project in a better-documented state than it started, so future sessions (even with a fresh context) can onboard instantly.
