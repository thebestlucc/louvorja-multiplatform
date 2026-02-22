# TASKS — Album-Based Import: API Albums → Collections

**Feature:** Album Import as Collections with Slide Backgrounds
**Date:** 2026-02-22
**Total Batches:** 13

---

## Execution Order

```
Batch 1  → Batch 2  → Batch 3  → Batch 4  → Batch 5
(Schema)   (Queries)  (Fetch)    (Import)   (Commands)
                                               ↓
                               Batch 6  → Batch 7  → Batch 8
                               (TS Types)  (Slide bg)  (Restore btn)
                                               ↓
                               Batch 9  → Batch 10 → Batch 11
                               (Wizard UI) (Coll page) (Detail page)
                                               ↓
                               Batch 12 → Batch 13
                               (i18n)     (Validate)
```

---

## Batch 1 — Schema + Models

**Goal:** Database schema and Rust structs ready for all new data.

### Task 1.1 — Migration v16
**File:** `src-tauri/src/db/migrations.rs`

- Add `migrate_v16()` function called from `run_migrations()`
- Create `collection_hymns` table with indexes
- `ALTER TABLE collections ADD COLUMN source_type TEXT NOT NULL DEFAULT 'file'`
- `ALTER TABLE collections ADD COLUMN api_album_id INTEGER`
- `ALTER TABLE hymns ADD COLUMN api_music_id INTEGER`
- Increment schema version check to 16

### Task 1.2 — Rust Models
**File:** `src-tauri/src/db/models.rs`

- Add `CollectionHymn` struct (id, collection_id, hymn_id, item_order, created_at) with `#[serde(rename_all = "camelCase")]`
- Add `CollectionWithHymns` struct (collection: Collection, hymns: Vec<Hymn>)
- Add `source_type: String` and `api_album_id: Option<i64>` to `Collection`
- Add `api_music_id: Option<i64>` to `Hymn`

### Task 1.3 — Row Mappers
**Files:** `src-tauri/src/db/queries/collections.rs`, `src-tauri/src/db/queries/music.rs`

- Update `map_collection_row` to read `source_type`, `api_album_id` columns
- Update `map_hymn_row` to read `api_music_id` column

---

## Batch 2 — Collection-Hymn Queries

**Goal:** All DB query functions for the new join table and updated collection queries.

### Task 2.1 — New join table queries
**File:** `src-tauri/src/db/queries/collections.rs`

- `insert_collection_hymn(conn, collection_id, hymn_id, item_order) -> Result<i64>` — use `INSERT OR IGNORE`
- `get_collection_hymns(conn, collection_id) -> Result<Vec<Hymn>>` — JOIN `collection_hymns` + `hymns`
- `get_collection_with_hymns(conn, id) -> Result<CollectionWithHymns>` — get collection + call `get_collection_hymns`
- `delete_collection_hymn(conn, collection_id, hymn_id) -> Result<()>`
- `find_collection_by_api_album_id(conn, api_album_id: i64) -> Option<i64>` — returns existing collection ID or None

### Task 2.2 — Update existing collection queries
**File:** `src-tauri/src/db/queries/collections.rs`

- `insert_collection`: add `source_type: &str`, `api_album_id: Option<i64>` params
- `get_collections`: include `source_type`, `api_album_id` in SELECT; update `song_count` to SUM both `collection_songs` and `collection_hymns` subqueries
- `get_collection_by_id`: same as `get_collections`

### Task 2.3 — Find hymn by API music ID
**File:** `src-tauri/src/db/queries/music.rs`

- `find_hymn_by_api_music_id(conn, api_music_id: i64) -> Option<i64>` — returns hymn row ID or None

---

## Batch 3 — Fix `fetch_albums` + Add Album Detail Fetcher

**Goal:** API fetch functions are correct and complete.

### Task 3.1 — Fix `fetch_albums` pagination bug
**File:** `src-tauri/src/legacy_fetch/mod.rs`

- Remove `#[allow(dead_code)]` from `ApiAlbum` and `ApiCategory`
- Fix `fetch_albums()` to deserialize as `PaginatedResponse<ApiAlbum>` (currently treats response as `Vec<ApiAlbum>`)
- Add pagination loop: fetch pages until `current_page >= last_page`
- Add missing `ApiAlbum` fields: `subtitle: Option<String>`, `order: Option<i64>`, `image_version: Option<String>`

