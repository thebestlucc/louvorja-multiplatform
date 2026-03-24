# Codebase File-Splitting Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split large multi-concern files into smaller focused modules, improving readability, navigability, and maintainability without changing any behaviour.

**Architecture:** Each split is a pure refactor — move code to new files, re-export from the original path (where needed for backward compatibility), verify build passes, commit. No logic changes. Tasks are grouped into 5 independent tracks that can be run by parallel subagents.

**Tech Stack:** TypeScript 5.8, React 19, Tauri 2, Rust (rusqlite, r2d2), TanStack Query, Zustand

---

## ⚠️ Golden Rules for This Plan

1. **Never change behaviour.** Only move, re-export, and restructure.
2. **Build must pass after every task.** Run `npx tsc --noEmit` (TS) or `cargo build --manifest-path src-tauri/Cargo.toml` (Rust) before committing.
3. **For Rust module splits:** use `pub mod <name>;` in the parent `mod.rs` / `queries/mod.rs` and `pub use` re-exports so existing callers don't need updating.
4. **For TypeScript splits:** create an `index.ts` barrel that re-exports everything from the new sub-files so existing imports remain valid.
5. **Do NOT edit `src/lib/bindings.ts`** — auto-generated.
6. **Do NOT change function signatures, types, or query keys.**

---

## Track A — Frontend Library Split (`queries.ts` + `tauri.ts`)

These are the highest-value TypeScript splits: 1406 + 901 lines → domain-specific files.

### Task A-1: Split `src/lib/tauri.ts` into domain modules

**Files:**
- Create: `src/lib/tauri/music.ts`
- Create: `src/lib/tauri/collections.ts`
- Create: `src/lib/tauri/display.ts`
- Create: `src/lib/tauri/audio.ts`
- Create: `src/lib/tauri/slides.ts`
- Create: `src/lib/tauri/bible.ts`
- Create: `src/lib/tauri/services.ts`
- Create: `src/lib/tauri/schedules.ts`
- Create: `src/lib/tauri/settings.ts`
- Create: `src/lib/tauri/pack-sync.ts`
- Create: `src/lib/tauri/utilities.ts`
- Create: `src/lib/tauri/streaming.ts`
- Create: `src/lib/tauri/youtube.ts`
- Create: `src/lib/tauri/index.ts` — barrel re-export
- Modify: `src/lib/tauri.ts` — replace body with single `export * from "./tauri/index"`

- [ ] **Step 1: Read the full file to understand domain boundaries**

```bash
wc -l src/lib/tauri.ts
```

Read `src/lib/tauri.ts` and note which line ranges belong to each domain (music, collections, display, audio, slides, bible, favorites/services, schedules, settings, pack-sync, utilities, streaming, youtube). Keep a scratch list.

- [ ] **Step 2: Create `src/lib/tauri/music.ts`**

Move all music-related `invoke` wrappers. Keep all existing imports (`invoke` from `@tauri-apps/api/core`, type imports from `@/lib/bindings`).

```typescript
// src/lib/tauri/music.ts
import { invoke } from "@tauri-apps/api/core";
import type { Hymn, HymnWriteInput, Album } from "@/lib/bindings";

// Paste exact music functions from tauri.ts here — no changes
```

- [ ] **Step 3: Create remaining domain files**

Repeat for each domain following the same pattern — copy the exact functions, same imports. Domain files to create:
- `collections.ts` — collection CRUD + song management + hymn-join
- `display.ts` — monitor enumeration, projector/return window lifecycle, slide projection, overlays, monitor config
- `audio.ts` — playback commands + sync points
- `slides.ts` — presentation + slide CRUD
- `bible.ts` — bible versions, books, verses, search
- `services.ts` — service items, favorites
- `schedules.ts` — departments, months, assignments, generation
- `settings.ts` — get/set settings
- `pack-sync.ts` — plan, start, cancel, status
- `utilities.ts` — media, text/lottery tools, video copy, timer, migration
- `streaming.ts` — SSE streaming start/stop/status
- `youtube.ts` — playlists, download, yt-dlp management

