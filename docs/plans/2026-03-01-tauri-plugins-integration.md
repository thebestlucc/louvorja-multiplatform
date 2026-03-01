# Tauri Plugins Integration Plan

> **For Agents:** REQUIRED SUB-SKILL: Use ring:executing-plans to implement this plan task-by-task.

**Goal:** Integrate 7 Tauri plugins (window-state, single-instance, global-shortcut, store, opener, clipboard-manager, autostart) to add native desktop capabilities.

**Architecture:** Each plugin is installed via `pnpm tauri add <plugin>` which auto-registers Cargo dep, permissions, and `app.plugin()` init. Frontend wrappers use `@tauri-apps/plugin-*` JS packages. Plugins are independent of each other -- order is by priority, not dependency.

**Tech Stack:** Tauri 2.9.4 plugins, Rust, TypeScript, React 19, i18next

**Global Prerequisites:**
- Environment: macOS (darwin), Node 18+, Rust 1.77+, pnpm
- Tools: `pnpm --version`, `cargo --version`, `rustc --version`
- State: Clean working tree on `main` branch, create feature branch first

**Verification before starting:**
```bash
pnpm --version        # Expected: 8.0+ or 9.0+
cargo --version       # Expected: 1.77+
git status            # Expected: clean working tree
```

---

### Task 0: Create feature branch

**Step 1:** Create and switch to branch

```bash
git checkout -b feat/tauri-plugins-integration
```

**Step 2:** Verify

```bash
git branch --show-current
```

**Expected output:** `feat/tauri-plugins-integration`

---

## Plugin 1: window-state (Persist window geometry)

### Task 1.1: Install window-state plugin

**Step 1:** Install

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform
pnpm tauri add window-state
```

**Expected output:** Plugin added to Cargo.toml, permissions config created, `app.plugin()` line added to lib.rs (or needs manual addition).

**Step 2:** Verify Cargo.toml has the dep

```bash
grep "window-state" src-tauri/Cargo.toml
```

**Expected:** Line containing `tauri-plugin-window-state`

**Step 3:** Verify permissions

```bash
cat src-tauri/capabilities/default.json | grep -i window-state
```

**Expected:** `"window-state:default"` or similar permission entry

**If Task Fails:**
- If `pnpm tauri add` fails, manually add `tauri-plugin-window-state = "2"` to `src-tauri/Cargo.toml` under `[dependencies]`
- Add permission `"window-state:default"` to `src-tauri/capabilities/default.json`
- Add `app.plugin(tauri_plugin_window_state::Builder::default().build());` to `lib.rs` setup

### Task 1.2: Configure window-state in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Context:** The `pnpm tauri add` command may add a basic `.plugin(tauri_plugin_window_state::init())` but we need the Builder pattern to configure which windows to save state for (only "main", not "projector"/"return").

**Step 1:** In `src-tauri/src/lib.rs`, locate the plugin registration block (around line 43-46). Add or replace the window-state plugin registration. Place it BEFORE `create_main_window` call so the plugin can restore state when the main window is created.

Find this block in `lib.rs`:
```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
```

Replace with:
```rust
    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
```

**Note:** The window-state plugin automatically saves/restores position and size for all windows. Projector/return windows explicitly set fullscreen + position in `open_fullscreen_window()`, which overrides restored state, so no filtering is needed.

**Step 2:** Verify build

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

**Expected output:** Compiles successfully

**Step 3:** Commit

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/ src-tauri/gen/
git commit -m "feat: add window-state plugin to persist main window geometry"
```

**If Task Fails:**
1. **Compilation error on import:** Add `use tauri_plugin_window_state;` or check crate name
2. **Rollback:** `git checkout -- .`

---

## Plugin 2: single-instance (Prevent duplicate instances)

### Task 2.1: Install single-instance plugin

**Step 1:** Install

```bash
pnpm tauri add single-instance
```

**Step 2:** Verify

