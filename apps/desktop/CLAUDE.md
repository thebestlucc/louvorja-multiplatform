# CLAUDE.md — apps/desktop

Tauri 2 desktop app: `src/` (React 19 frontend) + `src-tauri/` (Rust backend).

---

## Architecture Patterns

### Rust Side

- **Error handling:** All functions return `Result<T, AppError>`. Stubs → `Err(AppError::Internal("Not implemented".into()))`, never `todo!()`.
- **Commands:** `#[tauri::command]` takes `state: tauri::State<'_, AppState>`, pool conn via `state.db.get()?`, delegates to `db::queries::*`. Registered via `tauri_specta::collect_commands!` in `lib.rs`.
- **Database:** SQLite via rusqlite + r2d2. WAL mode + foreign keys via PRAGMAs in `migrations.rs`.
- **Imports:** `use tauri::Manager;` for `app.path()/manage()/get_webview_window()`. `use tauri::Emitter;` for `app.emit()`.
- **Serde:** `#[serde(rename_all = "camelCase")]` on structs returned to frontend.
- **SlideContent model:** Flat struct on Rust (slide_type + optional fields). Discriminated union on TS with `slideContentToFlat` / `flatToSlideContent`.
- **DB migrations:** Versioned in `migrations.rs`. New tables/columns go in `migrate_vN`.
- **Same-process projection windows:** Projector ("projector") and return ("return") created via `WebviewWindowBuilder`. Window creation runs on `std::thread::spawn` (hidden → position → sleep(150ms) → show → fullscreen). `open_fullscreen_window()` in `commands/display.rs` encapsulates this. `.skip_taskbar(false)` keeps them in alt+tab.

### Frontend Side

- **Typed bindings:** Import domain types from `@/lib/bindings` — never define manual interfaces for backend data.
- **Error handling (frontend):** `const [data, err] = await catcher(promise, { notify: true })`. No manual try-catch (except auto-generated files, Node scripts, SSE HTML templates).
- **Error handling (Rust):** Use `src-tauri/src/utils/catcher.rs` when `?` can't propagate (threads, closures).
- **Query hooks:** `useQuery` with `queryKey` arrays; `useMutation` with `onSuccess` → `queryClient.invalidateQueries`.
- **Routes:** File-based via TanStack Router. Directory-based for nested: `hymnal/route.tsx` + `index.tsx` + `$hymnId.tsx`.
- **Zustand:** `usePresentationStore` (slide projection), `useDisplayStore` (monitor/window), `useUIStore` (sidebar), `useAudioStore` (playback), `useQueueStore` (playing queue), `useThemeStore` (theme/language). Use `Store.getState()` in async callbacks.

### New Tauri Commands Checklist

1. Add query in `db/queries/*.rs`
2. Add command in `commands/*.rs`
3. Register in `lib.rs` via `tauri_specta::collect_commands!` (regenerates `bindings.ts`)
4. **Add command name to `src-tauri/permissions/commands.toml`** — omitting = silent "command not found" at runtime
5. Add wrapper in `lib/tauri.ts` if needed
6. Add hook in `lib/queries.ts`

---

## Common Errors to Avoid

### Rust

1. **quick-xml temporary lifetime:** `e.name().as_ref()` fails. Bind first: `let name = e.name(); let name_ref = name.as_ref();`

2. **rodio OutputStream not Send/Sync:** `unsafe impl Send/Sync for AudioPlayer {}` + `Mutex`.

3. **rodio Source trait:** `use rodio::Source;` to access `.total_duration()` on `Decoder`.

4. **Tauri command registration:** Use `tauri_specta::collect_commands!`, NOT `tauri::generate_handler!`.

5. **Tauri plugin registration:** Use `pnpm tauri add <plugin>` — adds Cargo dep + permissions + `app.plugin()` automatically.

6. **Windows IPC blocking:** Blocking ops in `#[tauri::command]` hang IPC bridge on Windows. All long-running ops must `std::thread::spawn` and return `Ok(())` immediately.