- [ ] **Step 4: Create barrel `src/lib/tauri/index.ts`**

```typescript
// src/lib/tauri/index.ts
export * from "./music";
export * from "./collections";
export * from "./display";
export * from "./audio";
export * from "./slides";
export * from "./bible";
export * from "./services";
export * from "./schedules";
export * from "./settings";
export * from "./pack-sync";
export * from "./utilities";
export * from "./streaming";
export * from "./youtube";
```

- [ ] **Step 5: Replace `src/lib/tauri.ts` body**

Keep the file but replace its entire content with:

```typescript
// src/lib/tauri.ts
// This file is a backward-compatibility re-export.
// Individual domain modules live in src/lib/tauri/*.
export * from "./tauri/index";
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: **0 errors**. Fix any import path issues (e.g., relative vs alias) before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tauri.ts src/lib/tauri/
git commit -m "refactor: split tauri.ts into domain modules under src/lib/tauri/"
```

---

### Task A-2: Split `src/lib/queries.ts` into domain modules

**Files:**
- Create: `src/lib/queries/keys.ts` — the `queryKeys` registry object
- Create: `src/lib/queries/music.ts`
- Create: `src/lib/queries/collections.ts`
- Create: `src/lib/queries/slides.ts`
- Create: `src/lib/queries/bible.ts`
- Create: `src/lib/queries/services.ts`
- Create: `src/lib/queries/schedules.ts`
- Create: `src/lib/queries/media-library.ts`
- Create: `src/lib/queries/settings.ts`
- Create: `src/lib/queries/pack-sync.ts`
- Create: `src/lib/queries/updater.ts`
- Create: `src/lib/queries/utilities.ts`
- Create: `src/lib/queries/streaming.ts`
- Create: `src/lib/queries/display.ts`
- Create: `src/lib/queries/youtube.ts`
- Create: `src/lib/queries/index.ts` — barrel re-export
- Modify: `src/lib/queries.ts` — replace body with single re-export

- [ ] **Step 1: Create `src/lib/queries/keys.ts`**

Move the entire `queryKeys` object (and only that) from `queries.ts` into this file. All other query modules will import from here.

```typescript
// src/lib/queries/keys.ts
export const queryKeys = {
  // paste exact object from queries.ts
} as const;
```

- [ ] **Step 2: Create each domain query file**

For each domain file, copy the relevant `useXxx()` hooks. Each file needs its own imports:
- `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";`
- Import the relevant tauri wrapper functions from `@/lib/tauri`
- Import `queryKeys` from `./keys`
- Import types from `@/lib/bindings`

Example structure:

```typescript
// src/lib/queries/music.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { getHymns, getHymn, updateHymn /* etc */ } from "@/lib/tauri";
import type { Hymn, HymnWriteInput, Album } from "@/lib/bindings";

export function useHymns() { /* exact copy */ }
export function useHymn(id: number) { /* exact copy */ }
// ...
```

Domains to create (map from the exploration analysis):
- `music.ts` — hymns, albums hooks
- `collections.ts` — collections, collection-songs, collection-hymns hooks
- `slides.ts` — presentations, slides hooks
- `bible.ts` — bible versions, books, verses, search hooks
- `services.ts` — services, service items, favorites hooks
- `schedules.ts` — departments, months, schedule generation hooks
- `media-library.ts` — media library categories and items hooks
- `settings.ts` — settings hooks
- `pack-sync.ts` — pack sync hooks
- `updater.ts` — update check/install hooks
- `utilities.ts` — timer, lottery, media, migration hooks
- `streaming.ts` — streaming status hooks
- `display.ts` — monitor configs, overlay hooks
- `youtube.ts` — youtube playlists, videos, download hooks

- [ ] **Step 3: Create barrel `src/lib/queries/index.ts`**

