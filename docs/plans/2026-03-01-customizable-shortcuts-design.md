# Customizable Keyboard Shortcuts — Design

**Date:** 2026-03-01
**Status:** Approved

## Overview

Add a Shortcuts tab inside the Settings route that lets users customize both local (in-app) and global (OS-level) keyboard shortcuts. Conflicts are prevented. A shortcut opens the shortcuts help modal. The Settings page is refactored to a sidebar-nav + content-area layout (matching the reference UI image).

---

## Settings Page Refactor

The current `/settings/index.tsx` monolithic page is split into a two-column layout:
- **Left sidebar** (~220px): nav items with icons — General, Appearance, Shortcuts, Monitor, Streaming, Migration, Data
- **Right content area**: renders the selected section

Use a `useState<SettingsTab>` in `SettingsIndex` to track the active tab. Each section becomes a sub-component rendered conditionally. No route changes needed — stays at `/settings/`.

---

## Shortcut Definitions

```ts
interface ShortcutDefinition {
  id: string              // e.g. "display-toggle-projector"
  category: "app" | "slides" | "display"
  labelKey: string        // i18n key for display
  defaultLocal?: string   // e.g. "F5"  (undefined = not a local shortcut)
  defaultGlobal?: string  // e.g. "Alt+Right" (undefined = not a global shortcut)
}
```

Defined in a single source-of-truth file: `src/lib/shortcut-definitions.ts`.
The `KeyboardShortcutsPanel` and `use-keyboard.ts` both import from this file.

**Shortcut IDs (initial set):**
| ID | Default Local | Default Global |
|----|--------------|----------------|
| `slides-next` | `ArrowRight` | `Alt+Right` |
| `slides-prev` | `ArrowLeft` | `Alt+Left` |
| `slides-clear` | `Escape` | — |
| `display-projector` | `F5` | — |
| `display-return` | `Shift+F5` | — |
| `display-black` | `B` | `Alt+B` |
| `display-logo` | `L` | `Alt+L` |
| `app-command-palette` | `Cmd+K` | `Alt+K` |
| `app-shortcuts-help` | `Cmd+/` | `Alt+H` |

---

## Storage

Shortcuts stored in the existing SQLite `settings` table as key-value pairs:

- Key format: `shortcut.<id>.local` → value: key combo string e.g. `"F5"` or `"Shift+F5"`
- Key format: `shortcut.<id>.global` → value: key combo string e.g. `"Alt+Right"`

Defaults used if no row exists for a shortcut. A null/empty value means "unset" (shortcut disabled).

---

## Conflict Detection

On every "Record" save attempt:
1. Collect all current local bindings (custom + defaults for un-customized shortcuts).
2. Collect all current global bindings.
3. If the new combo matches any other binding in the same layer (local or global), block save and show an inline conflict warning: `"Already used by: [action name]"`.
4. Cross-layer conflicts (same combo used as both local and global) are warned but not blocked (they operate at different layers).

---

## Key Recording UX

Each row in the Shortcuts tab:
```
[Action label]    [kbd key chip(s)]    [+ Record]
```

Clicking "Record" on a row:
- Row enters "recording" state — shows "Recording…" badge
- Captures the next `keydown` event (excludes Tab, Escape = cancel)
- Pressing Escape cancels recording without changes
- On capture: checks conflicts → if none, saves to SQLite → re-registers global if applicable
- Row returns to normal state showing new key combo

---

## Global Shortcut Re-registration (Rust)

New Tauri command: `update_global_shortcut(action: String, shortcut_str: String) -> Result<(), AppError>`

- Unregisters the existing shortcut for that action (tracked in a `HashMap<String, Shortcut>` in `AppState`)
- Parses and registers the new shortcut string
- Emits `"global-shortcut"` events with the same action payloads as before

On app startup, `lib.rs` reads all `shortcut.*.global` settings from SQLite and registers the custom (or default) shortcuts instead of hardcoded ones.

---

## Shortcuts Help Modal Update

`keyboard-shortcuts-panel.tsx` imports `SHORTCUT_DEFINITIONS` from `shortcut-definitions.ts` and reads current custom values from SQLite (via TanStack Query) to display actual current bindings instead of hardcoded strings.

A global keyboard shortcut `Alt+H` (default) is added to open the shortcuts panel — registered via `tauri_plugin_global_shortcut` so it works system-wide.

A global keyboard shortcut `Alt+K` (default) is added to open the command palette (global search) — also registered via `tauri_plugin_global_shortcut`. The Rust handler emits `"global-shortcut"` with payload `"open-command-palette"`. The frontend listens in `use-keyboard.ts` and calls `openCommandPalette()` (the existing dispatcher used by `Cmd+K`).

---

## i18n

New keys added to all three locale files (`en.json`, `pt.json`, `es.json`):
- `settings.tabs.*` — tab labels
- `settings.shortcuts.*` — section headers, record/recording labels, conflict messages

---

## Files Changed

**New:**
- `src/lib/shortcut-definitions.ts` — single source of truth for all shortcuts

**Modified:**
- `src/routes/settings/index.tsx` — sidebar nav layout + Shortcuts tab component
- `src/hooks/use-keyboard.ts` — reads custom shortcuts from SQLite at init
- `src/components/utilities/keyboard-shortcuts-panel.tsx` — shows live custom bindings
- `src-tauri/src/lib.rs` — reads custom global shortcuts from DB on startup
- `src-tauri/src/commands/settings.rs` — new `update_global_shortcut` command
- `src-tauri/src/state.rs` — add `global_shortcuts: Mutex<HashMap<String, Shortcut>>` field
- `src/lib/tauri.ts` — typed wrapper for `update_global_shortcut`
- `src/lib/queries.ts` — query hooks for shortcut settings
- `src/locales/en.json`, `pt.json`, `es.json` — new i18n keys
