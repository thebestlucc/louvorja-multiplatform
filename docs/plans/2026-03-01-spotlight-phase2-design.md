# Spotlight Phase 2 Design

**Goal:** Fix fullscreen overlay regression, change default shortcut to CmdOrCtrl+Shift+L, and add drag-to-reposition on the search bar.

## Root Cause: Fullscreen Overlay Broken

`set_macos_collection_behavior` in `spotlight.rs` calls `setStyleMask` (added in Task 3) **after** `setLevel`. On macOS, changing the style mask internally resets the window level. The window ends up at the default level, below the fullscreen app. Additionally, `NSWindowStyleMask::NonactivatingPanel` is only valid for `NSPanel` subclasses — setting it on a regular `NSWindow` is undefined behaviour.

## Changes

### 1. Fix fullscreen overlay — `src-tauri/src/commands/spotlight.rs`

- Remove the entire `setStyleMask(NonactivatingPanel)` block (lines 36–39)
- Replace `NSStatusWindowLevel` (25) with `NSPopUpMenuWindowLevel` (101) — higher level, reliable above fullscreen apps on modern macOS
- Move `setLevel` to be the **last** call in the `unsafe` block (after `setHidesOnDeactivate` and `setReleasedWhenClosed`) to prevent any internal reset from preceding setters
- Update the doc comment to reflect `NSPopUpMenuWindowLevel`

Final order inside `unsafe`:
1. `setCollectionBehavior(CanJoinAllSpaces | FullScreenAuxiliary)`
2. `setHidesOnDeactivate(true)`
3. `setReleasedWhenClosed(false)`
4. `setLevel(NSPopUpMenuWindowLevel)` ← last, so nothing resets it

### 2. Default shortcut — `src-tauri/src/lib.rs`

Line 157: `"Alt+K"` → `"CmdOrCtrl+Shift+L"`

`CmdOrCtrl` maps to `Cmd` on macOS and `Ctrl` on Windows/Linux. Existing users with a custom DB binding are unaffected (the default is only used when no DB value exists).

### 3. Draggable search bar — `src/routes/spotlight.tsx`

Add `data-tauri-drag-region` to the outer search-bar `<div>` (the row containing the search icon + `Command.Input`). Add `cursor-grab` to the div so the pointer signals draggability. Add `cursor-text` to the `Command.Input` to restore normal text-cursor UX (the webview's automatic `no-drag` on interactive children handles the actual drag suppression).

Position resets to screen center on every open (existing behaviour, no change needed).

## Non-changes

- No new Rust dependencies
- No new npm packages
- `setReleasedWhenClosed` and `setHidesOnDeactivate` from the previous phase stay
- `CanJoinAllSpaces | FullScreenAuxiliary` collection behaviour stays
- Position persistence: none (always re-centers, by design)
