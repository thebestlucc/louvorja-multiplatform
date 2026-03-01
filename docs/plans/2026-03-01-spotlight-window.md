# Spotlight Window Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a detached "spotlight" Tauri window that opens globally on Alt+K, shows a full command palette with search, and focuses the main LouvorJA window when a selection is made.

**Architecture:** A second `WebviewWindowBuilder` window (`"spotlight"`) is created lazily on first `Alt+K` press: `always_on_top`, `decorations(false)`, `skip_taskbar`. It renders a new `/spotlight` route. Selection calls `invoke("spotlight_select", ...)` → Rust hides the spotlight, focuses main, emits `"spotlight-navigated"` → main window listener calls `router.navigate()`. The `Alt+K` global shortcut handler in Rust now directly manages the spotlight window instead of emitting to the frontend.

**Tech Stack:** Tauri 2, Rust (WebviewWindowBuilder, AppHandle, Manager), React 19, TanStack Router, TypeScript, cmdk, i18next, Tailwind v4

---

### Task 1: Add Rust `spotlight` command module

**Files:**
- Create: `src-tauri/src/commands/spotlight.rs`
- Modify: `src-tauri/src/commands/mod.rs`

**Step 1: Create `spotlight.rs`**

```rust
// src-tauri/src/commands/spotlight.rs
use crate::error::AppError;
use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::{AppHandle, Emitter, Manager};

/// Opens or focuses the spotlight window.
/// Safe to call from the IPC thread — window creation is fast (no sleep/fullscreen retry).
pub fn open_spotlight_window(app: &AppHandle) -> Result<(), AppError> {
    // If window already exists, show and focus it
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    // Get primary monitor dimensions for centering
    let monitors = app
        .primary_monitor()
        .map_err(|e| AppError::Internal(format!("Cannot get primary monitor: {e}")))?;

    let (screen_w, screen_x, screen_y) = if let Some(m) = monitors {
        let pos = m.position();
        let size = m.size();
        (size.width as f64, pos.x as f64, pos.y as f64)
    } else {
        (1440.0, 0.0, 0.0)
    };

    let window_w = 640.0_f64;
    let window_h = 440.0_f64;
    let x = screen_x + (screen_w - window_w) / 2.0;
    let y = screen_y + screen_h_offset(window_h);

    tauri::WebviewWindowBuilder::new(
        app,
        "spotlight",
        tauri::WebviewUrl::App("/spotlight".into()),
    )
    .title("LouvorJA Search")
    .inner_size(window_w, window_h)
    .min_inner_size(window_w, window_h)
    .max_inner_size(window_w, window_h)
    .position(x, y)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .transparent(true)
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .build()
    .map_err(|e| AppError::Internal(format!("Failed to create spotlight window: {e}")))?;

    Ok(())
}

fn screen_h_offset(window_h: f64) -> f64 {
    // Position window ~18% from top of screen, regardless of screen height
    let _ = window_h;
    120.0
}

/// Called from the spotlight window when the user selects a result.
/// - kind = "navigate": focuses main window, emits spotlight-navigated event with route
/// - kind = "hide": just hides the spotlight window
#[tauri::command]
pub fn spotlight_select(
    kind: String,
    payload: String,
    app: AppHandle,
) -> Result<(), AppError> {
    // Hide spotlight window
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.hide();
    }

    match kind.as_str() {
        "navigate" => {
            // Focus and show main window, then tell it to navigate
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
                let _ = main.emit("spotlight-navigated", &payload);
            }
        }
        "action" => {
            // Emit action to main window so it can execute Tauri hooks that need React context
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
                let _ = main.emit("spotlight-action", &payload);
            }
        }
        _ => {}
    }

    Ok(())
}

/// Hides the spotlight window. Called when the spotlight loses focus.
#[tauri::command]
pub fn spotlight_hide(app: AppHandle) -> Result<(), AppError> {
    if let Some(win) = app.get_webview_window("spotlight") {
        let _ = win.hide();
    }
    Ok(())
}
```

**Step 2: Register module in `mod.rs`**

Add to `src-tauri/src/commands/mod.rs`:

```rust
pub mod spotlight;
```