```typescript
// src/lib/queries/index.ts
export * from "./keys";
export * from "./music";
export * from "./collections";
export * from "./slides";
export * from "./bible";
export * from "./services";
export * from "./schedules";
export * from "./media-library";
export * from "./settings";
export * from "./pack-sync";
export * from "./updater";
export * from "./utilities";
export * from "./streaming";
export * from "./display";
export * from "./youtube";
```

- [ ] **Step 4: Replace `src/lib/queries.ts` body**

```typescript
// src/lib/queries.ts
// This file is a backward-compatibility re-export.
// Individual domain modules live in src/lib/queries/*.
export * from "./queries/index";
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: **0 errors**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries.ts src/lib/queries/
git commit -m "refactor: split queries.ts into domain modules under src/lib/queries/"
```

---

## Track B — Rust DB Models Split (`db/models.rs`)

1041 lines of struct definitions mixed across all domains. Split into per-domain model files.

### Task B-1: Split `src-tauri/src/db/models.rs` into domain modules

**Files:**
- Create: `src-tauri/src/db/models/music.rs`
- Create: `src-tauri/src/db/models/bible.rs`
- Create: `src-tauri/src/db/models/slides.rs`
- Create: `src-tauri/src/db/models/online_videos.rs`
- Create: `src-tauri/src/db/models/display.rs`
- Create: `src-tauri/src/db/models/collections.rs`
- Create: `src-tauri/src/db/models/schedules.rs`
- Create: `src-tauri/src/db/models/content_sync.rs`
- Create: `src-tauri/src/db/models/mod.rs` — replaces `models.rs`, re-exports everything
- Delete: `src-tauri/src/db/models.rs`

> **Important Rust note:** The crate's `db/mod.rs` declares `pub mod models;`. After this task, `models.rs` becomes `models/mod.rs`. Rust resolves both `models.rs` and `models/mod.rs` identically for the `pub mod models;` declaration — no changes needed in `db/mod.rs`.

- [ ] **Step 1: Read `src-tauri/src/db/models.rs` fully**

Note line ranges per domain. Look for cross-domain deps (e.g., does `ScheduleDay` reference a `SlideContent`?). Any cross-references must be handled with `use super::` imports in the new files.

- [ ] **Step 2: Create `src-tauri/src/db/models/music.rs`**

```rust
// src-tauri/src/db/models/music.rs
use serde::{Deserialize, Serialize};
use specta::Type;

// Paste exact structs: Hymn, HymnWriteInput, Album
// Keep all derives exactly as-is
```

- [ ] **Step 3: Create remaining domain model files**

Follow the same pattern:
- `bible.rs` — `BibleVersion`, `Book`, `Verse`, `BibleSearchResult`
- `slides.rs` — `Presentation`, `Slide`, `SlideContent`, `SlideContentFlat`, all related types
- `online_videos.rs` — `OnlineVideoChannel`, `OnlineVideoPlaylist`, `OnlineVideo`, `AddPlaylistInput`, YouTube API result types
- `display.rs` — `OverlayState`, `SlideContext`, `MonitorConfig`, `MonitorInfo`
- `collections.rs` — `Collection`, `CollectionSong`, `CollectionWithSongs`, `CollectionSearchResult`, `CollectionHymn`, `CollectionSongSyncStatus`
- `schedules.rs` — all `Schedule*` structs and input types
- `content_sync.rs` — `ContentSyncState`, `ContentSyncEntity`, `ContentSyncRun`, `ContentSyncPlan`, `ContentSyncProgress`, `ContentSyncReport`, all related enums

- [ ] **Step 4: Create `src-tauri/src/db/models/mod.rs`**

```rust
// src-tauri/src/db/models/mod.rs
pub mod bible;
pub mod collections;
pub mod content_sync;
pub mod display;
pub mod music;
pub mod online_videos;
pub mod schedules;
pub mod slides;

// Re-export everything so all existing `use crate::db::models::Foo` remain valid
pub use bible::*;
pub use collections::*;
pub use content_sync::*;
pub use display::*;
pub use music::*;
pub use online_videos::*;
pub use schedules::*;
pub use slides::*;
```

