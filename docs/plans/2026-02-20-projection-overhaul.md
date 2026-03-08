# Projection Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken projection IPC by collapsing to same-process windows, add the Playing now screen, hymn 4-actions, legacy DB import, fix logo persistence, fix alt+tab visibility.

**Architecture:**
- Projector/return windows move from separate child OS processes to regular `WebviewWindowBuilder` windows in the main Tauri process. This fixes the fundamental IPC bug (events now flow naturally via `app.emit()`), eliminates 190 lines of dead code (`projector_process.rs`), and simplifies the entire projection pipeline.
- Window creation (sleep + fullscreen retries) is done on a background thread to prevent IPC blocking on ALL OSes (not just Windows).
- The existing SSE server remains for web streaming only (its original purpose — not used as internal IPC).
- Projection screens are NOT opened automatically when projecting — the user controls this explicitly. This behavior is preserved.

**Tech Stack:** Rust/Tauri 2, React 19, TypeScript, rusqlite

---

## Context: Why Same Process

The separate-process architecture (`projector_process.rs`) was created to avoid IPC blocking on Windows. But:
1. IPC blocking is already fixed by `std::thread::spawn` in `display.rs` commands
2. Separate processes break Tauri's event bus — `app.emit("slide-changed")` in the parent never reaches the child's webview
3. Child process registers `.invoke_handler(tauri::generate_handler![])` (empty) — all `invoke()` calls from the projector frontend fail silently
4. `.skip_taskbar(true)` hides windows from alt+tab

Solution: create projector/return windows via `WebviewWindowBuilder` in the main process, on a background thread.

---

## Task 1: Refactor Projector/Return to Same-Process Windows — 45 min

**Files:**
- Modify: `src-tauri/src/commands/display.rs` — `open_projector_window`, `close_projector_window`, `open_return_window`, `close_return_window`
- Delete: `src-tauri/src/projector_process.rs`
- Modify: `src-tauri/src/lib.rs` — remove projector_process module, remove child-process arg detection
- Modify: `src-tauri/src/main.rs` (or wherever child process args are detected)

**Step 1: Read the files before changing**

Read the full content of:
- `src-tauri/src/commands/display.rs` (find the open_projector_window and open_return_window functions)
- `src-tauri/src/projector_process.rs` (understand `open_fullscreen_window_in_process` to port it)
- `src-tauri/src/lib.rs` (find child-process arg detection)
- `src-tauri/src/main.rs` (find child-process arg detection)

**Step 2: Extract the fullscreen window helper**

The `open_fullscreen_window_in_process` function in `projector_process.rs` does the real work (find monitor, position, fullscreen with retry). Port this logic into `commands/display.rs` as a private helper `open_fullscreen_window`:

```rust
/// Opens a fullscreen window on the specified monitor.
/// MUST be called from a background thread — sleep() + fullscreen retries
/// block the calling thread, which would hang IPC on all OSes if called directly.
fn open_fullscreen_window(
    app: &tauri::AppHandle,
    label: &str,
    url: &str,
    title: &str,
    target_monitor_id: &str,
) -> Result<(), crate::error::AppError> {
    use tauri::Manager;

    let monitors = app
        .available_monitors()
        .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;

    let monitor = monitors
        .iter()
        .find(|m| stable_monitor_id(m) == target_monitor_id)
        .or_else(|| {
            parse_legacy_monitor_index(target_monitor_id)
                .and_then(|i| monitors.get(i))
        })
        .ok_or_else(|| crate::error::AppError::NotFound(
            format!("Monitor {} not found", target_monitor_id)
        ))?;

    let position = monitor.position();
    let size = monitor.size();

    let window = tauri::WebviewWindowBuilder::new(
        app,
        label,
        tauri::WebviewUrl::App(url.into()),
    )
    .title(title)
    .visible(false)
    .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
    .fullscreen(true)
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(false)  // visible in alt+tab / OS window switcher
    .build()
    .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;

    window.set_size(tauri::Size::Physical(*size))
        .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;
    window.set_position(tauri::Position::Physical(*position))
        .map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;

    std::thread::sleep(std::time::Duration::from_millis(150));
    window.show().map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;

    // Fullscreen with retry
    for _ in 0..6 {
        let _ = window.set_fullscreen(true);
        std::thread::sleep(std::time::Duration::from_millis(120));
        if window.is_fullscreen().unwrap_or(false) {
            return Ok(());
        }
    }
    // Fallback: maximize
    let _ = window.maximize();
    Ok(())
}
```

