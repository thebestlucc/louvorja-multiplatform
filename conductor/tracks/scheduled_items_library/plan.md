# Scheduled Items Library Implementation Plan (Extended: Date-Based)

- [x] **Task 1: Initial Database Migration** (7d823e3, a6a1bd1)
- [x] **Task 2: Initial Backend Models and Queries** (fae091a, 3735e22)
- [x] **Task 3: Initial Tauri Commands** (880ba21, 7ae17ff)
- [x] **Task 4: Initial Frontend Bindings and Routes** (ecfbfbd, ad94acd)
- [x] **Task 5: Initial Management UI Implementation** (85290a4, 85c00a7)
- [x] **Task 6: Initial Service Integration** (b50fa46, d69d206)
- [x] **Task 7: Spotlight Integration** (e030d4c, 92cf43d)
- [x] **Task 8: i18n and Polish** (1df43c9, 8c8a46c)
- [x] **Task 9: Permission Fixes and UI Polish** (7ca574b, 6719ca8)

---

### Task 10: Date-Based Schema Update
- [x] **Step 1: Write migration v31** (b01ca8c)
Add `scheduled_date` (TEXT) to `media_library_items`.
- [x] **Step 2: Update models and queries** (6719ca8)
Update `MediaLibraryItem` and `MediaLibraryItemInput` to include `scheduledDate`.
- [x] **Step 3: Commit**

### Task 11: Management UI Refactor (Date Flow)
- [x] **Step 1: Implement DateSelector component (multiple calendars)**
- [x] **Step 2: Update MediaLibraryManager flow** (f87370c)
Category Sidebar -> Date Sidebar (Calendar) -> Item Grid.
- [x] **Step 3: Commit**

### Task 12: Smart Service Integration
- [x] **Step 1: Add 'Scheduled Item Category' item type to Liturgy**
- [x] **Step 2: Implement auto-resolution of items based on service date**
- [x] **Step 3: Commit**
