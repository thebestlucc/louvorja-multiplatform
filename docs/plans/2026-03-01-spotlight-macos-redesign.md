# Spotlight macOS Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the detached spotlight window to look and feel like macOS Spotlight — frosted glass panel, large search field, clean result rows, centered on screen.

**Architecture:** Two changes — (1) Rust window builder gets `transparent(true)` and true screen-center positioning using both width+height; (2) React component gets a complete CSS overhaul using `backdrop-filter: blur` + semi-transparent backgrounds for the glass effect.

**Tech Stack:** Tauri 2 (Rust window builder), React 19, Tailwind CSS v4, cmdk

---

### Task 1: Fix spotlight centering in Rust (always center on screen)

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs`

**Context:** Currently `spotlight_position` only uses `screen_w` and hardcodes `y = screen_y + 120.0`. The window is never vertically centered.

**Step 1: Update `spotlight_position` to use both screen width and height**

Replace the entire `spotlight_position` function:

```rust
fn spotlight_position(app: &AppHandle) -> (f64, f64) {
    let monitor = app.primary_monitor().ok().flatten();
    let (screen_w, screen_h, screen_x, screen_y) = if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        // Divide by scale factor to get logical pixels (Tauri position is in logical px)
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
    let window_w = 680.0_f64;
    let window_h = 480.0_f64;
    let x = screen_x + (screen_w - window_w) / 2.0;
    let y = screen_y + (screen_h - window_h) / 2.0;
    (x, y)
}
```

**Step 2: Also update the window dimensions in `open_spotlight_window`**

In `open_spotlight_window`, change:
```rust
let window_w = 640.0_f64;
let window_h = 440.0_f64;
```
to:
```rust
let window_w = 680.0_f64;
let window_h = 480.0_f64;
```

**Step 3: Add `.transparent(true)` to the WebviewWindowBuilder chain**

In the builder call (after `.shadow(true)`), add:
```rust
.transparent(true)
```

The full builder chain should include:
```rust
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
.visible_on_all_workspaces(true)
```

**Step 4: Verify it compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "error|warning: unused"
```
Expected: no errors

**Step 5: Commit**

```bash
git add src-tauri/src/commands/spotlight.rs
git commit -m "fix: spotlight always centers on screen, transparent window for glass effect"
```

---

### Task 2: Redesign spotlight UI to match macOS Spotlight aesthetic

**Files:**
- Modify: `src/routes/spotlight.tsx`

**Context:** The window is now transparent and centered. We need the React component to render a frosted glass panel with macOS Spotlight proportions.

**Design spec:**
- Outer container: `h-screen w-screen bg-transparent flex items-center justify-center`
- Glass panel: `w-full rounded-2xl overflow-hidden` with `backdrop-blur-3xl bg-black/55 border border-white/10 shadow-2xl`
- Search row: `px-5 py-4 flex items-center gap-3 border-b border-white/10`
- Search icon: `h-6 w-6 text-white/60` (bigger than before)
- Input: `text-[19px] text-white placeholder:text-white/40 bg-transparent outline-none flex-1`
- Result list: `max-h-[380px] overflow-y-auto`
- Group heading: `px-5 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-white/40`
- Result item: `flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 cursor-pointer rounded-xl mx-2 aria-selected:bg-white/15 hover:bg-white/10`
- Item icon container: `h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0`
- Icon inside container: `h-4 w-4 text-white/70`
- Footer: `px-5 py-2.5 border-t border-white/10 flex items-center gap-4 text-[11px] text-white/35`

**Step 1: Replace the return JSX in `SpotlightWindow`**

Replace the entire `return (...)` block with:

