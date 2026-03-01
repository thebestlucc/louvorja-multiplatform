# Customizable Keyboard Shortcuts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Shortcuts settings tab with customizable local + global keyboard shortcuts, conflict detection, key recording UX, and global shortcuts for command palette and shortcuts modal.

**Architecture:** Single source-of-truth `shortcut-definitions.ts` drives the shortcuts panel, use-keyboard hook, and settings tab. Custom values stored in SQLite settings table as `shortcut.<id>.local/global`. Global shortcuts re-registered at runtime via a new `update_global_shortcut` Tauri command. Settings page refactored to sidebar-nav + content layout.

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, tauri_plugin_global_shortcut, rusqlite, TanStack Query, i18next, Tailwind v4

---

### Task 1: Create shortcut-definitions source-of-truth

**Files:**
- Create: `src/lib/shortcut-definitions.ts`

**Step 1: Create the file**

```ts
// src/lib/shortcut-definitions.ts
// Single source of truth for all keyboard shortcut definitions.
// Both the shortcuts panel and use-keyboard.ts import from here.

export interface ShortcutDefinition {
  id: string;
  category: "app" | "slides" | "display";
  labelKey: string;       // i18n key, e.g. "shortcuts.items.nextSlide"
  defaultLocal?: string;  // key combo for in-app (e.g. "ArrowRight", "F5", "Shift+F5")
  defaultGlobal?: string; // key combo for OS-level (e.g. "Alt+Right")
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "slides-next",
    category: "slides",
    labelKey: "shortcuts.items.nextSlide",
    defaultLocal: "ArrowRight",
    defaultGlobal: "Alt+Right",
  },
  {
    id: "slides-prev",
    category: "slides",
    labelKey: "shortcuts.items.previousSlide",
    defaultLocal: "ArrowLeft",
    defaultGlobal: "Alt+Left",
  },
  {
    id: "slides-clear",
    category: "slides",
    labelKey: "shortcuts.items.clearProjection",
    defaultLocal: "Escape",
  },
  {
    id: "display-projector",
    category: "display",
    labelKey: "shortcuts.items.toggleProjector",
    defaultLocal: "F5",
  },
  {
    id: "display-return",
    category: "display",
    labelKey: "shortcuts.items.toggleReturn",
    defaultLocal: "Shift+F5",
  },
  {
    id: "display-black",
    category: "display",
    labelKey: "shortcuts.items.toggleBlack",
    defaultLocal: "b",
    defaultGlobal: "Alt+B",
  },
  {
    id: "display-logo",
    category: "display",
    labelKey: "shortcuts.items.toggleLogo",
    defaultLocal: "l",
    defaultGlobal: "Alt+L",
  },
  {
    id: "app-command-palette",
    category: "app",
    labelKey: "shortcuts.items.openCommandPalette",
    defaultLocal: "Meta+k",
    defaultGlobal: "Alt+K",
  },
  {
    id: "app-shortcuts-help",
    category: "app",
    labelKey: "shortcuts.items.openShortcutsHelp",
    defaultLocal: "Meta+/",
    defaultGlobal: "Alt+H",
  },
];

export const SHORTCUT_CATEGORY_ORDER: ShortcutDefinition["category"][] = [
  "app",
  "slides",
  "display",
];

// Resolve a stored combo string into a display label array for <kbd> chips.
// e.g. "Shift+F5" → ["Shift", "F5"], "Meta+k" → ["Cmd/Ctrl", "K"]
export function comboToDisplayKeys(combo: string): string[] {
  return combo.split("+").map((part) => {
    switch (part.toLowerCase()) {
      case "meta": return "Cmd/Ctrl";
      case "shift": return "Shift";
      case "alt": return "Alt/Option";
      case "ctrl": return "Ctrl";
      default: return part.toUpperCase();
    }
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/shortcut-definitions.ts
git commit -m "feat: add shortcut-definitions source of truth"
```

---

