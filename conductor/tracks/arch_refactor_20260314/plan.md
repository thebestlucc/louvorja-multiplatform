# Implementation Plan: Architectural Refactoring and Security Hardening

## Phase 1: Security Hardening & Path Utilities
- [x] Task: Implement `src-tauri/src/utils/paths.rs` 8c46042
    - [x] Sub-task: Create `SafePath` struct with validation against `media/` root.
    - [x] Sub-task: Write unit tests for path traversal edge cases.
- [x] Task: Refactor Tauri Capabilities f69dbbf
    - [x] Sub-task: Audit `src-tauri/capabilities/*.json`.
    - [x] Sub-task: Replace `:default` with explicit command lists for each window.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Security Hardening' (Protocol in workflow.md)

## Phase 2: Display Module Decomposition
- [x] Task: Initialize `src-tauri/src/display/` sub-directory 8cb991b
    - [x] Sub-task: Create `monitor.rs` (scoring and detection logic).
    - [x] Sub-task: Create `window.rs` (creation and fullscreen retry logic).
    - [x] Sub-task: Create `projection.rs` (slide and context sync logic).
- [x] Task: Migrate logic from `commands/display.rs` to new sub-modules. 8cb991b
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Display Refactor' (Protocol in workflow.md)

## Phase 3: State & Performance
- [x] Task: Evaluate `AppState` Mutex usage 698e807
    - [x] Sub-task: Benchmark current `Mutex` under high-frequency audio position updates.
    - [x] Sub-task: Replace targeted `Mutex` with `RwLock` or `Atomic` if necessary.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Performance Check' (Protocol in workflow.md)