7. **`skip_taskbar(true)` hides from alt+tab:** Projector windows use `.skip_taskbar(false)`.

8. **Spawned threads must exit on shutdown:** (a) Channel-based: `mpsc::channel` + `OnceLock<Sender>` — `rx.recv()` returns `Err` when sender drops. (b) Cancel flag: `Arc<AtomicBool>` checked between work items. (c) One-shot (<1s): bare `std::thread::spawn` is OK.

9. **GStreamer hot-attach to live tee:** Never `sync_state_with_parent()` while pipeline is PLAYING without first installing a `BLOCK_DOWNSTREAM` pad probe. Pattern: (1) request tee pad, (2) add probe, (3) link + sync state, (4) remove probe. Per-branch queue: `max-size-time=200ms, max-size-buffers=0, leaky=no`.

10. **`uridecodebin` audio-pad race:** Track `pad-added` + `no-more-pads` in `Arc<PadReadiness>` (Mutex+Condvar); wait for `no_more_pads` before PLAYING. Set `expose-all-streams=true` + `min-threshold-time=0` explicitly. See `video_pipeline/pipeline.rs`.

11. **`MediaSource::Local` missing-file:** Check `path.exists()` BEFORE building `file://` URI. Surface as `AppError::NotFound(...)`. See `video_pipeline/source.rs`.

12. **Windows audio init:** `OutputStream::try_default()` can block forever on Windows. Always init audio in a background thread with `recv_timeout`. Hanging `setup()` blocks all `invoke()` calls.

13. **Content DB optional tables:** Probe `sqlite_master` before building SQL. Never use `CASE WHEN` guards for optional table names — SQLite validates all table names at `prepare()` even inside unreachable branches. Use `format!()` for dynamic SQL.

14. **Windows path separators:** After `Path::join().to_string_lossy()`, backslashes break asset protocol URLs. Always `.replace('\\', "/")` on Rust path strings sent to frontend. Frontend: `appDataDir.replace(/\\/g, "/")`.

15. **`serde_json preserve_order`** (remote WS HMAC): `serde_json = { features = ["preserve_order"] }` in `Cargo.toml` is MANDATORY. Without it, 2+ key payloads fail HMAC silently (BTreeMap alphabetizes keys, breaking `JSON.stringify` order match).

### TypeScript / React

1. **React 19 useRef:** `useRef<T>(undefined)`, not `useRef<T>()`.

2. **TanStack Router route generation:** Run `pnpm vite build` before `tsc --noEmit`. Vite plugin generates `routeTree.gen.ts`.

3. **Converting flat → directory route:** Delete `.tsx`, create `route.tsx` (layout + `<Outlet />`) + `index.tsx` + `$paramId.tsx`.

4. **Stale closures in Zustand callbacks:** Use `Store.getState()` inside async callbacks. See `use-slides.ts::goToSlide`.

5. **Dead key / IME composition (ç, ñ):** Don't bind inputs to TanStack Query data directly. Use local state + `dirtyRef` to block server sync mid-composition. See `use-presentation.ts`.

6. **Optimistic local state:** `Record<id, EditedValue>` merged with server data, per-item debounced saves. See `use-presentation.ts`.

7. **Never use `void` operator before function calls** — fix the root cause instead (add `await`, `.catch()`, or restructure).

8. **Unit tests for Tauri-dependent stores:** Stub IPC before importing: `(globalThis as any).window = { __TAURI_INTERNALS__: { invoke: () => Promise.resolve(null) } }`.

9. **Conditional hooks in root layout:** Never call hooks after early `return`. Pass `{ enabled: false }` for bare routes.

10. **Slide → media-player-store bridge must run unconditionally:** If a feature flag gates a component to `return null`, hooks inside silently stop. Extract bridges into always-mounted hooks in `__root.tsx`. See `hooks/use-online-video-bridge.ts`.

11. **Tauri v2 IPC bridge:** `window.__TAURI_INTERNALS__`, NOT `window.__TAURI__`. The latter requires `withGlobalTauri: true`.

---