**Step 3: Rewrite `open_projector_window` and `open_return_window`**

These commands currently call `spawn_projector_process()`. Replace with spawning a thread that calls the new `open_fullscreen_window` helper:

```rust
#[tauri::command]
pub fn open_projector_window(
    monitor_id: String,
    state: tauri::State<'_, crate::state::AppState>,
    app: tauri::AppHandle,
) -> Result<(), crate::error::AppError> {
    // If window already exists, just show/focus it
    if let Some(win) = app.get_webview_window("projector") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    // Spawn on background thread — sleep() and fullscreen retries would block IPC otherwise
    std::thread::spawn(move || {
        if let Err(e) = open_fullscreen_window(
            &app,
            "projector",
            "/projector",
            "LouvorJA - Projector",
            &monitor_id,
        ) {
            eprintln!("[display] Failed to open projector window: {}", e);
        }
    });

    // Mark as open immediately (optimistic — the thread will create it)
    if let Ok(mut open) = state.projector_open.lock() {
        *open = true;
    }

    Ok(())
}

#[tauri::command]
pub fn close_projector_window(
    state: tauri::State<'_, crate::state::AppState>,
    app: tauri::AppHandle,
) -> Result<(), crate::error::AppError> {
    if let Some(win) = app.get_webview_window("projector") {
        win.close().map_err(|e| crate::error::AppError::Tauri(e.to_string()))?;
    }
    if let Ok(mut open) = state.projector_open.lock() {
        *open = false;
    }
    Ok(())
}
```

Apply the same pattern for `open_return_window` and `close_return_window` (label: "return", url: "/return", title: "LouvorJA - Return Monitor").

**Step 4: Remove child-process detection from main.rs / lib.rs**

Find where `--louvorja-projector` or `--louvorja-return` args are detected (likely in `main.rs` or `lib.rs`). Remove those branches entirely. The child process is gone.

**Step 5: Remove projector_process module**

- Delete `src-tauri/src/projector_process.rs`
- Remove `mod projector_process;` from `lib.rs` (or `main.rs`)
- Remove any `use crate::projector_process::*` references

**Step 6: Update `__root.tsx` bare routes if needed**

The `/projector` and `/return` routes are still bare routes (no sidebar/header). This behavior is unchanged. Verify `BARE_ROUTES` list in `__root.tsx` still includes them.

**Step 7: Build**
```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
```
Expected: compiles clean, no references to removed module.

**Step 8: Commit**
```bash
git add src-tauri/src/commands/display.rs src-tauri/src/lib.rs src-tauri/src/main.rs
git rm src-tauri/src/projector_process.rs
git commit -m "refactor: collapse projector/return to same-process windows, fix IPC and alt+tab"
```

---

## Task 2: Create Playing now Screen Route — 45 min

**Goal:** A `/playing-now` route accessible from the sidebar that shows what is currently being projected, with slide navigation and audio play/pause controls. Works whether or not projection screens are open. Does NOT auto-open projection screens.

**Files:**
- Create: `src/routes/playing-now/route.tsx`
- Create: `src/routes/playing-now/index.tsx`
- Modify: sidebar component (add nav link)
- Modify: `src/__root.tsx` — ensure `/playing-now` is NOT in BARE_ROUTES (it has sidebar/header)
- Modify: `src/locales/en.json`, `pt.json`, `es.json`

