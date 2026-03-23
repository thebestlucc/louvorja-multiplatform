# Online Videos Feature — Design Spec

**Date:** 2026-03-23
**Status:** Approved

## Overview

Add YouTube video integration to the LouvorJA worship app. Users add YouTube playlists (via channel or playlist URL) to a new "Vídeos Online" tab inside the Collections route. Videos project via iframe (online) or local playback (offline via yt-dlp). Includes a sidebar refactor to support collapsible sub-items.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| How users add videos | Paste YouTube URL (channel or playlist) | Simple, no browsing complexity |
| Metadata API | YouTube Data API v3 | Stable, official, well-documented |
| API key management | Per-user key in Settings | Each church stays on free tier (10k units/day) |
| Online playback | YouTube iframe embed | Zero bandwidth pre-loading, legal, handles DRM |
| Offline playback | yt-dlp download → local VideoPlayer | Full control, no ads, offline-ready |
| yt-dlp delivery | Auto-download binary on first use | Lean installer, auto-managed updates |
| UI location | New tab in Collections route | Alongside existing Coletâneas |
| Sidebar changes | Collapsible sub-items for Collections | Extensible for Settings/Utilities later |
| Individual videos | Paste URL in presentation editor / service modal | No playlist required for one-offs |

## 1. Sidebar Refactor — Collapsible Sub-items

### Data Model

```ts
type NavItem = {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  children?: { to: string; icon: LucideIcon; labelKey: string }[];
};
```

### Behavior

- Items **without** `children` — navigate on click (unchanged)
- Items **with** `children`:
  - Clicking **label/icon area** → navigates to the parent's root route
  - Clicking **chevron icon** (right side) → toggles expand/collapse of children list
  - Children render indented below with smaller icons, each navigating to its sub-route
- Active child highlights both itself and the parent
- Navigating to any child route auto-expands the parent
- Collapsed state stored in `useUIStore`
- **Collapsed sidebar hover:** When sidebar is in icon-only mode, hovering a parent with children shows a floating popover sub-menu. Uses Radix `Popover` with manually controlled `open` prop: `onMouseEnter` with ~150ms delay to open, `onMouseLeave` to close (prevents flicker). Disappears on mouse leave.

### Collections Sub-items

| Label | Route | Description |
|-------|-------|-------------|
| Coletâneas | `/collections` | Existing collections (default) |
| Vídeos Online | `/collections/online-videos` | New online videos tab |

Only Collections uses sub-items now; extensible for Settings/Utilities later.

## 2. YouTube Integration Backend

### Settings

- New "YouTube API Key" field in Settings page
- Stored via `plugin-store` (`setPreference("youtube_api_key", key)`)
- Validation on save: Rust command calls YouTube API `channels.list` with a test query to verify key works
- Download quality selector (720p/1080p/best) stored via `plugin-store`

### Rust Module: `src-tauri/src/youtube/`

| File | Responsibility |
|------|---------------|
| `api.rs` | `reqwest` client wrapping YouTube Data API v3 endpoints |
| `parser.rs` | URL parsing (channel/handle/playlist URL formats) |
| `thumbnails.rs` | Downloads thumbnail images to `media/covers/youtube/` |

**API functions:**
- `fetch_channel(channel_url)` — parse channel ID from URL, call `channels.list` + `playlists.list`
- `fetch_playlist(playlist_url)` — parse playlist ID, call `playlists.list` + `playlistItems.list`
- `fetch_playlist_videos(playlist_id)` — paginated `playlistItems.list`

**URL formats supported:**
- `youtube.com/channel/UC...`
- `youtube.com/@handle`
- `youtube.com/playlist?list=PL...`
- `youtube.com/watch?v=...` (individual video — redirected to direct-use flow)

### Commands: `src-tauri/src/commands/youtube.rs`

| Command | Description |
|---------|-------------|
| `validate_youtube_api_key(key)` | Test call, returns ok/error |
| `fetch_youtube_channel(url)` | Returns channel info + list of playlists |
| `add_youtube_playlist(input: AddPlaylistInput)` | Saves to DB, downloads cover. `AddPlaylistInput { playlist_id: String, channel_id: String, channel_title: String, playlist_title: String, thumbnail_url: String }` |
| `get_youtube_playlists()` | Lists saved playlists from DB |
| `refresh_youtube_playlist(playlist_id)` | Re-fetches videos from API |
| `get_youtube_playlist_videos(playlist_id)` | Returns videos from DB |
| `delete_youtube_playlist(playlist_id)` | Removes playlist + videos from DB, deletes local files in `media/videos/youtube/` for any videos with `local_path` set |