## Desktop Patterns

- **Monitor assignment:** `src/lib/monitor-resolution.ts` resolves projector/return roles. `src/lib/projection-playback.ts` coordinates startup. All commands use stable fingerprint-based `monitorId`.
- **Projector event flow:** `setCurrentSlide` (Rust) → `app.emit("slide-changed", &slide_data)` → `ProjectorView` listens via `listen<SlideContentFlat>` → `flatToSlideContent`.
- **Link navigation:** Always `<Link to="/path">` (TanStack Router), never `<a href>` or `window.location`.
- **Cross-module "Add to X":** Use `usePresentationStore.activeServiceId` + `useAddServiceItem()`. Show button only when `activeServiceId` is set. See `hymn-card.tsx`.
- **Color-coded type maps:** `Record<Type, string>` maps for icons/text/border/bg colors, co-located with the component that uses them.
- **Tab switcher in panels:** `useState<"tab1" | "tab2">` with inline tab buttons, `cn()` + `border-b-2 border-primary`. No tabs library needed.
- **Service item projection:** `setCurrentSlide()` with `SlideContentFlat`. hymn→lyrics, bible→bible, annotation/url/file→text. Check `isProjectorOpen`, call `toggleProjector()` first if closed.
- **Dual liturgy projection paths:** `$serviceId.tsx::projectItem` (manual) and `use-liturgy-playback.ts::projectItem` (auto-advance) are independent — both must handle every `itemType`. When adding new `itemType`, update **all three**: both `projectItem` handlers + `buildSlideData`.
- **`online_video` notes JSON:** `{ videoId, videoUrl, videoSource, channelName, duration, downloadForOffline }`. Parse with `parseOnlineVideoNotes()` from `src/lib/utils.ts`. Resolve local download via `findOnlineVideoByYtId(videoId)` → `source: "local"` + `offline_video` if `localPath` set.
- **Shared file utilities:** `getFileExt()` + `parseOnlineVideoNotes()` in `src/lib/utils.ts`. `IMAGE_EXTS`/`VIDEO_EXTS`/`AUDIO_EXTS` defined per-file (not yet centralized).
- **Play Service mode:** `isPlayingService` + `activeServiceItemIndex` in presentation store. `useEffect` on index auto-projects current item. Stop resets index to -1.
- **Inline editing in lists:** Local `useState` + `useRef` for focus. Check/X icon buttons. Escape cancels, Enter saves.
- **Overlay state:** Black/logo overlays in Rust state, synced via `"overlay-changed"` events. Mutually exclusive. Keyboard: B=black, L=logo, F5=projector, Shift+F5=return, Escape=clear.
- **Content DB path contract:** `files` table: `dir || '/' || name`. Rust strips leading `/` via `trim_start_matches('/')` then joins with `app_data_dir`.
- **Content DB hymnal category filter:** `LEFT JOIN categories_albums + categories ... AND (cat.slug IS NULL OR cat.slug = 'hymnal')`. Applied in `get_hymns_from_content_db` + FTS search only (not in detail queries).
- **Pack sync disk I/O:** Background thread priority, 3 max concurrent downloads, `BufWriter::with_capacity(256*1024)`. FTS5 in background thread (`fts-ready` event when done). `synchronous=OFF` + `temp_store=MEMORY` on FTS connection. Join previous FTS thread before file rename.
- **Streaming SSE:** Raw `std::net::TcpListener` + `TcpStream::write_all()` + `flush()`. Never use buffered HTTP libs for SSE. Set `TCP_NODELAY`. Clearing slides: all 3 channels (music/bible/return) must receive empty payloads.
- **Video media path contract:** Persist only relative paths (`media/videos/...`). Resolve via video HTTP server (`VideoServerState` Rust, `useVideoSource()` frontend). Server: loopback-only, HTTP 206, access-token auth. Never use `convertFileSrc` for downloaded videos.
- **yt-dlp format:** Always `--remux-video mp4`. Without it, MPEG-TS files get `.mp4` extension → playback failures. Magic byte check: `0x47` at offset 0.
- **Presentation media player integration:** Standalone presentations must call `useMediaPlayerStore.load(PresentationMediaItem)`. `ControlBar` shows slide navigation when `totalSlides` exists even if `currentItem` is null.
- **Service-aware update guard:** `UpdateNotification` suppresses banner when `isProjectorOpen || isPlayingService || activeServiceId !== null`.
- **Pastoral error messaging:** `classifyUpdateError()` in `lib/update-errors.ts` → 4 categories. Toasts use `duration: Infinity`.
- **Legacy DB import:** `migrate_v13` detects Delphi tables (`musics`, `lyrics`, `albums`, `files`), imports to `hymns`. Idempotent.
- **Tauri plugin-store:** New preferences only (UI state/layout). Existing SQLite settings stay in SQLite. Use `src/lib/store.ts` helpers. Add `store:default` to `desktop.json` capabilities.
- **Clipboard:** `src/lib/clipboard.ts` `copyToClipboard()`. Needs `clipboard-manager:allow-write-text` + `allow-read-text` in `desktop.json`. Never use `navigator.clipboard` directly.
- **Global shortcuts:** Registered in `lib.rs` via `GlobalShortcutExt::on_shortcut()`, emitted as `"global-shortcut"` events. Listened in `use-keyboard.ts`. Use `Alt+` modifier.
- **Plugin capabilities:** `pnpm tauri add` may add permissions to `default.json` OR `desktop.json`. Always verify `desktop.json` after adding plugins.
- **Playing Queue:** `useQueueStore` (ordered hymn list). `use-playback-coordinator.ts` syncs index → auto-starts audio + slides. `useAudioStore.onFinished` triggers `queueStore.next()`.
- **Cancellable async run:** `active_run_id: Option<String>` + `cancel_flags: HashMap<String, Arc<AtomicBool>>` in `Mutex<FooRuntimeState>`. Progress events carry `run_id` for stale-event filtering.
- **Multi-language content DB:** `AppState.content_dbs: Arc<Mutex<HashMap<String, Pool<...>>>>` keyed by BCP 47. Scanned at startup + after pack sync.
- **Manifest cache:** Cached to `manifest_cache.json`. Skip network fetch when `manifest_version` matches. `force_refresh: Some(true)` to bypass.
- **Preview-without-commit:** `preview_languages: Option<Vec<String>>` to `build_plan()` — computes download plan without writing to DB.
- **Thumbnail layout:** `min-w-0` on every wrapper level. For long untrusted strings, prefer `break-all` over `whitespace-nowrap + truncate` in tiny cards.
- **Realtime sync:** Never poll for live sync (audio/timer/clock/projection/streaming). Use event-driven pub/sub from Rust emitters.
- **Playback/editor separation:** Presentation editor must not mutate playback queue or projection lifecycle.
- **Online Videos:** YouTube API commands spawn threads + emit Tauri events. `useYoutubeEvents()` listens + invalidates queries. `online_video` slide type: `SlideContent` has `videoUrl`, `videoId`, `videoSource`, `videoTitle`. YouTube → follower iframes (muted); local → `VideoFollowerElement` via video HTTP server. Persistent player in `__root.tsx` (`LocalVideoMaster` hidden `<video>`). `videoPlaybackTargets` (persisted) controls which screens render live video. YouTube API key: plugin-store `youtube_api_key`. Quality: `youtube_download_quality`.
- **Sidebar collapsible sub-items:** `NavItem.children`, expand/collapse in `useUIStore`, hover popover in collapsed mode via Radix `Popover`.
- **Collections route tab bar:** Shown on `/collections` + `/collections/online-videos` index only. Static `online-videos` route takes priority over `$collectionId`.