**Step 3: Verify it compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error" | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs src-tauri/src/commands/mod.rs
git commit -m "feat(rust): add spotlight window command module"
```

---

### Task 2: Wire spotlight into `lib.rs` — global shortcut + command registration

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Replace the `app-command-palette` global shortcut handler**

In `lib.rs`, find the global shortcuts loop (the `for (action, default_str) in global_defaults` block). The `app-command-palette` action currently emits `"global-shortcut"` with the action ID. Instead, it should call `open_spotlight_window`.

Replace the shortcut loop so the `"app-command-palette"` action has a dedicated handler:

```rust
for (action, default_str) in global_defaults {
    let key = format!("shortcut.{}.global", action);
    let combo_str = crate::db::queries::settings::get_setting(&conn, &key)
        .ok()
        .map(|s| s.value)
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| default_str.to_string());

    if let Ok(shortcut) = combo_str.parse::<Shortcut>() {
        let action_id = action.to_string();
        let app_clone = app.handle().clone();

        if action_id == "app-command-palette" {
            // Special case: open detached spotlight window instead of emitting event
            let _ = app.handle().global_shortcut().on_shortcut(
                shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        // Toggle: if visible, hide; if hidden/absent, open/show
                        if let Some(win) = app_clone.get_webview_window("spotlight") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        } else {
                            let _ = crate::commands::spotlight::open_spotlight_window(&app_clone);
                        }
                    }
                },
            );
        } else {
            let _ = app.handle().global_shortcut().on_shortcut(
                shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app_clone.emit("global-shortcut", &action_id);
                    }
                },
            );
        }

        shortcuts_map.insert(action.to_string(), combo_str);
    }
}
```

**Step 2: Register new commands in the invoke handler**

Find the `.invoke_handler(tauri::generate_handler![` block and add:

```rust
commands::spotlight::spotlight_select,
commands::spotlight::spotlight_hide,
```

**Step 3: Build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error" | head -20
```

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): wire spotlight window into global shortcut and invoke handler"
```

---

### Task 3: Add spotlight capabilities file

**Files:**
- Create: `src-tauri/capabilities/spotlight.json`

**Step 1: Create the capabilities file**

The spotlight window needs permissions to call Tauri commands and listen/emit events. Model it after `projector.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "spotlight",
  "description": "Permissions for the detached spotlight search window",
  "windows": [
    "spotlight"
  ],
  "permissions": [
    "core:event:allow-listen",
    "core:event:allow-emit",
    "core:window:default",
    "core:path:allow-resolve-directory",
    "core:path:allow-join"
  ]
}
```

**Step 2: Commit**

```bash
git add src-tauri/capabilities/spotlight.json
git commit -m "feat(tauri): add spotlight window capabilities"
```

---

### Task 4: Create the `/spotlight` route

**Files:**
- Create: `src/routes/spotlight.tsx`
- Modify: `src/routes/__root.tsx`

**Step 1: Create `spotlight.tsx`**

This is a bare route — no sidebar, no header. The window is 640×440px with a transparent body so the card appears to float.

```tsx
// src/routes/spotlight.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Home, Music, FolderOpen, BookOpen, Presentation, ListChecks,
  Wrench, Settings, Timer, Clock3, Shuffle, CaseSensitive, CircleHelp,
  Monitor, MonitorSmartphone, MonitorOff, Image, Eraser, Keyboard, Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation as useI18n } from "react-i18next";
import { searchHymns, searchBible, searchCollections } from "../lib/tauri";
import type { Hymn } from "../types/hymn";
import type { BibleSearchResult } from "../types/bible";
import type { CollectionSearchResult } from "../types/collection";

export const Route = createFileRoute("/spotlight")({
  component: SpotlightWindow,
});

// Tell the Rust side to hide the window and optionally navigate/execute in the main app
async function select(kind: "navigate" | "action" | "hide", payload: string) {
  await invoke("spotlight_select", { kind, payload });
}

async function hide() {
  await invoke("spotlight_hide");
}

