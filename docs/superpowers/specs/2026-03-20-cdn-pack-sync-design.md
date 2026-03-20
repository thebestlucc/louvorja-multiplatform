# CDN Pack Sync — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Feature area:** Content delivery / synchronization

---

## Overview

A two-component system for delivering media assets (audio, playback, cover images) to Tauri app installations via Cloudflare R2 / CDN, replacing or complementing the existing FTP-based sync.

The system consists of:
1. **Admin Panel** — a Next.js app (local or hosted) for creating, editing, and publishing media packs to Cloudflare R2
2. **Tauri App** — modifications to detect new packs on startup, show a plan dialog, and apply downloads on explicit user confirmation

The **manifest JSON** (hosted on R2/CDN) is the single shared contract between the two components.

---

## Architecture

```
admin-panel/          ← Next.js app (new, lives in this monorepo)
src-tauri/            ← existing Tauri app (modifications only)
.env                  ← gitignored, used locally by both components
```

### Environment Variables

**Admin Panel** (`.env` in `admin-panel/`):
```
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_BUCKET=louvorja-packs
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_CDN_BASE=https://pub-xxx.r2.dev
```

**Tauri App** (build-time, via `build.rs`):
```
CDN_MANIFEST_URL=https://pub-xxx.r2.dev/manifest.json
```

> **TODO:** In the future, `CDN_MANIFEST_URL` should be sourced from the remote API `params` response
> (same `fetch_params()` used by `legacy_fetch`) so it can be updated server-side without a new app release.

In GitHub Actions, all values are set as repository secrets. Locally, both components read from a gitignored `.env` file.

---

## Manifest Schema

A single JSON file hosted at `CDN_MANIFEST_URL`. Small (metadata only, no binary data). Re-generated and re-uploaded on every admin publish.

```json
{
  "manifestVersion": 42,
  "generatedAt": "2026-03-20T15:00:00Z",
  "packs": [
    {
      "id": "hymnal-pt-001",
      "url": "https://pub-xxx.r2.dev/packs/hymnal-pt-001-v3.zip",
      "version": 3,
      "size": 456000000,
      "sha256": "e3b0c44298fc1c149afb...",
      "files": [
        {
          "path": "media/audio/123/hino123.mp3",
          "hymnApiId": 123,
          "albumApiId": null,
          "type": "audio",
          "size": 5200000
        }
      ]
    }
  ]
}
```

### Field Definitions

| Field | Description |
|---|---|
| `manifestVersion` | Incrementing integer. Tauri stores this locally and skips all pack checks if unchanged since last run. |
| `generatedAt` | ISO 8601 timestamp. Informational. |
| `pack.id` | Stable string identifier. Never changes across versions (e.g. `hymnal-pt-001`). |
| `pack.url` | Versioned filename (e.g. `-v3.zip`). Each new version is a new R2 object. |
| `pack.version` | Incrementing integer. Compared against `content_sync_packs.local_version` in Tauri. |
| `pack.size` | Total ZIP size in bytes. Used for progress display. |
| `pack.sha256` | Required. Verified by Tauri after download, before extraction. |
| `file.path` | Relative path used as both the ZIP entry path and the local path under `app_data_dir`. Extraction places the file at the exact correct location automatically. |
| `file.hymnApiId` | API ID of the hymn this file belongs to. Used post-extraction to update the DB. Null for album files. |
| `file.albumApiId` | API ID of the album this file belongs to. Used post-extraction to update the DB. Null for hymn files. |
| `file.type` | One of: `audio`, `playback`, `cover`, `album_cover`. |
| `file.size` | File size in bytes. Used for integrity spot-checks. |

### Versioning and N-2 Cleanup

- Pack URLs embed the version: `hymnal-pt-001-v3.zip`, `hymnal-pt-001-v4.zip`
- On every publish, the admin panel checks if version `N-2` exists in the R2 bucket
- If it exists → delete it (keeps only `N` and `N-1`)
- If it does not exist → skip silently (handles fresh packs at version 1 or 2)

---

## Admin Panel

### Stack

- **Framework:** Next.js 14 (App Router), TypeScript
- **UI:** `shadcn/ui` (Radix-based, consistent with the Tauri app), Tailwind CSS
- **File upload:** `react-dropzone` for folder drag-and-drop
- **File tables:** `@tanstack/react-table`
- **Feedback:** `sonner` toasts
- **ZIP creation:** Node.js `archiver` library (`store` method — no compression)
- **R2 client:** AWS SDK v3 (`@aws-sdk/client-s3`) — R2 is S3-compatible