---

## Design System Rules

### Component Organization

- **UI primitives** in `src/components/ui/` — check here first before creating new components
- **Feature components** in `src/components/{domain}/`
- **Layout components** (Sidebar, Header, StatusBar) in `src/components/layout/`
- **File naming**: kebab-case (`dropdown-menu.tsx`), **export names**: PascalCase (`DropdownMenu`)
- **Variant objects**: exported as `{componentName}Variants`; **Props interfaces**: as `{ComponentName}Props`
- **All components must accept `className` prop** for composition via `cn()`

### Styling Rules

- **IMPORTANT**: Tailwind v4 — CSS-first config in `global.css` (no `tailwind.config.ts`)
- **IMPORTANT**: Never hardcode colors — use design tokens: `bg-primary`, `text-foreground`, `border-border`, `bg-surface`, etc.
- Color tokens map to `var(--theme-*)` CSS custom properties, changing per theme (azure/white/gray/orange/black)
- `text-destructive`/`bg-destructive` is hardcoded red (`#dc2626`) — does NOT vary by theme
- **Spacing**: raw Tailwind scale (`p-6`, `gap-1.5`, `h-9`); **Border radius**: `rounded-sm` (4px), `rounded-md` (6px), `rounded-lg` (8px)
- **Typography**: `text-xs` (12px) → `text-lg` (18px); `font-medium` (500), `font-semibold` (600), `font-bold` (700)
- Font: Inter via `@font-face` in `src/styles/fonts.css`; custom utility `writing-vertical-lr` in `global.css`

