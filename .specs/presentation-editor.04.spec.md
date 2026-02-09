# SPEC 04 — Presentation Editor & .slja Archive Support

**Phase:** 3
**Goal:** Full slide creation/editing with the custom .slja archive format.

---

## Files to CREATE

### Frontend — Routes

#### `src/routes/presentations/route.tsx`
- Create the presentations layout route
- Sub-layout with list panel on left and editor on right
- Wraps children with `<Outlet />`

#### `src/routes/presentations/index.tsx`
- Create the presentations list page
- Grid/list view of saved presentations
- Each item shows: title, slide count, last modified date, thumbnail of first slide
- "New Presentation" button
- "Import .slja" button (opens file picker)
- Search/filter bar
- Context menu: duplicate, delete, export
- Uses TanStack Query to fetch presentation list

#### `src/routes/presentations/$presentationId.tsx`
- Create the presentation editor page
- Three-panel layout:
  - Left: slide list (sortable thumbnails)
  - Center: slide editor (active slide)
  - Right: properties panel (font, color, background, transitions)
- Toolbar: add slide, delete slide, duplicate slide, aspect ratio selector
- Save button (saves to SQLite + optionally exports to .slja)
- Preview button (opens projector with current presentation)
- Auto-save on changes (debounced)

### Frontend — Components

#### `src/components/slides/slide-editor.tsx`
- Create the editable slide component
- Rich text editing area with:
  - Text content editing (contenteditable or textarea)
  - Font family selector (from system fonts)
  - Font size slider/input
  - Text color picker
  - Text alignment (left, center, right)
  - Bold/italic/underline toggles
- Background section:
  - Color picker for solid backgrounds
  - Image picker for background images
  - Background position selector (9-position grid: top-left, top-center, top-right, etc.)
  - Background opacity slider
- Slide type selector: cover, lyrics, pause, text, image
- Real-time preview as you edit

#### `src/components/slides/slide-list.tsx` (UPDATE)
- Add drag-and-drop reordering via `@dnd-kit/sortable`
- Add "Add Slide" button at the bottom
- Add context menu per slide: duplicate, delete, move up/down
- Add multi-select for batch operations

#### `src/components/slides/background-picker.tsx`
- Create background selection component
- Tab interface: "Solid Color" | "Image" | "Gradient"
- Solid Color tab: color picker
- Image tab: file browser, recent images, drag-and-drop upload
- 9-position grid for image placement (maps to CSS background-position)
- Preview of the selected background

#### `src/components/slides/aspect-ratio-selector.tsx`
- Create aspect ratio selection component
- Options: Free, 4:3, 16:9
- Visual preview of each ratio
- Changes apply to the entire presentation

#### `src/components/slides/transition-selector.tsx`
- Create slide transition picker
- Options: None, Fade, Slide Left, Slide Right, Slide Up
- Duration slider (100ms - 2000ms)
- Preview animation on hover

### Frontend — Hooks

#### `src/hooks/use-presentation.ts`
- Create presentation management hook
- Loads presentation by ID via TanStack Query
- Provides: `slides`, `activeSlideIndex`, `presentationMeta`
- Actions: `addSlide()`, `deleteSlide(index)`, `duplicateSlide(index)`, `reorderSlides(from, to)`, `updateSlide(index, content)`, `updateMeta(meta)`
- Auto-save: debounced save (1s) after any change

---

## Files to UPDATE

### Backend — Archive Module

#### `src-tauri/src/archive/mod.rs`
- Implement .slja archive read/write:
  - `read_slja(path: &Path) -> Result<PresentationArchive>` — open ZIP, parse manifest, extract slides and media
  - `write_slja(path: &Path, presentation: &PresentationArchive) -> Result<()>` — create ZIP with manifest, slides, media, thumbnails
  - `PresentationArchive` struct: `{ manifest: Manifest, slides: Vec<SlideData>, media: Vec<MediaFile> }`

#### `src-tauri/src/archive/manifest.rs`
- Implement manifest parsing and writing:
  - `Manifest::from_json(json: &str) -> Result<Manifest>` — parse manifest.json
  - `Manifest::to_json(&self) -> Result<String>` — serialize to JSON
  - Fields: `title`, `author`, `aspect_ratio`, `slide_count`, `created_at`, `updated_at`