function SpotlightWindow() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [bibleResults, setBibleResults] = useState<BibleSearchResult[]>([]);
  const [collectionResults, setCollectionResults] = useState<CollectionSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Hide on blur — when the spotlight window loses OS focus
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    win.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        void hide();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  // Escape key hides the window
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        void hide();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [h, b, c] = await Promise.all([
          searchHymns(query),
          query.trim().length >= 2 ? searchBible(query, null) : Promise.resolve([]),
          query.trim().length >= 2 ? searchCollections(query) : Promise.resolve([]),
        ]);
        setHymns(h.slice(0, 5));
        setBibleResults(b.slice(0, 5));
        setCollectionResults(c.slice(0, 5));
      } catch {
        // silently fail
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset on hide (when window becomes visible again, reset state)
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        setQuery("");
        setHymns([]);
        setBibleResults([]);
        setCollectionResults([]);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  const hasQuery = query.trim().length > 0;

  const navItems = [
    { id: "home", icon: Home, label: t("nav.home"), to: "/" },
    { id: "hymnal", icon: Music, label: t("nav.hymnal"), to: "/hymnal" },
    { id: "collections", icon: FolderOpen, label: t("nav.collections"), to: "/collections" },
    { id: "bible", icon: BookOpen, label: t("nav.bible"), to: "/bible" },
    { id: "presentations", icon: Presentation, label: t("nav.presentations"), to: "/presentations" },
    { id: "services", icon: ListChecks, label: t("nav.services"), to: "/services" },
    { id: "utilities", icon: Wrench, label: t("nav.utilities"), to: "/utilities" },
    { id: "settings", icon: Settings, label: t("nav.settings"), to: "/settings" },
    { id: "help", icon: CircleHelp, label: t("nav.help"), to: "/help" },
    { id: "timer", icon: Timer, label: t("utilities.nav.timer"), to: "/utilities/timer" },
    { id: "clock", icon: Clock3, label: t("utilities.nav.clock"), to: "/utilities/clock" },
    { id: "lottery", icon: Shuffle, label: t("utilities.nav.lottery"), to: "/utilities/lottery" },
    { id: "text", icon: CaseSensitive, label: t("utilities.nav.text"), to: "/utilities/text" },
  ];

  const actionItems = [
    { id: "toggle-projector", icon: Monitor, label: t("commandPalette.actions.toggleProjector"), action: "toggle-projector" },
    { id: "toggle-return", icon: MonitorSmartphone, label: t("commandPalette.actions.toggleReturn"), action: "toggle-return" },
    { id: "toggle-black", icon: MonitorOff, label: t("commandPalette.actions.toggleBlack"), action: "toggle-black" },
    { id: "toggle-logo", icon: Image, label: t("commandPalette.actions.toggleLogo"), action: "toggle-logo" },
    { id: "clear-projection", icon: Eraser, label: t("commandPalette.actions.clearProjection"), action: "clear-projection" },
    { id: "open-shortcuts", icon: Keyboard, label: t("commandPalette.actions.openShortcuts"), action: "open-shortcuts" },
  ];

  const filteredNav = hasQuery
    ? navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  const filteredActions = hasQuery
    ? actionItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : actionItems;

  return (
    // Full-window transparent wrapper — actual card sits inside
    <div className="flex h-screen w-screen items-start justify-center bg-transparent pt-0">
      <div className="w-full rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            {searching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <svg
                className="h-4 w-4 shrink-0 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t("commandPalette.placeholder")}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t("commandPalette.noResults")}
            </Command.Empty>

            {/* Navigation */}
            {filteredNav.length > 0 && (
              <Command.Group heading={t("commandPalette.groups.navigation")} className="mb-2">
                {filteredNav.map(({ id, icon: Icon, label, to }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => select("navigate", to)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            {filteredActions.length > 0 && (
              <Command.Group heading={t("commandPalette.groups.actions")} className="mb-2">
                {filteredActions.map(({ id, icon: Icon, label, action }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => select("action", action)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Hymn search results */}
            {hymns.length > 0 && (
              <Command.Group heading={t("commandPalette.groups.hymns")} className="mb-2">
                {hymns.map((hymn) => (
                  <Command.Item
                    key={hymn.id}
                    value={`hymn-${hymn.id}`}
                    onSelect={() => select("navigate", `/hymnal/${hymn.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{hymn.title}</span>
                    {hymn.number && (
                      <span className="text-xs text-muted-foreground">#{hymn.number}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Bible search results */}
            {bibleResults.length > 0 && (
              <Command.Group heading={t("commandPalette.groups.bible")} className="mb-2">
                {bibleResults.map((result) => (
                  <Command.Item
                    key={`${result.versionId}-${result.bookId}-${result.chapter}-${result.verse}`}
                    value={`bible-${result.versionId}-${result.bookId}-${result.chapter}-${result.verse}`}
                    onSelect={() =>
                      select(
                        "navigate",
                        `/bible?version=${result.versionId}&book=${result.bookId}&chapter=${result.chapter}&verse=${result.verse}`,
                      )
                    }
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        {result.bookName} {result.chapter}:{result.verse}
                      </span>
                      <span className="truncate">{result.text}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Collection search results */}
            {collectionResults.length > 0 && (
              <Command.Group heading={t("commandPalette.groups.collections")}>
                {collectionResults.map((col) => (
                  <Command.Item
                    key={col.id}
                    value={`collection-${col.id}`}
                    onSelect={() => select("navigate", `/collections/${col.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{col.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
```

**Step 2: Register `/spotlight` as a bare route in `__root.tsx`**

In `src/routes/__root.tsx`, find:

```ts
const BARE_ROUTES = ["/projector", "/return"];
```

Change to:

```ts
const BARE_ROUTES = ["/projector", "/return", "/spotlight"];
```

**Step 3: Regenerate route tree**

```bash
pnpm vite build 2>&1 | tail -5
```

Expected: builds cleanly, `routeTree.gen.ts` is updated.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any errors.

**Step 5: Commit**

```bash
git add src/routes/spotlight.tsx src/routes/__root.tsx
git commit -m "feat: add /spotlight bare route for detached command palette window"
```

---

### Task 5: Add `spotlight-navigated` and `spotlight-action` listeners to main window

**Files:**
- Modify: `src/routes/__root.tsx`

**Step 1: Add listener `useEffect` in `RootLayout`**

In `src/routes/__root.tsx`, import `useRouter` and add a `useEffect` that listens for the two events emitted by Rust after a spotlight selection.

Add at the top of the imports:

```ts
import { useRouter } from "@tanstack/react-router";
```

Also ensure `listen` is imported (it already is).

Add these two effects inside `RootLayout()` (before the `if (isBareRoute)` check so they always register):

```ts
const router = useRouter();

// Spotlight navigation: Rust hides spotlight, focuses main, emits this event
useEffect(() => {
  const unlistenPromise = listen<string>("spotlight-navigated", (event) => {
    void router.navigate({ to: event.payload as never });
  }).catch(() => () => {});

  return () => {
    unlistenPromise.then((unlisten) => unlisten());
  };
}, [router]);

// Spotlight action: execute projection actions triggered from the spotlight window
useEffect(() => {
  const unlistenPromise = listen<string>("spotlight-action", (event) => {
    const action = event.payload;
    const monitors = useMonitorsControl(); // imported hook — see note below
    switch (action) {
      case "toggle-projector":
        void monitors.toggleProjector();
        break;
      case "toggle-return":
        void monitors.toggleReturn();
        break;
      case "toggle-black":
        void monitors.toggleBlackScreen();
        break;
      case "toggle-logo":
        void monitors.toggleLogoScreen();
        break;
      case "clear-projection":
        void stopProjectionAndSongAudio();
        break;
      case "open-shortcuts":
        openKeyboardShortcutsPanel();
        break;
    }
  }).catch(() => () => {});

  return () => {
    unlistenPromise.then((unlisten) => unlisten());
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

> **Note on `useMonitorsControl` inside `useEffect`:** Hooks cannot be called inside callbacks. Instead, call `useMonitorsControl()` at the top of `RootLayout` and use the returned refs. Example:
>
> ```ts
> const { toggleProjector, toggleReturn, toggleBlackScreen, toggleLogoScreen } = useMonitorsControl({ enabled: !isBareRoute });
> ```
>
> Then reference those in the `useEffect` closure (they must be stable refs or added to the dependency array). The simplest approach is to wrap the handlers with `useRef` so the closure always reads the latest version:
>
> ```ts
> const toggleProjectorRef = useRef(toggleProjector);
> useEffect(() => { toggleProjectorRef.current = toggleProjector; }, [toggleProjector]);
> ```
>
> Then call `toggleProjectorRef.current()` inside the listener.

Add imports at top of `__root.tsx`:

```ts
import { useMonitorsControl } from "../hooks/use-monitors";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any errors. The most common will be type narrowing on `router.navigate({ to: ... })` — cast `event.payload` as the router's known route type or use `as never` to bypass strict route checking.

**Step 3: Build check**

```bash
pnpm vite build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: add spotlight-navigated and spotlight-action listeners in main window"
```

---

### Task 6: Final integration check — Rust + Frontend build

**Step 1: Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "^error" | head -20
```

Expected: no errors.

**Step 2: Frontend build**

```bash
pnpm vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 4: Manual smoke test (`pnpm tauri dev`)**

Test sequence:
1. Focus a different app (e.g. browser)
2. Press `Alt+K` — spotlight window should appear floating above everything, centered, with no title bar
3. Type "hymn" — search results should appear
4. Press arrow keys to navigate results, Enter to select — main app window should come to focus and navigate to the hymn
5. Press `Alt+K` again while spotlight is visible — should hide
6. Press `Alt+K` again — should re-show (state reset)
7. Press Escape inside spotlight — should hide
8. Click outside spotlight — should hide

**Step 5: Final commit (if any stray changes)**

```bash
git add -u
git commit -m "chore: spotlight window final integration"
```

---

## Summary

| File | Change |
|------|--------|
| `src-tauri/src/commands/spotlight.rs` | **New** — `open_spotlight_window`, `spotlight_select`, `spotlight_hide` |
| `src-tauri/src/commands/mod.rs` | **Modified** — add `pub mod spotlight` |
| `src-tauri/src/lib.rs` | **Modified** — `app-command-palette` shortcut opens spotlight; register commands |
| `src-tauri/capabilities/spotlight.json` | **New** — window capabilities |
| `src/routes/spotlight.tsx` | **New** — bare route for the spotlight window |
| `src/routes/__root.tsx` | **Modified** — add `/spotlight` to BARE_ROUTES, add event listeners |
