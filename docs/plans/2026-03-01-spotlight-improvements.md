# Spotlight Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 10 bugs and UX gaps in the detached Spotlight window — native macOS hide-on-blur, multi-monitor centering, non-activating panel behavior, correct icon colors, i18n completeness, and loop/heading copy-paste bugs.

**Architecture:** Tasks 1–5 are Rust-only changes inside `src-tauri/src/commands/spotlight.rs`. Tasks 6–10 are frontend-only changes inside `src/routes/spotlight.tsx` and the three locale files. No new dependencies required — objc2 / objc2_app_kit are already in `Cargo.toml`.

**Tech Stack:** Tauri 2, Rust, objc2 0.5.2, objc2-app-kit 0.3.2, React 19, TypeScript, i18next

---

## Task 1: `setHidesOnDeactivate(true)` — native hide when app loses focus

**Why:** The current `onFocusChanged` JS listener fires after an IPC round-trip, leaving a visible ghost frame when the user clicks another app. `setHidesOnDeactivate` is a synchronous NSWindow flag that hides the window the instant the OS deactivates the app — no JS involved.

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs:11-31` (`set_macos_collection_behavior`)

**Step 1: Open the file and locate the unsafe block**

```
src-tauri/src/commands/spotlight.rs, lines 11–31
```

The function currently calls `setCollectionBehavior` and `setLevel`. We need to add one more call inside the same `unsafe` block.

**Step 2: Add `setHidesOnDeactivate` feature flag to Cargo.toml**

`objc2-app-kit` feature-gates each method. Check the current feature list:

```bash
grep -A3 'objc2-app-kit' src-tauri/Cargo.toml
```

Expected output includes `"NSWindow"`. We need to add `"NSPanel"` (which exposes `setHidesOnDeactivate` on `NSWindow` in AppKit):

Edit `src-tauri/Cargo.toml` line 51 — change:
```toml
objc2-app-kit = { version = "0.3.2", features = ["NSWindow"] }
```
to:
```toml
objc2-app-kit = { version = "0.3.2", features = ["NSWindow", "NSPanel"] }
```

**Step 3: Verify the feature compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -20
```

Expected: no errors about missing features.

**Step 4: Add `setHidesOnDeactivate(true)` call inside `set_macos_collection_behavior`**

In `src-tauri/src/commands/spotlight.rs`, inside the `unsafe` block after `ns_win.setLevel(NSStatusWindowLevel);`, add:

```rust
// Hide automatically when the app loses focus (no IPC round-trip needed)
ns_win.setHidesOnDeactivate(true);
```

The full function after edit:

```rust
#[cfg(target_os = "macos")]
fn set_macos_collection_behavior(win: &tauri::WebviewWindow) {
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSStatusWindowLevel, NSWindowCollectionBehavior};

    if let Ok(ns_win_ptr) = win.ns_window() {
        unsafe {
            let ns_win = &*(ns_win_ptr as *const AnyObject as *const objc2_app_kit::NSWindow);
            let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary;
            ns_win.setCollectionBehavior(behavior);
            ns_win.setLevel(NSStatusWindowLevel);
            // Hide automatically when the app loses focus (no IPC round-trip needed)
            ns_win.setHidesOnDeactivate(true);
        }
    }
}
```

**Step 5: Build Rust to confirm**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Finished dev [unoptimized + debuginfo] target(s)`

**Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/commands/spotlight.rs
git commit -m "feat(spotlight): setHidesOnDeactivate — native hide on app deactivate"
```

---

## Task 2: Center spotlight on the monitor under the cursor

