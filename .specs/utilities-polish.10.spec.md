# SPEC 10 — Utilities & Polish

**Phase:** 9
**Goal:** Implement remaining utility features and polish the application.

---

## Files to CREATE

### Frontend — Utility Routes

#### `src/routes/utilities/route.tsx`
- Create the utilities layout route
- Grid layout with cards for each utility tool
- Wraps children with `<Outlet />`

#### `src/routes/utilities/timer.tsx`
- Create timer/chronometer page
- Two modes: countdown timer and stopwatch
- Mode toggle at the top
- Countdown mode:
  - Time input fields (hours, minutes, seconds)
  - Start, Pause, Reset buttons
  - Large time display
  - "Project to Screen" toggle (sends timer to projector)
  - Alert when countdown reaches zero (sound + notification)
- Stopwatch mode:
  - Large time display counting up
  - Start, Pause, Reset, Lap buttons
  - Lap times list
  - "Project to Screen" toggle

#### `src/routes/utilities/lottery.tsx`
- Create name lottery/randomizer page
- Name list management:
  - Text area for entering names (one per line)
  - Import from file button (.txt, .csv)
  - "Add" and "Clear All" buttons
- Lottery animation:
  - "Start Lottery" button
  - Animated name cycling (rapid name changes)
  - Slows down and stops on the selected name
  - Large display of the winner
  - "Pick Another" button (removes winner from pool)
  - "Project to Screen" toggle
- History: list of previously selected names in this session

#### `src/routes/utilities/clock.tsx`
- Create clock display utility
- Large digital clock display (current time)
- Format selector: 12-hour / 24-hour
- Date display toggle
- "Project to Screen" button (sends clock to projector)

### Frontend — Utility Components

#### `src/components/utilities/timer-display.tsx`
- Create timer display component
- Large, readable time display (MM:SS or HH:MM:SS)
- Props: `timeMs`, `mode: 'countdown' | 'stopwatch'`, `size: 'small' | 'large'`
- Color coding: green (normal), yellow (< 1 min), red (< 10 sec for countdown)

#### `src/components/utilities/lottery-animation.tsx`
- Create lottery name animation component
- Rapid name cycling effect (CSS animation)
- Easing function: fast → slow → stop
- Large text display
- Confetti effect when winner is selected (using CSS or a lightweight confetti library)

#### `src/components/utilities/clock-display.tsx`
- Create clock display component
- Updates every second
- Formats time according to user preference
- Optionally shows date
- Large, bold font

#### `src/components/utilities/favorites-panel.tsx`
- Create favorites/bookmarks panel
- List of favorited items (hymns, Bible verses, presentations)
- Grouped by type
- Click to navigate to item
- "Remove from Favorites" button
- "Project" button for quick projection

### Frontend — Keyboard Shortcuts Panel

#### `src/components/keyboard-shortcuts-panel.tsx`
- Create keyboard shortcuts help panel
- Triggered by Cmd+/ (or Ctrl+/)
- Modal dialog showing all keyboard shortcuts
- Grouped by category:
  - Slide Navigation
  - Display Control
  - Audio Playback
  - Global Actions
- Each shortcut shown with visual key badges (e.g., `⌘ K`)
- Searchable list

### Frontend — Command Palette

#### `src/components/ui/command-palette.tsx` (UPDATE from Phase 0)
- Finalize command palette with all app actions:
  - Navigation: "Go to Hymnal", "Go to Bible", etc.
  - Actions: "New Presentation", "Open Projector", "Start Streaming", etc.
  - Recent items: recently viewed hymns, services, presentations
  - Search: hymns, Bible verses, presentations
- Fuzzy search across all commands
- Keyboard navigation (arrow keys, Enter)
- Contextual commands based on current route

---

## Files to UPDATE

### Backend — Timer Commands

#### `src-tauri/src/commands/timer.rs`
- Implement timer/chronometer commands:
  - `start_timer(mode: String, duration_ms: Option<u64>, state: State<TimerState>) -> Result<(), AppError>`
    - Mode: "countdown" or "stopwatch"
    - For countdown, `duration_ms` is the total time
  - `pause_timer(state: State<TimerState>) -> Result<(), AppError>`
  - `resume_timer(state: State<TimerState>) -> Result<(), AppError>`
  - `reset_timer(state: State<TimerState>) -> Result<(), AppError>`
  - `get_timer_state(state: State<TimerState>) -> Result<TimerStateData, AppError>`
    - Returns: mode, is_running, current_time_ms, start_time, laps
  - `add_lap(state: State<TimerState>) -> Result<u64, AppError>` — for stopwatch mode
- `TimerStateData` struct: `{ mode: String, is_running: bool, current_time_ms: u64, laps: Vec<u64> }`

### Backend — Utility Commands

#### `src-tauri/src/commands/utility.rs`
- Implement lottery command:
  - `run_lottery(names: Vec<String>) -> Result<String, AppError>`
    - Uses `rand` crate to select a random name from the list
    - Returns the selected name
