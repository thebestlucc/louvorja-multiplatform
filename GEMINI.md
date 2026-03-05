# Gemini Code Assist Instructions — LouvorJA Multiplatform

This file provides comprehensive repository-level guidance for Gemini Code Assist. It integrates architectural patterns, critical development rules, and the current project state.

> **Primary Reference:** For the full technical specification and patterns, see [`CLAUDE.md`](./CLAUDE.md) and [`PRD.md`](./PRD.md).

---

## 1. Project Overview

**LouvorJA Multiplatform** is a church worship management desktop application.
- **Stack:** Tauri 2.9.4 + React 19 + Rust (stable).
- **Goal:** Cross-platform (Windows, macOS, Linux) migration from legacy Delphi.
- **Key Features:** Hymnal search (FTS5), Presentation editor (.slja), Bible projection, Multi-monitor output (Operator/Projector/Return), Audio synchronization (rodio), SSE Live Streaming, Timer/Clock projections, Spotlight (Cmd+K).

---

## 2. Critical Development Rules

### Tooling & Commands
- **Package Manager:** **ALWAYS use `pnpm`**. Never use `npm` or `deno`.
- **Type-Check Order:** Always run `pnpm vite build` **before** `npx tsc --noEmit`. The Vite plugin generates `routeTree.gen.ts` which `tsc` requires for type safety.
- **Bindings:** The project uses `tauri-specta` to generate TypeScript bindings. Run `pnpm tauri dev` or `cargo check` in debug mode to update `src/lib/bindings.ts`.
- **No Deno:** Do not run `deno` commands in this repository.

### Rust Backend
- **Error Handling:** Every function must return `Result<T, AppError>`. `AppError` returns structured JSON.
- **Database:** Use the `r2d2` connection pool from `AppState`. Never open manual connections.
- **No Panics:** Never use `todo!()` or `unwrap()` in production code. Use `Err(AppError::Internal("...".into()))` for stubs.
- **Windows IPC Safety:** **CRITICAL:** `#[tauri::command]` handlers must **never block**. Any operation involving `sleep`, long loops, or window creation (which requires retries) **must** be spawned on a separate thread via `std::thread::spawn`. Blocking the IPC thread hangs the entire application on Windows.
- **Command Registration:** New commands must be: (1) added to `db/queries/*.rs`, (2) implemented in `commands/*.rs`, (3) registered in `lib.rs` (inside `tauri_specta::collect_commands!`), (4) wrapped in `lib/tauri.ts` (if manual wrapping is needed) or used directly via `bindings.ts`, (5) exposed via `lib/queries.ts` (TanStack Query hooks).
- **Serde:** Use `#[serde(rename_all = "camelCase")]` on all structs sent to the frontend.

### Frontend (React 19)
- **Error Handling:** **ALWAYS use `catcher`** (`src/lib/catcher.ts`) to wrap async or sync operations instead of using manual `try-catch` blocks.
  - Example: `const [data, error] = await catcher(promise, { notify: true });`
  - Use the `{ notify: true }` option to automatically show error toasts.
  - **Exceptions:** Auto-generated files (e.g., `bindings.ts`), Node.js scripts (e.g., `scripts/*.mjs`), and standalone SSE HTML templates (`src-tauri/src/streaming/templates/*.html`) are exempt as they cannot access the React `catcher` utility.
- **Types:** **ALWAYS** import domain types (Hymn, Slide, etc.) from `@/lib/bindings`. Do not define manual interfaces for backend-provided data.
- **Refs:** Use `useRef<T>(undefined)` — React 19 requires an explicit initial value.
- **Navigation:** Use TanStack Router `<Link to="...">`. Never use `<a href>` or `window.location`.
- **Conditional Hooks:** Never call hooks after an early `return`. Use the `{ enabled: false }` pattern for hooks (e.g., `useKeyboard({ enabled: !isBareRoute })`).
- **i18n:** Every new string must be added to **all three** locale files: `en.json`, `pt.json`, and `es.json`. Run `pnpm lint:i18n` to verify.
- **Zustand State:** Use `Store.getState()` inside async callbacks/timeouts to avoid stale closures. Stores are decoupled (e.g., `audio-store` is independent of `presentation-store`).

---

## 3. Architecture Patterns

### Frontend
- **Typed Bindings:** `src/lib/bindings.ts` is the source of truth for IPC commands and types.
- **Typed Wrappers:** `src/lib/tauri.ts` contains compatibility wrappers and complex multi-step IPC logic.
- **TanStack Query:** Use `useQuery` for reads and `useMutation` for writes. Invalidate relevant keys on success.
- **Styling:** Tailwind CSS v4. Use the CVA (class-variance-authority) pattern for reusable UI components.
- **Themes:** Managed via `data-theme` attribute on `<html>`. Use CSS variables (`var(--primary)`) for theme-aware colors.

### Backend
- **State Management:** `AppState` holds the `r2d2` database pool and projection state. `AudioState` handles playback.
- **Database:** SQLite via `rusqlite` (bundled). Migrations are versioned in `migrations.rs`. PRAGMAs (WAL mode, foreign keys) are enabled by default.
- **Projection:** The `open_fullscreen_window` helper in `display.rs` manages the projector/return monitors. It runs on a background thread to prevent UI freezing.
- **Streaming:** SSE server implemented with raw `TcpListener` for low-latency, unbuffered delivery.

---

## 4. Project Structure

- `src/`: React frontend.
  - `components/`: UI, Music, Bible, Slides, Services, Layout.
  - `lib/`: `bindings.ts` (Auto-generated), `tauri.ts` (IPC wrappers), `queries.ts` (TanStack Query hooks), `utils.ts` (cn helper).
  - `routes/`: TanStack Router file-based routes.
  - `stores/`: Zustand (ui, presentation, display, audio, bible, etc.).
- `src-tauri/src/`: Rust backend.
  - `commands/`: Domain-specific command modules (music, collections, bible, slides, etc.).
  - `db/`: Migrations, Models, Queries.
  - `audio/`: Rodio engine and sync logic.
  - `display/`: Monitor and window management.
  - `archive/`: `.slja` and `.pptx` handling.

---

## 5. Key Commands

| Action | Command |
|---|---|
| Install Dependencies | `pnpm install` |
| Full Dev Mode | `pnpm tauri dev` |
| Frontend Build | `pnpm vite build` |
| Type Check | `npx tsc --noEmit` |
| Unit Tests | `pnpm test:unit` |
| Rust Check | `cargo check --manifest-path src-tauri/Cargo.toml` |
| i18n Validation | `pnpm lint:i18n` |

---

## 6. Development Workflow

1.  **Research:** Check `PRD.md` and `PROGRESS.md` for feature context.
2.  **Implementation:** Follow the "New Tauri commands checklist" (Section 2).
3.  **i18n:** Ensure all 3 languages are updated.
4.  **Verification:** Run `pnpm test:unit`, `pnpm lint:i18n`, and ensure the build passes.
5.  **Windows Verification:** If modifying IPC/Windows, verify that no `invoke` calls remain "Pending" indefinitely.