### Pages

| Route | Purpose |
|---|---|
| `/` | Pack list: all packs from current manifest, version, file count, size, last published date |
| `/packs/new` | Folder upload → auto-grouped plan → user review → publish |
| `/packs/[id]` | Pack editor: download + decompress existing pack, edit file listing, republish |

### New Pack Flow (`/packs/new`)

1. User drags a folder onto the drop zone (or uses folder picker via `webkitdirectory`)
2. Files stream to `POST /api/upload` using multipart upload — server uses `busboy` for streaming, writes to a temp directory, never loads all files into memory simultaneously
3. Server runs a **greedy bin-packing algorithm**: sorts files by size descending, fills packs up to 500MB, spills remainder into the next pack automatically
4. User reviews the generated plan — can rename packs, drag files between packs, remove files
5. User clicks **Publish**:
   - Server creates ZIP files (`STORED` mode, no compression) for each pack
   - Uploads each ZIP to R2 as `pack-id-vN.zip`
   - Conditionally deletes `pack-id-v(N-2).zip` if it exists
   - Regenerates manifest JSON and uploads to R2 at the fixed manifest key
   - Cleans up temp directory

### Pack Edit Flow (`/packs/[id]`)

1. User opens an existing pack page
2. Server downloads the current ZIP from R2 and extracts it to a temp directory
3. UI shows the extracted file listing
4. User adds files (same streaming upload), removes files, or replaces files
5. User clicks **Publish**:
   - Server re-creates ZIP from temp directory contents (new version `N`)
   - Uploads to R2, conditionally deletes `N-2`, regenerates and uploads manifest
   - Cleans up temp directory

### API Routes

| Route | Purpose |
|---|---|
| `GET /api/manifest` | Fetches current manifest from R2 |
| `POST /api/upload` | Streams files to temp directory |
| `POST /api/packs/build` | Analyzes uploaded files, returns pack grouping plan |
| `POST /api/packs/publish` | Creates ZIPs, uploads to R2, updates manifest |
| `GET /api/packs/[id]/download` | Downloads + extracts existing pack from R2 for editing |
| `DELETE /api/packs/[id]` | Removes pack from manifest, deletes all versions from R2 |

### Error Handling (Admin Panel)

- **Partial upload failure** → temp directory cleaned up regardless; toast with specific error
- **R2 upload failure mid-publish** → manifest not updated (old version remains valid); user can retry
- **N-2 deletion failure** → logged, ignored, not blocking
- **Pack exceeds 500MB** → files are uploaded to temp storage first (streaming), then rejected during the build/grouping phase before any R2 upload; UI shows which files caused overflow

---

## Tauri App Changes

### New Compile-Time Constant (`build.rs`)

```rust
// build.rs reads CDN_MANIFEST_URL from env and emits it as a Rust constant.
// If the env var is missing at build time, compilation fails with a clear error.
// TODO: migrate to fetch_params() API response field in the future
println!("cargo:rustc-env=CDN_MANIFEST_URL={}", std::env::var("CDN_MANIFEST_URL")
    .expect("CDN_MANIFEST_URL env var must be set at build time"));
```

In Rust code, accessed as: `const CDN_MANIFEST_URL: &str = env!("CDN_MANIFEST_URL");`

### Existing Schema Changes

- Replace current `ManifestPack`, `ManifestUpdate`, and `ContentManifest` structs in `src-tauri/src/content_sync/manifest.rs` with the new schema above. The existing `fetch_manifest()` function signature stays, but its return type changes to the new `ContentManifest`.
- The `content_sync_packs` table (added in `migrate_v33`) gains two new columns via `migrate_v34`:
  - `extracted_version INTEGER NOT NULL DEFAULT 0` — set after successful ZIP extraction, before DB update
  - `db_version INTEGER NOT NULL DEFAULT 0` — set after successful DB path update
  - The existing `local_version` column is **deprecated** in `migrate_v34` (retained in the table for backward compatibility, no longer written to or read by pack sync logic — all logic uses `extracted_version` and `db_version`)
