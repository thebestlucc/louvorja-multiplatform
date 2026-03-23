# Online Videos Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **CRITICAL: Each task MUST be executed by a dedicated sub-agent** to avoid context loss during conversation compression. The orchestrator dispatches one sub-agent per task, reviews output, then dispatches the next.

**Goal:** Add YouTube playlist integration with offline download support, a new "Online Videos" tab in Collections, and a sidebar refactor with collapsible sub-items.

**Architecture:** YouTube Data API v3 (per-user API key) fetches channel/playlist metadata via Rust `reqwest`. Videos project via YouTube iframe (online) or local `VideoPlayer` (offline via auto-downloaded `yt-dlp`). Sidebar gains collapsible children for Collections, extensible later.

**Tech Stack:** Tauri 2.9.4, Rust (reqwest, rusqlite, r2d2), React 19, TypeScript 5.8, TanStack Router/Query, Zustand, Radix UI, Tailwind CSS v4, i18next

**Design Spec:** `docs/superpowers/specs/2026-03-23-online-videos-design.md`

---

## Project Rules — MUST BE FOLLOWED BY ALL SUB-AGENTS

Every sub-agent MUST read and follow these rules. Violations cause build failures or runtime crashes.

### Rust Rules
1. **Error handling:** All functions return `Result<T, AppError>`. Use `Err(AppError::Internal("...".into()))` for stubs — NEVER `todo!()` (panics crash the app).
2. **Commands:** Each `#[tauri::command]` takes `state: tauri::State<'_, AppState>`, gets a connection via `state.db.get()?`, delegates to `db::queries::*`.
3. **Command registration:** Every new command MUST be added to `tauri_specta::collect_commands!` in `src-tauri/src/lib.rs:53-227`. This auto-generates `src/lib/bindings.ts`.
4. **Serde:** Use `#[serde(rename_all = "camelCase")]` on all structs returned to frontend.
5. **Specta types:** All command parameter/return structs need `#[derive(Serialize, Deserialize, specta::Type)]`.
6. **Module registration:** New modules must be added to `src-tauri/src/commands/mod.rs` and `src-tauri/src/db/queries/mod.rs`.
7. **Imports:** `use tauri::Manager;` for `app.path()`. `use tauri::Emitter;` for `app.emit()`.
8. **Background threads:** Long-running operations (network, downloads) MUST spawn on `std::thread::spawn` — never block IPC handlers.
9. **Async reqwest:** The project uses async `reqwest::Client` (NOT `reqwest::blocking`). The `blocking` feature is NOT in `Cargo.toml`. All HTTP calls must be async. Use `#[tauri::command(async)]` for commands that do network I/O, or spawn on a background thread with `std::thread::spawn` + a `tokio::runtime::Handle` or blocking client inside the thread.
10. **Search by content, not line numbers:** Line numbers in this plan are approximate and may drift. Always search for the target struct/function by name (e.g., `pub struct SlideContent`, `app.manage(AppState {`) rather than relying on line numbers.
11. **Completion events for background commands:** When a command spawns a background thread and returns `()` immediately, it MUST emit a Tauri event on completion (e.g., `"youtube-playlist-added"`, `"youtube-playlist-refreshed"`) so the frontend can invalidate queries at the right time.
12. **`?` operator for From-compatible errors:** When `AppError` implements `From<E>` (e.g., `std::io::Error`), use `?` directly instead of `.map_err()`. E.g., `fs::create_dir_all(&dir)?;` not `.map_err(AppError::Io)?`.

### Frontend Rules
1. **Package manager:** ALWAYS use `pnpm` — NEVER `npm` or `deno`.
2. **Types:** Import domain types from `@/lib/bindings` (auto-generated) — never define manual interfaces for backend data.
3. **Error handling:** Use `catcher.ts`: `const [data, err] = await catcher(promise, { notify: true })`. Do NOT use manual try-catch.
4. **React 19 useRef:** Requires explicit initial value: `useRef<T>(undefined)` not `useRef<T>()`.
5. **Route generation:** After adding/renaming route files, run `pnpm vite build` before `npx tsc --noEmit`.
6. **i18n:** Add keys to ALL THREE locale files (`en.json`, `pt.json`, `es.json`). Missing keys render as raw key strings.
7. **Components:** Use existing Radix UI primitives from `src/components/ui/`. Use CVA pattern for variants.
8. **Styling:** Tailwind v4 with CSS custom properties for themes. Use `cn()` from `src/lib/utils.ts`.
9. **Stale closures:** In Zustand + setTimeout/useCallback, use `Store.getState()` for fresh reads.
10. **UI design:** Use `ui-ux-pro-max` skill for UI components — avoid generic/AI-looking screens.

### Build & Verify Commands
```bash
cargo build --manifest-path src-tauri/Cargo.toml  # Rust build
pnpm vite build                                     # Frontend build (regenerates routeTree.gen.ts)
npx tsc --noEmit                                    # TypeScript check
pnpm tauri dev                                      # Full dev mode (regenerates bindings.ts)
```

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src-tauri/src/youtube/mod.rs` | Module declaration for youtube submodules |
| `src-tauri/src/youtube/api.rs` | YouTube Data API v3 client (reqwest) |
| `src-tauri/src/youtube/parser.rs` | URL parsing (channel/handle/playlist formats) |
| `src-tauri/src/youtube/thumbnails.rs` | Thumbnail download to `media/covers/youtube/` |
| `src-tauri/src/ytdlp/mod.rs` | Module declaration for ytdlp submodules |
| `src-tauri/src/ytdlp/binary.rs` | yt-dlp binary auto-download + SHA256 verification |
| `src-tauri/src/ytdlp/downloader.rs` | Video download subprocess + progress events |
| `src-tauri/src/commands/youtube.rs` | Tauri command handlers for YouTube + yt-dlp |
| `src-tauri/src/db/queries/online_videos.rs` | DB query functions for online_videos_* tables |
| `src/routes/collections/online-videos/route.tsx` | Online videos layout (nested under collections) |
| `src/routes/collections/online-videos/index.tsx` | Playlist grid page |
| `src/routes/collections/online-videos/$playlistId.tsx` | Playlist detail with video list |
| `src/components/online-videos/playlist-card.tsx` | Playlist card for grid view |
| `src/components/online-videos/video-card.tsx` | Video card for list/grid view |
| `src/components/online-videos/add-playlist-modal.tsx` | Modal: paste URL → fetch → pick playlists |
| `src/components/online-videos/playlist-picker.tsx` | Checkbox list to pick channel playlists |
| `src/components/online-videos/api-key-setup.tsx` | Setup prompt when no API key configured |
| `src/components/online-videos/online-video-slide.tsx` | iframe/local video renderer for projector |
| `src/hooks/use-youtube-events.ts` | Tauri event listener for query invalidation |

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/sidebar.tsx` | Collapsible sub-items + hover popover |
| `src/stores/ui-store.ts` | Add `expandedNavItems` state |
| `src-tauri/src/db/models.rs:189-205` | Add online video fields to `SlideContent` + new structs |
| `src-tauri/src/db/migrations.rs` | New `migrate_v36`: create tables + add `local_path` |
| `src-tauri/src/db/queries/mod.rs` | Add `pub mod online_videos;` |
| `src-tauri/src/commands/mod.rs` | Add `pub mod youtube;` |
| `src-tauri/src/state.rs:197-216` | Add `pub ytdlp: Mutex<YtdlpRuntimeState>` to `AppState` |
| `src-tauri/src/lib.rs:53-227` | Register youtube commands in `collect_commands!` |
| `src-tauri/src/lib.rs:298-315` | Add `ytdlp` field to `AppState` init |
| `src-tauri/src/lib.rs` (top) | Add `mod youtube; mod ytdlp;` |
| `src-tauri/Cargo.toml` | Add `"blocking"` feature to reqwest |
| `src-tauri/tauri.conf.json:16` | Add YouTube domains to CSP |
| `src/routes/collections/route.tsx` | Add conditional tab bar |
| `src/components/slides/slide-renderer.tsx` | Handle `online_video` slide type |
| `src/components/slides/video-slide.tsx` | Support iframe rendering for online videos |
| `src/lib/tauri.ts` | Add YouTube command wrappers |
| `src/lib/queries.ts` | Add TanStack Query hooks for online videos |
| `src/routes/settings/index.tsx` | Add YouTube API key + yt-dlp settings tab |
| `src/locales/en.json`, `pt.json`, `es.json` | All new i18n keys |
| `docs/DATABASE_SCHEMA.md` | Add `local_path` column to `online_videos` table |