**Step 1: Create `src/routes/playing-now/route.tsx`**

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/playing-now")({ component: () => <Outlet /> });
```

**Step 2: Create `src/routes/playing-now/index.tsx`**

Key design:
- Listens to Tauri events `"slide-changed"`, `"overlay-changed"`, `"slide-cleared"`, `"utility-projection"` — these work because the Playing now screen is in the main process
- Shows a scaled-down preview of the current slide (aspect ratio 16:9)
- Shows overlay state (black/logo screen indicators)
- Shows slide position counter (from `usePresentationStore`)
- Prev/Next slide buttons (call `useSlides().prevSlide()` / `nextSlide()`)
- Play/Pause audio button (calls `useAudio().togglePlayPause()`) — only enabled when audio is active
- Status indicator: projector open (green dot) or not (gray dot) — does NOT have a button to open projector
- On mount: loads current slide via `getCurrentSlide()` and overlay via `getOverlayState()`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { SlideRenderer } from "../../components/slides/slide-renderer";
import { useSlides } from "../../hooks/use-slides";
import { useAudio } from "../../hooks/use-audio";
import { usePresentationStore } from "../../stores/presentation-store";
import { useDisplayStore } from "../../stores/display-store";
import { flatToSlideContent } from "../../types/presentation";
import type { SlideContent, SlideContentFlat, OverlayState } from "../../types/presentation";
import { getCurrentSlide, getOverlayState } from "../../lib/tauri";
import { Button } from "../../components/ui/button";
import { ChevronLeft, ChevronRight, Play, Pause, MonitorPlay } from "lucide-react";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/playing-now/")({ component: PlayingNowScreen });

function PlayingNowScreen() {
  const [slide, setSlide] = useState<SlideContent | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ blackScreen: false, logoScreen: false });
  const [fadeKey, setFadeKey] = useState(0);

  const { prevSlide, nextSlide } = useSlides();
  const { status: audioStatus, togglePlayPause } = useAudio();
  const { activeSlideIndex, slides } = usePresentationStore();
  const { projectorWindowOpen } = useDisplayStore();

  // Load initial state
  useEffect(() => {
    void getCurrentSlide()
      .then((s) => { if (s) { setSlide(flatToSlideContent(s)); setFadeKey((k) => k + 1); } })
      .catch(() => {});
    void getOverlayState().then(setOverlay).catch(() => {});
  }, []);

  // Listen to events — works in main process
  useEffect(() => {
    const unlisteners = [
      listen<SlideContentFlat>("slide-changed", (e) => {
        setSlide(flatToSlideContent(e.payload));
        setFadeKey((k) => k + 1);
      }),
      listen("slide-cleared", () => { setSlide(null); setFadeKey((k) => k + 1); }),
      listen<OverlayState>("overlay-changed", (e) => setOverlay(e.payload)),
    ];
    return () => { unlisteners.forEach((p) => p.then((fn) => fn())); };
  }, []);

  const isPlaying = audioStatus === "playing";
  const audioActive = audioStatus !== "idle" && audioStatus !== "stopped";

  return (
    <div className="flex flex-col h-full p-6 gap-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <MonitorPlay className="w-5 h-5" />
          Operador
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={cn("w-2 h-2 rounded-full", projectorWindowOpen ? "bg-green-500" : "bg-muted-foreground/40")} />
          {projectorWindowOpen ? "Projetando" : "Sem projeção ativa"}
        </div>
      </div>

      {/* Slide preview — 16:9 aspect ratio */}
      <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {overlay.blackScreen && <div className="absolute inset-0 bg-black z-10" />}
        {overlay.logoScreen && (
          <div className="absolute inset-0 bg-black z-10 flex items-center justify-center">
            <span className="text-white/20 text-sm">Logo</span>
          </div>
        )}
        {slide ? (
          <SlideRenderer key={fadeKey} content={slide} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm select-none">
            Nenhum conteúdo projetado
          </div>
        )}
      </div>

      {/* Slide counter */}
      {slides.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {activeSlideIndex + 1} / {slides.length}
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => void prevSlide()}
          disabled={activeSlideIndex <= 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => void togglePlayPause()}
          disabled={!audioActive}
          title={isPlaying ? "Pausar" : "Reproduzir"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => void nextSlide()}
          disabled={activeSlideIndex >= slides.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Add to sidebar**

Read the sidebar component first. Add a nav link to `/playing-now` using `<Link to="/playing-now">` with a `MonitorPlay` icon from lucide-react and the translated label. Follow the exact same pattern as other nav items in the sidebar.

**Step 4: Regenerate route tree and type-check**
```bash
pnpm vite build 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -10
```

**Step 5: Add i18n keys to ALL THREE locale files**

```json
// en.json
"nav": { "playingNow": "Playing now" }