```bash
grep "single-instance" src-tauri/Cargo.toml
```

### Task 2.2: Configure single-instance in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1:** Add the single-instance plugin to the builder chain in `lib.rs`. Place it as the first plugin (before window-state). The callback focuses the existing main window when a second instance is launched.

After the `.plugin(tauri_plugin_window_state::Builder::new()...` line, the full plugin chain should start with:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.unminimize();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
```

**Step 2:** Verify build

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

**Step 3:** Commit

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/ src-tauri/gen/
git commit -m "feat: add single-instance plugin to prevent duplicate app windows"
```

**If Task Fails:**
1. **`unminimize` not found:** Use `let _ = win.set_minimized(false);` instead
2. **Rollback:** `git checkout -- .`

---

## Plugin 3: global-shortcut (OS-wide keyboard shortcuts)

### Task 3.1: Install global-shortcut plugin

**Step 1:** Install

```bash
pnpm tauri add global-shortcut
```

**Step 2:** Verify

```bash
grep "global-shortcut" src-tauri/Cargo.toml
```

### Task 3.2: Register global shortcuts in lib.rs setup

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Context:** Current in-app shortcuts (in `use-keyboard.ts`) only work when the app is focused. Global shortcuts should be opt-in and registered in Rust. We register them in `setup()` after all state is managed.

**Step 1:** Add the plugin to the builder chain (after single-instance):

```rust
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
```

**Step 2:** After the `create_main_window(app.handle())?;` line in `setup()`, add global shortcut registration:

```rust
            // Register global shortcuts (opt-in, configured via settings)
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

                let app_handle = app.handle().clone();

                // B key — toggle black screen
                // Note: Global shortcuts for single keys (B, L) can interfere with typing.
                // Only register arrow-based shortcuts globally; B/L stay as in-app only.

                // Right arrow — next slide
                let app_clone = app_handle.clone();
                let _ = app_handle.global_shortcut().on_shortcut(
                    "Alt+Right".parse::<Shortcut>().unwrap(),
                    move |_app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = app_clone.emit("global-shortcut", "next-slide");
                        }
                    },
                );

                // Left arrow — prev slide
                let app_clone = app_handle.clone();
                let _ = app_handle.global_shortcut().on_shortcut(
                    "Alt+Left".parse::<Shortcut>().unwrap(),
                    move |_app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = app_clone.emit("global-shortcut", "prev-slide");
                        }
                    },
                );

                // Alt+B — black screen (safe modifier combo)
                let app_clone = app_handle.clone();
                let _ = app_handle.global_shortcut().on_shortcut(
                    "Alt+B".parse::<Shortcut>().unwrap(),
                    move |_app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = app_clone.emit("global-shortcut", "toggle-black");
                        }
                    },
                );

                // Alt+L — logo screen
                let app_clone = app_handle.clone();
                let _ = app_handle.global_shortcut().on_shortcut(
                    "Alt+L".parse::<Shortcut>().unwrap(),
                    move |_app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = app_clone.emit("global-shortcut", "toggle-logo");
                        }
                    },
                );
            }
```

**Step 3:** Verify build

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