### Task 2: Add i18n keys for shortcuts settings tab

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`

**Step 1: Add keys to en.json**

Find the `"settings"` object and add inside it (or create it if absent):

```json
"settings": {
  "tabs": {
    "general": "General",
    "appearance": "Appearance",
    "shortcuts": "Shortcuts",
    "monitor": "Monitor",
    "streaming": "Streaming",
    "migration": "Migration",
    "data": "Data"
  },
  "shortcuts": {
    "description": "Customize and manage your keyboard shortcuts to navigate and perform actions faster.",
    "localLabel": "In-App",
    "globalLabel": "Global",
    "record": "Record",
    "recording": "Recording...",
    "cancel": "Cancel",
    "clear": "Clear",
    "conflict": "Already used by: {{action}}",
    "unset": "---"
  }
}
```

**Step 2: Add same keys to pt.json**

```json
"settings": {
  "tabs": {
    "general": "Geral",
    "appearance": "Aparência",
    "shortcuts": "Atalhos",
    "monitor": "Monitor",
    "streaming": "Streaming",
    "migration": "Migração",
    "data": "Dados"
  },
  "shortcuts": {
    "description": "Personalize e gerencie seus atalhos de teclado para navegar e executar ações mais rapidamente.",
    "localLabel": "No App",
    "globalLabel": "Global",
    "record": "Gravar",
    "recording": "Gravando...",
    "cancel": "Cancelar",
    "clear": "Limpar",
    "conflict": "Já usado por: {{action}}",
    "unset": "---"
  }
}
```

**Step 3: Add same keys to es.json**

```json
"settings": {
  "tabs": {
    "general": "General",
    "appearance": "Apariencia",
    "shortcuts": "Atajos",
    "monitor": "Monitor",
    "streaming": "Streaming",
    "migration": "Migración",
    "data": "Datos"
  },
  "shortcuts": {
    "description": "Personaliza y gestiona tus atajos de teclado para navegar y realizar acciones más rápido.",
    "localLabel": "En App",
    "globalLabel": "Global",
    "record": "Grabar",
    "recording": "Grabando...",
    "cancel": "Cancelar",
    "clear": "Limpiar",
    "conflict": "Ya usado por: {{action}}",
    "unset": "---"
  }
}
```

> **Note:** The existing `"shortcuts"` key is for the shortcuts _panel_ modal. The new `"settings.shortcuts"` is for the _settings tab_. They are separate namespaces — do not replace the existing `"shortcuts"` key.

**Step 4: Commit**

```bash
git add src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "i18n: add settings tabs and shortcuts settings keys"
```

---

### Task 3: Add Rust state for global shortcuts tracking

**Files:**
- Modify: `src-tauri/src/state.rs`

**Step 1: Add `global_shortcuts` field to `AppState`**

The field holds a map of action IDs → registered shortcut strings (so we can unregister before re-registering).

At the top of `state.rs`, add this import (it belongs after the existing `use` statements):

```rust
use std::collections::HashMap;
```

Inside the `AppState` struct (around line 170), add the new field after `slide_context`:

```rust
pub global_shortcuts: Mutex<HashMap<String, String>>,
```

**Step 2: Update `AppState` construction in `lib.rs`**

In `lib.rs`, find where `AppState` is constructed with `app.manage(AppState { ... })` and add:

```rust
global_shortcuts: Mutex::new(HashMap::new()),
```

**Step 3: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat(rust): add global_shortcuts tracking map to AppState"
```

---

### Task 4: Add `update_global_shortcut` Tauri command

**Files:**
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add the command to `settings.rs`**

Add after the existing `set_setting` command:

```rust
#[tauri::command]
pub fn update_global_shortcut(
    action: String,
    shortcut_str: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let mut shortcuts_map = state
        .global_shortcuts
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Unregister the previous shortcut for this action if one exists
    if let Some(old_str) = shortcuts_map.get(&action) {
        if let Ok(old_shortcut) = old_str.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(old_shortcut);
        }
    }

    // Empty string means "unset" — just unregister without re-registering
    if shortcut_str.is_empty() {
        shortcuts_map.remove(&action);
        return Ok(());
    }

    let shortcut = shortcut_str
        .parse::<Shortcut>()
        .map_err(|e| AppError::Internal(format!("Invalid shortcut: {}", e)))?;

    let action_clone = action.clone();
    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app_clone.emit("global-shortcut", &action_clone);
            }
        })
        .map_err(|e| AppError::Internal(format!("Failed to register shortcut: {}", e)))?;

    shortcuts_map.insert(action, shortcut_str);
    Ok(())
}
```

**Step 2: Register the command in `lib.rs`**

Find the `.invoke_handler(tauri::generate_handler![` block and add `commands::settings::update_global_shortcut` to the list (alongside `get_setting`, `set_setting`, etc.).

**Step 3: Verify Rust builds**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -40
```

Expected: no errors. Fix any type/import issues before continuing.

**Step 4: Commit**

```bash
git add src-tauri/src/commands/settings.rs src-tauri/src/lib.rs
git commit -m "feat(rust): add update_global_shortcut command"
```

---

### Task 5: Migrate startup global shortcut registration to use DB values

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Replace hardcoded global shortcut block**

Find the `// Register global shortcuts (opt-in, configured via settings)` block in the `setup()` closure (around line 145). Replace the entire block with a version that reads from SQLite and falls back to defaults:

```rust
// Register global shortcuts — reads custom values from DB, falls back to defaults
{
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    // (action_id, default_shortcut_str)
    let global_defaults: &[(&str, &str)] = &[
        ("slides-next", "Alt+Right"),
        ("slides-prev", "Alt+Left"),
        ("display-black", "Alt+B"),
        ("display-logo", "Alt+L"),
        ("app-command-palette", "Alt+K"),
        ("app-shortcuts-help", "Alt+H"),
    ];

    let conn = app
        .state::<AppState>()
        .db
        .lock()
        .map_err(|e| tauri::Error::from(tauri::Error::AssetNotFound(e.to_string())))?;

    let mut shortcuts_map = app
        .state::<AppState>()
        .global_shortcuts
        .lock()
        .map_err(|e| tauri::Error::from(tauri::Error::AssetNotFound(e.to_string())))?;

    for (action, default_str) in global_defaults {
        // Read custom value from DB; fall back to default
        let key = format!("shortcut.{}.global", action);
        let combo_str = crate::db::queries::settings::get_setting(&conn, &key)
            .ok()
            .map(|s| s.value)
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| default_str.to_string());

        if let Ok(shortcut) = combo_str.parse::<Shortcut>() {
            let action_id = action.to_string();
            let app_clone = app.handle().clone();
            let _ = app.handle().global_shortcut().on_shortcut(
                shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app_clone.emit("global-shortcut", &action_id);
                    }
                },
            );
            shortcuts_map.insert(action.to_string(), combo_str);
        }
    }

    drop(conn);
    drop(shortcuts_map);
}
```

> **Note:** The `tauri::Error::AssetNotFound` is a hack for mapping mutex errors — use `AppError::Internal` if you have access to it. The important thing is the setup closure accepts `Result<(), Box<dyn Error>>` so any error type that implements `Error` works.

**Step 2: Verify build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -40
```

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): load global shortcuts from DB on startup with defaults"
```

---

### Task 6: Add frontend tauri wrapper and query hooks

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/lib/queries.ts`

**Step 1: Add `updateGlobalShortcut` wrapper to `tauri.ts`**

Find the end of the file and add:

```ts
export async function updateGlobalShortcut(
  action: string,
  shortcutStr: string,
): Promise<void> {
  return invoke("update_global_shortcut", { action, shortcutStr });
}
```

**Step 2: Add shortcut query hooks to `queries.ts`**

The shortcut settings are read/written via the existing `useSetting` / `useSetSetting` hooks — no new query hooks needed for reads.

Add a dedicated mutation hook for updating a global shortcut (which also calls the Tauri command to re-register it):

```ts
import { updateGlobalShortcut } from "./tauri";

