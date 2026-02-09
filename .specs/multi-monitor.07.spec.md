# SPEC 07 — Multi-Monitor Display System

**Phase:** 6
**Goal:** Full multi-monitor support with operator, projector, and return monitor views.

---

## Files to CREATE

### Frontend — Components

#### `src/components/slides/return-view.tsx`
- Create the return monitor (performer feedback) view component
- Two-panel layout:
  - Top: current slide content (large, readable text)
  - Bottom: next slide preview (smaller)
- Large font sizes for readability from a distance
- Additional metadata display: hymn title, slide number (e.g., "3/7"), current time
- Dark background for reduced glare
- Listens to Tauri `slide-changed` events for updates
- When playing a service: also shows next service item name

#### `src/components/display/monitor-config.tsx`
- Create monitor configuration/identification UI
- Displays a visual representation of detected monitors (rectangles positioned according to actual monitor layout)
- Each monitor rectangle is labeled with its name and resolution
- Drag-and-drop role assignment: drag "Operator", "Projector", "Return" labels onto monitor rectangles
- "Identify" button: briefly displays a large number on each monitor (like Windows display settings)
- "Test" button: opens a test pattern window on the selected monitor
- Save/Reset configuration buttons

#### `src/components/display/projector-controls.tsx`
- Create projector control bar component (in the operator view)
- Buttons: "Open Projector", "Close Projector", "Black Screen", "Logo Screen"
- Monitor selector dropdown (which monitor to use for projector)
- Status indicator: green dot when projector is active
- Fade speed slider
- Same controls for return monitor

#### `src/components/display/black-screen.tsx`
- Create the black/blank screen overlay component
- Used when operator wants to temporarily hide content
- Renders a solid black (or logo) fullscreen overlay
- Fade transition on show/hide (CSS transition)

### Frontend — Settings Route

#### `src/routes/settings/route.tsx` (UPDATE — may be created in Phase 0)
- Add "Display" / "Monitors" section to settings
- Embed the `MonitorConfig` component
- Show current monitor assignments
- Allow changing default monitor roles

---

## Files to UPDATE

### Backend — Display Module

#### `src-tauri/src/display/mod.rs`
- Implement monitor detection and window lifecycle:
  - `detect_monitors(app: &AppHandle) -> Result<Vec<MonitorInfo>>` — wraps Tauri `available_monitors()`
  - `create_window_on_monitor(app: &AppHandle, label: &str, url: &str, monitor: &MonitorInfo, fullscreen: bool) -> Result<()>`
    - Implements the placement workaround:
      1. Create window with `visible: false`
      2. Set position to monitor coordinates
      3. Set size to monitor dimensions
      4. Wait 100-200ms
      5. Set visible to true
      6. Set fullscreen if requested
  - `close_window(app: &AppHandle, label: &str) -> Result<()>`
  - `set_window_fullscreen(app: &AppHandle, label: &str, fullscreen: bool) -> Result<()>`
  - `send_to_window(app: &AppHandle, label: &str, event: &str, payload: &impl Serialize) -> Result<()>`

### Backend — Display Commands

#### `src-tauri/src/commands/display.rs`
- Enhance with full implementation:
  - `get_available_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, AppError>`
  - `open_projector_window(app: AppHandle, monitor_index: usize) -> Result<(), AppError>`
    - **Only called when user wants to project content** (hymn/bible/presentation)
    - Creates window at `/projector` route on the specified monitor
    - Uses `display::create_window_on_monitor()`
    - Sets fullscreen mode on the target monitor
    - Window is created dynamically and does NOT exist at app startup
  - `close_projector_window(app: AppHandle) -> Result<(), AppError>`
    - Destroys the projector window completely
    - Called when user stops projecting content
  - `open_return_window(app: AppHandle, monitor_index: usize) -> Result<(), AppError>`
    - Creates window at `/return` route on the specified monitor
    - Optional performer feedback window
  - `close_return_window(app: AppHandle) -> Result<(), AppError>`
  - `set_current_slide(app: AppHandle, slide_data: SlideContent) -> Result<(), AppError>`
    - Emits `slide-changed` event to projector and return windows
    - If projector window doesn't exist, opens it first
  - `show_black_screen(app: AppHandle) -> Result<(), AppError>` — sends "black screen" event to projector
  - `show_logo_screen(app: AppHandle) -> Result<(), AppError>` — sends "logo screen" event to projector
  - `identify_monitors(app: AppHandle) -> Result<(), AppError>` — briefly shows a number overlay on each monitor
  - `save_monitor_config(role: String, monitor_name: String, position_json: String) -> Result<(), AppError>` — persist assignment to DB
  - `get_monitor_configs() -> Result<Vec<MonitorConfig>, AppError>` — load saved configs

