# Project Rules

> Ring Standards apply automatically. This file documents only what Ring does not cover.
> For error handling, logging, testing, architecture, lib-commons → See Ring Standards (auto-loaded by agents)
> Generated from legacy project analysis.

## What Ring Standards Already Cover (DO not ADD HERE)

The following are defined in Ring Standards and MUST not be duplicated:
- Error handling patterns (no panic, wrap errors)
- Logging standards (structured JSON, zerolog/zap)
- Testing patterns (table-driven tests, mocks)
- Architecture patterns (Hexagonal, Clean Architecture)
- Observability (OpenTelemetry, trace correlation)
- lib-commons usage and patterns
- API directory structure

---

## Tech Stack (Not in Ring Standards)

| Technology | Purpose | Notes |
|------------|---------|-------|
| Tauri 2.9.4 | Desktop framework | Rust backend + React frontend |
| React 19 | Frontend library | Latest React features (use, ref initial value) |
| Rust (stable) | Backend language | IPC safety, no panics, Result<T, AppError> |
| rusqlite | Database | SQLite for local persistence |
| rodio | Audio playback | Sync and async playback support |
| TanStack Router | Navigation | File-based routing |
| TanStack Query | Data fetching | useQuery, useMutation patterns |
| Zustand | State management | Centralized client state |
| Tailwind CSS v4 | Styling | Utility-first CSS |

## Non-Standard Directory Structure

| Directory | Purpose | Pattern |
|-----------|---------|---------|
| src-tauri/src/commands/ | Tauri IPC handlers | Register in lib.rs |
| src/lib/tauri.ts | IPC wrappers | Typed async functions |
| src/locales/ | i18n files | en.json, pt.json, es.json |

## External Integrations

| Service | Purpose | Docs |
|---------|---------|------|
| SQLite | Local data | Bundled with Tauri |
| SSE | Live streaming | TcpListener implementation |

## Domain Terminology

| Term | Definition | Used In |
|------|------------|---------|
| Hymn | Song with lyrics and metadata | Hymnal, Projection |
| Slide | Visual presentation unit | Presentation, Slides |
| Playing now | Control interface | Playing now screen |
| Projector | Presentation window | Projector Screen |

---

*Generated: 2026-03-05*
*Source: Legacy project analysis*
