# Specification: Scheduled Items Library (Itens Agendados)

## 1. Goal
Implement a centralized Media Library (historically "Itens Agendados") that allows users to manage a reusable collection of media files (videos, PDFs, images, etc.) organized by categories. This library will be accessible from the Worship Service (Liturgy) manager and the global Spotlight search.

## 2. User Experience
- **Management UI**: A new utility under `/utilities/media-library` with a two-pane layout:
    - **Sidebar**: Manage and select categories (e.g., "Intro Videos", "Announcements", "Sermon Slides").
    - **Main Grid**: List, add, edit, and delete items within the selected category. Supports drag-and-drop for file addition.
- **Service Integration**: When adding a "File" to a service, the user can choose between "Local File" (current behavior) or "Library" (browsing the Scheduled Items).
- **Spotlight**: Library items appear in global search results for quick projection or addition to the current service.

## 3. Technical Design

### 3.1 Database Schema
Two new tables will be added via a migration:

#### `media_library_categories`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT NOT NULL
- `sort_order`: INTEGER NOT NULL DEFAULT 0
- `id_language`: TEXT NOT NULL REFERENCES languages(id_language)

#### `media_library_items`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `category_id`: INTEGER NOT NULL REFERENCES media_library_categories(id) ON DELETE CASCADE
- `name`: TEXT NOT NULL
- `file_path`: TEXT NOT NULL
- `file_type`: TEXT NOT NULL (e.g., 'video', 'image', 'pdf')
- `thumbnail_path`: TEXT (optional)
- `sort_order`: INTEGER NOT NULL DEFAULT 0
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### 3.2 Backend (Rust/Tauri)
- **Commands**: 
    - `get_media_categories`, `upsert_media_category`, `delete_media_category`
    - `get_media_items`, `upsert_media_item`, `delete_media_item`
- **Search**: Update the Spotlight command to include matches from `media_library_items`.

### 3.3 Frontend (React)
- **Route**: New route `src/routes/utilities/media-library.tsx`.
- **Components**:
    - `MediaLibraryManager`: The main utility UI.
    - `LibraryBrowser`: A shared component used in both the utility and the `AddItemModal` tab.
- **Store**: Add `media-library` slice to TanStack Query for caching and state management.

## 4. Acceptance Criteria
- [ ] Users can create/edit/delete categories.
- [ ] Users can add files to the library and assign them to categories.
- [ ] The library is accessible as a tab when adding items to a Service.
- [ ] Selecting a library item in a Service correctly stores the reference.
- [ ] Library items are searchable via Cmd+K.
- [ ] i18n: All UI strings exist in PT, EN, and ES.

## 5. Constraints
- Must follow existing project patterns (Tailwind v4, TanStack Router/Query, catcher for error handling).
- DB migrations must be versioned correctly in `src-tauri/src/db/migrations.rs`.