### Database

The tables documented in `DATABASE_SCHEMA.md` (`online_videos_channels`, `online_videos_playlists`, `online_videos`) are **not yet created** in any migration. A new migration (`migrate_vN`) must:

1. `CREATE TABLE IF NOT EXISTS online_videos_channels` — channel metadata, status, cached images
2. `CREATE TABLE IF NOT EXISTS online_videos_playlists` — playlist metadata, status, cached cover path
3. `CREATE TABLE IF NOT EXISTS online_videos` — individual video records with thumbnails, status, and `local_path TEXT` column for offline downloads

**Language FK:** The existing schema has `id_language VARCHAR NOT NULL` with FK to `languages`. The `languages` table is only created by the Delphi legacy import (migrate_v13) and does **not exist on fresh installs**. The new migration must unconditionally:
1. `CREATE TABLE IF NOT EXISTS languages (id_language VARCHAR PRIMARY KEY NOT NULL, language VARCHAR, created_at DATETIME, updated_at DATETIME)`
2. Seed with `INSERT OR IGNORE INTO languages VALUES ('pt', 'Português', ...)`, `('en', 'English', ...)`, `('es', 'Español', ...)`, `('und', 'Undetermined', ...)`
3. Then create the `online_videos_*` tables with their FK constraints

Use `"und"` (BCP 47 "undetermined") as the default `id_language` for all YouTube content since it's language-agnostic from the church's perspective.

**Schema sync:** Update `DATABASE_SCHEMA.md` to include the `local_path TEXT` column in the `online_videos` table definition, keeping the documented schema in sync with the actual migration.

### Input/Output Types

All command parameters use named Rust structs with `#[derive(Serialize, Deserialize, specta::Type)]`:

```rust
pub struct AddPlaylistInput {
    pub playlist_id: String,
    pub channel_id: String,
    pub channel_title: String,
    pub playlist_title: String,
    pub thumbnail_url: String,
}

pub struct YoutubeChannelResult {
    pub channel_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub playlists: Vec<YoutubePlaylistInfo>,
}

pub struct YoutubePlaylistInfo {
    pub playlist_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub video_count: u32,
}
```

## 3. yt-dlp Offline Download (Full Implementation)

### Binary Management: `src-tauri/src/ytdlp/`

| File | Responsibility |
|------|---------------|
| `binary.rs` | Download/update yt-dlp binary from GitHub releases to `app_data_dir/bin/yt-dlp` |
| `downloader.rs` | Spawn yt-dlp subprocess, parse progress, emit events |

**Binary lifecycle:**
- On first download attempt → auto-downloads platform-specific binary (`.exe` on Windows) from `https://github.com/yt-dlp/yt-dlp/releases/latest`
- **SHA256 verification:** Download the `SHA2-256SUMS` file from the same release, verify binary hash matches before marking as ready. `verify_binary_hash(path, expected_hash)` in `binary.rs`.
- Update check triggered on Settings page visit (lazy, non-blocking) or manual via "Update yt-dlp" button. Not on app startup (avoids blocking IPC bridge per Windows audio init pattern).
- Stored at `app_data_dir/bin/yt-dlp`

### Commands

| Command | Description |
|---------|-------------|
| `ensure_ytdlp()` | Downloads binary if missing, returns path |
| `update_ytdlp()` | Forces re-download of latest binary |
| `download_online_video(video_id, playlist_id)` | Spawns download, emits progress events |
| `cancel_download(run_id)` | Sets cancel flag for active download |

### Cancellable Async Pattern

Reuses the pattern from pack sync:
- `active_run_id: Option<String>` + `cancel_flags: HashMap<String, Arc<AtomicBool>>` in `Mutex<YtdlpRuntimeState>` on `AppState`
- Executor checks flag between chunks
- Progress events: `"ytdlp-progress"` with `{ runId, videoId, percent, status }`
- Frontend ignores stale events by matching `runId`