// pt.json
"nav": { "playingNow": "Tocando agora" }

// es.json
"nav": { "playingNow": "Reproduciendo ahora" }
```

**Step 6: Commit**
```bash
git add src/routes/playing-now/ src/components/layout/ src/locales/
git commit -m "feat: add Playing now screen route with slide preview and controls"
```

---

## Task 3: Hymn 4 Actions + Lyrics Modal — 45 min

**Goal:** Replace the implicit play behavior on the hymn detail page with 4 explicit, labeled action buttons. Add a lyrics modal component usable from both the card and detail page.

**4 actions:**
1. **Cantado** — play audio in `"sung"` mode AND project slides (audio with vocal)
2. **Playback** — play audio in `"karaoke"` mode AND project slides (audio without vocal)
3. **Só slides** — project slides only, no audio (`"silent"` mode, skip audio start)
4. **Ver letra** — opens a `LyricsModal` dialog, no projection

**Files:**
- Create: `src/components/music/lyrics-modal.tsx`
- Modify: `src/routes/hymnal/$hymnId.tsx`
- Modify: `src/components/music/hymn-card.tsx`
- Modify: `src/locales/en.json`, `pt.json`, `es.json`

**Step 1: Read files before modifying**

Read `src/routes/hymnal/$hymnId.tsx` and `src/components/music/hymn-card.tsx` in full before writing any code.

**Step 2: Create `src/components/music/lyrics-modal.tsx`**

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Hymn } from "../../types/hymn";

interface LyricsModalProps {
  hymn: Hymn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LyricsModal({ hymn, open, onOpenChange }: LyricsModalProps) {
  const stanzas = (hymn.lyrics ?? "").split(/\n\n+/).filter(Boolean);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col p-6 gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">{hymn.title}</Dialog.Title>
              {hymn.author && <p className="text-sm text-muted-foreground">{hymn.author}</p>}
            </div>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto flex flex-col gap-4 text-sm leading-relaxed pr-2">
            {stanzas.length > 0 ? (
              stanzas.map((stanza, i) => (
                <p key={i} className="whitespace-pre-line">{stanza}</p>
              ))
            ) : (
              <p className="text-muted-foreground italic">Letra não disponível</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Step 3: Modify `$hymnId.tsx`**

After reading the file, identify where the current "Project" / "Stop" button is. Add a `lyricsModalOpen` state. Replace or supplement the projection trigger area with 4 buttons. The existing audio/slide machinery (`play`, `setPlaybackMode`, `bindHymnToPlaybackQueue`, `goToSlide`, etc.) is preserved — we're only changing the UI that triggers them.

Key logic to wire:
- "Cantado": `setPlaybackMode("sung")` → `bindHymnToPlaybackQueue(0)` → `goToSlide(0)` → `play(hymn.audio_path)`
- "Playback": `setPlaybackMode("karaoke")` → same flow
- "Só slides": `setPlaybackMode("silent")` → `bindHymnToPlaybackQueue(0)` → `goToSlide(0)` (no audio)
- "Ver letra": `setLyricsModalOpen(true)`

Show 4 buttons when `!isProjecting`, show "Parar" button when `isProjecting`. Render `<LyricsModal>` at the bottom of the component.

Do NOT change any hook calls, audio logic, slide generation, or sync point behavior — only the UI buttons.

**Step 4: Modify `hymn-card.tsx`**

Add a small "Ver letra" icon button to the card. Since the card is wrapped in a `<Link>`, use `e.preventDefault(); e.stopPropagation()` on the button click. Add `lyricsModalOpen` state and render `<LyricsModal>` inside the card component.

**Step 5: Add i18n keys to all 3 locale files**

```json
// Add to each locale:
"hymn": {
  "actionSung":       "Cantado" / "Sung" / "Cantado",
  "actionPlayback":   "Playback" / "Playback" / "Playback",
  "actionSlidesOnly": "Só slides" / "Slides only" / "Solo diapositivas",
  "actionShowLyrics": "Ver letra" / "Show lyrics" / "Ver letra",
  "stopProjection":   "Parar" / "Stop" / "Detener"
}
```

**Step 6: Build and type-check**
```bash
pnpm vite build && npx tsc --noEmit 2>&1 | tail -10
```

**Step 7: Commit**
```bash
git add src/components/music/lyrics-modal.tsx src/routes/hymnal/ src/components/music/hymn-card.tsx src/locales/
git commit -m "feat: add hymn 4 action buttons (cantado, playback, só slides, ver letra) + lyrics modal"
```

---

## Task 4: Legacy DB Import (migrate_v13) — 60 min

**Goal:** When the app opens a DB that has the old Delphi-schema tables (`musics`, `lyrics`, `albums`, `files`, `albums_musics`, `categories_albums`, `categories`), automatically import that data into the new `hymns` schema. If the legacy DB also has `bible_verse`/`bible_book`/`bible_version` tables, import them too. The migration is idempotent and non-destructive (legacy tables left intact).

**Legacy schema summary (from analysis of `database.db`):**
- `musics(id_music, name, id_file_music, id_file_instrumental_music, id_language)`
- `albums(id_album, name)`
- `albums_musics(id_album_music, id_album, id_music, track)`
- `categories(id_category, name, slug)`
- `categories_albums(id_category_album, id_category, id_album)`
- `lyrics(id_lyric, id_music, lyric, "order", show_slide, id_language)`
- `files(id_file, name, dir, type)`
- `bible_version(id_bible_version, name, abbreviation, id_language)`
- `bible_book(id_bible_book, name, book_number, id_language)`
- `bible_verse(id_bible_verse, id_bible_version, id_bible_book, chapter, verse, text, id_language)`

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

**Step 1: Add migrate_v13 call to `run_migrations`**

After the `current_version < 12` block:
```rust
if current_version < 13 {
    migrate_v13(conn)?;
    conn.execute("INSERT INTO schema_version (version) VALUES (13)", [])?;
}
```

**Step 2: Add `table_exists` helper (if not already present)**

```rust
fn table_exists(conn: &Connection, table: &str) -> Result<bool, AppError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
        rusqlite::params![table],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
