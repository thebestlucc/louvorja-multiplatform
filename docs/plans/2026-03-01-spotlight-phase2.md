# Spotlight Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix fullscreen overlay regression (NonactivatingPanel style mask was resetting the window level), change the default shortcut to CmdOrCtrl+Shift+L, and make the search bar draggable.

**Architecture:** Three independent changes — one Rust fix to `set_macos_collection_behavior`, one string change in `lib.rs`, and one HTML attribute + CSS change in `spotlight.tsx`. No new dependencies. No new commands. No new routes.

**Tech Stack:** Tauri 2, Rust, objc2-app-kit 0.3.2, React 19, TypeScript, Tailwind CSS v4

---

## Task 1: Fix fullscreen overlay — remove NonactivatingPanel, raise level, reorder calls

**Root cause context:** In `set_macos_collection_behavior`, `setStyleMask` is called AFTER `setLevel`. On macOS, changing the style mask triggers an internal window reconfiguration that resets the window level to the default. The spotlight ends up behind the fullscreen app. Fix: remove `setStyleMask` entirely (it's invalid for `NSWindow` anyway — `NonactivatingPanel` is an `NSPanel`-only flag) and replace `NSStatusWindowLevel` (25) with `NSPopUpMenuWindowLevel` (101), which reliably floats above fullscreen content on modern macOS. Move `setLevel` to be the last call so nothing can reset it.

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs:14-45`

**Step 1: Read the current `set_macos_collection_behavior` function**

```
src-tauri/src/commands/spotlight.rs lines 7–45
```

Current unsafe block order: setCollectionBehavior → setLevel → setHidesOnDeactivate → setStyleMask(NonactivatingPanel) → setReleasedWhenClosed

**Step 2: Replace the entire `set_macos_collection_behavior` function**

Replace everything from the `#[cfg(target_os = "macos")]` line through the closing `}` of the function with:

```rust
/// On macOS, configure the spotlight window so it:
/// - appears on every Space (CanJoinAllSpaces)
/// - floats above fullscreen apps (FullScreenAuxiliary + NSPopUpMenuWindowLevel)
/// - hides automatically when the app loses focus (setHidesOnDeactivate)
/// - survives Cmd+W without being deallocated (setReleasedWhenClosed)
///
/// IMPORTANT: setLevel must be the LAST call. Changing the style mask or
/// other properties before setLevel can cause macOS to internally reset the
/// window level to its default, placing the spotlight behind fullscreen apps.
#[cfg(target_os = "macos")]
fn set_macos_collection_behavior(win: &tauri::WebviewWindow) {
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSPopUpMenuWindowLevel, NSWindowCollectionBehavior};

    if let Ok(ns_win_ptr) = win.ns_window() {
        // SAFETY: Tauri gives us the raw NSWindow pointer; we only call methods
        // that are safe on any NSWindow from the main thread.
        unsafe {
            let ns_win = &*(ns_win_ptr as *const AnyObject as *const objc2_app_kit::NSWindow);
            // CanJoinAllSpaces: visible on every Space
            // FullScreenAuxiliary: allowed to enter a fullscreen Space
            let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary;
            ns_win.setCollectionBehavior(behavior);
            // Hide automatically when the app loses focus (no IPC round-trip needed)
            ns_win.setHidesOnDeactivate(true);
            // Prevent NSWindow deallocation on close — keep alive for hide/show cycling
            ns_win.setReleasedWhenClosed(false);
            // NSPopUpMenuWindowLevel (101) floats above fullscreen app content.
            // Must be set LAST — any setStyleMask call after this resets the level.
            ns_win.setLevel(NSPopUpMenuWindowLevel);
        }
    }
}
```

Key changes from the old version:
- Import `NSPopUpMenuWindowLevel` instead of `NSStatusWindowLevel` and `NSWindowStyleMask`
- Removed the entire `setStyleMask(NonactivatingPanel)` block (was invalid on NSWindow, was resetting the level)
- `setLevel` is now last

**Step 3: Build Rust**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
```

Expected: `Finished dev [unoptimized + debuginfo] target(s)` — no errors about missing imports.

If `NSPopUpMenuWindowLevel` is not found, it's behind a feature flag. Check:
```bash
grep -r "NSPopUpMenuWindowLevel" ~/.cargo/registry/src/*/objc2-app-kit-0.3.2/src/ | head -3
```
It should already be exported from `NSWindow` feature (confirmed available). If not, add `"NSWindow"` to the objc2-app-kit features in `src-tauri/Cargo.toml` (it's already there, so this shouldn't be needed).

**Step 4: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs
git commit -m "fix(spotlight): use NSPopUpMenuWindowLevel, remove NonactivatingPanel — fix fullscreen overlay"
```

---

## Task 2: Change default shortcut to CmdOrCtrl+Shift+L

**Context:** The global shortcut for the spotlight is registered in `lib.rs` setup. The default string `"Alt+K"` is used when no user-configured value exists in the DB. `CmdOrCtrl` is Tauri's cross-platform modifier — maps to `Cmd` on macOS, `Ctrl` on Windows/Linux.

**Files:**
- Modify: `src-tauri/src/lib.rs:157`

**Step 1: Find the line**

```bash
grep -n 'app-command-palette' src-tauri/src/lib.rs
```

Expected output: `157:    ("app-command-palette", "Alt+K"),`

**Step 2: Change the default string**

Line 157 — change:
```rust
("app-command-palette", "Alt+K"),
```
to:
```rust
("app-command-palette", "CmdOrCtrl+Shift+L"),
```

**Step 3: Build Rust**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: clean build.

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(spotlight): change default shortcut to CmdOrCtrl+Shift+L"
```

---

## Task 3: Draggable search bar

**Context:** Tauri's `data-tauri-drag-region` attribute on an element calls the native window drag API on mousedown. The webview automatically applies `no-drag` to interactive children (inputs, buttons), so typing and clicking results are unaffected. We add the attribute to the search bar row div only (not the entire panel), add `cursor-grab` to signal draggability, and add `cursor-text` on the input to restore the expected text cursor.

Position always resets to screen center on the next open (existing behaviour — `open_spotlight_window` calls `spotlight_position()` and sets position on every show). No Rust changes needed.

**Files:**
- Modify: `src/routes/spotlight.tsx` — the search bar `<div>` (lines ~203–219)

**Step 1: Read the current search bar section**

```
src/routes/spotlight.tsx lines 200–220
```

The search bar is the `<div>` inside `<Command>` that wraps the search icon/loader and `Command.Input`. It currently looks like:

```tsx
{/* ── Search bar ── */}
<div className="flex items-center gap-2.5 px-4 py-3.5">
  {searching ? (
    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
  ) : (
    <Search className="h-5 w-5 shrink-0 text-gray-400" />
  )}
  <Command.Input
    ref={inputRef}
    autoFocus
    value={query}
    onValueChange={setQuery}
    placeholder={t("commandPalette.placeholder")}
    className="flex-1 bg-transparent text-[17px] text-gray-900 outline-none placeholder:text-gray-400"
  />
