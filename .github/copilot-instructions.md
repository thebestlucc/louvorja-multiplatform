# GitHub Copilot Instructions

This file provides repository-level guidance to GitHub Copilot when working with this codebase.

> For the full project reference, see [`CLAUDE.md`](../CLAUDE.md) at the repo root.

## Project

Church worship desktop app: **Tauri 2 + React 19 + Rust**.

## Critical Rules

- **Package manager:** Always use `pnpm`. Never `npm` or `deno`.
- **Type-check order:** Run `pnpm vite build` before `npx tsc --noEmit` (Vite generates `routeTree.gen.ts`).
- **Rust errors:** Return `Result<T, AppError>`. Never use `todo!()` — use `Err(AppError::Internal("...".into()))`.
- **i18n:** Add keys to all three locale files: `en.json`, `pt.json`, `es.json`.
- **New Tauri commands:** (1) `db/queries/*.rs` → (2) `commands/*.rs` → (3) register in `lib.rs` → (4) `lib/tauri.ts` → (5) `lib/queries.ts`.
- **Windows IPC:** Never block `#[tauri::command]` handlers. Use `std::thread::spawn` for any long-running or sleeping operation.
- **React 19 refs:** `useRef<T>(undefined)` — always provide an initial value.
- **Navigation:** Use TanStack Router `<Link to="...">` — never `<a href>` or `window.location`.
- **Conditional hooks:** Never call hooks after an early return. Use `{ enabled: false }` pattern instead.

## Tech Stack Summary

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4 |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query |
| Client state | Zustand |
| UI | Radix UI, CVA, cmdk, sonner |
| Backend | Tauri 2.9.4, Rust, rusqlite |
| Audio | rodio 0.19 |

## Key Files

- `src/lib/tauri.ts` — typed `invoke()` wrappers (one per command)
- `src/lib/queries.ts` — TanStack Query hooks
- `src-tauri/src/lib.rs` — command registration
- `src-tauri/src/db/migrations.rs` — schema versioning
- `src-tauri/src/error.rs` — `AppError` enum
