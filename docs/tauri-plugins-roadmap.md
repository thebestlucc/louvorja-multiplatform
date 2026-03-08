# Tauri Plugins Roadmap

Plugins evaluated for future refactoring or new features. Each entry notes the relevance to LouvorJA and suggested use case.

---

## High Priority / Strong Fit

### `tauri-plugin-window-state`
**Purpose:** Automatically saves and restores window position/size across sessions.
**Relevance:** LouvorJA opens multiple windows (main/Playing now, projector, return). Currently no window state is persisted — users must resize/reposition on every launch.
**Suggested use:** Persist main window geometry. Projector/return windows intentionally go fullscreen so they may be excluded via `StateFlags`.
**Install:** `pnpm tauri add window-state`

---

### `tauri-plugin-single-instance`
**Purpose:** Prevents multiple app instances from running simultaneously.
**Relevance:** A worship app should never open twice accidentally. A second launch attempt could confuse audio/projector state.
**Suggested use:** Register as a guard at startup. Emit a `single-instance` event to bring the existing window to focus instead of opening a duplicate.
**Install:** `pnpm tauri add single-instance`

---

### `tauri-plugin-global-shortcut`
**Purpose:** Register OS-wide keyboard shortcuts that work even when the app is not focused.
**Relevance:** Worship operators often alt-tab out of the app. Global shortcuts for B (black screen), L (logo screen), arrow keys (next/prev slide) would make live operation much safer.
**Current state:** Shortcuts only work when LouvorJA is the focused window (`useKeyboard` hook).
**Suggested use:** Phase 9/polish — offer opt-in global shortcuts for projection controls.
**Install:** `pnpm tauri add global-shortcut`

---

### `tauri-plugin-store`
**Purpose:** Persistent key-value store, accessible from both Rust and TypeScript.
**Relevance:** LouvorJA currently persists settings via custom SQLite tables (`settings` table in `db/queries/settings.rs`). For simpler non-relational preferences (theme, language, window layout, default monitor), a key-value store is less overhead.
**Trade-off:** Migrating existing settings requires a data migration step. Evaluate for new settings only, not replacing the DB.
**Install:** `pnpm tauri add store`

---

### `tauri-plugin-opener`
**Purpose:** Open URLs, files, and folders with the system's default application.
**Relevance:** Multiple planned/existing features benefit: opening exported `.slja` files in Finder/Explorer, opening URLs from service annotations, opening video files externally.
**Current state:** Some file opening is done via `shell::open` workarounds.
**Suggested use:** Replace any custom shell-open logic with this plugin.
**Install:** `pnpm tauri add opener`

---

## Medium Priority / Useful for Specific Features

### `tauri-plugin-clipboard-manager`
**Purpose:** Read/write system clipboard (text, HTML).
**Relevance:** Copy-to-clipboard for hymn lyrics, Bible verses, service notes. Currently no clipboard integration exists.
**Suggested use:** "Copy lyrics" button on hymn detail, "Copy verse" on Bible view.
**Platform:** Linux, Windows, macOS, Android, iOS.
**Install:** `pnpm tauri add clipboard-manager`

---

### `tauri-plugin-fs`
**Purpose:** Cross-platform file system API accessible from TypeScript.
**Relevance:** LouvorJA already does file operations via Rust commands (archive import/export, video path resolution). This plugin exposes file ops to the frontend directly — useful for drag-and-drop file reading without a round-trip to Rust.
**Trade-off:** Current architecture keeps file ops in Rust for security. Frontend file access adds a permission surface. Use selectively.
**Install:** `pnpm tauri add fs`

---

### `tauri-plugin-upload`
**Purpose:** Upload/download files over HTTP with progress callbacks.
**Relevance:** Useful if cloud backup of `.slja` collections or hymn libraries is ever added. Also relevant for downloading hymn packs from a remote server.
**Current state:** No remote file transfer exists.
**Suggested use:** Phase 10 (Migration & Deploy) — importing hymn collections from LouvorJA server.
**Install:** `pnpm tauri add upload`

---

### `tauri-plugin-autostart`
**Purpose:** Register app to launch at system startup.
**Relevance:** Churches often want the worship app to auto-open when the presentation computer boots. A user-facing toggle in settings ("Launch at startup") would be a polished Phase 9 feature.
**Install:** `pnpm tauri add autostart`

---

### `tauri-plugin-persisted-scope`
**Purpose:** Automatically persists filesystem permission scopes granted by the user across sessions.
**Relevance:** When users grant LouvorJA access to a media folder (videos, backgrounds), that permission currently needs to be re-granted after restart. This plugin restores scopes automatically.
**Suggested use:** Pair with `tauri-plugin-fs` when frontend file access is introduced.
**Install:** `pnpm tauri add persisted-scope`

---

### `tauri-plugin-positioner`
**Purpose:** Place windows at predefined screen positions (e.g., `TopRight`, `TrayLeft`).
**Relevance:** Could help with the Playing now screen or tray popup positioning. Currently projector/return windows are manually positioned based on monitor bounds via `open_fullscreen_window()`.
**Trade-off:** LouvorJA's fullscreen logic is custom and intentional. This plugin is more useful for small popup windows (e.g., a quick lyrics overlay widget).
**Install:** `pnpm tauri add positioner`

---

## Low Priority / Niche Use

### `tauri-plugin-sql`
**Purpose:** Frontend-accessible SQL (SQLite, MySQL, PostgreSQL) via `sqlx`.
**Relevance:** LouvorJA already uses `rusqlite` directly in Rust with a mature query layer (`db/queries/`). Migrating to this plugin would mean rewriting all DB logic in frontend-accessible SQL — a significant refactor with questionable benefit.
**Verdict:** Not recommended for migration. The current Rust-layer DB pattern is more secure and already well-established. Evaluate only if adding a MySQL/PostgreSQL remote DB for multi-device sync.

---

### `tauri-plugin-stronghold`
**Purpose:** Encrypted secrets vault (IOTA Stronghold).
**Relevance:** No current secrets management need. Could be relevant if LouvorJA ever integrates with external APIs requiring API keys (e.g., Bible cloud sync, streaming services).
**Verdict:** Low priority. Overkill for current feature set.

---

### `tauri-plugin-shell`
**Purpose:** Execute shell commands and open files via system shell.
**Relevance:** Some workarounds may exist that could be replaced with `tauri-plugin-opener` instead. Direct shell execution is a security risk and should be avoided unless there's a specific need.
**Verdict:** Prefer `tauri-plugin-opener` for file/URL opening. Avoid raw shell execution.

---

## Already in Use

| Plugin | Status |
|--------|--------|
| `tauri-plugin-updater` | Installed — auto-update system (Phase installers-pipeline, complete) |

---

## Installation Notes

All plugins are installed with:
```bash
pnpm tauri add <plugin-name>
```
This automatically:
1. Adds the Cargo dependency to `src-tauri/Cargo.toml`
2. Adds permissions config to `src-tauri/capabilities/`
3. Registers `app.plugin(tauri_plugin_*::init())` in `lib.rs`

After installing, verify `lib.rs` plugin registration and add any required permissions to the capability files.
