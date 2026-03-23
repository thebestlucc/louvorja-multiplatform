# Manifest-Driven CDN Sync — Implementation Plans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Two independent subsystems — implement separately:**
> - **Plan A** (below): Client-side changes to the main Tauri app
> - **Plan B** (below): New standalone `louvorja-admin` Tauri app

**Save this file to:** `docs/superpowers/plans/2026-03-19-manifest-cdn-sync.md`

---

# Plan A: Client App — Manifest + CDN Sync

**Goal:** Replace FTP-only media sync with a manifest-driven, CDN-first (Cloudflare R2) system that uses ZIP packs to minimize R2 read operations, falling back to FTP for missing content.

**Architecture:** App fetches a small `manifest.json` from R2 (~50KB compressed) to determine which ZIP packs are outdated. Outdated packs are downloaded and extracted. Individual hymns added after the last pack rebuild are downloaded file-by-file from CDN or FTP fallback. A new `content_sync_packs` DB table tracks which pack versions are already extracted.

**Tech Stack:** Rust (reqwest already in Cargo.toml, zip already in Cargo.toml), rusqlite, Tauri 2

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/src/db/migrations.rs` | Modify | Add `migrate_v16` for `content_sync_packs` table |
| `src-tauri/src/db/queries/content_sync.rs` | Modify | Add pack version queries (`get_pack_version`, `upsert_pack_version`) |
| `src-tauri/src/content_sync/manifest.rs` | **Create** | `ManifestPack`, `ManifestUpdate`, `ContentManifest` structs + `fetch_manifest()` |
| `src-tauri/src/content_sync/mod.rs` | Modify | Add `pub mod manifest;` |
| `src-tauri/src/http_sync/mod.rs` | **Create** | Module declaration |
| `src-tauri/src/http_sync/downloader.rs` | **Create** | `download_file_http()` + `download_and_extract_pack()` |
| `src-tauri/src/lib.rs` | Modify | Add `mod http_sync;` |
| `src-tauri/src/commands/content_sync.rs` | Modify | Manifest-first metadata path; 3-phase sync execution |

---

## Task 1: Add `content_sync_packs` DB Table

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/queries/content_sync.rs`

- [x] Step 1.1–1.7 complete

## Task 2: Manifest Structs and Fetch Function

**Files:**
- Create: `src-tauri/src/content_sync/manifest.rs`
- Modify: `src-tauri/src/content_sync/mod.rs`

- [x] Step 2.1–2.6 complete

## Task 3: HTTP Downloader and Pack Extractor

**Files:**
- Create: `src-tauri/src/http_sync/mod.rs`
- Create: `src-tauri/src/http_sync/downloader.rs`
- Modify: `src-tauri/src/lib.rs`

- [x] Step 3.1–3.8 complete

## Task 4: Update `commands/content_sync.rs` — Manifest-First Metadata Path

- [x] Step 4.1–4.5 complete

## Task 5: Update `commands/content_sync.rs` — Pack-First Sync Execution

- [x] Step 5.1–5.5 complete

## Task 6: Add `manifest_url` to `ApiParams`

- [x] Step 6.1–6.3 complete