### Backend — Database Queries

#### `src-tauri/src/db/queries/settings.rs`
- Add monitor config queries:
  - `get_monitor_configs(conn) -> Result<Vec<MonitorConfig>>`
  - `set_monitor_config(conn, role, monitor_name, position_json) -> Result<()>` — upsert by role
  - `delete_monitor_config(conn, role) -> Result<()>`

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register new display commands: `open_return_window`, `close_return_window`, `show_black_screen`, `show_logo_screen`, `identify_monitors`, `save_monitor_config`, `get_monitor_configs`
- Update Tauri builder with additional window configurations for "projector" and "return" windows

### Backend — Tauri Config

#### `src-tauri/tauri.conf.json`
- **IMPORTANT:** Do NOT define "projector" and "return" windows in the initial windows array
- These windows should be created dynamically at runtime ONLY when content is being projected
- The projector window is opened on-demand when:
  - A hymn is selected for projection
  - A Bible passage is selected for projection
  - A presentation/slide is opened for projection
- The projector window is closed when the user stops projecting
- This prevents unnecessary windows from opening at app startup

### Frontend — Stores

#### `src/stores/display-store.ts`
- Implement full display state management:
  - `monitors: MonitorInfo[]` — detected monitors
  - `monitorAssignments: { operator?: string, projector?: string, return?: string }` — monitor name by role
  - `projectorOpen: boolean`
  - `returnOpen: boolean`
  - `isBlackScreen: boolean`
  - `isLogoScreen: boolean`
  - Actions:
    - `refreshMonitors()` — re-detect monitors
    - `assignMonitor(role, monitorName)` — assign a monitor to a role
    - `openProjector()` / `closeProjector()`
    - `openReturn()` / `closeReturn()`
    - `toggleBlackScreen()` / `toggleLogoScreen()`

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `openReturnWindow(monitorIndex: number): Promise<void>`
  - `closeReturnWindow(): Promise<void>`
  - `showBlackScreen(): Promise<void>`
  - `showLogoScreen(): Promise<void>`
  - `identifyMonitors(): Promise<void>`
  - `saveMonitorConfig(role: string, monitorName: string, positionJson: string): Promise<void>`
  - `getMonitorConfigs(): Promise<MonitorConfig[]>`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks:
  - `useMonitors()` — fetch detected monitors
  - `useMonitorConfigs()` — fetch saved monitor configurations
  - `useSaveMonitorConfig()` — mutation

### Frontend — Projector Route

#### `src/routes/projector.tsx` (UPDATE)
- Add black screen overlay support (listens to `black-screen` event)
- Add logo screen support (listens to `logo-screen` event)
- Add CSS fade transitions between states (content → black → content)

### Frontend — Return Route

#### `src/routes/return.tsx` (UPDATE)
- Implement full return monitor view using `ReturnView` component
- Listen to `slide-changed` events for both current and next slide data
- Display performer metadata (hymn title, slide position)

### Frontend — Keyboard Shortcuts

#### `src/hooks/use-keyboard.ts` (UPDATE)
- Add shortcuts:
  - `B` → toggle black screen
  - `L` → toggle logo screen
  - `F5` → toggle projector window
  - `Shift+F5` → toggle return monitor window