- [ ] **Step 5: Delete the old file and rename**

```bash
# The old models.rs must be removed; models/mod.rs takes its place
rm src-tauri/src/db/models.rs
```

- [ ] **Step 6: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -50
```

Expected: **0 errors**. Fix any `use super::` cross-references if structs from different modules reference each other.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/db/models/
git rm src-tauri/src/db/models.rs
git commit -m "refactor: split db/models.rs into domain modules under db/models/"
```

---

## Track C — Rust DB Queries Split

### Task C-1: Split `src-tauri/src/db/queries/music.rs` into three files

1365 lines with three distinct concerns: app-DB CRUD, lyrics sync, content-DB CDN queries.

**Files:**
- Create: `src-tauri/src/db/queries/music_app.rs` — hymn/album CRUD against the local app DB
- Create: `src-tauri/src/db/queries/music_sync.rs` — lyrics sync point parsing and timeline helpers
- Create: `src-tauri/src/db/queries/music_content_db.rs` — all queries against the CDN content DB
- Modify: `src-tauri/src/db/queries/music.rs` — keep only `pub use` re-exports from the three new files

- [ ] **Step 1: Create `src-tauri/src/db/queries/music_app.rs`**

Move: `search_hymns`, `search_all_hymns`, `get_hymn_by_id`, `get_albums`, `get_hymns_by_album`, `insert_hymn`, `update_hymn`, `delete_hymn`, plus any private helpers they use.

```rust
// src-tauri/src/db/queries/music_app.rs
use rusqlite::{Connection, Result};
use crate::db::models::*;

// Paste exact functions
```

- [ ] **Step 2: Create `src-tauri/src/db/queries/music_sync.rs`**

Move: `parse_time_to_ms`, `resolve_sync_timeline`, `parse_lyrics_sync_points`, `get_sync_points`, `save_sync_points`.

- [ ] **Step 3: Create `src-tauri/src/db/queries/music_content_db.rs`**

Move: `get_hymns_from_content_db`, `search_hymns_content_db`, `get_collections_from_content_db`, `get_collection_hymns_from_content_db`, `get_albums_from_content_db`, `get_hymns_by_album_from_content_db`.

- [ ] **Step 4: Replace `music.rs` with re-exports**

```rust
// src-tauri/src/db/queries/music.rs
pub mod music_app;
pub mod music_sync;
pub mod music_content_db;

pub use music_app::*;
pub use music_sync::*;
pub use music_content_db::*;
```

- [ ] **Step 5: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -50
```

Expected: **0 errors**.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/db/queries/music*.rs
git commit -m "refactor: split db/queries/music.rs into app/sync/content-db modules"
```

---

### Task C-2: Extract schedule generation algorithm from `schedules.rs`

1932 lines. The schedule generation algorithm (`generate_schedule_month` + private helpers) is a complex, self-contained concern.

**Files:**
- Create: `src-tauri/src/db/queries/schedules_generator.rs` — generation algorithm + supporting types
- Modify: `src-tauri/src/db/queries/schedules.rs` — `mod schedules_generator; use schedules_generator::*;`, remove moved code

- [ ] **Step 1: Identify all generation-specific code in `schedules.rs`**

Read the file and find: `generate_schedule_month`, `next_assignment_member_ids`, `maybe_shuffle_member_ids`, `are_consecutive_service_dates`, `GenerationTarget`, `DepartmentGenerationState`, and any private helper types they use.

- [ ] **Step 2: Create `src-tauri/src/db/queries/schedules_generator.rs`**

```rust
// src-tauri/src/db/queries/schedules_generator.rs
use rusqlite::Connection;
use crate::db::models::*;
use crate::error::AppError;

// Paste generation algorithm and private helper structs/functions here
// Make pub any items that schedules.rs calls directly
```

