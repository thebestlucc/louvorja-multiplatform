# SPEC 06 — Worship Service / Liturgy Manager

**Phase:** 5
**Goal:** Organize complete worship services with drag-and-drop item management.

---

## Files to CREATE

### Frontend — Routes

#### `src/routes/services/route.tsx`
- Create the services layout route
- Sub-layout with service list on left, service detail/editor on right
- Wraps children with `<Outlet />`

#### `src/routes/services/index.tsx`
- Create the services list page
- List of worship services sorted by date (most recent first)
- Each item shows: title, date, item count, quick preview of items
- "New Service" button → opens dialog to set title and date
- Search/filter by date range or title
- Context menu: duplicate service, delete, export
- Uses TanStack Query to fetch service list

#### `src/routes/services/$serviceId.tsx`
- Create the service editor page
- Editable title and date at the top
- Drag-and-drop sortable item list using `@dnd-kit`
- Each item shows its type icon, title/description, and action buttons
- Item types with visual distinction (color-coded left border):
  - Hymn (music note icon, blue)
  - Bible reading (book icon, green)
  - Presentation (slides icon, purple)
  - Annotation/note (pencil icon, yellow)
  - URL link (link icon, cyan)
  - File (file icon, gray)
- "Add Item" button opens a modal with item type selection
- When adding a hymn: opens hymn search modal
- When adding a Bible reading: opens Bible navigation modal
- When adding a presentation: opens presentation picker modal
- When adding an annotation: inline text input
- "Play Service" button: starts projecting items in order
- Notes section at the bottom for general service notes

### Frontend — Components

#### `src/components/services/service-editor.tsx`
- Create the drag-and-drop service builder component
- Uses `@dnd-kit/core` and `@dnd-kit/sortable` for reordering
- Renders a list of `ServiceItem` components
- Drop zone at the bottom for adding items via drag
- Handles item reordering with optimistic updates
- "Save" button (or auto-save)

#### `src/components/services/service-item.tsx`
- Create the individual service item component
- Displays:
  - Drag handle (grip icon)
  - Type icon with color-coded border
  - Item title/description (e.g., "Hymn #123 - Amazing Grace" or "Genesis 1:1-5 (ARA)")
  - Action buttons: edit, remove, project
- Click to expand: shows full details and edit options
- "Project" button: sends item content to projector
- "Remove" button with confirmation

#### `src/components/services/service-timeline.tsx`
- Create a visual timeline component for the service
- Vertical timeline with items as nodes
- Shows progression through the service during "Play Service" mode
- Highlights the current active item
- Estimated duration per item (optional)

#### `src/components/services/add-item-modal.tsx`
- Create modal for adding items to a service
- Tab interface for each item type
- Hymn tab: embedded hymn search (reuses `HymnSearch` component)
- Bible tab: embedded Bible navigation (reuses `BookSelector`)
- Presentation tab: embedded presentation picker
- Annotation tab: text input field
- URL tab: URL input with validation
- File tab: file picker
- "Add" button adds the selected item to the service

#### `src/components/services/service-card.tsx`
- Create a card component for the services list
- Shows: title, date, item count
- Click navigates to service editor
- Context menu: duplicate, delete, export

### Frontend — Hooks

#### `src/hooks/use-service.ts`
- Create service management hook
- Loads service by ID via TanStack Query
- Provides: `service`, `items`, `isEditing`
- Actions: `addItem(type, data)`, `removeItem(id)`, `reorderItems(from, to)`, `updateItem(id, data)`, `saveService()`
- Auto-save: debounced save (2s) after any change

---

## Files to UPDATE

### Backend — Liturgy Commands

#### `src-tauri/src/commands/liturgy.rs`
- Implement all worship service commands:
  - `get_services() -> Result<Vec<Service>, AppError>` — list all services ordered by date DESC
  - `get_service(id: i64) -> Result<Service, AppError>` — get single service with items
  - `create_service(title: String, date: Option<String>, notes: Option<String>) -> Result<Service, AppError>` — create new service
  - `update_service(id: i64, title: String, date: Option<String>, notes: Option<String>) -> Result<(), AppError>` — update service metadata
  - `delete_service(id: i64) -> Result<(), AppError>` — delete service and all its items
  - `add_service_item(service_id: i64, item_type: String, reference_id: Option<i64>, metadata_json: Option<String>) -> Result<ServiceItem, AppError>` — add item to service
  - `remove_service_item(item_id: i64) -> Result<(), AppError>` — remove item from service
  - `reorder_service_items(service_id: i64, item_ids: Vec<i64>) -> Result<(), AppError>` — update sort_order for all items
  - `duplicate_service(id: i64) -> Result<Service, AppError>` — create a copy of an existing service with all its items