export function useSetShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; layer: "local" | "global"; value: string }) => {
      const key = `shortcut.${vars.id}.${vars.layer}`;
      await setSetting(key, vars.value);
      if (vars.layer === "global") {
        await updateGlobalShortcut(vars.id, vars.value);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["setting", `shortcut.${vars.id}.${vars.layer}`] });
    },
  });
}
```

> Import `setSetting` from `./tauri` (it already exists as the typed wrapper for `set_setting`).

**Step 3: Commit**

```bash
git add src/lib/tauri.ts src/lib/queries.ts
git commit -m "feat: add updateGlobalShortcut tauri wrapper and useSetShortcut hook"
```

---

### Task 7: Update use-keyboard.ts to handle new global-shortcut payloads

**Files:**
- Modify: `src/hooks/use-keyboard.ts`

**Step 1: Add handlers for the two new global shortcut actions**

In the `listen<string>("global-shortcut")` handler, add cases for `"app-command-palette"` and `"app-shortcuts-help"`:

```ts
case "app-command-palette":
  // Simulate Cmd+K to open the command palette (same as the header button does)
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
  );
  break;
case "app-shortcuts-help":
  openKeyboardShortcutsPanel();
  break;
```

> `openKeyboardShortcutsPanel` is already imported at the top of `use-keyboard.ts`.

**Step 2: Commit**

```bash
git add src/hooks/use-keyboard.ts
git commit -m "feat: handle app-command-palette and app-shortcuts-help global shortcuts"
```

---

### Task 8: Update keyboard-shortcuts-panel to use SHORTCUT_DEFINITIONS

**Files:**
- Modify: `src/components/utilities/keyboard-shortcuts-panel.tsx`

**Step 1: Replace hardcoded SHORTCUTS array**

Remove the old local `SHORTCUTS`, `SHORTCUT_CATEGORY_ORDER`, and `ShortcutEntry` definitions. Replace with:

```ts
import { SHORTCUT_DEFINITIONS, SHORTCUT_CATEGORY_ORDER, comboToDisplayKeys } from "../../lib/shortcut-definitions";
import { useSetting } from "../../lib/queries";
```

**Step 2: Add a hook to resolve current bindings**

Inside `KeyboardShortcutsPanel`, add per-shortcut setting queries. Since TanStack Query is conditional-per-hook unfriendly, use a helper component pattern or map the definitions to their SQLite keys and read them.

Simplest approach — read all shortcut settings at once by fetching known keys. Since `useSetting` takes a single key, create a `ShortcutRow` sub-component that reads its own value:

```tsx
function ShortcutRow({ def }: { def: typeof SHORTCUT_DEFINITIONS[number] }) {
  const { t } = useTranslation();
  const { data: localSetting } = useSetting(`shortcut.${def.id}.local`);
  const { data: globalSetting } = useSetting(`shortcut.${def.id}.global`);

  const localCombo = localSetting?.value ?? def.defaultLocal;
  const globalCombo = globalSetting?.value ?? def.defaultGlobal;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm text-foreground">{t(def.labelKey)}</span>
      <div className="flex flex-wrap gap-2">
        {localCombo && (
          <div className="flex gap-1">
            {comboToDisplayKeys(localCombo).map((k) => (
              <kbd key={k} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {k}
              </kbd>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update the grouped render to use `ShortcutRow`**

In `KeyboardShortcutsPanel`, replace the old `grouped.map` render with:

```tsx
const filtered = useMemo(
  () =>
    SHORTCUT_DEFINITIONS.filter((def) => {
      if (!normalizedQuery) return true;
      const label = t(def.labelKey).toLowerCase();
      const category = t(`shortcuts.categories.${def.category}`).toLowerCase();
      return label.includes(normalizedQuery) || category.includes(normalizedQuery);
    }),
  [normalizedQuery, t],
);

const grouped = useMemo(
  () =>
    SHORTCUT_CATEGORY_ORDER.map((category) => ({
      category,
      entries: filtered.filter((def) => def.category === category),
    })).filter((g) => g.entries.length > 0),
  [filtered],
);

// In JSX:
grouped.map((group) => (
  <section key={group.category} className="space-y-2">
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {t(`shortcuts.categories.${group.category}`)}
    </h3>
    <div className="space-y-2">
      {group.entries.map((def) => (
        <ShortcutRow key={def.id} def={def} />
      ))}
    </div>
  </section>
))
```

**Step 4: Commit**

```bash
git add src/components/utilities/keyboard-shortcuts-panel.tsx
git commit -m "feat: update shortcuts panel to use SHORTCUT_DEFINITIONS and live DB values"
```

---

### Task 9: Build the ShortcutsTab component

**Files:**
- Create: `src/components/settings/shortcuts-tab.tsx`

**Step 1: Create the component**

```tsx
// src/components/settings/shortcuts-tab.tsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, Circle } from "lucide-react";
import { cn } from "../../lib/utils";
import { SHORTCUT_DEFINITIONS, SHORTCUT_CATEGORY_ORDER, comboToDisplayKeys } from "../../lib/shortcut-definitions";
import { useSetting, useSetShortcut } from "../../lib/queries";

// Converts a KeyboardEvent into a stored combo string like "Shift+F5" or "Alt+Right"
function eventToComboString(e: KeyboardEvent): string | null {
  // Ignore modifier-only keypresses
  if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("Meta");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(e.key);
  return parts.join("+");
}

// A single shortcut row with inline Record functionality
function ShortcutRow({
  def,
  layer,
  allCurrentBindings,
}: {
  def: (typeof SHORTCUT_DEFINITIONS)[number];
  layer: "local" | "global";
  allCurrentBindings: Record<string, string>; // id+layer → combo
}) {
  const { t } = useTranslation();
  const { data: setting } = useSetting(`shortcut.${def.id}.${layer}`);
  const setShortcut = useSetShortcut();

  const defaultCombo = layer === "local" ? def.defaultLocal : def.defaultGlobal;
  const currentCombo = setting?.value ?? defaultCombo ?? "";

  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const startRecording = useCallback(() => {
    setRecording(true);
    setConflict(null);
  }, []);

  const stopRecording = useCallback(() => setRecording(false), []);

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      const combo = eventToComboString(e);
      if (!combo) return;

      // Conflict check: scan all bindings in the same layer
      const conflictId = Object.entries(allCurrentBindings).find(
        ([key, val]) => val === combo && key !== `${def.id}.${layer}`,
      )?.[0];

      if (conflictId) {
        const [conflictDefId] = conflictId.split(".");
        const conflictDef = SHORTCUT_DEFINITIONS.find((d) => d.id === conflictDefId);
        const conflictLabel = conflictDef ? t(conflictDef.labelKey) : conflictDefId;
        setConflict(t("settings.shortcuts.conflict", { action: conflictLabel }));
        stopRecording();
        return;
      }

      setShortcut.mutate({ id: def.id, layer, value: combo });
      stopRecording();
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [recording, allCurrentBindings, def.id, layer, stopRecording, setShortcut, t]);

  if (!defaultCombo) return null; // This shortcut doesn't have this layer

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
        <div className="flex flex-1 items-center gap-3">
          {currentCombo ? (
            <div className="flex gap-1">
              {comboToDisplayKeys(currentCombo).map((k) => (
                <kbd
                  key={k}
                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {k}
                </kbd>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t("settings.shortcuts.unset")}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {recording ? (
            <span className="flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <Circle className="h-2 w-2 animate-pulse fill-primary" />
              {t("settings.shortcuts.recording")}
            </span>
          ) : (
            <>
              <button
                onClick={startRecording}
                className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                {t("settings.shortcuts.record")}
              </button>
              {currentCombo !== defaultCombo && (
                <button
                  onClick={() => {
                    setShortcut.mutate({ id: def.id, layer, value: defaultCombo ?? "" });
                    setConflict(null);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  title="Reset to default"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {conflict && (
        <p className="px-1 text-xs text-destructive">{conflict}</p>
      )}
    </div>
  );
}

// A full shortcut action row (label + local + global columns)
function ShortcutActionRow({
  def,
  allCurrentBindings,
}: {
  def: (typeof SHORTCUT_DEFINITIONS)[number];
  allCurrentBindings: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-start gap-x-4 gap-y-1 rounded-md border border-border bg-background px-3 py-2">
      <span className="self-center text-sm text-foreground">{t(def.labelKey)}</span>
      <ShortcutRow def={def} layer="local" allCurrentBindings={allCurrentBindings} />
      <ShortcutRow def={def} layer="global" allCurrentBindings={allCurrentBindings} />
    </div>
  );
}

export function ShortcutsTab() {
  const { t } = useTranslation();

  // Build a flat map of all current bindings for conflict detection.
  // Each entry is { "id.layer": "combo" }.
  // We derive this from the definitions + live SQLite values.
  // Since hooks can't be called in a loop, we use a single bulk query approach:
  // just pass the definitions down and let each ShortcutRow self-query.
  // For conflict detection we need an aggregate — compute it from defaults only
  // (good enough for MVP; a future improvement can use live values).
  const allCurrentBindings = Object.fromEntries(
    SHORTCUT_DEFINITIONS.flatMap((def) => {
      const entries: [string, string][] = [];
      if (def.defaultLocal) entries.push([`${def.id}.local`, def.defaultLocal]);
      if (def.defaultGlobal) entries.push([`${def.id}.global`, def.defaultGlobal]);
      return entries;
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("shortcuts.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.shortcuts.description")}</p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Action</span>
        <span>{t("settings.shortcuts.localLabel")}</span>
        <span>{t("settings.shortcuts.globalLabel")}</span>
      </div>

      {SHORTCUT_CATEGORY_ORDER.map((category) => {
        const defs = SHORTCUT_DEFINITIONS.filter((d) => d.category === category);
        if (defs.length === 0) return null;

        return (
          <section key={category} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(`shortcuts.categories.${category}`)}
            </h3>
            <div className="space-y-2">
              {defs.map((def) => (
                <ShortcutActionRow key={def.id} def={def} allCurrentBindings={allCurrentBindings} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/settings/shortcuts-tab.tsx
git commit -m "feat: add ShortcutsTab component with inline key recording and conflict detection"
```

---

### Task 10: Refactor Settings page to sidebar-nav layout with Shortcuts tab

**Files:**
- Modify: `src/routes/settings/index.tsx`

**Step 1: Define the tab list and layout**

At the top of `SettingsIndex`, add:

```tsx
import { ShortcutsTab } from "../../components/settings/shortcuts-tab";
import {
  Sliders, Palette, Keyboard, Monitor, Wifi, Upload, Database,
} from "lucide-react";

type SettingsTab = "general" | "appearance" | "shortcuts" | "monitor" | "streaming" | "migration" | "data";

const SETTINGS_TABS: { id: SettingsTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: Sliders },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
  { id: "shortcuts", labelKey: "settings.tabs.shortcuts", icon: Keyboard },
  { id: "monitor", labelKey: "settings.tabs.monitor", icon: Monitor },
  { id: "streaming", labelKey: "settings.tabs.streaming", icon: Wifi },
  { id: "migration", labelKey: "settings.tabs.migration", icon: Upload },
  { id: "data", labelKey: "settings.tabs.data", icon: Database },
];
```

**Step 2: Add tab state**

Inside `SettingsIndex` function, add:

```tsx
const [activeTab, setActiveTab] = useState<SettingsTab>("general");
```

**Step 3: Replace the page return JSX with sidebar layout**

Replace the current single-column layout with:

```tsx
return (
  <div className="flex h-full overflow-hidden">
    {/* Sidebar nav */}
    <nav className="w-52 flex-shrink-0 border-r border-border bg-surface p-3">
      <ul className="space-y-1">
        {SETTINGS_TABS.map(({ id, labelKey, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                activeTab === id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {t(labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>

    {/* Content area */}
    <main className="flex-1 overflow-y-auto p-6">
      {activeTab === "general" && <GeneralSection />}
      {activeTab === "appearance" && <AppearanceSection />}
      {activeTab === "shortcuts" && <ShortcutsTab />}
      {activeTab === "monitor" && <MonitorSection />}
      {activeTab === "streaming" && <StreamingSection />}
      {activeTab === "migration" && <MigrationSection />}
      {activeTab === "data" && <DataSection />}
    </main>
  </div>
);
```

**Step 4: Extract current settings sections into sub-components**

Move each logical block of the current `SettingsIndex` JSX into named sub-components within the same file:
- `GeneralSection` — language, autostart, ffprobe, collections settings
- `AppearanceSection` — theme picker, projector screen defaults, logo image
- `MonitorSection` — monitor assignment and test buttons
- `StreamingSection` — `<StreamingControls />`
- `MigrationSection` — legacy fetch wizard
- `DataSection` — clear database button

Each sub-component receives the same hooks/state it needs. Move the relevant `useState` declarations into each sub-component where possible to keep `SettingsIndex` clean. Shared settings mutations can be called from hooks directly inside each sub-component.

> **Tip:** Start by copy-pasting the relevant JSX blocks into each sub-component and moving their state/hooks. The TypeScript compiler will flag any missing references. Fix one by one.

**Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Fix all errors before committing.

**Step 6: Commit**

```bash
git add src/routes/settings/index.tsx src/components/settings/
git commit -m "feat: refactor Settings page to sidebar-nav layout with Shortcuts tab"
```

---

### Task 11: Final integration check and TypeScript/build verification

**Step 1: Frontend build**

```bash
pnpm vite build 2>&1 | tail -20
```

Expected: no errors.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: no errors.

**Step 3: Rust build**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error" | head -20
```

Expected: no errors.

**Step 4: Manual smoke test (pnpm tauri dev)**

1. Open Settings → Shortcuts tab
2. Click "Record" on "Toggle Projector (F5)"
3. Press `Alt+F6` — should update the chip to `Alt+F6`
4. Press `Alt+F6` on a different shortcut — conflict warning should appear
5. Press `Cmd/?` or `Alt+H` (with app unfocused) — shortcuts panel should open
6. Press `Alt+K` (with app unfocused) — command palette should open

**Step 5: Final commit**

```bash
git add -u
git commit -m "chore: final build verification for customizable shortcuts"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/shortcut-definitions.ts` | **New** — source of truth |
| `src/components/settings/shortcuts-tab.tsx` | **New** — settings tab component |
| `src/routes/settings/index.tsx` | **Modified** — sidebar layout + sub-components |
| `src/hooks/use-keyboard.ts` | **Modified** — new global shortcut payloads |
| `src/components/utilities/keyboard-shortcuts-panel.tsx` | **Modified** — uses SHORTCUT_DEFINITIONS + live values |
| `src/lib/tauri.ts` | **Modified** — updateGlobalShortcut wrapper |
| `src/lib/queries.ts` | **Modified** — useSetShortcut hook |
| `src/locales/{en,pt,es}.json` | **Modified** — new i18n keys |
| `src-tauri/src/state.rs` | **Modified** — global_shortcuts map |
| `src-tauri/src/lib.rs` | **Modified** — DB-driven startup registration |
| `src-tauri/src/commands/settings.rs` | **Modified** — update_global_shortcut command |