**Why:** `spotlight_position()` always uses `app.primary_monitor()`. On a two-monitor setup, if the user's cursor (and focus) is on the secondary monitor, the spotlight opens on monitor 1 — wrong screen. Fix: iterate `available_monitors()`, find the one whose bounds contain the cursor position.

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs:34-54` (`spotlight_position`)

**Step 1: Understand the current function signature and return type**

`spotlight_position` takes `&AppHandle` and returns `(f64, f64)` — the `(x, y)` top-left position for the window. The window size is fixed at `680 × 480` logical pixels.

**Step 2: Replace the function body**

Replace the entire `spotlight_position` function with:

```rust
/// Compute the centered position for the spotlight window.
/// Targets the monitor whose bounds contain the current cursor position.
/// Falls back to the primary monitor, then to a hardcoded default.
fn spotlight_position(app: &AppHandle) -> (f64, f64) {
    let window_w = 680.0_f64;
    let window_h = 480.0_f64;

    // Try to find which monitor the cursor is on
    let cursor_monitor: Option<tauri::Monitor> = (|| {
        let cursor = app.cursor_position().ok()?;
        let monitors = app.available_monitors().ok()?;
        monitors.into_iter().find(|m| {
            let pos = m.position();
            let size = m.size();
            let scale = m.scale_factor();
            // Convert physical cursor coords to logical for comparison
            let lx = cursor.x;
            let ly = cursor.y;
            let mx = pos.x as f64 / scale;
            let my = pos.y as f64 / scale;
            let mw = size.width as f64 / scale;
            let mh = size.height as f64 / scale;
            lx >= mx && lx < mx + mw && ly >= my && ly < my + mh
        })
    })();

    let monitor = cursor_monitor
        .or_else(|| app.primary_monitor().ok().flatten());

    let (screen_w, screen_h, screen_x, screen_y) = if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        (
            size.width as f64 / scale,
            size.height as f64 / scale,
            pos.x as f64 / scale,
            pos.y as f64 / scale,
        )
    } else {
        (1440.0, 900.0, 0.0, 0.0)
    };

    let x = screen_x + (screen_w - window_w) / 2.0;
    let y = screen_y + (screen_h - window_h) / 2.0;
    (x, y)
}
```

Also update the hardcoded `window_w`/`window_h` inside `open_spotlight_window` to use `const` values to avoid duplication. At the top of the file, before `set_macos_collection_behavior`, add:

```rust
const SPOTLIGHT_W: f64 = 680.0;
const SPOTLIGHT_H: f64 = 480.0;
```

Then replace all `680.0_f64` / `480.0_f64` in `open_spotlight_window` with `SPOTLIGHT_W` / `SPOTLIGHT_H`. Also update `spotlight_position` to use these consts:

```rust
let window_w = SPOTLIGHT_W;
let window_h = SPOTLIGHT_H;
```

**Step 3: Build Rust**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: clean build.

**Step 4: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs
git commit -m "feat(spotlight): center on monitor under cursor, not always primary"
```

---

## Task 3: Non-activating panel — don't steal app-activation from other apps

**Why:** Currently clicking the spotlight window makes LouvorJA the "frontmost app" in macOS. A user who was typing in Word and opens spotlight sees their Word focus lost. `NSWindowStyleMask::nonactivatingPanel` tells macOS this is a tool panel — it takes key focus (can receive keyboard input) but doesn't change the frontmost application.

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs` — extend `set_macos_collection_behavior`
- Modify: `src-tauri/Cargo.toml` — add `NSPanel` feature if not already there (done in Task 1)

**Step 1: Verify `NSPanel` feature is in Cargo.toml**

```bash
grep 'objc2-app-kit' src-tauri/Cargo.toml
```

Expected: `features = ["NSWindow", "NSPanel"]` (added in Task 1).

**Step 2: Add `NSWindowStyleMask` import and apply it**

Inside `set_macos_collection_behavior`, extend the import line and add the style mask call:

```rust
use objc2_app_kit::{NSStatusWindowLevel, NSWindowCollectionBehavior, NSWindowStyleMask};
```

Then inside the `unsafe` block, after `setHidesOnDeactivate`, add:

```rust
// Non-activating: clicking the panel doesn't steal app-activation from
// whatever app the user was in (Word, browser, etc.)
let mut mask = ns_win.styleMask();
mask |= NSWindowStyleMask::NonactivatingPanel;
ns_win.setStyleMask(mask);
```

**Step 3: Build Rust**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

If `NSWindowStyleMask::NonactivatingPanel` does not exist in objc2-app-kit 0.3.2, use the raw integer value instead. Check with:

```bash
cargo doc --manifest-path src-tauri/Cargo.toml --open 2>/dev/null; grep -r "NonactivatingPanel" ~/.cargo/registry/src/ 2>/dev/null | head -5
```

If the constant is missing, use the raw bit value `0x00000080` (bit 7 of NSWindowStyleMask):

```rust
// NSWindowStyleMask NonactivatingPanel = 1 << 7 = 128
let raw_mask = ns_win.styleMask().bits() | 128;
let new_mask = NSWindowStyleMask::from_bits_truncate(raw_mask);
ns_win.setStyleMask(new_mask);
```

**Step 4: Build again to confirm**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs
git commit -m "feat(spotlight): non-activating panel — preserve foreground app focus"
```

---

## Task 4: `setReleasedWhenClosed(false)` — keep window reusable after Cmd+W

**Why:** On macOS, closing a window (Cmd+W or the red button) calls `[NSWindow close]`, which by default deallocates the window object (releasedWhenClosed = YES). The spotlight window is a persistent resource — it should be hidden, not destroyed. Without this fix, closing it via Cmd+W destroys the NSWindow object, causing the next `app.get_webview_window("spotlight")` call to return `None` and forcing a full recreation.

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs` — extend `set_macos_collection_behavior`

**Step 1: Add `setReleasedWhenClosed` call**

Inside `set_macos_collection_behavior`, inside the `unsafe` block, after the NonactivatingPanel mask, add:

```rust
// Prevent NSWindow deallocation on close — keep the window alive for
// hide/show cycling without full recreation cost.
ns_win.setReleasedWhenClosed(false);
```

**Step 2: Build Rust**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: clean build.

**Step 3: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs
git commit -m "fix(spotlight): setReleasedWhenClosed(false) — window survives Cmd+W"
```

