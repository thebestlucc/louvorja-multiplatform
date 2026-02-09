# SPEC 02 — Music & Lyrics Core

**Phase:** 1
**Goal:** Deliver hymn browsing, lyrics display, and basic slide projection.

---

## Files to CREATE

### Frontend — Routes

#### `src/routes/hymnal/route.tsx`
- Create the hymnal layout route
- Contains a sub-layout with a left panel (hymn list/search) and right panel (hymn detail/lyrics)
- Wraps children with `<Outlet />`

#### `src/routes/hymnal/index.tsx`
- Create the hymnal list/search page
- Displays a grid of album cards (covers) using `AlbumCard` component
- Includes a search bar at the top that filters hymns in real-time
- Uses TanStack Query to fetch hymn list via `search_hymns` Rust command
- Pagination or infinite scroll for large hymn databases

#### `src/routes/hymnal/$hymnId.tsx`
- Create the individual hymn view page
- Displays hymn metadata (number, title, album, artist)
- Shows lyrics via `LyricsDisplay` component
- Slide preview panel showing how the lyrics will appear on the projector
- "Project" button to send current slide to projector window
- "Add to Service" button to add hymn to the current worship service
- Navigation: previous/next hymn within the same album

### Frontend — Music Components

#### `src/components/music/hymn-card.tsx`
- Create a card component for displaying a hymn in a list/grid
- Shows: hymn number, title, album name
- Thumbnail/cover art if available
- Click navigates to `$hymnId` route
- Context menu (right-click): "Add to Service", "Add to Favorites", "Project"

#### `src/components/music/hymn-search.tsx`
- Create a search component for hymns
- Text input with debounced search (300ms)
- Search by: number, title, lyrics content
- Filter toggles: by album, by artist
- Results displayed as a list of `HymnCard` components
- Uses TanStack Query with the `search_hymns` command

#### `src/components/music/lyrics-display.tsx`
- Create the lyrics display component
- Renders hymn lyrics with configurable: font family, font size, text color, background color/image
- Splits lyrics into slides based on stanza breaks (double newline)
- Each slide is a separate visual block
- Highlights the currently active slide
- Supports slide types: cover (title slide), lyrics (stanza), pause (instrumental break)

#### `src/components/music/album-card.tsx`
- Create a card component for albums/collections
- Shows album/collection name and cover art
- Displays hymn count
- Click navigates to hymnal list filtered by album

### Frontend — Slide Components

#### `src/components/slides/slide-renderer.tsx`
- Create the core slide renderer component
- Accepts `SlideContent` as props
- Renders text with the specified font, size, color, alignment
- Renders background (color or image with position)
- Supports CSS transitions for fade between slides
- This component is shared across: operator preview, projector window, return monitor, streaming output

#### `src/components/slides/slide-thumbnail.tsx`
- Create a miniature slide preview component
- Renders a scaled-down version of the slide using `SlideRenderer`
- Shows slide number overlay
- Click selects the slide
- Active state visual indicator (border highlight)

#### `src/components/slides/slide-list.tsx`
- Create a vertical scrollable list of slide thumbnails
- Displays all slides for the current hymn/presentation
- Highlights the active slide
- Click to navigate to a slide
- Keyboard navigation support (up/down arrows)

#### `src/components/slides/projector-view.tsx`
- Create the fullscreen projector output component
- Renders the current slide using `SlideRenderer` at full resolution
- Listens to Tauri events (`slide-changed`) for content updates
- CSS transition animations between slides (fade)
- Black background when no content is projected

### Frontend — Routes (Projector/Return)

#### `src/routes/projector.tsx`
- Create the projector window route (`/projector`)
- Fullscreen layout with no chrome (no sidebar, no header)
- Renders `ProjectorView` component
- Listens to Tauri events for slide changes
- Handles black screen / logo screen commands

#### `src/routes/return.tsx`
- Create the return monitor route (`/return`)
- Fullscreen layout with performer-facing content
- Shows current slide AND next slide preview
- Larger text for readability from a distance
- Listens to Tauri events for slide changes

### Frontend — Hooks

#### `src/hooks/use-slides.ts`
- Create slide navigation hook
- State: `currentIndex`, `slides[]`, `totalSlides`
- Actions: `nextSlide()`, `prevSlide()`, `goToSlide(index)`, `setSlides(slides[])`
- Sends Tauri commands to update projector on slide change
- Keyboard bindings: ArrowRight/Space/PgDn = next, ArrowLeft/PgUp = prev

#### `src/hooks/use-keyboard.ts`
- Create global keyboard shortcut hook
- Register keyboard listeners for slide navigation
- ArrowRight, ArrowDown, Space, PageDown → next slide
- ArrowLeft, ArrowUp, PageUp → previous slide
- Escape → black screen
- F5 → toggle projector
- Cmd+K / Ctrl+K → command palette
- Prevents default browser behavior for registered keys

