# Architectural Improvement — Implementation Tasks

This document provides a structured, detailed breakdown of the work required to modernize the LouvorJA Multiplatform codebase.

## Task 1: Type Safety & IPC Modernization
**Objective:** Replace manual type duplication with automated, derivation-based synchronization.

- [x] **Infrastructure Setup**
  - [x] Add `specta = "2.0.0-rc.20"` and `tauri-specta = "2.0.0-rc.15"` to `src-tauri/Cargo.toml`.
  - [x] Initialize the type exporter in `src-tauri/src/run.rs` (Tauri builder setup).
- [x] **Struct Annotations**
  - [x] Add `#[derive(specta::Type)]` to all models in `src-tauri/src/db/models.rs`.
  - [x] Add `#[derive(specta::Type)]` to all structs and enums in `src-tauri/src/state.rs`.
- [x] **camelCase Migration**
  - [x] Ensure `#[serde(rename_all = "camelCase")]` is applied to all Rust structs in `models.rs`.
  - [x] Update frontend components and hooks to use `camelCase` for properties that were previously `snake_case`.
    - [x] `Hymn` properties: `audioPath`, `playbackPath`, etc.
    - [x] `Album` properties: `hymnCount`.
    - [x] `SlideContent` properties: `slideType`, `videoPath`, etc.
- [x] **Binding Generation**
  - [x] Run the backend once to generate `src/lib/bindings.ts` (Manually simulated for this environment).
  - [x] Update `src/lib/tauri.ts` to export functions using these generated types.

## Task 2: Backend Reliability & Performance
**Objective:** Improve database throughput and error observability.

- [x] **Database Connection Pooling**
  - [x] Add `r2d2 = "0.8"` and `r2d2_sqlite = "0.24"` to `src-tauri/Cargo.toml`.
  - [x] Refactor `AppState` in `src-tauri/src/state.rs` to replace `Mutex<Connection>` with `r2d2::Pool<SqliteConnectionManager>`.
  - [x] Update `init_db` in `src-tauri/src/db/mod.rs` to initialize the pool.
  - [x] Update all command handlers in `src-tauri/src/commands/*.rs` to use `state.db.get()?`.
- [x] **Structured Error Communication**
  - [x] Modify `AppError` in `src-tauri/src/error.rs` to return a JSON object with `code`, `message`, and `details`.
  - [x] Implement a standardized `SONNER` notification handler in the frontend to display these errors based on the returned code.

## Task 3: Frontend Refactoring & State Decoupling
**Objective:** Clean up the "Fat Store" antipattern and improve testability.

- [x] **Decouple Zustand Stores**
  - [x] Use `tauri::event::listen` and `tauri::event::emit` for communication between `audio-store` and `presentation-store`.
  - [x] Remove `usePresentationStore.getState()` calls from `audio-store.ts`.
- [x] **Extract Orchestration Logic**
  - [x] Logic for slide navigation moved to specialized hooks (e.g., `use-slides.ts`).
  - [x] Stores refactored to be purely reactive state containers.

## Task 4: Quality Control & Validation
**Objective:** Ensure high quality for all supported locales and prevent regressions.

- [x] **i18n Key Validator**
  - [x] Create `scripts/validate-i18n.mjs` using Node.js to check that all three JSON files have matching keys.
  - [x] Add a `pnpm lint:i18n` command to `package.json`.
- [x] **Concurrency Audit**
  - [x] Refactored all DB access to use pooling, resolving potential bottlenecks in background operations.
- [x] **Hardening**
  - [x] Replaced legacy manual interfaces in `src/types/` with imports from `src/lib/bindings.ts`.
  - [x] Unified `SlideContent` across all modules.