---

## Task 5: Drive input focus from Rust `"spotlight-shown"` event, remove `setTimeout` hack

**Why:** `spotlight.tsx:107` uses `setTimeout(() => inputRef.current?.focus(), 50)` — a 50ms arbitrary delay to wait for the window to finish animating before focusing the input. This is fragile (animations vary) and creates a noticeable flash on slower machines. The fix: emit a `"spotlight-shown"` event from Rust after the window is visible, and listen for it in the frontend to focus reliably.

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs` — emit event in `open_spotlight_window`
- Modify: `src/routes/spotlight.tsx` — replace `setTimeout` with event listener

**Step 1: Emit `"spotlight-shown"` from Rust after show/focus**

In `open_spotlight_window`, in both branches (existing window and new window), emit the event after show:

For the **existing window branch** (around line 62–71), after `let _ = win.set_focus();`:

```rust
let _ = win.emit("spotlight-shown", ());
```

For the **new window branch** (after the `build()` call, inside the `if let Some(win)` block at line 102):

```rust
let _ = win.emit("spotlight-shown", ());
```

`win.emit()` requires `use tauri::Emitter;` — that import is already at the top of the file (line 2: `use tauri::{AppHandle, Emitter, Manager};`). No change needed.

**Step 2: Replace the JS `onFocusChanged` focus logic**

In `src/routes/spotlight.tsx`, find the `onFocusChanged` `useEffect` (lines 97–112). This currently:
1. Resets query/results on focus gained
2. Calls `setTimeout(() => inputRef.current?.focus(), 50)` on focus gained

Replace the entire effect with two separate effects — one for the reset logic driven by `"spotlight-shown"`, one keeping the focus-on-show:

```tsx
// Reset state and focus input when spotlight becomes visible — driven by
// a Rust event to ensure timing is correct (window fully shown).
useEffect(() => {
  let unlisten: (() => void) | undefined;
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen("spotlight-shown", () => {
      setQuery("");
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
      // requestAnimationFrame ensures the DOM is painted before focus
      requestAnimationFrame(() => inputRef.current?.focus());
    }).then((fn) => { unlisten = fn; });
  });
  return () => unlisten?.();
}, []);
```

> Note: `listen` is already imported at the top of the file via `@tauri-apps/api/event` — check the current imports and use the existing import if present, or add it.

Check current imports at the top of `spotlight.tsx`. The file imports from `@tauri-apps/api/window` (`getCurrentWindow`) but may not import `listen`. If `listen` is not already imported, add it:

```tsx
import { listen } from "@tauri-apps/api/event";
```

And the effect becomes:

```tsx
useEffect(() => {
  let unlisten: (() => void) | undefined;
  listen("spotlight-shown", () => {
    setQuery("");
    setHymns([]);
    setBibleResults([]);
    setCollectionResults([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }).then((fn) => { unlisten = fn; });
  return () => unlisten?.();
}, []);
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs src/routes/spotlight.tsx
git commit -m "fix(spotlight): replace setTimeout focus hack with spotlight-shown Rust event"
```

---

## Task 6: Fix Collections group heading — copy-paste bug

**Why:** `spotlight.tsx:345` shows `heading={t("commandPalette.navigation")}` for the Collections group. This is a copy-paste error — it duplicates the Navigation group's heading. Collections should have its own heading.

**Files:**
- Modify: `src/routes/spotlight.tsx:345`
- Modify: `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

**Step 1: Add `"collections"` key to all three locale files**

`src/locales/en.json` — inside `"commandPalette"`, after `"bible": "Bible Verses",`:
```json
"collections": "Collections"
```

`src/locales/pt.json` — same location:
```json
"collections": "Coleções"
```

`src/locales/es.json` — same location:
```json
"collections": "Colecciones"
```

**Step 2: Fix the heading in `spotlight.tsx`**

Line 345 — change:
```tsx
heading={t("commandPalette.navigation")}
```
to:
```tsx
heading={t("commandPalette.collections")}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/routes/spotlight.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "fix(spotlight): correct collections group heading (copy-paste bug)"
```

---

## Task 7: Fix `aria-selected` icon colors not following selection highlight

**Why:** Nav, action, and hymn rows turn blue (`aria-selected:text-blue-600`) when selected, but their inner icons have a hardcoded `text-gray-400` class with no `aria-selected` variant. The icon stays gray while the text turns blue — visually inconsistent. The fix uses Tailwind's `group` + `group-aria-selected:` pattern already established on hymn rows.

**Files:**
- Modify: `src/routes/spotlight.tsx` — three `<Icon>` components inside Command.Item rows

**Step 1: Identify the three locations**

1. **Nav items** — `spotlight.tsx` around line 239: `<Icon className="h-4 w-4 shrink-0 text-gray-400 aria-selected:text-blue-500" />`
   Wait — the nav `Command.Item` does NOT have `group` class. The `aria-selected` pseudo-class must be on the row to cascade to children via `group`.

2. **Action items** — around line 258: `<Icon className="h-4 w-4 shrink-0 text-gray-400" />`

3. **Hymn items** — around line 281: `<Music className="h-4 w-4 shrink-0 text-gray-400" />`

**Step 2: Add `group` to the `Command.Item` className for nav, action, and hymn rows**

For nav `Command.Item` (line ~236), add `group` to className:
```tsx
className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
```

For action `Command.Item` (line ~253), add `group` to className:
```tsx
className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
```

(Hymn rows already have `group` — verify at line ~278.)

**Step 3: Update icon classNames to use `group-aria-selected:`**

For nav icon:
```tsx
<Icon className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
```

For action icon:
```tsx
<Icon className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
```

For hymn `<Music>` icon:
```tsx
<Music className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
```

For bible `<BookOpen>` icon (line ~318):
```tsx
<BookOpen className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
```

For collections `<FolderOpen>` icon (line ~357):
```tsx
<FolderOpen className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/routes/spotlight.tsx
git commit -m "fix(spotlight): aria-selected icon colors follow row selection highlight"
```

---

## Task 8: i18n — footer hint labels (hardcoded English strings)

**Why:** The footer in `spotlight.tsx:377-379` has `↑↓ Navigate`, `↩ Open`, `⎋ Close` hardcoded in English. These must use i18n keys so they display correctly for PT and ES users.

**Files:**
- Modify: `src/routes/spotlight.tsx:377-379`
- Modify: `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

**Step 1: Add keys to all three locale files**

`src/locales/en.json` — inside `"spotlight"`, after `"projectToScreen"`:
```json
"hintNavigate": "↑↓ Navigate",
"hintOpen": "↩ Open",
"hintClose": "⎋ Close"
```

`src/locales/pt.json`:
```json
"hintNavigate": "↑↓ Navegar",
"hintOpen": "↩ Abrir",
"hintClose": "⎋ Fechar"
```

`src/locales/es.json`:
```json
"hintNavigate": "↑↓ Navegar",
"hintOpen": "↩ Abrir",
"hintClose": "⎋ Cerrar"
```

**Step 2: Replace hardcoded strings in `spotlight.tsx`**

Lines 377–379 — change:
```tsx
<span>↑↓ Navigate</span>
<span>↩ Open</span>
<span>⎋ Close</span>
```
to:
```tsx
<span>{t("spotlight.hintNavigate")}</span>
<span>{t("spotlight.hintOpen")}</span>
<span>{t("spotlight.hintClose")}</span>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/routes/spotlight.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "fix(spotlight): i18n footer hint labels (was hardcoded English)"
```

---

## Task 9: Remove `loop` from `<Command>` — bounded list navigation

**Why:** `<Command loop>` at `spotlight.tsx:201` means `ArrowUp` on the first item wraps to the last item. macOS Spotlight and every major command palette (VS Code, Linear, Raycast) use a bounded list — pressing up at the top does nothing. This is a deliberate UX expectation: the list has a top and a bottom. Remove the `loop` prop.

**Files:**
- Modify: `src/routes/spotlight.tsx:201`

**Step 1: Remove the `loop` prop**

Line 201 — change:
```tsx
<Command shouldFilter={false} loop>
```
to:
```tsx
<Command shouldFilter={false}>
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/routes/spotlight.tsx
git commit -m "fix(spotlight): remove loop prop — bounded list navigation matches macOS convention"
```

---

## Task 10: Final build verification

**Why:** Confirm all 9 previous tasks compile together cleanly — both Rust and TypeScript — before closing the branch.

**Step 1: Full Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
```

Expected: `Finished dev [unoptimized + debuginfo] target(s)` with no warnings about unused imports.

**Step 2: Frontend build (regenerates routeTree.gen.ts)**

```bash
pnpm vite build 2>&1 | tail -10
```

Expected: clean build with no TS errors or Vite warnings.

**Step 3: TypeScript strict check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

**Step 4: Final commit if any files were auto-modified**

```bash
git status
# If routeTree.gen.ts or other generated files changed:
git add src/routeTree.gen.ts
git commit -m "chore: regenerate route tree after spotlight improvements"
```