### Storage

- Downloads to `media/videos/youtube/{video_id}.mp4`
- Updates `online_videos.local_path` column
- Once downloaded → projector uses existing `VideoPlayer` instead of iframe

### Video State UI

| State | UI | Projection |
|-------|-----|------------|
| No local file | "Download" button | YouTube iframe |
| Downloading | Progress bar + cancel | YouTube iframe |
| Downloaded | "Downloaded" badge + "Delete local" | Local VideoPlayer |

## 4. Frontend — Collections Route & Online Videos Tab

### Route Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/collections` | Existing | Coletâneas tab (default) |
| `/collections/online-videos` | New | Online videos grid |
| `/collections/online-videos/$playlistId` | New | Playlist detail with video list |

Collections `route.tsx` gets a conditional tab bar (shown only on `/collections` and `/collections/online-videos` paths, **not** on `/$collectionId` detail pages). The static `online-videos` route takes priority over the `$collectionId` dynamic segment in TanStack Router — no conflict.

**Route build step:** After adding `online-videos/` routes, run `pnpm vite build` before `npx tsc --noEmit` to regenerate `routeTree.gen.ts`.

### Online Videos Tab (`/collections/online-videos`)

**No API key state:** Setup prompt with link to Settings + brief instructions on getting a YouTube API key.

**With API key:** Grid of saved playlists showing:
- Cover image (locally cached)
- Playlist title
- Channel name
- Video count

**"Add Playlist" button** opens a modal:
- URL input field with inline validation
- **Channel URL flow:** Fetches channel → shows playlist picker (checkboxes) → user selects which to add → downloads covers
- **Playlist URL flow:** Fetches playlist info + channel reference → adds directly → downloads cover

### Playlist Detail (`/collections/online-videos/$playlistId`)

- Header: cover, title, channel name, video count, "Refresh" button
- Grid/list of videos: thumbnail, title, duration
- Per-video actions: "Project", "Add to Presentation", "Add to Service", "Download for offline"

### Projector Rendering

New `online_video` slide type in `SlideContent` flat struct. Add `Option<String>` fields to the existing struct:
- `video_url` — full YouTube URL
- `video_id` — YouTube video ID
- `video_source` — "youtube" (extensible for other sources)
- `video_title` — display title

These fields flow through the entire pipeline:
- `flatToSlideContent` / `slideContentToFlat` converter functions must be updated
- Streaming SSE HTML templates must handle `null`/empty values for these fields (per "Streaming clear pattern")
- Return monitor component must render video title + thumbnail (lightweight, no iframe)

**Tauri CSP:** Update `tauri.conf.json` CSP to include `frame-src https://www.youtube.com https://www.youtube-nocookie.com` (use `youtube-nocookie.com` embeds for privacy/GDPR compliance in a church context).

**Rendering:**
- Online: renders `<iframe src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&controls=0" />`
- Offline (downloaded): renders existing `VideoPlayer` with local file
- Return monitor: shows video title + thumbnail (no iframe)

### Presentation/Service Integration

- Slide editor "Add Slide" gets "Online Video" option (paste URL or pick from saved playlists)
- Service "Add Item" modal gets "Online Video" type
- Both produce `online_video` slide type

## 5. Error Handling

### YouTube API Errors

| Error | User-facing message |
|-------|-------------------|
| Invalid/expired API key | Pastoral toast + link to Settings |
| Quota exceeded (10k/day) | "Daily limit reached, try again tomorrow" |
| Network failure | "No internet connection" + retry button |
| Video unavailable/private | Grayed out in list with reason, `status: 'error'` in DB |

### yt-dlp Errors

| Error | Handling |
|-------|---------|
| Binary download fails | Retry 3x with exponential backoff, then error toast |
| Video download fails (geo-blocked, removed, age-restricted) | Toast with reason from stderr, mark status as error |
| Disk full | Detect from exit code, "Not enough disk space" message |
| Process killed/cancelled | Clean up partial file from `media/videos/youtube/` |

### URL Parsing

| Case | Behavior |
|------|----------|
| Invalid URL | Inline validation error under input |
| Single video URL (not channel/playlist) | Message with CTA: "This is a single video." + action button "Add to Service" (if `activeServiceId` set, per cross-module pattern) or "Go to Presentations" link |
| Channel with no public playlists | "This channel has no public playlists" |