**Step 4:** Commit

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/ src-tauri/gen/
git commit -m "feat: register global shortcuts (Alt+Arrow, Alt+B, Alt+L) via global-shortcut plugin"
```

### Task 3.3: Listen for global shortcuts on frontend

**Files:**
- Modify: `src/hooks/use-keyboard.ts`

**Step 1:** Add a `useEffect` that listens for the `global-shortcut` Tauri event and dispatches the corresponding actions. Add this inside the `useKeyboard` function, after the existing `useEffect`:

```typescript
  useEffect(() => {
    if (!enabled) return;

    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<string>("global-shortcut", (event) => {
        switch (event.payload) {
          case "next-slide":
            nextSlide();
            break;
          case "prev-slide":
            prevSlide();
            break;
          case "toggle-black":
            toggleBlackScreen();
            break;
          case "toggle-logo":
            toggleLogoScreen();
            break;
        }
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      unlisten?.();
    };
  }, [enabled, nextSlide, prevSlide, toggleBlackScreen, toggleLogoScreen]);
```

**Step 2:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 3:** Commit

```bash
git add src/hooks/use-keyboard.ts
git commit -m "feat: handle global-shortcut events in useKeyboard hook"
```

### Task 3.4: Update i18n with global shortcut labels

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/es.json`

**Step 1:** Add entries under `shortcuts.items` in each locale file.

In `en.json`, add after the `"toggleLogo"` entry in `shortcuts.items`:
```json
      "globalNextSlide": "Next slide (global)",
      "globalPrevSlide": "Previous slide (global)",
      "globalBlack": "Toggle black screen (global)",
      "globalLogo": "Toggle logo screen (global)"
```

In `pt.json`, add the same keys:
```json
      "globalNextSlide": "Proximo slide (global)",
      "globalPrevSlide": "Slide anterior (global)",
      "globalBlack": "Alternar tela preta (global)",
      "globalLogo": "Alternar tela logo (global)"
```

In `es.json`:
```json
      "globalNextSlide": "Siguiente diapositiva (global)",
      "globalPrevSlide": "Diapositiva anterior (global)",
      "globalBlack": "Alternar pantalla negra (global)",
      "globalLogo": "Alternar pantalla logo (global)"
```

**Step 2:** Commit

```bash
git add src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat: add i18n keys for global shortcut labels"
```

**If Task Fails:**
1. **JSON syntax error:** Validate with `node -e "require('./src/locales/en.json')"`
2. **Rollback:** `git checkout -- src/locales/`

---

## Plugin 4: store (Key-value store for new settings)

### Task 4.1: Install store plugin

**Step 1:** Install

```bash
pnpm tauri add store
```

**Step 2:** Verify

```bash
grep "tauri-plugin-store" src-tauri/Cargo.toml
```

### Task 4.2: Create store utility wrapper on frontend

**Files:**
- Create: `src/lib/store.ts`

**Context:** The store plugin is for NEW settings only (window layout preferences, UI state). Existing SQLite settings stay in SQLite. The store plugin auto-persists to disk.

**Step 1:** Create `src/lib/store.ts`:

```typescript
import { load } from "@tauri-apps/plugin-store";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("app-preferences.json", { autoSave: true });
  }
  return storeInstance;
}

export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  const store = await getStore();
  const value = await store.get<T>(key);
  return value ?? defaultValue;
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
}

export async function deletePreference(key: string): Promise<void> {
  const store = await getStore();
  await store.delete(key);
}
```

**Step 2:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 3:** Commit

```bash
git add src/lib/store.ts src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/ src-tauri/gen/
git commit -m "feat: add store plugin with typed preference helpers"
```

**If Task Fails:**
1. **Module not found:** Run `pnpm install` to ensure `@tauri-apps/plugin-store` is installed
2. **Rollback:** `git checkout -- . && rm -f src/lib/store.ts`

---

## Plugin 5: opener (Replace custom shell-open logic)

### Task 5.1: Verify opener is already installed

**Context:** The opener plugin is ALREADY in `Cargo.toml` (line 26: `tauri-plugin-opener = "2.5.2"`) and registered in `lib.rs` (line 45). We only need to ensure the frontend JS package is available and used correctly.

**Step 1:** Verify JS package

```bash
grep "@tauri-apps/plugin-opener" package.json
```

If not found:
```bash
pnpm add @tauri-apps/plugin-opener
```

**Step 2:** Verify opener is used anywhere for URL opening. Currently streaming-controls uses `navigator.clipboard` for copy and likely `window.open` for URLs. Check:

```bash
grep -r "openUrl\|revealItemInDir\|window.open" src/ --include="*.ts" --include="*.tsx" | head -20
```

**Step 3:** Commit (if any changes)

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: ensure opener plugin JS package is available"
```

### Task 5.2: Use opener for URL and file reveal actions

**Files:**
- Modify: `src/components/streaming/streaming-controls.tsx`

**Context:** The streaming controls have an "Open in browser" button. Replace `window.open()` with the opener plugin's `openUrl()` for native browser opening.

**Step 1:** Read the current streaming-controls.tsx to find the open-in-browser handler and replace it.

At the top of the file, add:
```typescript
import { openUrl } from "@tauri-apps/plugin-opener";
```

Find any `window.open(url)` calls and replace with:
```typescript
await openUrl(url);
```

**Step 2:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 3:** Commit

```bash
git add src/components/streaming/streaming-controls.tsx
git commit -m "feat: use opener plugin for native URL opening in streaming controls"
```

---

### Code Review Checkpoint 1

**After Plugins 1-5, run code review:**

1. **Dispatch all 5 reviewers in parallel:**
   - REQUIRED SUB-SKILL: Use ring:requesting-code-review
   - All reviewers run simultaneously
   - Wait for all to complete

2. **Handle findings by severity:**
   - Critical/High/Medium: Fix immediately, re-run reviewers
   - Low: Add `TODO(review):` comments
   - Cosmetic: Add `FIXME(nitpick):` comments

3. **Proceed only when zero Critical/High/Medium issues remain**

---

## Plugin 6: clipboard-manager (Copy lyrics/verses)

### Task 6.1: Install clipboard-manager plugin

**Step 1:** Install

```bash
pnpm tauri add clipboard-manager
```

**Step 2:** Verify

```bash
grep "clipboard-manager" src-tauri/Cargo.toml
```

### Task 6.2: Create clipboard utility wrapper

**Files:**
- Create: `src/lib/clipboard.ts`

**Step 1:** Create `src/lib/clipboard.ts`:

```typescript
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * Copy text to the system clipboard using the native Tauri plugin.
 * Falls back to navigator.clipboard for non-Tauri environments (dev/test).
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await writeText(text);
  } catch {
    // Fallback for web dev mode
    await navigator.clipboard.writeText(text);
  }
}
```

**Step 2:** Commit

```bash
git add src/lib/clipboard.ts src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/ src-tauri/gen/
git commit -m "feat: add clipboard-manager plugin with copyToClipboard helper"
```

### Task 6.3: Replace navigator.clipboard usage with plugin

**Files:**
- Modify: `src/components/streaming/streaming-controls.tsx`
- Modify: `src/routes/utilities/text.tsx`

**Step 1:** In both files, replace `navigator.clipboard.writeText(...)` with the new helper.

Add import at the top of each file:
```typescript
import { copyToClipboard } from "../../lib/clipboard";
```
(Adjust relative path based on file location: `../../lib/clipboard` for streaming-controls, `../../lib/clipboard` for utilities/text)

Replace all occurrences of `navigator.clipboard.writeText(text)` with `copyToClipboard(text)`.

In `streaming-controls.tsx`, also remove the `if (!navigator.clipboard)` guard since the helper handles fallback.

**Step 2:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 3:** Commit

```bash
git add src/components/streaming/streaming-controls.tsx src/routes/utilities/text.tsx
git commit -m "refactor: use clipboard plugin instead of navigator.clipboard"
```

### Task 6.4: Add "Copy lyrics" button to hymn detail page

**Files:**
- Modify: `src/routes/hymnal/$hymnId.tsx`

**Context:** The hymn detail page shows stanzas and has action buttons. Add a "Copy lyrics" button that copies all lyrics text to clipboard.

**Step 1:** Read `src/routes/hymnal/$hymnId.tsx` to find the action buttons area (near "Sung", "Playback", "Slides only", "Show lyrics" buttons).

Add import:
```typescript
import { copyToClipboard } from "../../lib/clipboard";
import { Copy } from "lucide-react";
```

Add a button next to the existing action buttons:
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    if (hymn?.lyrics) {
      await copyToClipboard(hymn.lyrics);
      toast.success(t("hymn.lyricsCopied"));
    }
  }}
>
  <Copy className="h-4 w-4 mr-1" />
  {t("hymn.copyLyrics")}
</Button>
```