- [ ] **Step 3: Declare module in `schedules.rs` and remove moved code**

At the top of `schedules.rs`:

```rust
mod schedules_generator;
use schedules_generator::generate_schedule_month;
```

Remove the moved functions from `schedules.rs`.

- [ ] **Step 4: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -50
```

Expected: **0 errors**.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries/schedules.rs src-tauri/src/db/queries/schedules_generator.rs
git commit -m "refactor: extract schedule generation algorithm into schedules_generator.rs"
```

---

## Track D — Rust Commands Split (`commands/utility.rs`)

### Task D-1: Split `src-tauri/src/commands/utility.rs` into focused command files

582 lines of heterogeneous commands: media integrity, text tools, video copy, media path resolution.

**Files:**
- Create: `src-tauri/src/commands/media_integrity.rs` — `scan_media_integrity`, `delete_excess_media`
- Create: `src-tauri/src/commands/text_tools.rs` — `run_lottery`, `format_text`, private text helpers
- Create: `src-tauri/src/commands/video_copy.rs` — `copy_video_to_media`, `do_copy_video_work`, `copy_image_to_media`, `ensure_supported_cover_image`
- Modify: `src-tauri/src/commands/utility.rs` — keep only `open_media_folder`, `resolve_media_path`, `get_video_metadata` + re-export from new files OR keep as thin router

> **Important:** All `#[tauri::command]` functions must remain registered in `lib.rs` under `tauri_specta::collect_commands!`. Moving the function to a new file is fine — just ensure `lib.rs` imports the new module path. Check current module declarations in `lib.rs` before committing.

- [ ] **Step 1: Read `src-tauri/src/commands/utility.rs` and `src-tauri/src/lib.rs`**

Note which commands from `utility.rs` are registered in `lib.rs`'s `collect_commands!`. Note how `utility` module is declared (likely `mod utility;` in `commands/mod.rs` or `lib.rs`).

- [ ] **Step 2: Create `src-tauri/src/commands/media_integrity.rs`**

```rust
// src-tauri/src/commands/media_integrity.rs
use tauri::State;
use crate::state::AppState;
use crate::error::AppError;

#[tauri::command]
pub async fn scan_media_integrity(/* ... */) -> Result</* ... */, AppError> {
    // exact copy from utility.rs
}

#[tauri::command]
pub async fn delete_excess_media(/* ... */) -> Result</* ... */, AppError> {
    // exact copy from utility.rs
}
```

- [ ] **Step 3: Create `src-tauri/src/commands/text_tools.rs`**

Move: `run_lottery`, `format_text`, `sanitize_lottery_names`, `to_title_case`, `to_sentence_case`.

- [ ] **Step 4: Create `src-tauri/src/commands/video_copy.rs`**

Move: `copy_video_to_media`, `do_copy_video_work`, `copy_image_to_media`, `ensure_supported_cover_image`.

- [ ] **Step 5: Declare new modules in `commands/mod.rs` or `lib.rs`**

Find where `mod utility;` is declared and add:

```rust
pub mod media_integrity;
pub mod text_tools;
pub mod video_copy;
```

- [ ] **Step 6: Update `tauri_specta::collect_commands!` in `lib.rs`**

The moved commands must still be listed. Update import paths if needed. Example: if `scan_media_integrity` moved to `commands::media_integrity`, add `commands::media_integrity::scan_media_integrity` to the commands list.

Verify the exact call pattern in `lib.rs`:
```bash
grep -n "collect_commands" src-tauri/src/lib.rs | head -5
```

- [ ] **Step 7: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -50
```

Expected: **0 errors**.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/media_integrity.rs src-tauri/src/commands/text_tools.rs \
        src-tauri/src/commands/video_copy.rs src-tauri/src/commands/utility.rs \
        src-tauri/src/lib.rs
git commit -m "refactor: split commands/utility.rs into focused command modules"
```