### Task 3.2 — Add `fetch_album_detail`
**File:** `src-tauri/src/legacy_fetch/mod.rs`

- Add `fetch_album_detail(client, base_url, lang, album_id: i64) -> Result<ApiAlbum>`
- Calls `GET /{lang}/albums/{album_id}` → deserializes `SingleResponse<ApiAlbum>`
- Returns album with nested `musics: Vec<ApiMusic>` (no lyrics — those require separate calls)

### Task 3.3 — Update `import_music_to_db` signature
**File:** `src-tauri/src/legacy_fetch/mod.rs`

- Add params: `album_name: Option<&str>`, `api_music_id: Option<i64>`
- Return type: `Result<(bool, Option<i64>)>` — `(was_newly_imported, hymn_db_id)`
- When `api_music_id` is Some and hymn already exists (by `api_music_id`): if `replace_existing=true`, UPDATE; return `(false, Some(existing_id))`
- When newly created: return `(true, Some(new_id))`
- Store `api_music_id` in the hymn row

---

## Batch 4 — Album Import Flow in Background Fetch

**Goal:** Full album→collection import orchestrated in the background fetch command.

### Task 4.1 — Add `include_albums` to options and report
**File:** `src-tauri/src/commands/legacy_fetch.rs`

- Add `include_albums: bool` to `LegacyFetchOptions` struct
- Add `albums_created: u64`, `collection_hymns_linked: u64` to `LegacyFetchReport`

### Task 4.2 — Implement album import loop
**File:** `src-tauri/src/commands/legacy_fetch.rs`

When `options.include_albums` is true, after existing hymnal/musics fetch:

1. Emit step `fetching_albums` → call `fetch_albums()` (all pages) → collect all `ApiAlbum`s
2. For each album (emit `importing_album` with `n/total`):
   a. `find_collection_by_api_album_id` → skip creation if exists (still process musics for linking)
   b. Download `url_image` → save as collection `cover_path`
   c. `insert_collection(name, cover_path, source_type='api', api_album_id)` → get `collection_id`
   d. Increment `albums_created`
3. Call `fetch_album_detail(album_id)` → get nested musics list
4. For each music in album (emit `importing_album_music` with `n/m`):
   a. `find_hymn_by_api_music_id` → get existing hymn ID if any
   b. If not found (or `replace_existing`): `fetch_music_detail(music_id)` → download `url_image` → `import_music_to_db`
   c. `insert_collection_hymn(collection_id, hymn_id, track_order)` — INSERT OR IGNORE
   d. Increment `collection_hymns_linked`
5. Check `cancel_flag` between albums

### Task 4.3 — Ensure hymnal path is unaffected
**File:** `src-tauri/src/commands/legacy_fetch.rs`

- Confirm the existing `include_hymnal` / `include_musics` paths are not modified
- Add regression note in comment: "album import is additive; does not touch hymnal flow"

---

## Batch 5 — Tauri Commands + Registration

**Goal:** New backend commands wired and registered.

### Task 5.1 — Collection-hymn commands
**File:** `src-tauri/src/commands/collections.rs`

```rust
#[tauri::command]
pub fn get_collection_hymns(collection_id: i64, state: State<'_, AppState>) -> Result<Vec<Hymn>, AppError>

#[tauri::command]
pub fn add_hymn_to_collection(collection_id: i64, hymn_id: i64, item_order: i64, state: State<'_, AppState>) -> Result<i64, AppError>

#[tauri::command]
pub fn remove_hymn_from_collection(collection_id: i64, hymn_id: i64, state: State<'_, AppState>) -> Result<(), AppError>
```

### Task 5.2 — Restore hymn from API command
**File:** `src-tauri/src/commands/legacy_fetch.rs`

```rust
#[tauri::command]
pub async fn restore_hymn_from_api(hymn_id: i64, api_music_id: i64, language: String, state: State<'_, AppState>) -> Result<(), AppError>
```

- Re-fetches `/{language}/musics/{api_music_id}`
- Re-downloads `url_image` → updates hymn `cover_path`
- Updates lyrics, sync timings
- Does not alter `api_music_id` — stable identifier