- Add `manifest_version` storage to `settings` table via a new key `pack_sync.manifest_version` (no migration needed — uses existing settings key/value store)

### New Tauri Commands

| Command | Description |
|---|---|
| `plan_pack_sync` | Fetches manifest, compares against local state, returns `PackSyncPlan`. Stateless — safe to call multiple times. |
| `start_pack_sync` | Generates a new `run_id` internally (same as `start_content_sync`), re-fetches the manifest, builds a fresh plan, executes it. Returns the `run_id`. |
| `get_pack_sync_progress(run_id)` | Polls progress of an in-flight sync run |
| `cancel_pack_sync(run_id)` | Cancels an in-flight sync run |

`plan_pack_sync` and `start_pack_sync` are independent — the plan shown in the dialog is informational. `start_pack_sync` always re-fetches the manifest before executing, so there is no staleness risk if the user waits before confirming.

### Startup Flow

On every app startup (background thread, non-blocking):
1. Call `plan_pack_sync` → fetches manifest, compares `manifestVersion` to stored value in settings
2. If `manifestVersion` unchanged → exit early, no UI shown
3. If packs need downloading → emit event to frontend → show plan dialog

### Plan Dialog (Frontend)

Shown when `plan_pack_sync` returns items. Displays:
- List of packs with file counts and total download size
- Breakdown of which files are missing or changed per pack
- **Download & Apply** button → calls `start_pack_sync`
- **Later** button → dismisses, no action taken

### Execution Flow (after user confirms)

For each pack in the plan:
1. Download ZIP from `pack.url` to a temp file
2. Verify SHA-256 against `pack.sha256` — abort if mismatch, delete temp file
3. Extract ZIP to `app_data_dir` — file paths from ZIP entries map directly to correct local locations
4. Set `content_sync_packs.extracted_version = pack.version` (marks extraction complete; download will be skipped on retry even if DB update fails below)
5. Update DB: for each `file` in the pack manifest entries, using exact column names:

   | `file.type` | Entity | SQL |
   |---|---|---|
   | `audio` | `hymnApiId` | `UPDATE hymns SET audio_path = file.path WHERE api_music_id = hymnApiId` |
   | `playback` | `hymnApiId` | `UPDATE hymns SET playback_path = file.path WHERE api_music_id = hymnApiId` |
   | `cover` | `hymnApiId` | `UPDATE hymns SET cover_path = file.path WHERE api_music_id = hymnApiId` |
   | `album_cover` | `albumApiId` | `UPDATE collections SET cover_path = file.path WHERE api_album_id = albumApiId` |

6. Set `content_sync_packs.db_version = pack.version` (marks DB update complete)
7. After all packs complete → store new `manifestVersion` in settings
8. Emit `"pack-sync-progress"` events throughout for status bar feedback

### Error Handling (Tauri App)

| Scenario | Behavior |
|---|---|
| Manifest fetch failure — app has existing content | Silent skip. App starts normally. No dialog. |
| Manifest fetch failure — first install / empty DB (zero rows in `hymns`) | Show info dialog: *"Content could not be fetched. Go to Settings → Synchronization to retry."* |
| SHA-256 mismatch after download | Temp ZIP deleted. Pack skipped. Error surfaced in dialog. Manual retry available from Settings. |
| Extraction failure (disk full, permissions) | Extraction aborted. `content_sync_packs` version NOT updated. Temp files cleaned. Pack retried next run. |
| DB update failure after successful extraction | Logged. Files are on disk. `extracted_version` is already set, so re-sync sees `extracted_version >= pack.version` → skips download, retries only the DB update step. `db_version` is only set after DB update succeeds. |
| User cancels mid-run | In-flight download abandoned. Already-completed packs in the same run retain their updated versions. |

### Settings → Synchronization

A new section added to the existing settings page:
- **Pack Sync** status: last synced manifest version, last synced date
- **Check Now** button → manually triggers `plan_pack_sync`
- Progress indicator when a sync run is active (same status bar pattern as existing content sync)

---

## What Is NOT in This Spec

- FTP integration in the admin panel (future enhancement)
- SHA-256 verification at the file level within packs (pack-level SHA-256 is sufficient for now)
- Cloudflare Cache Purge API calls (versioned filenames make this unnecessary)
- Pack deletion from the Tauri app side (admin panel manages R2 cleanup)