### Backend — Slide Commands

#### `src-tauri/src/commands/slides.rs`
- Implement all slide/presentation commands:
  - `get_presentations() -> Result<Vec<Presentation>>` — list all presentations
  - `get_presentation(id: i64) -> Result<Presentation>` — get single presentation
  - `create_presentation(title: String, aspect_ratio: String) -> Result<Presentation>` — create new
  - `update_presentation(id: i64, title: String, aspect_ratio: String) -> Result<()>` — update metadata
  - `delete_presentation(id: i64) -> Result<()>` — delete presentation and its slides
  - `get_slides(presentation_id: i64) -> Result<Vec<Slide>>` — get all slides for a presentation
  - `create_slide(presentation_id: i64, content_json: String, sort_order: i32) -> Result<Slide>` — add slide
  - `update_slide(id: i64, content_json: String) -> Result<()>` — update slide content
  - `delete_slide(id: i64) -> Result<()>` — delete a slide
  - `reorder_slides(presentation_id: i64, slide_ids: Vec<i64>) -> Result<()>` — update sort_order for all slides
  - `import_slja(path: String) -> Result<Presentation>` — import .slja file into database
  - `export_slja(presentation_id: i64, path: String) -> Result<()>` — export presentation to .slja file

### Backend — Database Queries

#### `src-tauri/src/db/queries/slides.rs` (CREATE)
- Create query module for presentations and slides:
  - `get_presentations(conn) -> Result<Vec<Presentation>>`
  - `get_presentation_by_id(conn, id) -> Result<Presentation>`
  - `insert_presentation(conn, title, aspect_ratio) -> Result<i64>`
  - `update_presentation(conn, id, title, aspect_ratio) -> Result<()>`
  - `delete_presentation(conn, id) -> Result<()>`
  - `get_slides(conn, presentation_id) -> Result<Vec<Slide>>`
  - `insert_slide(conn, presentation_id, content_json, sort_order) -> Result<i64>`
  - `update_slide(conn, id, content_json) -> Result<()>`
  - `delete_slide(conn, id) -> Result<()>`
  - `update_slide_order(conn, slide_id, new_order) -> Result<()>`

#### `src-tauri/src/db/queries/mod.rs`
- Add `pub mod slides;`

### Backend — Cargo

#### `src-tauri/Cargo.toml`
- Add `zip = "2.1"` dependency
- Add `tempfile = "3"` dependency

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register all presentation/slide commands

### Frontend — npm Dependencies

#### `package.json`
- Add `@dnd-kit/core` and `@dnd-kit/sortable` dependencies (if not already added in Phase 0)

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `getPresentations(): Promise<Presentation[]>`
  - `getPresentation(id: number): Promise<Presentation>`
  - `createPresentation(title: string, aspectRatio: string): Promise<Presentation>`
  - `updatePresentation(id: number, title: string, aspectRatio: string): Promise<void>`
  - `deletePresentation(id: number): Promise<void>`
  - `getSlides(presentationId: number): Promise<Slide[]>`
  - `createSlide(presentationId: number, contentJson: string, sortOrder: number): Promise<Slide>`
  - `updateSlide(id: number, contentJson: string): Promise<void>`
  - `deleteSlide(id: number): Promise<void>`
  - `reorderSlides(presentationId: number, slideIds: number[]): Promise<void>`
  - `importSlja(path: string): Promise<Presentation>`
  - `exportSlja(presentationId: number, path: string): Promise<void>`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks for presentations:
  - `usePresentations()` — list all presentations
  - `usePresentation(id)` — single presentation
  - `useSlides(presentationId)` — slides for a presentation
  - `useCreatePresentation()` — mutation
  - `useUpdatePresentation()` — mutation
  - `useDeletePresentation()` — mutation
  - `useCreateSlide()` — mutation
  - `useUpdateSlide()` — mutation with optimistic update
  - `useDeleteSlide()` — mutation
  - `useReorderSlides()` — mutation with optimistic update
  - `useImportSlja()` — mutation
  - `useExportSlja()` — mutation