### Task 5.3 — Register in lib.rs
**File:** `src-tauri/src/lib.rs`

Add to `generate_handler![]`:
- `get_collection_hymns`
- `add_hymn_to_collection`
- `remove_hymn_from_collection`
- `restore_hymn_from_api`

---

## Batch 6 — Frontend Types + Wrappers + Hooks

**Goal:** TypeScript layer fully typed and connected to new backend commands.

### Task 6.1 — Update TypeScript types
**Files:** `src/types/legacy-fetch.ts`, `src/types/hymn.ts`, `src/types/collection.ts`

- `LegacyFetchOptions`: add `includeAlbums: boolean`
- `LegacyFetchReport`: add `albumsCreated: number`, `collectionHymnsLinked: number`
- `Hymn` and `HymnInput`: add `apiMusicId: number | null`
- `Collection`: add `sourceType: string`, `apiAlbumId: number | null`
- Add `CollectionHymn` interface

### Task 6.2 — Tauri wrappers
**File:** `src/lib/tauri.ts`

```ts
export const getCollectionHymns = (collectionId: number): Promise<Hymn[]>
export const addHymnToCollection = (collectionId: number, hymnId: number, itemOrder: number): Promise<number>
export const removeHymnFromCollection = (collectionId: number, hymnId: number): Promise<void>
export const restoreHymnFromApi = (hymnId: number, apiMusicId: number, language: string): Promise<void>
```

### Task 6.3 — TanStack Query hooks
**File:** `src/lib/queries.ts`

- `useCollectionHymns(collectionId)` — `useQuery`
- `useAddHymnToCollection()` — `useMutation` + invalidate `["collection-hymns", collectionId]`
- `useRemoveHymnFromCollection()` — `useMutation` + invalidate
- `useRestoreHymnFromApi()` — `useMutation` + invalidate `["hymn", hymnId]`

---

## Batch 7 — Slide Background from `cover_path`

**Goal:** Hymn projection slides automatically use cover image as background.

### Task 7.1 — Update `hymnToSlides`
**File:** `src/routes/hymnal/$hymnId.tsx`

- Add `coverPath: string | null` parameter to `hymnToSlides(hymn, stanzas, coverPath)`
- When `coverPath` is non-null, set `backgroundImage: coverPath` on every `SlideContent` in the returned array (cover slide + all lyrics slides)
- No `SlideContent` type changes needed — `backgroundImage` already exists via `StyledSlideMetadata`
- Call `hymnToSlides(hymn, stanzas, hymn.coverPath ?? null)` at the call site

---

## Batch 8 — Hymn Detail "Restore from API" Button

**Goal:** Users can one-click restore API-imported hymn data.

### Task 8.1 — Restore button UI
**File:** `src/routes/hymnal/$hymnId.tsx`

- Show "Restore from API" button (use `RefreshCw` or similar icon) only when `hymn.apiMusicId != null`
- Placement: near existing action buttons (Cantado, Playback, etc.)
- On click: call `restoreHymnFromApi` mutation with `{ hymnId: hymn.id, apiMusicId: hymn.apiMusicId, language: i18n.language }`
- On success: show `toast.success(t('hymn.restoreFromApiSuccess'))`
- On error: show `toast.error(t('hymn.restoreFromApiError'))`
- Show loading state on button while mutation is in progress

---

## Batch 9 — Legacy Fetch Wizard UI Update

**Goal:** Wizard exposes album import option and shows stats in report.

### Task 9.1 — Add "Import Albums as Collections" toggle
**File:** `src/components/migration/legacy-fetch-wizard.tsx`

- Add `includeAlbums` boolean to wizard options state (default: `true`)
- Render as a checkbox/toggle with label `t('settings.legacyFetch.optionAlbums')`
- Add hint text below: `t('settings.legacyFetch.optionAlbumsHint')`
- Wire to `LegacyFetchOptions.includeAlbums` in the fetch call

### Task 9.2 — Show album stats in report card
**File:** `src/components/migration/legacy-fetch-wizard.tsx`

