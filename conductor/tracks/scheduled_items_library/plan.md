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
- [~] **Step 1: Write migration v31**
Add `scheduled_date` (TEXT) to `media_library_items`.
- [ ] **Step 2: Update models and queries**
Update `MediaLibraryItem` and `MediaLibraryItemInput` to include `scheduledDate`.
- [ ] **Step 3: Commit**

### Task 11: Management UI Refactor (Date Flow)
- [ ] **Step 1: Implement DateSelector component (multiple calendars)**
- [ ] **Step 2: Update MediaLibraryManager flow**
Category Sidebar -> Date Sidebar (Calendar) -> Item Grid.
- [ ] **Step 3: Commit**

### Task 12: Smart Service Integration
- [ ] **Step 1: Add 'Scheduled Item Category' item type to Liturgy**
- [ ] **Step 2: Implement auto-resolution of items based on service date**
- [ ] **Step 3: Commit**