- Implement text formatting helpers:
  - `format_text(text: String, format: String) -> Result<String, AppError>`
    - Formats: "uppercase", "lowercase", "title_case", "sentence_case"
    - Returns formatted text

### Backend — State

#### `src-tauri/src/state.rs`
- Add `TimerState` struct:
  - `mode: Mutex<String>` — "countdown" or "stopwatch"
  - `is_running: Mutex<bool>`
  - `start_instant: Mutex<Option<Instant>>`
  - `duration_ms: Mutex<Option<u64>>` — for countdown
  - `elapsed_ms: Mutex<u64>` — accumulated time when paused
  - `laps: Mutex<Vec<u64>>`
- Add to Tauri managed state

### Backend — Cargo

#### `src-tauri/Cargo.toml`
- Add `rand = "0.8"` dependency (if not already added)

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register timer commands: `start_timer`, `pause_timer`, `resume_timer`, `reset_timer`, `get_timer_state`, `add_lap`
- Register utility commands: `run_lottery`, `format_text`

### Frontend — Theme System

#### `src/global.css` (UPDATE)
- Finalize all 5 theme variants with complete color palettes:
  - **Azure (Blue)**: Primary #0078d4, Secondary #106ebe, Accent #00bcf2
  - **White**: Light theme with subtle grays
  - **Gray**: Neutral theme with balanced grays
  - **Orange**: Warm theme with orange primary (#ff8c00)
  - **Black**: Dark theme with cyan accent (#60cdff) on dark backgrounds (#1e1e1e)
- Add smooth theme transition animations (CSS transitions on color properties)

#### `src/stores/theme-store.ts` (UPDATE)
- Add `toggleTheme()` action for quick theme switching
- Add `systemThemePreference` detection (dark/light mode from OS)
- Add `followSystem` option

### Frontend — Favorites

#### `src/hooks/use-favorites.ts` (CREATE)
- Create favorites management hook
- Actions: `addToFavorites(type, id)`, `removeFromFavorites(type, id)`, `isFavorite(type, id)`
- Uses TanStack Query to sync with backend

### Backend — Favorites

#### `src-tauri/src/db/queries/favorites.rs` (CREATE)
- Implement favorites queries:
  - `get_favorites(conn) -> Result<Vec<Favorite>>`
  - `add_favorite(conn, item_type, reference_id) -> Result<()>`
  - `remove_favorite(conn, item_type, reference_id) -> Result<()>`
  - `is_favorite(conn, item_type, reference_id) -> Result<bool>`

#### `src-tauri/src/commands/favorites.rs` (CREATE)
- Implement favorites commands wrapping the query functions

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - Timer: `startTimer(mode, durationMs?)`, `pauseTimer()`, `resumeTimer()`, `resetTimer()`, `getTimerState()`, `addLap()`
  - Utility: `runLottery(names)`, `formatText(text, format)`
  - Favorites: `getFavorites()`, `addFavorite(type, id)`, `removeFavorite(type, id)`, `isFavorite(type, id)`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks:
  - `useTimerState()` — polls timer state every 100ms when running
  - `useStartTimer()`, `usePauseTimer()`, `useResetTimer()` — mutations
  - `useFavorites()` — fetch all favorites
  - `useAddFavorite()`, `useRemoveFavorite()` — mutations

### Frontend — Projector View

#### `src/components/slides/projector-view.tsx` (UPDATE)
- Add support for utility projections:
  - Timer display (fullscreen timer)
  - Clock display (fullscreen clock)
  - Lottery display (animated lottery)
- Listen to Tauri events: `timer-update`, `lottery-result`

### Frontend — Keyboard Shortcuts

#### `src/hooks/use-keyboard.ts` (UPDATE)
- Add global shortcuts:
  - `Cmd+K` / `Ctrl+K` → open command palette
  - `Cmd+/` / `Ctrl+/` → open keyboard shortcuts help
  - `T` → open timer utility
  - `F` → toggle favorites panel
  - Numbers `1-5` → switch themes (when in settings)

### Frontend — Settings

#### `src/routes/settings/route.tsx` (UPDATE)
- Add settings sections:
  - **Appearance**: Theme selector (5 theme cards), font size, follow system theme toggle
  - **Language**: Language selector (Portuguese, Spanish, English)
  - **Display**: Monitor configuration (from Phase 6)
  - **Streaming**: Streaming server settings (from Phase 7)
  - **Audio**: Default audio device selector, default volume
  - **Keyboard**: Keyboard shortcut customization (view only, or editable if time permits)
  - **About**: App version, credits, license, GitHub link

### Frontend — Status Bar

#### `src/components/layout/status-bar.tsx` (UPDATE)
- Add additional status indicators:
  - Active timer indicator (shows remaining time in compact format)
  - Favorites count (click to open favorites panel)
  - Current theme indicator
