# Architectural Improvement Plan — LouvorJA Multiplatform

This document outlines the strategic roadmap for improving the codebase's maintainability, type safety, and scalability. It addresses the identified technical debt and modernizes the bridge between the Rust backend and React frontend.

## 1. Objectives
- **Zero-Manual Types:** Eliminate manual duplication of types between Rust and TypeScript.
- **Consistent Conventions:** Standardize on `camelCase` across the IPC boundary.
- **Improved Performance:** Enable concurrent database operations via connection pooling.
- **Decoupled State:** Reduce tight coupling between Zustand stores.
- **Robust Error Handling:** Provide structured, actionable error context to the UI.

## 2. Phased Roadmap

### Phase 1: Standardization & DX (Developer Experience)
*   **Automated Type Generation:** Implement `specta` to derive TS bindings from Rust.
*   **Naming Standardization:** Migration of all models to `camelCase` for seamless JS integration.
*   **Quality Gates:** Automated validation for i18n keys and type symmetry.

### Phase 2: Backend Performance & Reliability
*   **Database Scaling:** Replace single-threaded `Mutex<Connection>` with `r2d2` connection pooling.
*   **Structured Errors:** Refactor `AppError` to return machine-readable codes and metadata.

### Phase 3: Frontend Refactoring
*   **Store Decoupling:** Implement event-based communication between state domains.
*   **Logic Extraction:** Move complex orchestration (like audio-slide sync) from stores into dedicated hooks/managers.

### Phase 4: Validation & Hardening
*   **Concurrency Audit:** Verify WAL-mode performance with multiple read connections.
*   **Type Audit:** Remove all legacy manual interfaces in `src/types/`.

## 3. Key Architectural Decisions
- **Tooling:** Use `tauri-specta` for the most robust Tauri-specific type generation.
- **Patterns:** Prefer "Thin Stores" (pure state) and "Rich Managers" (complex logic).
- **Concurrency:** Leverage SQLite's WAL mode with a connection pool to maximize throughput.