#### `src/hooks/use-monitors.ts`
- Create monitor detection hook
- Calls `get_available_monitors` Rust command via TanStack Query
- Returns list of monitors with their names, sizes, and positions
- Provides `openProjector(monitorIndex)` and `closeProjector()` actions

### Frontend — Query Definitions

#### `src/lib/queries.ts` (UPDATE)
- Add query key factories for hymns:
  - `queryKeys.hymns.all`
  - `queryKeys.hymns.search(query)`
  - `queryKeys.hymns.detail(id)`
  - `queryKeys.hymns.byAlbum(album)`
  - `queryKeys.albums.all`
- Add query functions: `useHymns(query)`, `useHymn(id)`, `useAlbums()`, `useHymnsByAlbum(album)`
- Add mutation: `useProjectSlide()`

---

## Files to UPDATE

### Backend — Rust Commands

#### `src-tauri/src/commands/music.rs`
- Implement `search_hymns(query: String) -> Result<Vec<Hymn>, AppError>`
  - Uses FTS5 full-text search when query is text
  - Uses direct number lookup when query is numeric
  - Returns results sorted by relevance
- Implement `get_hymn(id: i64) -> Result<Hymn, AppError>`
  - Fetches a single hymn by ID with all fields
- Implement `get_albums() -> Result<Vec<Album>, AppError>`
  - Returns distinct album names with hymn counts
- Implement `get_hymns_by_album(album: String) -> Result<Vec<Hymn>, AppError>`
  - Returns all hymns in a given album, ordered by number

#### `src-tauri/src/commands/display.rs`
- Implement `get_available_monitors() -> Result<Vec<MonitorInfo>, AppError>`
  - Uses Tauri's `available_monitors()` API
  - Returns monitor name, size, position, scale factor
- Implement `open_projector_window(monitor_index: usize) -> Result<(), AppError>`
  - Creates a new Tauri webview window targeting `/projector` route
  - Positions on the specified monitor
  - Sets fullscreen
  - Follows the placement workaround: create hidden → set position → set size → make visible → set fullscreen
- Implement `close_projector_window() -> Result<(), AppError>`
  - Closes the projector window if open
- Implement `set_current_slide(slide_data: SlideContent) -> Result<(), AppError>`
  - Stores current slide in managed state
  - Emits `slide-changed` Tauri event to all windows

### Backend — Database Queries

#### `src-tauri/src/db/queries/music.rs`
- Implement `search_hymns(conn: &Connection, query: &str) -> Result<Vec<Hymn>>`
  - Full-text search via `hymns_fts` virtual table
  - Fallback to LIKE query for simple patterns
  - Numeric query → search by hymn number
- Implement `get_hymn_by_id(conn: &Connection, id: i64) -> Result<Hymn>`
  - SELECT * FROM hymns WHERE id = ?
- Implement `get_albums(conn: &Connection) -> Result<Vec<Album>>`
  - SELECT album, COUNT(*) FROM hymns GROUP BY album
- Implement `get_hymns_by_album(conn: &Connection, album: &str) -> Result<Vec<Hymn>>`
  - SELECT * FROM hymns WHERE album = ? ORDER BY number

### Backend — Models

#### `src-tauri/src/db/models.rs`
- Finalize `Hymn` struct fields: `id`, `number`, `title`, `album`, `artist`, `lyrics`, `audio_path`, `created_at`, `updated_at`
- Add `Album` struct: `name: String`, `hymn_count: i64`
- Add `MonitorInfo` struct: `name: String`, `width: u32`, `height: u32`, `x: i32`, `y: i32`, `scale_factor: f64`
- Add `SlideContent` struct with serde serialization for Tauri events

### Backend — State

#### `src-tauri/src/state.rs`
- Add `current_slide: Mutex<Option<SlideContent>>` to `AppState`
- Add `projector_open: Mutex<bool>` to track projector window state

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register implemented music commands: `search_hymns`, `get_hymn`, `get_albums`, `get_hymns_by_album`
- Register implemented display commands: `get_available_monitors`, `open_projector_window`, `close_projector_window`, `set_current_slide`
- Add event emission for `slide-changed`

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `searchHymns(query: string): Promise<Hymn[]>`
  - `getHymn(id: number): Promise<Hymn>`
  - `getAlbums(): Promise<Album[]>`
  - `getHymnsByAlbum(album: string): Promise<Hymn[]>`
  - `getAvailableMonitors(): Promise<MonitorInfo[]>`
  - `openProjectorWindow(monitorIndex: number): Promise<void>`
  - `closeProjectorWindow(): Promise<void>`
  - `setCurrentSlide(slideData: SlideContent): Promise<void>`

### Frontend — Stores

#### `src/stores/presentation-store.ts`
- Implement slide navigation state and actions
- `setSlides(slides: SlideContent[])` — load slides for a hymn
- `nextSlide()` / `prevSlide()` — advance/retreat and invoke `setCurrentSlide`
- `goToSlide(index: number)` — jump to specific slide