### Backend — Database Queries

#### `src-tauri/src/db/queries/liturgy.rs`
- Implement all liturgy query functions:
  - `get_services(conn) -> Result<Vec<Service>>` — SELECT * FROM services ORDER BY date DESC
  - `get_service_by_id(conn, id) -> Result<Service>`
  - `insert_service(conn, title, date, notes) -> Result<i64>`
  - `update_service(conn, id, title, date, notes) -> Result<()>`
  - `delete_service(conn, id) -> Result<()>` — CASCADE: also delete related service_items
  - `get_service_items(conn, service_id) -> Result<Vec<ServiceItem>>` — ordered by sort_order
  - `insert_service_item(conn, service_id, item_type, reference_id, metadata_json) -> Result<i64>` — auto-assign sort_order
  - `delete_service_item(conn, item_id) -> Result<()>`
  - `reorder_items(conn, service_id, item_ids) -> Result<()>` — update sort_order based on position in array
  - `duplicate_service_with_items(conn, id) -> Result<i64>` — copy service and all items

### Backend — Models

#### `src-tauri/src/db/models.rs`
- Finalize `Service` struct: `{ id, title, date, notes, created_at, item_count }`
- Finalize `ServiceItem` struct: `{ id, service_id, sort_order, item_type, reference_id, metadata_json }`
- Add `ServiceWithItems` struct: `{ service: Service, items: Vec<ServiceItem> }`

### Backend — Lib

#### `src-tauri/src/lib.rs`
- Register all liturgy commands: `get_services`, `get_service`, `create_service`, `update_service`, `delete_service`, `add_service_item`, `remove_service_item`, `reorder_service_items`, `duplicate_service`

### Frontend — Tauri Wrappers

#### `src/lib/tauri.ts`
- Add typed invoke wrappers:
  - `getServices(): Promise<Service[]>`
  - `getService(id: number): Promise<ServiceWithItems>`
  - `createService(title: string, date?: string, notes?: string): Promise<Service>`
  - `updateService(id: number, title: string, date?: string, notes?: string): Promise<void>`
  - `deleteService(id: number): Promise<void>`
  - `addServiceItem(serviceId: number, itemType: string, referenceId?: number, metadataJson?: string): Promise<ServiceItem>`
  - `removeServiceItem(itemId: number): Promise<void>`
  - `reorderServiceItems(serviceId: number, itemIds: number[]): Promise<void>`
  - `duplicateService(id: number): Promise<Service>`

### Frontend — Queries

#### `src/lib/queries.ts`
- Add query keys and hooks for services:
  - `queryKeys.services.all`
  - `queryKeys.services.detail(id)`
  - `useServices()` — list all services
  - `useService(id)` — single service with items
  - `useCreateService()` — mutation
  - `useUpdateService()` — mutation
  - `useDeleteService()` — mutation
  - `useAddServiceItem()` — mutation with optimistic update
  - `useRemoveServiceItem()` — mutation with optimistic update
  - `useReorderServiceItems()` — mutation with optimistic update

### Frontend — Layout

#### `src/components/layout/sidebar.tsx` (UPDATE)
- Add "current service" quick access in the sidebar
- Show active service name at the bottom of the sidebar
- Quick "Add to Service" action accessible from any view

### Frontend — Music Components

#### `src/components/music/hymn-card.tsx` (UPDATE)
- Add "Add to Service" action in the context menu and as a button
- When clicked, adds the hymn to the currently active service

### Frontend — Bible Components

#### `src/components/bible/verse-display.tsx` (UPDATE)
- Add "Add to Service" button next to verse selection
- When clicked, adds the selected Bible reference to the current service

### Frontend — Stores

#### `src/stores/presentation-store.ts` (UPDATE)
- Add `activeServiceId: number | null` to track the current service being worked on
- Add `setActiveService(id)` action
- Used by the "Add to Service" buttons throughout the app