---

## Task 1: Database Migration — Create online_videos tables

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src-tauri/src/db/migrations.rs` (add `migrate_v36` after last migration)
- Modify: `docs/DATABASE_SCHEMA.md` (add `local_path TEXT` to `online_videos` table definition)

**Reference:** Read `docs/DATABASE_SCHEMA.md:420-525` for table schemas. Read `src-tauri/src/db/migrations.rs` to find the latest migration version number and follow the pattern.

- [ ] **Step 1: Read current migration file** — search for `current_version <` to find the last migration version number. As of plan creation it was v35, but verify before proceeding. The next version number is last + 1. The pattern is: `if current_version < N { migrate_vN(conn)?; conn.execute("INSERT INTO schema_version ...", [])?; }`

- [ ] **Step 2: Add `migrate_v36` function** to `src-tauri/src/db/migrations.rs`:

```rust
fn migrate_v36(conn: &Connection) -> Result<(), AppError> {
    // 1. Create languages table (may not exist on fresh installs)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS languages (
            id_language VARCHAR PRIMARY KEY NOT NULL,
            language VARCHAR,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('pt', 'Português');
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('en', 'English');
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('es', 'Español');
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('und', 'Undetermined');"
    )?;

    // 2. Create online_videos_channels
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS online_videos_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_language VARCHAR NOT NULL DEFAULT 'und',
            channel_id VARCHAR NOT NULL UNIQUE,
            title VARCHAR,
            description TEXT,
            images TEXT,
            status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
            playlists TEXT,
            error TEXT,
            base64 TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_language) REFERENCES languages(id_language)
        );"
    )?;

    // 3. Create online_videos_playlists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS online_videos_playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_language VARCHAR NOT NULL DEFAULT 'und',
            id_channel INTEGER,
            playlist_id VARCHAR NOT NULL UNIQUE,
            title VARCHAR,
            description TEXT,
            images TEXT,
            status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
            error TEXT,
            base64 TEXT,
            cover_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_language) REFERENCES languages(id_language),
            FOREIGN KEY (id_channel) REFERENCES online_videos_channels(id) ON DELETE CASCADE
        );"
    )?;

    // 4. Create online_videos
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS online_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_language VARCHAR NOT NULL DEFAULT 'und',
            id_playlist INTEGER NOT NULL,
            video_id VARCHAR NOT NULL,
            sequence INTEGER DEFAULT 0,
            title VARCHAR,
            description TEXT,
            images TEXT,
            status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
            error TEXT,
            local_path TEXT,
            duration_seconds INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id_playlist, video_id),
            FOREIGN KEY (id_language) REFERENCES languages(id_language),
            FOREIGN KEY (id_playlist) REFERENCES online_videos_playlists(id) ON DELETE CASCADE
        );"
    )?;

    Ok(())
}
```

- [ ] **Step 3: Wire migration into the version check chain.** Find the last `if current_version < N` block and add:

```rust
if current_version < 36 {
    migrate_v36(conn)?;
    conn.execute("INSERT INTO schema_version (version) VALUES (36)", [])?;
}
```

- [ ] **Step 4: Update `DATABASE_SCHEMA.md`** — add `local_path TEXT` and `duration_seconds INTEGER` columns to the `online_videos` table definition.

- [ ] **Step 5: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 6: Commit**
```bash
git add src-tauri/src/db/migrations.rs docs/DATABASE_SCHEMA.md
git commit -m "feat(db): add migrate_v36 — create online_videos tables with languages seed"
```

---

## Task 2: Rust Models & State — Online video types + YtdlpRuntimeState

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src-tauri/src/db/models.rs:189-205` (add fields to `SlideContent`, add new structs)
- Modify: `src-tauri/src/state.rs:197-216` (add `YtdlpRuntimeState` struct + field on `AppState`)

**Reference:** Follow `PackSyncRuntimeState` pattern at `src-tauri/src/state.rs:188-195`.

- [ ] **Step 1: Add online video fields to `SlideContent`** in `src-tauri/src/db/models.rs:189-205`. Add these `Option<String>` fields after `text_size`:

```rust
pub video_url: Option<String>,
pub video_id: Option<String>,
pub video_source: Option<String>,
pub video_title: Option<String>,
```

- [ ] **Step 2: Add YouTube/online video model structs** below `SlideContent` in `models.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineVideoChannel {
    pub id: i64,
    pub channel_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub images: Option<String>,
    pub status: String,
    pub playlists: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineVideoPlaylist {
    pub id: i64,
    pub id_channel: Option<i64>,
    pub playlist_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub images: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub cover_path: Option<String>,
    pub channel_title: Option<String>,
    pub video_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineVideo {
    pub id: i64,
    pub id_playlist: i64,
    pub video_id: String,
    pub sequence: i32,
    pub title: Option<String>,
    pub description: Option<String>,
    pub images: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub local_path: Option<String>,
    pub duration_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AddPlaylistInput {
    pub playlist_id: String,
    pub channel_id: String,
    pub channel_title: String,
    pub playlist_title: String,
    pub thumbnail_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeChannelResult {
    pub channel_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub playlists: Vec<YoutubePlaylistInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YoutubePlaylistInfo {
    pub playlist_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub video_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeVideoInfo {
    pub video_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub duration_seconds: Option<i64>,
    pub sequence: i32,
}
```

- [ ] **Step 3: Add `YtdlpRuntimeState`** to `src-tauri/src/state.rs` (after `PackSyncRuntimeState` at line 195):

```rust
#[derive(Default)]
pub struct YtdlpRuntimeState {
    pub active_run_id: Option<String>,
    pub cancel_flags: std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>,
}
```

- [ ] **Step 4: Add `ytdlp` field to `AppState`** in `src-tauri/src/state.rs:197-216`. Add after `pack_sync`:

```rust
pub ytdlp: Mutex<YtdlpRuntimeState>,
```

- [ ] **Step 5: Update `AppState` initialization** in `src-tauri/src/lib.rs:298-315`. Add after the `pack_sync` line:

```rust
ytdlp: Mutex::new(crate::state::YtdlpRuntimeState::default()),
```