**Step 2:** Add i18n keys to all three locale files.

In `en.json` under `"hymn"`:
```json
    "copyLyrics": "Copy lyrics",
    "lyricsCopied": "Lyrics copied to clipboard"
```

In `pt.json` under `"hymn"`:
```json
    "copyLyrics": "Copiar letra",
    "lyricsCopied": "Letra copiada"
```

In `es.json` under `"hymn"`:
```json
    "copyLyrics": "Copiar letra",
    "lyricsCopied": "Letra copiada al portapapeles"
```

**Step 3:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 4:** Commit

```bash
git add src/routes/hymnal/\$hymnId.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat: add copy lyrics button to hymn detail page"
```

### Task 6.5: Add "Copy verse" button to Bible view

**Files:**
- Modify: `src/components/bible/verse-display.tsx` (or wherever Bible verse rendering is)

**Context:** Similar to hymn copy -- add a copy button for selected Bible verses.

**Step 1:** Find the Bible verse display component. Read it and add a copy button.

Add import:
```typescript
import { copyToClipboard } from "../../lib/clipboard";
import { Copy } from "lucide-react";
```

Add a copy button near each verse or as a toolbar action. The exact location depends on the component structure -- look for the existing "Project" or "Add to Service" buttons and place the copy button alongside.

```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={async () => {
    const text = `${reference}\n${verseText}`;
    await copyToClipboard(text);
    toast.success(t("bible.verseCopied"));
  }}
  title={t("bible.copyVerse")}
>
  <Copy className="h-4 w-4" />
</Button>
```