---

## Track E — Frontend UI Component Extraction

### Task E-1: Extract form sub-components from `add-item-modal.tsx`

528 lines. Eight named form sub-components already exist inline — extract them to a dedicated directory.

**Files:**
- Create: `src/components/services/add-item-forms/hymn-form.tsx`
- Create: `src/components/services/add-item-forms/bible-form.tsx`
- Create: `src/components/services/add-item-forms/presentation-form.tsx`
- Create: `src/components/services/add-item-forms/annotation-form.tsx`
- Create: `src/components/services/add-item-forms/url-form.tsx`
- Create: `src/components/services/add-item-forms/file-form.tsx`
- Create: `src/components/services/add-item-forms/scheduled-category-form.tsx`
- Create: `src/components/services/add-item-forms/online-video-form.tsx`
- Create: `src/components/services/add-item-forms/index.ts` — barrel export
- Modify: `src/components/services/add-item-modal.tsx` — import from `./add-item-forms`

- [ ] **Step 1: Create the `add-item-forms/` directory and extract `BibleForm`**

`BibleForm` is the most complex (~148 lines). Extract it first to validate the pattern:

```tsx
// src/components/services/add-item-forms/bible-form.tsx
import { /* exact imports from add-item-modal.tsx */ } from "...";

// Props interface (extract from inline usage in add-item-modal.tsx)
interface BibleFormProps {
  onSubmit: (item: ServiceItemInput) => void;
}

export function BibleForm({ onSubmit }: BibleFormProps) {
  // exact copy of function body
}
```

- [ ] **Step 2: Extract remaining 7 form components**

Follow the same pattern for each. Keep props interfaces co-located in each file.

- [ ] **Step 3: Create barrel `add-item-forms/index.ts`**

```typescript
export * from "./hymn-form";
export * from "./bible-form";
export * from "./presentation-form";
export * from "./annotation-form";
export * from "./url-form";
export * from "./file-form";
export * from "./scheduled-category-form";
export * from "./online-video-form";
```

- [ ] **Step 4: Update `add-item-modal.tsx`**

Replace inline form function definitions with imports:

```tsx
import {
  HymnForm, BibleForm, PresentationForm, AnnotationForm,
  UrlForm, FileForm, ScheduledCategoryForm, OnlineVideoForm,
} from "./add-item-forms";
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: **0 errors**.

- [ ] **Step 6: Commit**

```bash
git add src/components/services/add-item-modal.tsx src/components/services/add-item-forms/
git commit -m "refactor: extract add-item-modal form sub-components into add-item-forms/ directory"
```

---

### Task E-2: Extract field components from `slide-editor.tsx`

481 lines. Six named field-group sub-components already exist inline — extract to `fields/` directory.

**Files:**
- Create: `src/components/slides/fields/cover-fields.tsx`
- Create: `src/components/slides/fields/lyrics-fields.tsx`
- Create: `src/components/slides/fields/text-fields.tsx`
- Create: `src/components/slides/fields/image-fields.tsx`
- Create: `src/components/slides/fields/video-fields.tsx`
- Create: `src/components/slides/fields/online-video-fields.tsx`
- Create: `src/components/slides/fields/toggle-field.tsx`
- Create: `src/components/slides/fields/index.ts`
- Modify: `src/components/slides/slide-editor.tsx`

- [ ] **Step 1: Extract each field component**

For each field group, create a corresponding file in `src/components/slides/fields/`. Maintain exact function signatures and props types.

Example:

```tsx
// src/components/slides/fields/cover-fields.tsx
import { /* required imports */ } from "...";

interface CoverFieldsProps {
  // derive from current usage
}

