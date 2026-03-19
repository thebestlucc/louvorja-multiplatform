# Implementation Plan: Rust Error Refactoring

This plan outlines the steps for migrating manual Rust error handling patterns to use the `catcher` utilities.

## 1. Preparation
- [x] Implement `src-tauri/src/utils/catcher.rs`.
- [x] Register `catcher` module in `src-tauri/src/utils/mod.rs`.

## 2. Refactoring Phases
Refactor each module in `src-tauri/src/commands/` following the specification.

- [ ] **Phase 2.1: Music and Collections**
  - Files: `music.rs`, `collections.rs`
- [ ] **Phase 2.2: Bible and Favorites**
  - Files: `bible.rs`, `favorites.rs`
- [ ] **Phase 2.3: Slides and Liturgy**
  - Files: `slides.rs`, `liturgy.rs`
- [ ] **Phase 2.4: Audio and Display**
  - Files: `audio.rs`, `display.rs`
- [ ] **Phase 2.5: Migration and Legacy Fetch**
  - Files: `migration.rs`, `legacy_fetch.rs`
- [ ] **Phase 2.6: Settings, Timer, and Utility**
  - Files: `settings.rs`, `timer.rs`, `utility.rs`

## 3. Verification
- [ ] Run `cargo check` after each refactoring phase.
- [ ] Perform a full `pnpm tauri build` to ensure all type bindings and command signatures are intact.
- [ ] Verify that errors are still correctly propagated to the frontend notifications system.

## 4. Documentation and Rules Update
- [ ] Update `CLAUDE.md` to mandate the use of `catcher` for manual error destructuring in Rust.
- [ ] Update `GEMINI.md` to reflect the new Rust error handling rules.
- [ ] Update `conductor/development-rules.md` to include Rust-specific `catcher` guidance.
