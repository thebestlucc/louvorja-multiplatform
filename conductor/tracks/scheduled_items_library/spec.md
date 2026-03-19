# Specification: Scheduled Items Library

## 1. Goal
Implement a centralized Media Library (historically "Itens Agendados") that allows users to manage a reusable collection of media files (videos, PDFs, images, etc.) organized by categories. This library will be accessible from the Worship Service (Liturgy) manager and the global Spotlight search.

## 2. Scope
- **Database Migration**: Create `media_library_categories` and `media_library_items` tables.
- **Backend Commands**: Implement CRUD operations for categories and items in Rust.
- **Management UI**: Create a new route `/utilities/media-library` for library management.
- **Service Integration**: Update `AddItemModal` to include a library browser tab for the "File" item type.
- **Spotlight Integration**: Update search logic to include library items.
- **Internationalization**: Add strings for all three supported languages.

## 3. Technical Approach

### 3.1 Data Model
- `media_library_categories`: `id`, `name`, `sort_order`, `id_language`.
- `media_library_items`: `id`, `category_id`, `name`, `file_path`, `file_type`, `thumbnail_path`, `sort_order`, `created_at`.

### 3.2 Backend
- New file: `src-tauri/src/db/queries/media_library.rs`.
- New file: `src-tauri/src/commands/media_library.rs`.
- Register commands in `src-tauri/src/lib.rs`.

### 3.3 Frontend
- New route: `src/routes/utilities/media-library.tsx`.
- Shared component: `src/components/media/library-browser.tsx`.
- Update `src/components/services/add-item-modal.tsx`.

## 4. Constraints
- Follow existing patterns for error handling (`catcher`) and UI styling (Tailwind v4 + CVA).
- Ensure DB foreign key constraints are respected (ON DELETE CASCADE for categories).
