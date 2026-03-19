# Scheduled Items Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a categorized Media Library ("Itens Agendados") for reusable assets, integrated into Services and Spotlight search.

**Architecture:** 
- New SQLite tables for categories and items.
- Rust Tauri commands for CRUD and global search integration.
- TanStack Router for management UI and shared components for browsing.

**Tech Stack:** Tauri 2, Rust (rusqlite, serde), React 19, TanStack Query/Router, Tailwind v4.

---

### Task 1: Database Migration

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

- [x] **Step 1: Write migration v30**
Add `migrate_v30` function to create `media_library_categories` and `media_library_items` tables.
- [x] **Step 2: Register migration**
Update `run_migrations` to include `migrate_v30`.
- [x] **Step 3: Run cargo check**
Ensure the backend compiles.
- [x] **Step 4: Commit** (7d823e3)
`git add src-tauri/src/db/migrations.rs && git commit -m "feat(db): Add media library tables migration"`

### Task 2: Backend Models and Queries

**Files:**
- Create: `src-tauri/src/db/queries/media_library.rs`
- Modify: `src-tauri/src/db/models.rs` (Assuming it exists, need to verify)

- [x] **Step 1: Define Structs in models.rs**
- [x] **Step 2: Implement CRUD queries in media_library.rs**
- [x] **Step 3: Commit** (fae091a)
`git add src-tauri/src/db/queries/media_library.rs src-tauri/src/db/models.rs && git commit -m "feat(db): Implement media library queries"`

### Task 3: Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/media_library.rs`
- Modify: `src-tauri/src/lib.rs`

- [x] **Step 1: Implement commands in media_library.rs**
- [x] **Step 2: Register commands in lib.rs**
- [x] **Step 3: Commit** (880ba21)
`git add src-tauri/src/commands/media_library.rs src-tauri/src/lib.rs && git commit -m "feat(tauri): Add media library commands"`

### Task 4: Frontend Bindings and Routes

**Files:**
- Modify: `src/lib/bindings.ts` (via `cargo check` or `tauri dev`)
- Create: `src/routes/utilities/media-library.tsx`
- Modify: `src/routes/utilities/index.tsx`

- [ ] **Step 1: Update bindings**
- [ ] **Step 2: Add Media Library to Utilities index**
- [ ] **Step 3: Scaffold management route**
- [ ] **Step 4: Commit**
`git add . && git commit -m "feat(ui): Add media library management route"`

### Task 5: Management UI Implementation

**Files:**
- Create: `src/components/media/media-library-manager.tsx`
- Create: `src/components/media/category-sidebar.tsx`
- Create: `src/components/media/item-grid.tsx`

- [ ] **Step 1: Implement CategorySidebar**
- [ ] **Step 2: Implement ItemGrid with drag-and-drop support**
- [ ] **Step 3: Commit**
`git add . && git commit -m "feat(ui): Implement media library management components"`

### Task 6: Service Integration

**Files:**
- Modify: `src/components/services/add-item-modal.tsx`
- Create: `src/components/media/library-browser.tsx`

- [ ] **Step 1: Implement LibraryBrowser (shared browser)**
- [ ] **Step 2: Update AddItemModal to use LibraryBrowser in 'File' tab**
- [ ] **Step 3: Commit**
`git add . && git commit -m "feat(ui): Integrate media library into service add-item flow"`

### Task 7: Spotlight Integration

**Files:**
- Modify: `src-tauri/src/commands/spotlight.rs`

- [ ] **Step 1: Update spotlight search query to include library items**
- [ ] **Step 2: Commit**
`git add . && git commit -m "feat(tauri): Add media library items to spotlight search"`

### Task 8: i18n and Polish

**Files:**
- Modify: `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

- [ ] **Step 1: Add all necessary translation keys**
- [ ] **Step 2: Final build check and verification**
- [ ] **Step 3: Commit**
`git add . && git commit -m "chore(i18n): Add media library translations"`