- In the `LegacyFetchProgressCard` (or equivalent report section):
  - Add row: `{t('settings.legacyFetch.reportAlbumsCreated')}: {report.albumsCreated}`
  - Add row: `{t('settings.legacyFetch.reportCollectionHymnsLinked')}: {report.collectionHymnsLinked}`

---

## Batch 10 — Collections Page: Albums + Custom Collections Tabs

**Goal:** Collections page splits API albums from file-based collections via tabs.

### Task 10.1 — Tab state and filtering
**File:** `src/routes/collections/index.tsx`

- Add `const [tab, setTab] = useState<"albums" | "custom">("albums")`
- Filter `collections` by `sourceType`:
  - albums tab: `c.sourceType === 'api'`
  - custom tab: `c.sourceType === 'file'`
- Render tab buttons using existing `cn()` + `border-b-2 border-primary` pattern (see CLAUDE.md tab pattern)
- Move create/import button to custom tab only

### Task 10.2 — Album collection card display
**File:** `src/routes/collections/index.tsx`

- Album collection cards: show `cover_path` as cover image, album name, hymn count from `song_count`
- Use `convertFileSrc(collection.coverPath)` for the image src

---

## Batch 11 — Collection Detail: Album vs File View

**Goal:** Collection detail page renders hymn list for API collections.

### Task 11.1 — Conditional rendering by `source_type`
**File:** `src/routes/collections/$collectionId.tsx`

When `collection.sourceType === 'api'`:
- Fetch hymns via `useCollectionHymns(collection.id)`
- Render hymn list: cover image, title, track number
- Each hymn card: `<Link to="/hymnal/$hymnId" params={{ hymnId: hymn.id }}>` (TanStack Router)
- No file import/sync UI

When `collection.sourceType === 'file'`:
- Keep existing presentation-backed song list behavior entirely unchanged

---

## Batch 12 — i18n Keys

**Goal:** All UI strings translated in all 3 locales.

### Task 12.1 — Add keys to all 3 locale files
**Files:** `src/locales/en.json`, `src/locales/pt.json`, `src/locales/es.json`

Keys to add (translate appropriately per locale):

```json
{
  "collections": {
    "tabAlbums": "Albums",
    "tabCustom": "Custom Collections"
  },
  "settings": {
    "legacyFetch": {
      "optionAlbums": "Import Albums as Collections",
      "optionAlbumsHint": "Downloads album covers and groups hymns by album",
      "reportAlbumsCreated": "Albums created",
      "reportCollectionHymnsLinked": "Hymns linked to albums"
    }
  },
  "hymn": {
    "restoreFromApi": "Restore from API",
    "restoreFromApiSuccess": "Hymn restored from API successfully",
    "restoreFromApiError": "Failed to restore hymn from API"
  }
}
```

---

## Batch 13 — Validation + Closure

**Goal:** Everything compiles and smoke tests pass.

### Task 13.1 — Rust compilation
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Verify: zero errors, zero warnings related to new code.

### Task 13.2 — Frontend compilation
```bash
pnpm vite build && npx tsc --noEmit
```
Verify: zero type errors.

### Task 13.3 — Manual smoke test checklist

1. [ ] Open Settings → Legacy Fetch → "Import Albums as Collections" toggle is visible and on by default
2. [ ] Start fetch with albums enabled → progress events show `fetching_albums`, `importing_album`, `importing_album_music`
3. [ ] After import: Collections page → "Albums" tab shows imported albums with covers and hymn counts
4. [ ] Open an album collection → hymn list renders with covers and track numbers
5. [ ] Click a hymn → navigates to `/hymnal/{hymnId}`
6. [ ] Project hymn → lyrics slides show `cover_path` as background image
7. [ ] Hymn detail shows "Restore from API" button when `api_music_id` is set
8. [ ] Click "Restore from API" → success toast appears, hymn data refreshed
9. [ ] Re-run import → zero new duplicate collections, zero new duplicate hymns
10. [ ] "Custom Collections" tab still shows file-based collections (unaffected)
11. [ ] Hymnal (Hinário) import still works independently

---

## Definition of Done

- [ ] All 13 batches complete with no compilation errors
- [ ] Smoke test checklist passes end-to-end
- [ ] No existing collections or hymns broken by migration
- [ ] `cargo build` clean
- [ ] `npx tsc --noEmit` clean