```

**Step 3: Implement `migrate_v13`**

```rust
fn migrate_v13(conn: &Connection) -> Result<(), AppError> {
    // Only run if legacy schema tables exist
    if !table_exists(conn, "musics")? {
        return Ok(());
    }

    // Skip if hymns already has data (already imported or user has their own hymns)
    let hymn_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM hymns",
        [],
        |row| row.get(0),
    )?;
    if hymn_count > 0 {
        return Ok(());
    }

    // Import musics + lyrics + albums + files → hymns
    // - name → title
    // - albums_musics.track → number
    // - albums.name → album
    // - lyrics grouped by id_music, ordered by "order", joined with \n\n → lyrics field
    // - files.dir || '/' || files.name → audio_path (for id_file_music)
    // - categories.slug → category
    conn.execute_batch("
        INSERT INTO hymns (number, title, album, lyrics, audio_path, category)
        SELECT
            am.track,
            m.name,
            a.name,
            (
                SELECT GROUP_CONCAT(l.lyric, char(10) || char(10))
                FROM lyrics l
                WHERE l.id_music = m.id_music
                  AND l.id_language = 'pt'
                ORDER BY l.\"order\"
            ),
            CASE
                WHEN f.dir IS NOT NULL AND f.name IS NOT NULL
                THEN f.dir || '/' || f.name
                ELSE NULL
            END,
            cat.slug
        FROM musics m
        INNER JOIN albums_musics am ON am.id_music = m.id_music
        INNER JOIN albums a ON a.id_album = am.id_album
        LEFT JOIN files f ON f.id_file = m.id_file_music
        LEFT JOIN categories_albums ca ON ca.id_album = a.id_album
            AND ca.id_language = 'pt'
        LEFT JOIN categories cat ON cat.id_category = ca.id_category
        WHERE m.id_language = 'pt'
        ORDER BY am.track;

        DELETE FROM hymns_fts;
        INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
        SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
        FROM hymns;
    ")?;

    // Import legacy bible data if present and new bible_verses is still empty (only ARA seed)
    if !table_exists(conn, "bible_verse")? || !table_exists(conn, "bible_book")? {
        return Ok(());
    }

    let new_verse_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM bible_verses",
        [],
        |row| row.get(0),
    )?;
    // ARA seeded in migrate_v3 has only a few hundred verses; full bible has 31000+
    // Only import if we don't already have a full bible
    if new_verse_count > 1000 {
        return Ok(());
    }

    conn.execute_batch("
        INSERT OR IGNORE INTO bible_versions (name, abbreviation, language)
        SELECT name, abbreviation, id_language
        FROM bible_version
        WHERE id_language = 'pt';

        INSERT OR IGNORE INTO bible_verses (version_id, book, chapter, verse, text)
        SELECT
            nv.id,
            bb.name,
            bv.chapter,
            bv.verse,
            bv.text
        FROM bible_verse bv
        INNER JOIN bible_version lv ON lv.id_bible_version = bv.id_bible_version
        INNER JOIN bible_book bb ON bb.id_bible_book = bv.id_bible_book
        INNER JOIN bible_versions nv ON nv.abbreviation = lv.abbreviation
        WHERE lv.id_language = 'pt';

        DELETE FROM bible_fts;
        INSERT INTO bible_fts(rowid, text, book)
        SELECT id, text, book FROM bible_verses;
    ")?;

    Ok(())
}
```

**Step 4: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
```
Expected: compiles clean.