- [ ] **Step 6: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/db/models.rs src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat(models): add online video types, SlideContent fields, YtdlpRuntimeState"
```

---

## Task 3: YouTube Rust Backend — API client, URL parser, thumbnails

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Create: `src-tauri/src/youtube/mod.rs`
- Create: `src-tauri/src/youtube/api.rs`
- Create: `src-tauri/src/youtube/parser.rs`
- Create: `src-tauri/src/youtube/thumbnails.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod youtube;` near top)

**Reference:** `reqwest` is already in `Cargo.toml:56` with features `["json", "rustls-tls", "gzip"]`. The project uses **async** `reqwest::Client` (NOT `blocking`). Follow pattern in `src-tauri/src/pack_sync/` for HTTP calls.

**IMPORTANT:** All HTTP functions in `api.rs` and `thumbnails.rs` must use synchronous code that runs inside `std::thread::spawn` from the command layer (Task 4). Use `reqwest::blocking::Client` ONLY inside spawned threads. Add the `"blocking"` feature to reqwest in `Cargo.toml`.

- [ ] **Step 0: Add `blocking` feature to reqwest** in `src-tauri/Cargo.toml`. Find the `reqwest` line and add `"blocking"`:
```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls", "gzip", "blocking"] }
```

- [ ] **Step 1: Create `src-tauri/src/youtube/mod.rs`:**

```rust
pub mod api;
pub mod parser;
pub mod thumbnails;
```

- [ ] **Step 2: Create `src-tauri/src/youtube/parser.rs`** — URL parsing (pure logic, no I/O):

```rust
use crate::error::AppError;

#[derive(Debug, Clone, PartialEq)]
pub enum YoutubeUrl {
    Channel(String),       // channel_id (UC...)
    Handle(String),        // @handle
    Playlist(String),      // playlist_id (PL...)
    Video(String),         // video_id
}