### Offline Scenarios

| Scenario | Behavior |
|----------|----------|
| No internet when projecting iframe | "No internet" overlay with video title on projector |
| No internet when browsing | Show cached DB data + "Offline — showing saved data" banner |

## 6. Implementation Strategy

Use **sub-agents** for each implementation chunk to avoid context loss:

1. **Sidebar refactor** — collapsible sub-items with hover popover
2. **YouTube Rust backend** — module, API client, URL parser, thumbnails, commands
3. **Database migration** — `local_path` column + ensure existing tables exist
4. **yt-dlp module** — binary management, download commands, cancellation
5. **Frontend: Online Videos tab** — route, playlist grid, add modal, playlist detail
6. **Frontend: Projector integration** — `online_video` slide type, iframe/local rendering
7. **Frontend: Presentation/Service integration** — add online video to slides/services
8. **Settings UI** — API key field, download quality, yt-dlp update button
9. **i18n** — all 3 locale files
10. **UI polish** — use `ui-ux-pro-max` skill to avoid generic screens

## 7. New Dependencies

### Rust (Cargo.toml)

- `reqwest` — already present (`0.12` with `json`, `rustls-tls`, `gzip` features). No change needed.

### Frontend

- None — uses existing Radix primitives, existing `<iframe>` for embeds

## 8. Files Created/Modified Summary

### New Files

| File | Purpose |
|------|---------|
| `src-tauri/src/youtube/mod.rs` | Module declaration |
| `src-tauri/src/youtube/api.rs` | YouTube Data API v3 client |
| `src-tauri/src/youtube/parser.rs` | URL parsing |
| `src-tauri/src/youtube/thumbnails.rs` | Thumbnail download |
| `src-tauri/src/ytdlp/mod.rs` | Module declaration |
| `src-tauri/src/ytdlp/binary.rs` | Binary management |
| `src-tauri/src/ytdlp/downloader.rs` | Video download + progress |
| `src-tauri/src/commands/youtube.rs` | Tauri command handlers |
| `src/routes/collections/online-videos/index.tsx` | Playlist grid |
| `src/routes/collections/online-videos/route.tsx` | Layout |
| `src/routes/collections/online-videos/$playlistId.tsx` | Playlist detail |
| `src/components/online-videos/` | Playlist card, video card, add modal, URL input, playlist picker |

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/sidebar.tsx` | Collapsible sub-items + hover popover |
| `src/stores/ui-store.ts` | Sidebar expand/collapse state |
| `src-tauri/src/db/models.rs` | Online video Rust structs + `SlideContent` new `Option<String>` fields |
| `src-tauri/src/db/migrations.rs` | New migration: CREATE all 3 `online_videos_*` tables + `local_path` column |
| `src-tauri/src/db/queries/` | New `online_videos.rs` query module |
| `src-tauri/src/lib.rs` | Register new commands + extend `app.manage(AppState { ... })` literal with `ytdlp: Mutex::new(YtdlpRuntimeState::default())` (follows `pack_sync` pattern) |
| `src-tauri/src/state.rs` | Add `YtdlpRuntimeState` struct + add `pub ytdlp: Mutex<YtdlpRuntimeState>` field to `AppState` |
| `src/lib/tauri.ts` | YouTube command wrappers |
| `src/lib/queries.ts` | TanStack Query hooks for online videos |
| `src/components/slides/slide-renderer.tsx` | Handle `online_video` type |
| `src/components/slides/projector-view.tsx` | Render iframe or local video |
| `src/components/slides/video-slide.tsx` | Support online video source (iframe vs local) |
| `src/types/` or converters | Update `flatToSlideContent` / `slideContentToFlat` for new fields |
| `src-tauri/src/streaming/mod.rs` | SSE HTML templates handle `null` for new online video fields |
| Return monitor component | Render video title + thumbnail for `online_video` slides |
| `src-tauri/tauri.conf.json` | Add `frame-src https://www.youtube.com https://www.youtube-nocookie.com` to CSP |
| `src/routes/collections/route.tsx` | Conditional tab bar for sub-routes |
| `src/routes/settings/index.tsx` | API key + yt-dlp settings |
| `src/locales/*.json` | All 3 locale files |