**Step 2:** Add i18n keys.

In `en.json` under `"bible"`:
```json
    "copyVerse": "Copy verse",
    "verseCopied": "Verse copied to clipboard"
```

In `pt.json` under `"bible"`:
```json
    "copyVerse": "Copiar versiculo",
    "verseCopied": "Versiculo copiado"
```

In `es.json` under `"bible"`:
```json
    "copyVerse": "Copiar versiculo",
    "verseCopied": "Versiculo copiado al portapapeles"
```

**Step 3:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 4:** Commit

```bash
git add src/components/bible/ src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat: add copy verse button to Bible view"
```

---

## Plugin 7: autostart (Launch at startup)

### Task 7.1: Install autostart plugin

**Step 1:** Install

```bash
pnpm tauri add autostart
```

**Step 2:** Verify

```bash
grep "autostart" src-tauri/Cargo.toml
```

### Task 7.2: Configure autostart plugin in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1:** Add the plugin to the builder chain:

```rust
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
```

**Step 2:** Verify build

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

**Step 3:** Commit

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/ src-tauri/gen/
git commit -m "feat: add autostart plugin with LaunchAgent on macOS"
```

### Task 7.3: Add autostart toggle to Settings UI

**Files:**
- Modify: `src/routes/settings/index.tsx`

**Step 1:** Add imports at top of the file:

```typescript
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
```

**Step 2:** Inside `SettingsIndex` component, add state and effect for autostart:

```typescript
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  useEffect(() => {
    isEnabled().then(setAutoStartEnabled).catch(() => {});
  }, []);

  const handleAutoStartToggle = async () => {
    try {
      if (autoStartEnabled) {
        await disable();
        setAutoStartEnabled(false);
      } else {
        await enable();
        setAutoStartEnabled(true);
      }
    } catch (err) {
      toast.error(String(err));
    }
  };