### UI Primitives Inventory

| Component | Variants | Notes |
|-----------|----------|-------|
| `Button` | `variant`: default, outline, ghost, destructive; `size`: sm, md, lg, icon | CVA pattern |
| `Badge` | `variant`: default, secondary, outline, destructive | Simple function |
| `Input` | label?, error? | Adds `border-destructive` on error |
| `Textarea` | label?, error? | Same pattern as Input |
| `Card` | Compound: Header, Title, Description, Content, Footer | No variants |
| `Dialog` | Radix + styled wrappers | Auto X close button |
| `DropdownMenu` | Radix + styled wrappers | |
| `Select` | Radix + styled wrappers | ChevronDown + Check icons |
| `Slider`, `Tabs`, `Tooltip`, `ScrollArea` | Radix wrappers | |
| `Table` | Compound: Header, Body, Row, Cell, etc. | Native HTML table |
| `Popover` | Custom (NOT Radix) — controlled, Escape/click-outside | |
| `HighlightedSnippet` | Renders `<mark>` HTML strings | |
| `AppToaster` | Sonner wrapper | |

### Icon System

- **Library**: `lucide-react` — named imports only. **IMPORTANT**: DO NOT install new icon packages.
- **Sizes**: `h-4 w-4` standard, `h-3 w-3` small, `h-3.5 w-3.5`, `h-5 w-5` large
- Decorative icons: `aria-hidden="true"`; interactive icons in buttons with `aria-label`

### Component Patterns

- **CVA Pattern** (Button, Badge): `cva("base")` + `VariantProps`, export `buttonVariants` + `ButtonProps`. See `src/components/ui/button.tsx`.
- **Radix Wrapper Pattern**: `forwardRef` + `cn("base-styles", className)`. See `src/components/ui/dialog.tsx`.
- **Input Pattern**: `forwardRef` with `label?` + `error?`; adds `border-destructive` on error. See `src/components/ui/input.tsx`.

### Figma Implementation Flow

1. `get_design_context` for the node; `get_screenshot` for visual reference
2. Map Figma colors → project tokens (`primary`, `surface`, `muted-foreground`, etc.)
3. Check `src/components/ui/` for existing components
4. Replace hardcoded colors/spacing with Tailwind token classes; apply CVA if variants needed
5. Validate against screenshot before completing

### Accessibility Rules

