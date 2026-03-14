# Implementation Plan: Architectural Refactoring and Security Hardening

## Phase 1: Security Hardening & Path Utilities
- [ ] Task: Implement `src-tauri/src/utils/paths.rs`
    - [ ] Sub-task: Create `SafePath` struct with validation against `media/` root.
    - [ ] Sub-task: Write unit tests for path traversal edge cases.
- [ ] Task: Refactor Tauri Capabilities
    - [ ] Sub-task: Audit `src-tauri/capabilities/*.json`.
    - [ ] Sub-task: Replace `:default` with explicit command lists for each window.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Security Hardening' (Protocol in workflow.md)

## Phase 2: Display Module Decomposition
- [ ] Task: Initialize `src-tauri/src/display/` sub-directory
    - [ ] Sub-task: Create `monitor.rs` (scoring and detection logic).
    - [ ] Sub-task: Create `window.rs` (creation and fullscreen retry logic).
    - [ ] Sub-task: Create `projection.rs` (slide and context sync logic).
- [ ] Task: Migrate logic from `commands/display.rs` to new sub-modules.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Display Refactor' (Protocol in workflow.md)

## Phase 3: State & Performance
- [ ] Task: Evaluate `AppState` Mutex usage
    - [ ] Sub-task: Benchmark current `Mutex` under high-frequency audio position updates.
    - [ ] Sub-task: Replace targeted `Mutex` with `RwLock` or `Atomic` if necessary.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Performance Check' (Protocol in workflow.md)