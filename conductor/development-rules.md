# Development Rules

## Tooling & Commands
- **Package Manager:** **ALWAYS use `pnpm`**. Never use `npm` or `deno`.
- **Type-Check Order:** Always run `pnpm vite build` **before** `npx tsc --noEmit`. The Vite plugin generates `routeTree.gen.ts` which `tsc` requires.
- **Bindings:** The project uses `tauri-specta` to generate TypeScript bindings. Run `pnpm tauri dev` to update `src/lib/bindings.ts`.

## Rust Backend
- **Error Handling:** Every function must return `Result<T, AppError>`. Never use `todo!()` or `unwrap()`; use `Err(AppError::Internal(...))` for stubs.
- **Manual Error Destructuring:** Use the `catcher` utilities (`src-tauri/src/utils/catcher.rs`) when manually destructuring a `Result` into `(data, error)` or handling errors in threads/closures where `?` cannot be used.
- **Windows IPC Safety:** **CRITICAL:** `#[tauri::command]` handlers must **never block**. Long-running operations (sleep, window creation) **must** be spawned via `std::thread::spawn`.
- **Serde:** Use `#[serde(rename_all = "camelCase")]` on all structs sent to the frontend.
- **Audio Init:** Initialize audio in a background thread with a timeout to prevent Tauri's `setup()` from hanging.

## Frontend (React 19)
- **Error Handling:** **ALWAYS use `catcher`** (`src/lib/catcher.ts`) instead of manual `try-catch`. Use `{ notify: true }` for auto-toasts.
- **Types:** **ALWAYS** import domain types from `@/lib/bindings`.
- **Refs:** Use `useRef<T>(undefined)` (React 19 requirement).
- **Navigation:** Use TanStack Router `<Link to="...">`. Never use `<a href>` or `window.location`.
- **Zustand State:** Use `Store.getState()` inside async callbacks to avoid stale closures.
- **IME Composition:** Use local state with a `dirtyRef` to prevent server sync from breaking dead key sequences (ç, ñ, accents).

## Common Errors to Avoid
- **quick-xml:** Bind `e.name()` to a variable before calling `.as_ref()` to avoid temporary lifetime issues.
- **rodio:** Import `use rodio::Source;` to access `.total_duration()`.
- **Clipboard:** Use `src/lib/clipboard.ts` `copyToClipboard()` instead of `navigator.clipboard`.
- **Shortcuts:** Use `Alt+` modifier for global shortcuts to avoid interference with typing.
- **Stale Closures:** Always use `.getState()` for fresh reads in async logic within stores.