- All interactive elements must have `aria-label` or `<label>` association
- `aria-hidden="true"` on decorative icons
- Focus rings: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`
- All Radix primitives provide built-in keyboard support

### State Management UI Patterns

- **Zustand stores**: client-only UI state (`src/stores/`)
- `const { sidebarOpen } = useUIStore()` — direct subscription
- `const id = usePresentationStore((s) => s.activeLiturgyId)` — selector
- **IMPORTANT**: Use `Store.getState()` inside async callbacks to avoid stale closures
- Theme/language persisted to `localStorage`; UI state (sidebar, modals) is NOT persisted

### Layout Conventions

- App shell: Sidebar (left, `w-60`/`w-14`) + Header (`h-14`) + Content + StatusBar (`h-11`)
- Sidebar uses `<Link>` (TanStack Router), NOT `<a>`
- Bare routes (`/projector`, `/return`): pass `{ enabled: false }` to hooks, return `<Outlet />` early

---

## Project Structure

```
src/
├── components/
│   ├── display/        # projector-controls
│   ├── layout/         # sidebar, header, status-bar
│   ├── music/          # hymn-search, hymn-card, album-card, lyrics-display, audio-controls, audio-sync-editor, lyrics-modal
│   ├── services/       # service-item-list, service-timeline, add-item-modal
│   ├── slides/         # slide-renderer, slide-thumbnail, slide-list, slide-editor, projector-view, background-picker, aspect-ratio-selector, transition-selector
│   ├── online-videos/  # playlist-card, video-card, add-playlist-modal, api-key-setup, playlist-picker, online-video-slide, video-follower-element, persistent-video-player
│   ├── slide-passer/   # slide-passer-indicator, key-capture-dialog, test-clicker-dialog
│   ├── streaming/      # streaming preview panels, SSE event handlers
│   └── ui/             # Radix-based primitives (button, card, badge, input, etc.)
├── hooks/              # use-slides, use-keyboard, use-monitors, use-audio, use-presentation, use-service, use-youtube-events, use-video-source
├── lib/
│   ├── bindings.ts           # AUTO-GENERATED by tauri-specta — do not edit
│   ├── tauri.ts              # Typed invoke() wrappers
│   ├── queries.ts            # TanStack Query hooks
│   ├── catcher.ts            # Async/sync error wrapper — use instead of try-catch
│   ├── store.ts              # Tauri plugin-store helpers
│   ├── clipboard.ts          # copyToClipboard() wrapper
│   ├── monitor-resolution.ts # Projector/return monitor role resolution
│   ├── update-errors.ts      # Pastoral error classifier
│   ├── tauri/video-server.ts # Video server command wrappers
│   └── utils.ts              # cn(), getFileExt(), parseOnlineVideoNotes()
├── locales/            # en.json, pt.json, es.json
├── routes/
│   ├── __root.tsx      # Root layout (sidebar + header + bare /projector /return)
│   ├── index.tsx
│   ├── hymnal/         # route.tsx, index.tsx, $hymnId.tsx
│   ├── presentations/  # route.tsx, index.tsx, $presentationId.tsx
│   ├── services/       # route.tsx, index.tsx, $serviceId.tsx
│   ├── collections/    # route.tsx, online-videos/ (index, $playlistId)
│   └── playing-now/
├── stores/             # presentation-store, display-store, audio-store, ui-store, queue-store, theme-store, content-sync-store
└── types/

src-tauri/src/
├── lib.rs              # Tauri setup, command registration, plugin init
├── state.rs            # AppState, AudioState, YtdlpRuntimeState
├── error.rs            # AppError enum
├── commands/           # music.rs, display.rs, slides.rs, audio.rs, bible.rs, liturgy.rs, youtube.rs, …
├── db/
│   ├── migrations.rs   # schema_version, migrate_v1…v13
│   ├── models.rs       # Hymn, Album, Presentation, Slide, SlideContent, etc.
│   └── queries/        # music.rs, slides.rs, bible.rs, liturgy.rs, settings.rs, online_videos.rs
├── archive/            # .slja + .pptx import
├── audio/              # rodio player, sync timeline
├── content_sync/       # CDN manifest model
├── pack_sync/          # CDN pack download/extract (planner.rs, executor.rs)
├── display/, streaming/ # Multi-monitor + SSE server
├── youtube/            # YouTube Data API v3
├── ytdlp/              # yt-dlp binary management
└── video/              # Video path + metadata helpers
```
