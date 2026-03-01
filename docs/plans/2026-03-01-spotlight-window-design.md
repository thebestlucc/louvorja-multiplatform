# Spotlight Window — Design

**Date:** 2026-03-01
**Status:** Approved

## Overview

Add a detached "spotlight" webview window (like Alfred/Spotlight) that opens on `Alt+K` (global shortcut) regardless of which app has focus. The window floats above all apps, runs a command palette with search, and focuses the main LouvorJA window on selection.

---

## Window Properties

| Property | Value |
|----------|-------|
| Label | `"spotlight"` |
| Size | 640 × 420px (fixed) |
| Position | Horizontally centered, 18% from top of primary monitor |
| `always_on_top` | true |
| `decorations` | false |
| `skip_taskbar` | true |
| `resizable` | false |
| `shadow` | true (macOS) |
| URL | `/spotlight` route |

The window is created once (lazily on first `Alt+K`) and re-used: subsequent `Alt+K` presses show/hide it.

---

## Event Flow

### Opening
1. User presses `Alt+K` (global shortcut, already registered)
2. Rust `"global-shortcut"` handler for `"app-command-palette"` calls `open_spotlight_window(app)` instead of emitting to frontend
3. `open_spotlight_window()`: if window exists → `show()` + `set_focus()`; if not → `WebviewWindowBuilder::new("spotlight", ...)`

### Selection (navigation/search result)
1. Spotlight frontend calls `invoke("spotlight_select", { kind: "navigate", to: "/hymnal/123" })`
2. Rust: hides spotlight window, gets main window, calls `main.show()` + `main.set_focus()`, emits `"spotlight-navigated"` with payload to main window
3. Main window: listens via `listen("spotlight-navigated")` in a top-level hook, calls `router.navigate({ to: payload.to })`

### Selection (action — toggle projector, etc.)
1. Spotlight frontend calls `invoke("spotlight_select", { kind: "action", action: "toggle-projector" })`
2. Rust: hides spotlight, executes the action directly (calls the same logic as the existing command), shows toast via `app.emit("spotlight-action-done", ...)`

### Dismiss (blur / Escape)
1. Spotlight window loses focus → `onBlur` event → calls `appWindow.hide()`
2. Escape key inside the palette → `appWindow.hide()`

---

## Spotlight Route `/spotlight`

New route: `src/routes/spotlight.tsx` (bare route — no sidebar, no header).

Registered in `__root.tsx` as a bare route (like `/projector` and `/return`).

The component:
- Full-screen transparent background with a centered card (640×420)
- Search input at the top
- Results list below (same groups as CommandPalette: Navigation, Utilities, Actions, Hymns, Bible, Collections)
- Reuses search logic from `CommandPalette` (debounced `searchHymns`, `searchBible`, `searchCollections`)
- Does NOT use `useNavigate()` — calls `invoke("spotlight_select", ...)` instead
- On `blur` of the window → `appWindow.hide()`

Styling: matches app theme but uses a card-style container with border + shadow on a transparent backdrop.

---

## Rust Changes

### New command: `spotlight_select`

```rust
#[tauri::command]
pub fn spotlight_select(kind: String, payload: String, app: AppHandle) -> Result<(), AppError>
```

- `kind = "navigate"` → hides spotlight, focuses main, emits `"spotlight-navigated"` with `payload` (the route string)
- `kind = "action"` → hides spotlight, dispatches action internally, emits result to main

### Window creation helper: `open_spotlight_window(app: &AppHandle)`

Lives in `commands/display.rs` or a new `commands/spotlight.rs`. Called from the global shortcut handler in `lib.rs` instead of the current `emit("global-shortcut", "app-command-palette")`.

### AppState: no new fields needed

The spotlight window is accessed by label `"spotlight"` via `app.get_webview_window("spotlight")`.

---

## Main Window Listener

New hook `use-spotlight.ts` (or inline in `__root.tsx`):

```ts
useEffect(() => {
  listen<{ to: string }>("spotlight-navigated", (event) => {
    router.navigate({ to: event.payload.to });
  });
}, []);
```

Registered in `__root.tsx` root layout component (always active).

---

## Files Changed

**New:**
- `src/routes/spotlight.tsx` — spotlight window route
- `src-tauri/src/commands/spotlight.rs` — `spotlight_select` command + `open_spotlight_window` helper

**Modified:**
- `src-tauri/src/lib.rs` — global shortcut for `app-command-palette` calls `open_spotlight_window` + register `spotlight_select` command
- `src-tauri/src/commands/mod.rs` — expose `spotlight` module
- `src/routes/__root.tsx` — add `/spotlight` bare route + `spotlight-navigated` listener
- Tauri config — allow spotlight window creation (capabilities)