/// Parses a YouTube URL into a structured enum.
/// Supports: /channel/UC..., /@handle, /playlist?list=PL..., /watch?v=...
pub fn parse_youtube_url(url: &str) -> Result<YoutubeUrl, AppError> {
    let url = url.trim();

    // Handle youtu.be short links
    if url.contains("youtu.be/") {
        let video_id = url.split("youtu.be/").nth(1)
            .and_then(|s| s.split(['?', '&', '#']).next())
            .ok_or_else(|| AppError::Internal("Invalid youtu.be URL".into()))?;
        return Ok(YoutubeUrl::Video(video_id.to_string()));
    }

    // Playlist URL: ?list=PLxxxx
    if url.contains("list=") {
        let list_id = url.split("list=").nth(1)
            .and_then(|s| s.split(['&', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract playlist ID".into()))?;
        return Ok(YoutubeUrl::Playlist(list_id.to_string()));
    }

    // Channel URL: /channel/UCxxxx
    if url.contains("/channel/") {
        let channel_id = url.split("/channel/").nth(1)
            .and_then(|s| s.split(['/', '?', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract channel ID".into()))?;
        return Ok(YoutubeUrl::Channel(channel_id.to_string()));
    }

    // Handle URL: /@handle
    if url.contains("/@") {
        let handle = url.split("/@").nth(1)
            .and_then(|s| s.split(['/', '?', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract handle".into()))?;
        return Ok(YoutubeUrl::Handle(handle.to_string()));
    }

    // Watch URL: /watch?v=xxxx (without list param — already handled above)
    if url.contains("watch?v=") || url.contains("watch?") && url.contains("v=") {
        let video_id = url.split("v=").nth(1)
            .and_then(|s| s.split(['&', '#']).next())
            .ok_or_else(|| AppError::Internal("Could not extract video ID".into()))?;
        return Ok(YoutubeUrl::Video(video_id.to_string()));
    }

    Err(AppError::Internal("Unrecognized YouTube URL format".into()))
}
```

- [ ] **Step 3: Create `src-tauri/src/youtube/api.rs`** — YouTube Data API v3 client. Uses `reqwest::blocking::Client` (runs inside `std::thread::spawn` from command layer):

```rust
use reqwest::blocking::Client;
use serde::Deserialize;
use crate::error::AppError;
use crate::db::models::{YoutubeChannelResult, YoutubePlaylistInfo, YoutubeVideoInfo};

const API_BASE: &str = "https://www.googleapis.com/youtube/v3";

#[derive(Deserialize)]
struct ApiListResponse<T> {
    items: Option<Vec<T>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
    #[serde(rename = "pageInfo")]
    page_info: Option<PageInfo>,
}

#[derive(Deserialize)]
struct PageInfo {
    #[serde(rename = "totalResults")]
    total_results: Option<u32>,
}

#[derive(Deserialize)]
struct ChannelItem {
    id: String,
    snippet: Option<ChannelSnippet>,
}

#[derive(Deserialize)]
struct ChannelSnippet {
    title: Option<String>,
    thumbnails: Option<Thumbnails>,
}

#[derive(Deserialize)]
struct PlaylistItem {
    id: String,
    snippet: Option<PlaylistSnippet>,
    #[serde(rename = "contentDetails")]
    content_details: Option<PlaylistContentDetails>,
}

#[derive(Deserialize)]
struct PlaylistSnippet {
    title: Option<String>,
    thumbnails: Option<Thumbnails>,
    #[serde(rename = "channelId")]
    channel_id: Option<String>,
    #[serde(rename = "channelTitle")]
    channel_title: Option<String>,
}

#[derive(Deserialize)]
struct PlaylistContentDetails {
    #[serde(rename = "itemCount")]
    item_count: Option<u32>,
}

#[derive(Deserialize)]
struct PlaylistVideoItem {
    snippet: Option<PlaylistVideoSnippet>,
    #[serde(rename = "contentDetails")]
    content_details: Option<VideoContentDetails>,
}

#[derive(Deserialize)]
struct PlaylistVideoSnippet {
    title: Option<String>,
    thumbnails: Option<Thumbnails>,
    position: Option<u32>,
    #[serde(rename = "resourceId")]
    resource_id: Option<ResourceId>,
}

#[derive(Deserialize)]
struct ResourceId {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[derive(Deserialize)]
struct VideoContentDetails {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[derive(Deserialize)]
struct Thumbnails {
    default: Option<ThumbnailInfo>,
    medium: Option<ThumbnailInfo>,
    high: Option<ThumbnailInfo>,
    standard: Option<ThumbnailInfo>,
    maxres: Option<ThumbnailInfo>,
}

#[derive(Deserialize)]
struct ThumbnailInfo {
    url: Option<String>,
}

impl Thumbnails {
    fn best_url(&self) -> String {
        self.maxres.as_ref()
            .or(self.standard.as_ref())
            .or(self.high.as_ref())
            .or(self.medium.as_ref())
            .or(self.default.as_ref())
            .and_then(|t| t.url.clone())
            .unwrap_or_default()
    }
}

pub fn validate_api_key(api_key: &str) -> Result<bool, AppError> {
    let client = Client::new();
    let resp = client.get(format!("{}/channels", API_BASE))
        .query(&[("part", "id"), ("id", "UC_x5XG1OV2P6uZZ5FSM9Ttw"), ("key", api_key)])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    Ok(resp.status().is_success())
}

/// Resolves a @handle to a channel ID using the YouTube API search endpoint.
pub fn resolve_handle(api_key: &str, handle: &str) -> Result<String, AppError> {
    let client = Client::new();
    let resp = client.get(format!("{}/search", API_BASE))
        .query(&[("part", "snippet"), ("q", handle), ("type", "channel"), ("maxResults", "1"), ("key", api_key)])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    let body: serde_json::Value = resp.json()
        .map_err(|e| AppError::Internal(format!("Failed to parse YouTube response: {}", e)))?;

    body["items"][0]["id"]["channelId"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal(format!("Could not resolve handle @{}", handle)))
}

pub fn fetch_channel(api_key: &str, channel_id: &str) -> Result<YoutubeChannelResult, AppError> {
    let client = Client::new();

    // Fetch channel info
    let resp = client.get(format!("{}/channels", API_BASE))
        .query(&[("part", "snippet"), ("id", channel_id), ("key", api_key)])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    let channels: ApiListResponse<ChannelItem> = resp.json()
        .map_err(|e| AppError::Internal(format!("Failed to parse channel response: {}", e)))?;

    let channel = channels.items.and_then(|mut v| if v.is_empty() { None } else { Some(v.remove(0)) })
        .ok_or_else(|| AppError::NotFound("Channel not found".into()))?;

    let snippet = channel.snippet.unwrap_or(ChannelSnippet { title: None, thumbnails: None });

    // Fetch channel playlists
    let playlists = fetch_channel_playlists(api_key, channel_id)?;

    Ok(YoutubeChannelResult {
        channel_id: channel.id,
        title: snippet.title.unwrap_or_default(),
        thumbnail_url: snippet.thumbnails.map(|t| t.best_url()).unwrap_or_default(),
        playlists,
    })
}

fn fetch_channel_playlists(api_key: &str, channel_id: &str) -> Result<Vec<YoutubePlaylistInfo>, AppError> {
    let client = Client::new();
    let mut all_playlists = Vec::new();
    let mut page_token: Option<String> = None;

    loop {
        let mut query = vec![
            ("part", "snippet,contentDetails".to_string()),
            ("channelId", channel_id.to_string()),
            ("maxResults", "50".to_string()),
            ("key", api_key.to_string()),
        ];
        if let Some(ref token) = page_token {
            query.push(("pageToken", token.clone()));
        }

        let resp = client.get(format!("{}/playlists", API_BASE))
            .query(&query.iter().map(|(k, v)| (*k, v.as_str())).collect::<Vec<_>>())
            .send()
            .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

        let body: ApiListResponse<PlaylistItem> = resp.json()
            .map_err(|e| AppError::Internal(format!("Failed to parse playlists response: {}", e)))?;

        if let Some(items) = body.items {
            for item in items {
                let snippet = item.snippet.unwrap_or(PlaylistSnippet {
                    title: None, thumbnails: None, channel_id: None, channel_title: None,
                });
                all_playlists.push(YoutubePlaylistInfo {
                    playlist_id: item.id,
                    title: snippet.title.unwrap_or_default(),
                    thumbnail_url: snippet.thumbnails.map(|t| t.best_url()).unwrap_or_default(),
                    video_count: item.content_details.and_then(|cd| cd.item_count).unwrap_or(0),
                });
            }
        }

        match body.next_page_token {
            Some(token) => page_token = Some(token),
            None => break,
        }
    }

    Ok(all_playlists)
}

pub fn fetch_playlist_info(api_key: &str, playlist_id: &str) -> Result<(YoutubePlaylistInfo, String, String), AppError> {
    let client = Client::new();
    let resp = client.get(format!("{}/playlists", API_BASE))
        .query(&[("part", "snippet,contentDetails"), ("id", playlist_id), ("key", api_key)])
        .send()
        .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

    let body: ApiListResponse<PlaylistItem> = resp.json()
        .map_err(|e| AppError::Internal(format!("Failed to parse playlist response: {}", e)))?;

    let item = body.items.and_then(|mut v| if v.is_empty() { None } else { Some(v.remove(0)) })
        .ok_or_else(|| AppError::NotFound("Playlist not found".into()))?;

    let snippet = item.snippet.unwrap_or(PlaylistSnippet {
        title: None, thumbnails: None, channel_id: None, channel_title: None,
    });

    let info = YoutubePlaylistInfo {
        playlist_id: item.id,
        title: snippet.title.clone().unwrap_or_default(),
        thumbnail_url: snippet.thumbnails.map(|t| t.best_url()).unwrap_or_default(),
        video_count: item.content_details.and_then(|cd| cd.item_count).unwrap_or(0),
    };

    let channel_id = snippet.channel_id.unwrap_or_default();
    let channel_title = snippet.channel_title.unwrap_or_default();

    Ok((info, channel_id, channel_title))
}

pub fn fetch_playlist_videos(api_key: &str, playlist_id: &str) -> Result<Vec<YoutubeVideoInfo>, AppError> {
    let client = Client::new();
    let mut all_videos = Vec::new();
    let mut page_token: Option<String> = None;

    loop {
        let mut query = vec![
            ("part", "snippet,contentDetails".to_string()),
            ("playlistId", playlist_id.to_string()),
            ("maxResults", "50".to_string()),
            ("key", api_key.to_string()),
        ];
        if let Some(ref token) = page_token {
            query.push(("pageToken", token.clone()));
        }

        let resp = client.get(format!("{}/playlistItems", API_BASE))
            .query(&query.iter().map(|(k, v)| (*k, v.as_str())).collect::<Vec<_>>())
            .send()
            .map_err(|e| AppError::Internal(format!("YouTube API request failed: {}", e)))?;

        let body: ApiListResponse<PlaylistVideoItem> = resp.json()
            .map_err(|e| AppError::Internal(format!("Failed to parse playlist videos: {}", e)))?;

        if let Some(items) = body.items {
            for item in items {
                let snippet = item.snippet.unwrap_or(PlaylistVideoSnippet {
                    title: None, thumbnails: None, position: None, resource_id: None,
                });
                let video_id = snippet.resource_id
                    .and_then(|r| r.video_id)
                    .unwrap_or_default();
                if video_id.is_empty() { continue; }

                all_videos.push(YoutubeVideoInfo {
                    video_id,
                    title: snippet.title.unwrap_or_default(),
                    thumbnail_url: snippet.thumbnails.map(|t| t.best_url()).unwrap_or_default(),
                    duration_seconds: None, // playlistItems don't include duration
                    sequence: snippet.position.unwrap_or(0) as i32,
                });
            }
        }

        match body.next_page_token {
            Some(token) => page_token = Some(token),
            None => break,
        }
    }

    Ok(all_videos)
}
```

- [ ] **Step 4: Create `src-tauri/src/youtube/thumbnails.rs`** — uses `reqwest::blocking::Client` (called from spawned thread):

```rust
use std::path::Path;
use std::fs;
use reqwest::blocking::Client;
use crate::error::AppError;

/// Downloads a thumbnail from a URL and saves it to media/covers/youtube/.
/// Returns the relative path (e.g., "media/covers/youtube/{id}.jpg").
/// MUST be called from a spawned thread — uses blocking HTTP.
pub fn download_thumbnail(
    app_data_dir: &Path,
    url: &str,
    filename: &str,
) -> Result<String, AppError> {
    if url.is_empty() {
        return Err(AppError::Internal("Empty thumbnail URL".into()));
    }

    let covers_dir = app_data_dir.join("media").join("covers").join("youtube");
    fs::create_dir_all(&covers_dir)?; // AppError implements From<io::Error>

    let ext = if url.contains(".webp") { "webp" }
        else if url.contains(".png") { "png" }
        else { "jpg" };

    let file_name = format!("{}.{}", filename, ext);
    let full_path = covers_dir.join(&file_name);
    let relative_path = format!("media/covers/youtube/{}", file_name);

    let client = Client::new();
    let bytes = client.get(url)
        .send()
        .map_err(|e| AppError::Internal(format!("Failed to download thumbnail: {}", e)))?
        .bytes()
        .map_err(|e| AppError::Internal(format!("Failed to read thumbnail bytes: {}", e)))?;

    fs::write(&full_path, &bytes)?; // AppError implements From<io::Error>

    Ok(relative_path)
}
```

- [ ] **Step 5: Add `mod youtube;`** to `src-tauri/src/lib.rs` near the other module declarations at the top of the file.

- [ ] **Step 6: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/youtube/ src-tauri/src/lib.rs
git commit -m "feat(youtube): add API client, URL parser, and thumbnail downloader"
```

---

## Task 4: DB Queries + Tauri Commands for YouTube

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Create: `src-tauri/src/db/queries/online_videos.rs`
- Create: `src-tauri/src/commands/youtube.rs`
- Modify: `src-tauri/src/db/queries/mod.rs` (add `pub mod online_videos;`)
- Modify: `src-tauri/src/commands/mod.rs` (add `pub mod youtube;`)
- Modify: `src-tauri/src/lib.rs:53-227` (register commands in `collect_commands!`)

**Reference:** Follow patterns in `src-tauri/src/db/queries/collections.rs` for query structure. Follow `src-tauri/src/commands/pack_sync.rs` for background thread pattern.

- [ ] **Step 1: Create `src-tauri/src/db/queries/online_videos.rs`** with CRUD functions for channels, playlists, and videos. Each function takes `&Connection` and returns `Result<T, AppError>`. Include:
  - `upsert_channel(conn, channel_id, title, images) -> Result<i64, AppError>`
  - `insert_playlist(conn, channel_id, playlist_id, title, cover_path) -> Result<i64, AppError>`
  - `get_playlists(conn) -> Result<Vec<OnlineVideoPlaylist>, AppError>` (JOIN with channels for channel_title)
  - `get_playlist(conn, playlist_id) -> Result<OnlineVideoPlaylist, AppError>`
  - `delete_playlist(conn, playlist_id) -> Result<(), AppError>`
  - `upsert_videos(conn, db_playlist_id, videos: Vec<YoutubeVideoInfo>) -> Result<(), AppError>`
  - `get_playlist_videos(conn, db_playlist_id) -> Result<Vec<OnlineVideo>, AppError>`
  - `update_video_local_path(conn, video_id, local_path) -> Result<(), AppError>`
  - `get_videos_with_local_path(conn, db_playlist_id) -> Result<Vec<String>, AppError>` (for cleanup)

- [ ] **Step 2: Create `src-tauri/src/commands/youtube.rs`** with Tauri commands.

**CRITICAL:** ALL commands that do network I/O MUST spawn on `std::thread::spawn` and return immediately. They MUST emit a Tauri event on completion so the frontend can invalidate queries at the right time (NOT on `onSuccess` of the mutation, which fires immediately before work is done).

Commands:
  - `validate_youtube_api_key(key: String, app: AppHandle) -> Result<(), AppError>` — spawns thread, emits `"youtube-api-key-validated"` with `{ valid: bool, error?: string }`
  - `fetch_youtube_channel(url: String, api_key: String, app: AppHandle) -> Result<(), AppError>` — spawns thread, parses URL, resolves handle if needed, calls API, emits `"youtube-channel-fetched"` with `YoutubeChannelResult`
  - `add_youtube_playlist(input: AddPlaylistInput, api_key: String, app: AppHandle, state: State<AppState>) -> Result<(), AppError>` — spawns thread: saves channel, saves playlist, downloads cover, fetches & saves videos, emits `"youtube-playlist-added"`
  - `get_youtube_playlists(state: State<AppState>) -> Result<Vec<OnlineVideoPlaylist>, AppError>` — DB read only, no thread needed
  - `get_youtube_playlist_videos(playlist_id: String, state: State<AppState>) -> Result<Vec<OnlineVideo>, AppError>` — DB read only, no thread needed
  - `refresh_youtube_playlist(playlist_id: String, api_key: String, app: AppHandle, state: State<AppState>) -> Result<(), AppError>` — spawns thread, re-fetches videos, emits `"youtube-playlist-refreshed"`
  - `delete_youtube_playlist(playlist_id: String, app: AppHandle, state: State<AppState>) -> Result<(), AppError>` — deletes from DB + cleans up local video files in `media/videos/youtube/` for videos with `local_path` set

**Event-driven frontend pattern:** The frontend listens to these Tauri events (via `listen()`) and calls `queryClient.invalidateQueries()` when received, instead of using `onSuccess` on mutations. This is the same pattern used by pack_sync.

- [ ] **Step 3: Register modules** — add `pub mod online_videos;` to `src-tauri/src/db/queries/mod.rs` and `pub mod youtube;` to `src-tauri/src/commands/mod.rs`.

- [ ] **Step 4: Register commands** in `src-tauri/src/lib.rs` `collect_commands!` macro. Add a `// YouTube` section after the last command group.

- [ ] **Step 5: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 6: Commit**
```bash
git add src-tauri/src/db/queries/online_videos.rs src-tauri/src/commands/youtube.rs \
  src-tauri/src/db/queries/mod.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(youtube): add DB queries and Tauri commands for online videos"
```

---

## Task 5: yt-dlp Module — Binary management + video download

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Create: `src-tauri/src/ytdlp/mod.rs`
- Create: `src-tauri/src/ytdlp/binary.rs`
- Create: `src-tauri/src/ytdlp/downloader.rs`
- Modify: `src-tauri/src/commands/youtube.rs` (add download commands)
- Modify: `src-tauri/src/lib.rs` (add `mod ytdlp;`, register download commands)

**Reference:** Follow cancellable async pattern from `src-tauri/src/pack_sync/executor.rs`. State pattern at `src-tauri/src/state.rs:188-195`.

- [ ] **Step 1: Create `src-tauri/src/ytdlp/mod.rs`:**

```rust
pub mod binary;
pub mod downloader;
```

- [ ] **Step 2: Create `src-tauri/src/ytdlp/binary.rs`** — downloads yt-dlp binary from GitHub releases with SHA256 verification:
  - `ensure_binary(app_data_dir: &Path) -> Result<PathBuf, AppError>` — returns binary path, downloads if missing
  - `download_binary(app_data_dir: &Path) -> Result<PathBuf, AppError>` — downloads from `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp` (or `yt-dlp.exe` on Windows)
  - `verify_hash(binary_path: &Path, expected_hash: &str) -> Result<bool, AppError>` — SHA256 check
  - `check_for_update(app_data_dir: &Path) -> Result<bool, AppError>` — compares local vs remote latest tag

- [ ] **Step 3: Create `src-tauri/src/ytdlp/downloader.rs`** — spawns yt-dlp subprocess:
  - `download_video(binary_path: &Path, video_id: &str, output_dir: &Path, quality: &str, cancel_flag: Arc<AtomicBool>, app: &AppHandle, run_id: &str) -> Result<PathBuf, AppError>`
  - Spawns `yt-dlp -f "bestvideo[height<=<quality>]+bestaudio/best[height<=<quality>]" --merge-output-format mp4 -o <output_path> https://www.youtube.com/watch?v=<video_id>`
  - Parses stdout for progress (`[download]  XX.X%`), emits `"ytdlp-progress"` events
  - Checks cancel flag between progress lines
  - Cleans up partial file on cancel/error

- [ ] **Step 4: Add download commands** to `src-tauri/src/commands/youtube.rs`:
  - `ensure_ytdlp(app: AppHandle) -> Result<String, AppError>` — calls `binary::ensure_binary()`
  - `update_ytdlp(app: AppHandle) -> Result<(), AppError>` — force re-download
  - `download_online_video(video_id: String, playlist_id: String, quality: String, app: AppHandle, state: State<AppState>) -> Result<String, AppError>` — spawns background thread, returns run_id
  - `cancel_download(run_id: String, state: State<AppState>) -> Result<(), AppError>`

- [ ] **Step 5: Add `mod ytdlp;`** to `src-tauri/src/lib.rs` and register new commands in `collect_commands!`.

- [ ] **Step 6: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/ytdlp/ src-tauri/src/commands/youtube.rs src-tauri/src/lib.rs
git commit -m "feat(ytdlp): add binary management and video download with cancellation"
```

---

## Task 6: Tauri CSP Update + Frontend Bindings

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src-tauri/tauri.conf.json:16` (add YouTube domains to CSP)
- Modify: `src/lib/tauri.ts` (add YouTube command wrappers)
- Modify: `src/lib/queries.ts` (add TanStack Query hooks)

**Reference:** Follow wrapper pattern in `src/lib/tauri.ts:53-95`. Follow hook pattern in `src/lib/queries.ts:56-122+`.

- [ ] **Step 1: Update CSP** in `src-tauri/tauri.conf.json:16`. Add `frame-src https://www.youtube.com https://www.youtube-nocookie.com;` and add `https://i.ytimg.com` to `img-src`:

```json
"csp": "default-src 'self' tauri: asset:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data: blob: https://i.ytimg.com; connect-src ipc: http://ipc.localhost; media-src asset: blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com"
```

- [ ] **Step 2: Regenerate bindings** — run `cargo build --manifest-path src-tauri/Cargo.toml` which triggers tauri-specta to write `src/lib/bindings.ts`. Verify the new types (`OnlineVideoPlaylist`, `OnlineVideo`, `YoutubeChannelResult`, `AddPlaylistInput`, etc.) appear in the generated file.

- [ ] **Step 3: Update slide content converters** — Search the frontend codebase for where `SlideContent` types are transformed (search for `slideType`, `slide_type`, `slideContent` in `src/` files). The CLAUDE.md references `flatToSlideContent`/`slideContentToFlat` converter functions but they may not exist by those exact names, or the conversion may be inline. Find the actual conversion points and ensure the 4 new online video fields (`videoUrl`, `videoId`, `videoSource`, `videoTitle`) are handled. If no converters exist (SlideContent is used as-is from bindings), no changes needed here.

- [ ] **Step 4: Add command wrappers** to `src/lib/tauri.ts`. Import types from `./bindings` and add one async function per YouTube command.

- [ ] **Step 5: Add TanStack Query hooks** to `src/lib/queries.ts`:
  - Add `youtubeVideos` key group to `queryKeys` object
  - `useYoutubePlaylists()` — `useQuery` for `get_youtube_playlists`
  - `useYoutubePlaylistVideos(playlistId)` — `useQuery` for `get_youtube_playlist_videos`
  - `useAddYoutubePlaylist()` — `useMutation` (fire-and-forget, NO `onSuccess` invalidation — event-driven)
  - `useRefreshYoutubePlaylist()` — `useMutation` (fire-and-forget)
  - `useDeleteYoutubePlaylist()` — `useMutation` with `onSuccess` invalidation (this one is synchronous DB-only)

- [ ] **Step 6: Create a `useYoutubeEvents()` hook** (in `src/hooks/use-youtube-events.ts` or inline) that listens to Tauri events (`"youtube-playlist-added"`, `"youtube-playlist-refreshed"`, `"youtube-channel-fetched"`, `"youtube-api-key-validated"`) and invalidates the corresponding queries. Call this hook in the Online Videos route layout. Pattern: use `listen()` from `@tauri-apps/api/event` in a `useEffect` cleanup pattern.

- [ ] **Step 7: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 8: Commit**
```bash
git add src-tauri/tauri.conf.json src/lib/tauri.ts src/lib/queries.ts src/lib/bindings.ts src/hooks/
git commit -m "feat(frontend): add YouTube CSP, command wrappers, query hooks, and event listener"
```

---

## Task 7: Sidebar Refactor — Collapsible Sub-items

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task. **Use `ui-ux-pro-max` skill** for sidebar design.

**Files:**
- Modify: `src/components/layout/sidebar.tsx:29-40` (NavItem type + children), `src/components/layout/sidebar.tsx:79-126` (rendering)
- Modify: `src/stores/ui-store.ts:3-25` (add `expandedNavItems` state)

**Reference:** Current sidebar renders flat navItems array at `sidebar.tsx:29-40`. Uses `Link` from TanStack Router + `Tooltip` from Radix. Collapsed/expanded toggle at `sidebar.tsx:43`.

- [ ] **Step 1: Add `expandedNavItems` to `useUIStore`** in `src/stores/ui-store.ts`:

```ts
expandedNavItems: Record<string, boolean>;
toggleNavItem: (to: string) => void;
setNavItemExpanded: (to: string, expanded: boolean) => void;
```

Initialize: `expandedNavItems: {}`. Implement toggle and set functions.

- [ ] **Step 2: Update navItems array** in `sidebar.tsx:29-40` to add `children` to Collections:

```ts
type NavChild = { to: string; icon: LucideIcon; labelKey: string };
type NavItem = { to: string; icon: LucideIcon; labelKey: string; children?: NavChild[] };

const navItems: NavItem[] = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/hymnal", icon: Music, labelKey: "nav.hymnal" },
  {
    to: "/collections",
    icon: FolderOpen,
    labelKey: "nav.collections",
    children: [
      { to: "/collections", icon: FolderOpen, labelKey: "nav.collections.items" },
      { to: "/collections/online-videos", icon: Video, labelKey: "nav.collections.onlineVideos" },
    ],
  },
  // ... rest unchanged
];
```

- [ ] **Step 3: Update sidebar rendering** to handle items with children:
  - Parent item: label/icon click navigates, chevron (ChevronDown/ChevronRight) toggles expand
  - Children: render indented below when expanded
  - Auto-expand when current route matches any child
  - Active child + active parent both get highlight styling

- [ ] **Step 4: Add hover popover** for collapsed sidebar mode:
  - **First:** Read `src/components/ui/popover.tsx` to confirm the export names (it's a new file — verify it exports `Popover`, `PopoverTrigger`, `PopoverContent` or similar)
  - When `!sidebarOpen` and item has `children`, wrap in Radix `Popover` with controlled `open` prop
  - `onMouseEnter` with 150ms setTimeout to set open
  - `onMouseLeave` to close (clear timeout + set closed)
  - Popover content shows children list with navigation links
  - Import popover components using the verified export names from `../ui/popover`

- [ ] **Step 5: Add i18n keys** to all 3 locale files:
  - `nav.collections.items`: "Coletâneas" / "Collections" / "Colecciones"
  - `nav.collections.onlineVideos`: "Vídeos Online" / "Online Videos" / "Videos en Línea"

- [ ] **Step 6: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 7: Commit**
```bash
git add src/components/layout/sidebar.tsx src/stores/ui-store.ts src/locales/
git commit -m "feat(sidebar): add collapsible sub-items with hover popover for Collections"
```

---

## Task 8: Collections Route — Tab Bar + Online Videos Routes

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task. **Use `ui-ux-pro-max` skill** for tab design.

**Files:**
- Modify: `src/routes/collections/route.tsx` (add conditional tab bar)
- Create: `src/routes/collections/online-videos/route.tsx`
- Create: `src/routes/collections/online-videos/index.tsx`
- Create: `src/routes/collections/online-videos/$playlistId.tsx`

**Reference:** Current `route.tsx` at `src/routes/collections/route.tsx` is a bare `<Outlet />`. Tab pattern: use `cn()` + conditional `border-b-2 border-primary` styling (documented in CLAUDE.md).

- [ ] **Step 1: Update `src/routes/collections/route.tsx`** — add conditional tab bar:

```tsx
import { Outlet, createFileRoute, useMatchRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { FolderOpen, Video } from "lucide-react";

export const Route = createFileRoute("/collections")({
  component: CollectionsLayout,
});

const TABS = [
  { to: "/collections", icon: FolderOpen, labelKey: "nav.collections.items", exact: true },
  { to: "/collections/online-videos", icon: Video, labelKey: "nav.collections.onlineVideos", exact: false },
] as const;

function CollectionsLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  // Only show tabs on /collections and /collections/online-videos, NOT on /$collectionId
  const isCollectionDetail = matchRoute({ to: "/collections/$collectionId", fuzzy: true });
  const isPlaylistDetail = matchRoute({ to: "/collections/online-videos/$playlistId", fuzzy: true });

  if (isCollectionDetail || isPlaylistDetail) {
    return <Outlet />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-4 pt-2">
        {TABS.map((tab) => {
          const isActive = tab.exact
            ? matchRoute({ to: tab.to }) != null
            : matchRoute({ to: tab.to, fuzzy: true }) != null;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                "hover:text-foreground",
                isActive
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/routes/collections/online-videos/route.tsx`:**

```tsx
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/collections/online-videos")({
  component: OnlineVideosLayout,
});

function OnlineVideosLayout() {
  return <Outlet />;
}
```

- [ ] **Step 3: Create `src/routes/collections/online-videos/index.tsx`** — placeholder with API key check, playlist grid, and add button. Scaffold the component — detail implementation in Task 9.

- [ ] **Step 4: Create `src/routes/collections/online-videos/$playlistId.tsx`** — placeholder with playlist header + video list. Scaffold — detail in Task 10.

- [ ] **Step 5: Build and verify** (critical — route generation):
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 6: Commit**
```bash
git add src/routes/collections/
git commit -m "feat(routes): add online videos tab bar and route scaffolds"
```

---

## Task 9: Online Videos Tab — Full UI Implementation

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task. **Use `ui-ux-pro-max` skill** for all component design.

**Files:**
- Modify: `src/routes/collections/online-videos/index.tsx` (full implementation)
- Create: `src/components/online-videos/api-key-setup.tsx`
- Create: `src/components/online-videos/playlist-card.tsx`
- Create: `src/components/online-videos/add-playlist-modal.tsx`
- Create: `src/components/online-videos/playlist-picker.tsx`

**Reference:** Use existing Radix components from `src/components/ui/` (Button, Card, Dialog, Input, Badge). Grid pattern from `src/routes/collections/index.tsx`. Modal pattern from `src/components/services/add-item-modal.tsx`.

- [ ] **Step 1: Create `api-key-setup.tsx`** — setup prompt component shown when no API key is configured. Links to Settings page. Brief instructions on getting a YouTube Data API key.

- [ ] **Step 2: Create `playlist-card.tsx`** — card showing playlist cover (locally cached image), title, channel name, video count, with hover actions (refresh, delete).

- [ ] **Step 3: Create `playlist-picker.tsx`** — checkbox list of playlists from a channel. Used inside the add modal when user pastes a channel URL.

- [ ] **Step 4: Create `add-playlist-modal.tsx`** — Radix Dialog with URL input. On paste/submit:
  - Validates URL via `youtube/parser` patterns (client-side regex for instant feedback)
  - Channel URL → calls `fetch_youtube_channel` → shows `playlist-picker` → user selects → calls `add_youtube_playlist` per selected
  - Playlist URL → calls API to fetch info → calls `add_youtube_playlist` directly
  - Single video URL → shows CTA message with "Add to Service" button (if `activeServiceId` set) or "Go to Presentations" link
  - Loading states, error toasts via catcher

- [ ] **Step 5: Implement `online-videos/index.tsx`** — connects all components:
  - Reads API key from `plugin-store` via `getPreference("youtube_api_key")`
  - No key → renders `ApiKeySetup`
  - Has key → renders playlist grid with `useYoutubePlaylists()` hook + "Add Playlist" button

- [ ] **Step 6: Add all i18n keys** to `en.json`, `pt.json`, `es.json` for online videos section.

- [ ] **Step 7: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 8: Commit**
```bash
git add src/routes/collections/online-videos/ src/components/online-videos/ src/locales/
git commit -m "feat(ui): implement online videos tab with playlist management"
```

---

## Task 10: Playlist Detail Page + Video Actions

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task. **Use `ui-ux-pro-max` skill**.

**Files:**
- Modify: `src/routes/collections/online-videos/$playlistId.tsx` (full implementation)
- Create: `src/components/online-videos/video-card.tsx`

**Reference:** Detail page pattern from `src/routes/collections/$collectionId.tsx`. Video card should show thumbnail, title, duration. Actions follow cross-module "Add to X" pattern (see `src/components/music/hymn-card.tsx` for reference).

- [ ] **Step 1: Create `video-card.tsx`** — card component for each video showing:
  - YouTube thumbnail (from `images` JSON field)
  - Title, duration
  - Status badge (pending/validated/error/downloaded)
  - Actions: "Project" button, "Add to Presentation", "Add to Service" (conditional on `activeServiceId`), "Download" / progress bar / "Downloaded" badge

- [ ] **Step 2: Implement `$playlistId.tsx`** — full playlist detail page:
  - Header: cover image, playlist title, channel name, video count, "Refresh" button, "Back" link
  - Video list/grid using `useYoutubePlaylistVideos(playlistId)`
  - Refresh calls `refresh_youtube_playlist` mutation
  - Listen to `"ytdlp-progress"` Tauri events for download progress per video

- [ ] **Step 3: Add i18n keys** for playlist detail page.

- [ ] **Step 4: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add src/routes/collections/online-videos/$playlistId.tsx src/components/online-videos/video-card.tsx src/locales/
git commit -m "feat(ui): implement playlist detail page with video actions"
```

---

## Task 11: Projector Integration — online_video Slide Type

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src/components/slides/slide-renderer.tsx` (add `online_video` case)
- Create: `src/components/online-videos/online-video-slide.tsx` (iframe + local rendering)
- Modify: `src/components/slides/video-slide.tsx` (optional — may reuse for local playback)

**Reference:** Slide type routing in `slide-renderer.tsx:48-170`. Video rendering in `video-slide.tsx:23-104`. Projector event flow: `setCurrentSlide` (Rust) → `"slide-changed"` event → `ProjectorView` → `SlideRenderer`.

- [ ] **Step 0: Locate slide content conversion** — Search for `flatToSlideContent`, `slideContentToFlat`, `slideType`, or `slide_type` conversion logic in `src/`. Identify where `SlideContent` from bindings is transformed or consumed. If converters exist, verify they already handle the new `videoUrl`/`videoId`/`videoSource`/`videoTitle` fields (Task 6 Step 3 should have addressed this). If they don't exist, confirm `SlideContent` is used as-is from bindings (no conversion needed).

- [ ] **Step 1: Create `online-video-slide.tsx`** — renders based on local availability:
  - If `slide.videoPath` is set (downloaded) → use existing `VideoPlayer` with `convertFileSrc(resolvedPath)`
  - If not → render YouTube iframe: `<iframe src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&controls=0&rel=0" />`
  - Handle `renderMode`: projector (full iframe), return-current (title + thumbnail, no iframe), editor (thumbnail preview)
  - Error state: "No internet connection" overlay when iframe fails to load

- [ ] **Step 2: Add `online_video` case to `slide-renderer.tsx`**:

```tsx
if (slideType === "online_video") {
  return <OnlineVideoSlide slide={slide} renderMode={renderMode} className={className} />;
}
```

- [ ] **Step 3: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add src/components/online-videos/online-video-slide.tsx src/components/slides/slide-renderer.tsx
git commit -m "feat(projector): add online_video slide type with iframe and local rendering"
```

---

## Task 12: Presentation & Service Integration

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src/components/slides/slide-editor.tsx` (add "Online Video" option to slide type picker)
- Modify: `src/components/services/add-item-modal.tsx` (add "Online Video" item type)
- Modify: relevant service item projection code

**Reference:** Cross-module "Add to X" pattern documented in CLAUDE.md. See `hymn-card.tsx` for "Add to Service" button pattern using `usePresentationStore.activeServiceId`.

- [ ] **Step 1: Add "Online Video" to slide editor** — in the slide type picker, add an option that opens a small modal/popover to paste a YouTube URL. On submit, creates a slide with `slide_type: "online_video"`, `video_id`, `video_url`, `video_source: "youtube"`, `video_title`.

- [ ] **Step 2: Add "Online Video" to service add-item modal:**
  - Read `src/components/services/add-item-modal.tsx` and locate the item type list/enum
  - Add `online_video` as a new item type
  - Update ALL parallel `Record<ServiceItemType, ...>` maps (icons, text colors, border colors, bg colors) per the color-coded type maps pattern documented in CLAUDE.md
  - Check if the Rust `ServiceItem` model (search for `pub struct ServiceItem` in `src-tauri/src/db/models.rs`) and service projection logic need changes for the `online_video` type — update if needed
  - New item lets user paste a YouTube URL, creates a service item that projects as `online_video` slide type

- [ ] **Step 3: Add i18n keys** for new options.

- [ ] **Step 4: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add src/components/slides/slide-editor.tsx src/components/services/add-item-modal.tsx src/locales/
git commit -m "feat(integration): add online video support to presentations and services"
```

---

## Task 13: Settings UI — API Key + yt-dlp Management

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task. **Use `ui-ux-pro-max` skill**.

**Files:**
- Modify: `src/routes/settings/index.tsx:69-91` (add new settings tab or section)

**Reference:** Settings tab pattern at `src/routes/settings/index.tsx:69-77` (SETTINGS_TABS array with id, labelKey, icon).

- [ ] **Step 1: Add "YouTube" section/tab** to settings with:
  - API Key input field (password-masked with show/hide toggle)
  - "Validate" button → calls `validate_youtube_api_key`, shows success/error toast
  - "Save" button → stores via `setPreference("youtube_api_key", key)`
  - Download quality dropdown (720p / 1080p / best) → stored via `setPreference("ytdlp_quality", quality)`
  - "Update yt-dlp" button → calls `update_ytdlp`, shows progress/success toast
  - Brief help text explaining where to get a YouTube API key

- [ ] **Step 2: Add i18n keys** for all settings labels.

- [ ] **Step 3: Build and verify**
```bash
pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add src/routes/settings/index.tsx src/locales/
git commit -m "feat(settings): add YouTube API key and yt-dlp management section"
```

---

## Task 14: SSE Streaming + Return Monitor Updates

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src-tauri/src/streaming/mod.rs` (SSE templates handle online_video fields)
- Modify: Return monitor component (render video title + thumbnail for online_video slides)

**Reference:** Streaming clear pattern from CLAUDE.md: "all 3 SSE channels must receive empty payloads. HTML templates must handle null/empty values explicitly."

- [ ] **Step 1: Update SSE HTML templates** in `src-tauri/src/streaming/mod.rs` to handle the new `video_url`, `video_id`, `video_source`, `video_title` fields. Templates must show "Waiting for content" when these are null.

- [ ] **Step 2: Update return monitor** to render online_video slides as title + thumbnail (no iframe). Use the `images` field from the video data or the YouTube thumbnail URL.

- [ ] **Step 3: Build and verify**
```bash
cargo build --manifest-path src-tauri/Cargo.toml && pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/streaming/mod.rs src/components/slides/
git commit -m "feat(streaming): update SSE templates and return monitor for online videos"
```

---

## Task 15: Final i18n Audit + Integration Test

**Sub-agent mandate:** Dispatch a dedicated sub-agent for this task.

**Files:**
- Modify: `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

- [ ] **Step 1: Run i18n lint** to verify all 3 locales have matching keys:
```bash
pnpm lint:i18n
```

- [ ] **Step 2: Fix any missing keys** across all 3 locale files.

- [ ] **Step 3: Run full build**:
```bash
cargo build --manifest-path src-tauri/Cargo.toml && pnpm vite build && npx tsc --noEmit
```

- [ ] **Step 4: Run `pnpm tauri dev`** and manually verify:
  - Sidebar shows Collections with expandable sub-items
  - Collapsed sidebar hover shows popover
  - Online Videos tab shows API key setup prompt
  - After adding API key: can add playlists, see videos, project
  - iframe renders in projector window
  - Download button triggers yt-dlp download with progress
  - Downloaded videos play via local VideoPlayer
  - Settings page shows YouTube section

- [ ] **Step 5: Commit any final fixes**
```bash
git add -A
git commit -m "feat(online-videos): final i18n audit and integration fixes"
```

---

## Code Review Checkpoints

After completing each task group, dispatch a code review sub-agent:

| After Tasks | Review Focus |
|-------------|-------------|
| 1–2 | DB schema correctness, model completeness, type safety |
| 3–5 | Rust backend: API client robustness, error handling, yt-dlp security (SHA256) |
| 6 | CSP correctness, binding generation, query hook patterns |
| 7–8 | Sidebar UX, route structure, tab bar conditional logic |
| 9–10 | UI polish (use `ui-ux-pro-max`), component reuse, accessibility |
| 11–12 | Projector rendering, cross-module integration correctness |
| 13–14 | Settings UX, streaming template completeness |
| 15 | Full integration, i18n completeness |