</div>
```

**Step 2: Add drag region and cursor styles**

Change the search bar `<div>` opening tag from:
```tsx
<div className="flex items-center gap-2.5 px-4 py-3.5">
```
to:
```tsx
<div
  data-tauri-drag-region
  className="flex cursor-grab items-center gap-2.5 px-4 py-3.5 active:cursor-grabbing"
>
```

Change `Command.Input` className from:
```tsx
className="flex-1 bg-transparent text-[17px] text-gray-900 outline-none placeholder:text-gray-400"
```
to:
```tsx
className="flex-1 cursor-text bg-transparent text-[17px] text-gray-900 outline-none placeholder:text-gray-400"
```

The `cursor-text` on the input overrides the parent's `cursor-grab` so the user sees the expected I-beam cursor when hovering over the text field. `active:cursor-grabbing` changes to a closed fist cursor while dragging.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Fix rounded corners — outer wrapper needs padding**

The inner panel already has `rounded-2xl overflow-hidden`, but the outer wrapper has `p-0`, meaning the panel sits flush with the window edges and the drop shadow is clipped. Add `p-3` so the shadow and corners breathe.

Change the outer wrapper `<div>` (first `<div>` in the return, line ~196) from:
```tsx
<div className="flex w-screen justify-center bg-transparent p-0">
```
to:
```tsx
<div className="flex w-screen justify-center bg-transparent p-3">
```

The `overflow-hidden rounded-2xl` on the inner panel already clips the backdrop blur and background to the rounded shape. Adding outer padding makes the shadow visible on all four sides and gives the window a floating, gracefully-rounded appearance.

**Step 5: Commit**

```bash
git add src/routes/spotlight.tsx
git commit -m "feat(spotlight): draggable search bar, gracefully rounded corners"
```

---

## Task 4: Final build verification

**Step 1: Full Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Finished dev [unoptimized + debuginfo] target(s)`

**Step 2: Frontend build**

```bash
pnpm vite build 2>&1 | tail -10
```

Expected: `✓ built in Xs` — no errors.

**Step 3: TypeScript strict check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

**Step 4: Commit if generated files changed**

```bash
git status
# Only commit if routeTree.gen.ts or similar generated files were modified:
git add src/routeTree.gen.ts
git commit -m "chore: regenerate after spotlight phase 2"
```