export function CoverFields(props: CoverFieldsProps) {
  // exact copy
}
```

- [ ] **Step 2: Create barrel `fields/index.ts`**

```typescript
export * from "./cover-fields";
export * from "./lyrics-fields";
export * from "./text-fields";
export * from "./image-fields";
export * from "./video-fields";
export * from "./online-video-fields";
export * from "./toggle-field";
```

- [ ] **Step 3: Update `slide-editor.tsx`**

Replace inline definitions with:

```tsx
import { CoverFields, LyricsFields, TextFields, ImageFields, VideoFields, OnlineVideoFields, ToggleField } from "./fields";
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: **0 errors**.

- [ ] **Step 5: Commit**

```bash
git add src/components/slides/slide-editor.tsx src/components/slides/fields/
git commit -m "refactor: extract slide-editor field sub-components into fields/ directory"
```

---

## Track F — Rust Video Metadata Split

### Task F-1: Split `src-tauri/src/video/metadata.rs` into parser modules

557 lines with two completely independent binary parsers (MP4 and WebM).

**Files:**
- Create: `src-tauri/src/video/mp4_parser.rs` — `parse_mp4`, `parse_mp4_boxes`, `parse_mvhd`, `parse_mdhd`, `parse_tkhd`
- Create: `src-tauri/src/video/webm_parser.rs` — `parse_webm`, `parse_webm_elements`, EBML helpers
- Create: `src-tauri/src/video/io_helpers.rs` — `read_u8`, `read_u32_be`, `read_u64_be`, `skip_exact`
- Modify: `src-tauri/src/video/metadata.rs` — import from new modules, keep dispatch function `parse_video_metadata`

- [ ] **Step 1: Create `src-tauri/src/video/io_helpers.rs`**

```rust
// src-tauri/src/video/io_helpers.rs
use std::io::{self, Read, Seek};

pub fn read_u8(r: &mut impl Read) -> io::Result<u8> { /* exact copy */ }
pub fn read_u32_be(r: &mut impl Read) -> io::Result<u32> { /* exact copy */ }
pub fn read_u64_be(r: &mut impl Read) -> io::Result<u64> { /* exact copy */ }
pub fn skip_exact(r: &mut (impl Read + Seek), n: u64) -> io::Result<()> { /* exact copy */ }
```

- [ ] **Step 2: Create `src-tauri/src/video/mp4_parser.rs`**

Move all `parse_mp4*` and `parse_mvhd/mdhd/tkhd` functions. Import from `super::io_helpers`.

- [ ] **Step 3: Create `src-tauri/src/video/webm_parser.rs`**

Move all `parse_webm*` and EBML helper functions. Import from `super::io_helpers`.

- [ ] **Step 4: Update `src-tauri/src/video/mod.rs` or `metadata.rs`**

Add module declarations:

```rust
mod io_helpers;
mod mp4_parser;
mod webm_parser;

use mp4_parser::parse_mp4;
use webm_parser::parse_webm;
```

Remove moved code from `metadata.rs`.

- [ ] **Step 5: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | head -50
```

Expected: **0 errors**.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/video/
git commit -m "refactor: split video/metadata.rs into mp4_parser, webm_parser, io_helpers"
```

---

## Execution Order & Parallelism

All 8 tasks above are **fully independent** — they touch disjoint files. They can be dispatched to parallel subagents.

Recommended parallel dispatch groups:

| Group | Tasks | Dependency |
|-------|-------|------------|
| Group 1 (parallel) | A-1, B-1, C-1, D-1 | None — start immediately |
| Group 2 (parallel) | A-2, C-2, E-1, E-2, F-1 | None — start immediately |

After all tasks complete, run a final full build verification:

```bash
npx tsc --noEmit && cargo build --manifest-path src-tauri/Cargo.toml
```

---

## Final Verification Checklist

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` — 0 errors
- [ ] `pnpm lint:i18n` — 0 missing keys (no i18n changes expected)
- [ ] No function was modified — only moved
- [ ] No import paths in application code were changed (all re-exports in place)
- [ ] `src/lib/bindings.ts` was NOT edited
- [ ] All `#[tauri::command]` functions remain in `collect_commands!` in `lib.rs`