```tsx
return (
  <div className="flex h-screen w-screen items-center justify-center bg-transparent">
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/55 shadow-2xl backdrop-blur-3xl">
      <Command shouldFilter={false} loop>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          {searching ? (
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-white/50" />
          ) : (
            <svg
              className="h-6 w-6 shrink-0 text-white/50"
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
            ref={inputRef}
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 bg-transparent text-[19px] text-white outline-none placeholder:text-white/40"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="rounded-full p-1 text-white/40 hover:text-white/70"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <Command.List className="max-h-[380px] overflow-y-auto py-2">
          <Command.Empty className="py-10 text-center text-sm text-white/40">
            {t("commandPalette.noResults")}
          </Command.Empty>

          {/* Navigation */}
          {filteredNav.length > 0 && (
            <Command.Group
              heading={t("commandPalette.navigation")}
              className="mb-1 [&>[cmdk-group-heading]]:px-5 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-widest [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:text-white/40"
            >
              {filteredNav.map(({ id, icon: Icon, label, to }) => (
                <Command.Item
                  key={id}
                  value={id}
                  onSelect={() => void spotlightSelect("navigate", to)}
                  className="mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-white/70" />
                  </span>
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Actions */}
          {filteredActions.length > 0 && (
            <Command.Group
              heading={t("commandPalette.globalActions")}
              className="mb-1 [&>[cmdk-group-heading]]:px-5 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-widest [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:text-white/40"
            >
              {filteredActions.map(({ id, icon: Icon, label, action }) => (
                <Command.Item
                  key={id}
                  value={id}
                  onSelect={() => void spotlightSelect("action", action)}
                  className="mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-white/70" />
                  </span>
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Hymn search results */}
          {hymns.length > 0 && (
            <Command.Group
              heading={t("commandPalette.hymns")}
              className="mb-1 [&>[cmdk-group-heading]]:px-5 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-widest [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:text-white/40"
            >
              {hymns.map((hymn) => (
                <Command.Item
                  key={hymn.id}
                  value={`hymn-${hymn.id}`}
                  onSelect={() =>
                    void spotlightSelect("navigate", `/hymnal/${hymn.id}`)
                  }
                  className="group mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Music className="h-4 w-4 text-white/70" />
                  </span>
                  <span className="flex-1 truncate">{hymn.title}</span>
                  {hymn.number && (
                    <span className="text-xs text-white/40">#{hymn.number}</span>
                  )}
                  <button
                    title={t("spotlight.projectToScreen")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void projectHymnFirstStanza(hymn);
                    }}
                    className="ml-1 hidden rounded-lg p-1.5 text-white/50 hover:bg-white/20 hover:text-white group-hover:flex group-aria-selected:flex"
                  >
                    <MonitorPlay className="h-3.5 w-3.5" />
                  </button>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Bible search results */}
          {bibleResults.length > 0 && (
            <Command.Group
              heading={t("commandPalette.bible")}
              className="mb-1 [&>[cmdk-group-heading]]:px-5 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-widest [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:text-white/40"
            >
              {bibleResults.map((result) => (
                <Command.Item
                  key={`${result.verse.versionId}-${result.verse.book}-${result.verse.chapter}-${result.verse.verse}`}
                  value={`bible-${result.verse.versionId}-${result.verse.book}-${result.verse.chapter}-${result.verse.verse}`}
                  onSelect={() =>
                    void spotlightSelect(
                      "navigate",
                      `/bible?book=${result.verse.book}&chapter=${result.verse.chapter}&verse=${result.verse.verse}&version=${result.verse.versionId}`,
                    )
                  }
                  className="group mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <BookOpen className="h-4 w-4 text-white/70" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[11px] text-white/40">
                      {result.bookName} {result.verse.chapter}:{result.verse.verse}
                    </span>
                    <span className="truncate text-[13px]">{result.snippet}</span>
                  </div>
                  <button
                    title={t("spotlight.projectToScreen")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void projectBibleVerse(result);
                    }}
                    className="ml-1 hidden rounded-lg p-1.5 text-white/50 hover:bg-white/20 hover:text-white group-hover:flex group-aria-selected:flex"
                  >
                    <MonitorPlay className="h-3.5 w-3.5" />
                  </button>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Collection search results */}
          {collectionResults.length > 0 && (
            <Command.Group
              heading={t("commandPalette.navigation")}
              className="mb-1 [&>[cmdk-group-heading]]:px-5 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-widest [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:text-white/40"
            >
              {collectionResults.map((col) => (
                <Command.Item
                  key={`${col.kind}-${col.collection_id}-${col.song_id ?? ""}`}
                  value={`collection-${col.collection_id}-${col.song_id ?? ""}`}
                  onSelect={() =>
                    void spotlightSelect(
                      "navigate",
                      col.song_id
                        ? `/collections/${col.collection_id}/songs/${col.song_id}`
                        : `/collections/${col.collection_id}`,
                    )
                  }
                  className="mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <FolderOpen className="h-4 w-4 text-white/70" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[11px] text-white/40">
                      {col.collection_name}
                    </span>
                    <span className="truncate text-[13px]">{col.title}</span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-white/10 px-5 py-2.5 text-[11px] text-white/35">
          <span><kbd className="font-sans">↩</kbd> to open</span>
          <span><kbd className="font-sans">↑↓</kbd> to navigate</span>
          <span><kbd className="font-sans">⎋</kbd> to close</span>
        </div>
      </Command>
    </div>
  </div>
);
```

**Step 2: Build the frontend to check for errors**

```bash
pnpm vite build 2>&1 | grep -E "error|Error"
```
Expected: no errors

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS"
```
Expected: no errors

**Step 4: Commit**

```bash
git add src/routes/spotlight.tsx
git commit -m "feat: redesign spotlight with macOS frosted glass aesthetic"
```

---

### Task 3: Verify window transparency is enabled in tauri.conf.json (if needed)

**Files:**
- Check: `src-tauri/tauri.conf.json`

**Context:** Some Tauri versions require `"transparent": true` in the window config inside `tauri.conf.json` in addition to the builder call. The spotlight window is created dynamically so it doesn't need an entry in the config, but if the app fails to render transparent we check here.

**Step 1: Check if transparency is globally allowed**

```bash
grep -n "transparent" src-tauri/tauri.conf.json
```

If no results, the builder's `.transparent(true)` alone should be sufficient for dynamically created windows in Tauri 2.

**Step 2: Run the app and verify**

```bash
pnpm tauri dev
```

Press `Alt+K` to open spotlight. Expected: frosted glass panel centered on screen.

If transparency doesn't work (solid black background instead of blur), add to `src-tauri/tauri.conf.json` under `app.windows`:
```json
{ "label": "spotlight", "transparent": true }
```

**Step 3: Commit if changes were needed**

```bash
git add src-tauri/tauri.conf.json
git commit -m "fix: enable transparency for spotlight window in tauri config"
```