```

**Step 3:** Add a toggle in the Settings UI. Find the Appearance section and add a new row after the language selector:

```tsx
<div className="flex items-center justify-between">
  <div>
    <p className="text-sm font-medium">{t("settings.autoStart")}</p>
    <p className="text-xs text-muted-foreground">{t("settings.autoStartDesc")}</p>
  </div>
  <Button
    variant={autoStartEnabled ? "default" : "outline"}
    size="sm"
    onClick={handleAutoStartToggle}
  >
    {autoStartEnabled ? t("settings.autoStartOn") : t("settings.autoStartOff")}
  </Button>
</div>
```

**Step 4:** Add i18n keys (note: `settings.autoStart` already exists for streaming auto-start; use a distinct key).

In `en.json` under `"settings"`:
```json
    "launchAtStartup": "Launch at startup",
    "launchAtStartupDesc": "Automatically open LouvorJA when your computer starts.",
    "autoStartOn": "Enabled",
    "autoStartOff": "Disabled"
```

In `pt.json`:
```json
    "launchAtStartup": "Iniciar com o sistema",
    "launchAtStartupDesc": "Abrir LouvorJA automaticamente ao ligar o computador.",
    "autoStartOn": "Ativado",
    "autoStartOff": "Desativado"
```

In `es.json`:
```json
    "launchAtStartup": "Iniciar con el sistema",
    "launchAtStartupDesc": "Abrir LouvorJA automaticamente al encender el computador.",
    "autoStartOn": "Activado",
    "autoStartOff": "Desactivado"
```

**Note:** Update the JSX to use `t("settings.launchAtStartup")` and `t("settings.launchAtStartupDesc")` instead of `t("settings.autoStart")`.

**Step 5:** Verify TypeScript

```bash
npx tsc --noEmit
```

**Step 6:** Commit

```bash
git add src/routes/settings/index.tsx src/locales/en.json src/locales/pt.json src/locales/es.json
git commit -m "feat: add launch-at-startup toggle in Settings UI"
```

---

### Code Review Checkpoint 2

**After Plugins 6-7, run code review:**

1. **Dispatch all 5 reviewers in parallel:**
   - REQUIRED SUB-SKILL: Use ring:requesting-code-review
   - All reviewers run simultaneously
   - Wait for all to complete

2. **Handle findings by severity (same rules as Checkpoint 1)**

3. **Proceed only when zero Critical/High/Medium issues remain**

---

### Task 8: Final verification build

**Step 1:** Full frontend build

```bash
pnpm vite build
```

**Expected output:** Build succeeds

**Step 2:** TypeScript check

```bash
npx tsc --noEmit
```

**Expected output:** No errors

**Step 3:** Full Rust build

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

**Expected output:** Compiles successfully

**Step 4:** Full dev mode smoke test

```bash
pnpm tauri dev
```

**Expected:** App launches, main window restores previous position, single-instance prevents second launch, settings page shows autostart toggle.

**Step 5:** Commit any final fixes

```bash
git add -A
git commit -m "chore: final build verification for tauri plugins integration"
```

---

### Task 9: Update CLAUDE.md with new patterns

**Files:**
- Modify: `CLAUDE.md`

**Step 1:** Add the following entries:

Under **Tech Stack** table, add:
```
| Plugins    | window-state, single-instance, global-shortcut, store, opener, clipboard-manager, autostart |
```

Under **General** section, add:
```
- **Tauri plugin-store:** For NEW preferences only (UI state, layout). Existing SQLite settings stay in SQLite. Use `src/lib/store.ts` helpers (`getPreference`/`setPreference`).
- **Clipboard:** Use `src/lib/clipboard.ts` `copyToClipboard()` instead of `navigator.clipboard.writeText()`. Handles native plugin with web fallback.
- **Global shortcuts:** Registered in `lib.rs` setup, emitted as `"global-shortcut"` events. Listened in `use-keyboard.ts`. Use `Alt+` modifier for global keys to avoid conflicts with typing.
```

**Step 2:** Commit

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with tauri plugin patterns"
```