**Step 5: Verify idempotency logic**

The migration guards:
1. If `musics` table doesn't exist → skip (fresh DB)
2. If `hymns` already has rows → skip (already imported or user has data)
3. For bible: if `new_verse_count > 1000` → skip (already has full bible)

**Step 6: Commit**
```bash
git add src-tauri/src/db/migrations.rs
git commit -m "feat: migrate_v13 auto-imports legacy Delphi DB (musics/lyrics → hymns, bible)"
```

---

## Task 5: Verify Logo Screen Config Persistence — 20 min

**Context:** Migration v12 adds `projector.logo.imagePath` to the settings table. The settings route already reads/writes this key via `setSettingMutation`. The `projector-view.tsx` reads it via `getScreenDefaults()` which internally calls `getSetting`.

**After Task 1**, the projector window is in the same process as the main app. This means:
- All Tauri commands (`get_setting`, etc.) work in the projector window
- The `tauri-plugin-fs` and asset protocol work as configured for the main app
- No additional setup needed for command access

**Step 1: Verify `projector-view.tsx` loads logo image path**

Read `src/components/slides/projector-view.tsx`. Confirm it calls something like `getSetting("projector.logo.imagePath")` (directly or via a wrapper like `getScreenDefaults`) on mount.

**Step 2: Verify settings route persists logo image**

Read `src/routes/settings/index.tsx`. Confirm there's a UI section for the projector logo image that calls `setSettingMutation.mutate({ key: "projector.logo.imagePath", value: ... })`.

**Step 3: If the settings route is missing the logo image picker UI, add it**

Look for the projector section in settings. If `projector.logo.imagePath` is persisted but there's no UI to change it (just a default), add a simple file picker:

```tsx
// Near the projector default content type selector:
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium">Imagem do logo</label>
  <div className="flex gap-2 items-center">
    <Input
      value={projectorLogoImagePath ?? ""}
      readOnly
      className="flex-1 text-sm"
      placeholder="Nenhuma imagem selecionada"
    />
    <Button variant="outline" size="sm" onClick={handlePickLogoImage}>
      Escolher
    </Button>
    {projectorLogoImagePath && (
      <Button variant="ghost" size="sm" onClick={() => handleSetLogoImage("")}>
        Limpar
      </Button>
    )}
  </div>
</div>
```

Use `open()` from `@tauri-apps/plugin-dialog` to let the user pick an image file, then `copyImageToMedia()` to copy it to managed storage, and persist the managed path.

**Step 4: Build and type-check**
```bash
pnpm vite build && npx tsc --noEmit 2>&1 | tail -10
```

**Step 5: Commit if any changes made**
```bash
git add src/routes/settings/ src/components/slides/projector-view.tsx
git commit -m "fix: ensure logo image path is visible and editable in settings"
```

---

## Task 6: Update CLAUDE.md Documentation — 15 min

**Files:**
- Modify: `CLAUDE.md`

**Add to Architecture Patterns → Rust Side:**
```
- **Same-process projection windows:** Projector and return monitor windows (`WebviewWindowBuilder` label: "projector", "return") live in the main Tauri process. Window creation (sleep + fullscreen retries) runs on a background thread via `std::thread::spawn` to prevent IPC blocking on all OSes. The `open_fullscreen_window()` helper in `commands/display.rs` handles this. The separate `projector_process.rs` module was removed in Phase 11.
```

**Add to Common Errors to Avoid → Rust:**
```
7. **Projection window creation blocks IPC:** The fullscreen retry loop in `open_fullscreen_window()` uses `sleep()` — this MUST run on a background thread (`std::thread::spawn`). Never call it directly in a `#[tauri::command]` handler on any OS. The `open_projector_window` and `open_return_window` commands spawn a thread and return immediately.
8. **skip_taskbar hides from alt+tab:** Using `.skip_taskbar(true)` on a `WebviewWindowBuilder` hides the window from the OS window switcher (alt+tab on Windows, Mission Control on macOS). Projector windows use `.skip_taskbar(false)`.
```

**Add to General patterns:**
```
- **Playing now screen:** The `/playing-now` route (sidebar nav) shows what's currently projected. It listens to Tauri events (`slide-changed`, `overlay-changed`, etc.) directly — these work because `/playing-now` is in the main process. Controls call `useSlides().prevSlide()/nextSlide()` and `useAudio().togglePlayPause()`. It does NOT open projection screens automatically.
- **Hymn 4 actions:** Hymn detail and card have 4 explicit buttons: Cantado (sung), Playback (karaoke), Só slides (silent, no audio), Ver letra (LyricsModal). The `PlaybackMode` type covers the first 3; the 4th opens a `@radix-ui/react-dialog`.
- **Legacy DB import:** `migrate_v13` in `migrations.rs` detects Delphi-schema tables (`musics`, `lyrics`, `albums`, `files`) and imports into `hymns`. Idempotent: skips if `hymns` table already has data, or if `musics` table doesn't exist.
```

**Update Phase Status table:**
```
| 11 | Projection Overhaul | COMPLETE |
```

**Commit:**
```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with projection overhaul patterns (Phase 11 complete)"
```

---

## Summary

| Task | Files Changed | Impact |
|------|--------------|--------|
| 1 | `display.rs`, `lib.rs`, `main.rs`, delete `projector_process.rs` | Same-process windows, events work, alt+tab works |
| 2 | `routes/playing-now/`, sidebar, locales | New Playing now screen |
| 3 | `lyrics-modal.tsx`, `$hymnId.tsx`, `hymn-card.tsx`, locales | Hymn 4 actions + lyrics modal |
| 4 | `db/migrations.rs` | Auto-import legacy Delphi DB |
| 5 | `routes/settings/`, `projector-view.tsx` | Logo config UI verification/fix |
| 6 | `CLAUDE.md` | Documentation |
