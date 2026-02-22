# Album-Based Import: API Albums → Collections with Slide Backgrounds

**Date:** 2026-02-22

## Summary

Adapt the legacy fetch importer to group musics/hymnals by albums fetched from the LouvorJA API. Each album becomes a **Collection** (coletânea) with a downloaded cover, and each album's musics become **Hymns** linked to that collection via a new `collection_hymns` join table. Per-music `url_image` is downloaded as `cover_path` and used as `backgroundImage` on lyrics slides during projection. A "Restore Default" button on hymn detail pages re-fetches data from the API. File-based collections (`.slja`/`.pptx`) coexist on the same Collections page under a "Custom Collections" tab.

## Context

The current legacy fetch wizard (`src-tauri/src/legacy_fetch/mod.rs` + `src-tauri/src/commands/legacy_fetch.rs`) has two data source options:

1. **`/{lang}/hymnal`** — Official hymnal collection → maps to the "Hinário" tab
2. **`/{lang}/musics`** — All musics (used to fetch individual music details and lyrics)

Critical gaps:
- The `fetch_albums()` function exists but is `#[allow(dead_code)]` and **never called**.
- The `album` field is set to `Option::<String>::None` during import — albums are unused.
- The `/albums` endpoint is **paginated** (`PaginatedResponse`), but `fetch_albums()` treats it as `Vec<ApiAlbum>` — this is a bug.
- Per-music `url_image` is available from the API but not used as slide backgrounds.
- Collections (Phase 11) were designed for file-based songs only — no hymn linking.

## Architecture Decisions

1. **New `collection_hymns` join table** — Links `collections.id` → `hymns.id`. Keeps clean separation from file-based `collection_songs`. Both tables contribute to `song_count` displayed in the Collections list.

2. **`source_type` column on `collections`** — Values: `'file'` (slja/pptx) or `'api'` (album-imported). Used by the UI to distinguish collection types and render appropriate detail views. Default: `'file'` (backward compatible).

3. **`api_album_id` on `collections`** — Stores the original API album ID for de-duplication on re-import. Prevents duplicate collections when the import is run multiple times.

4. **`api_music_id` on `hymns`** — Stores the original API music ID. Enables:
   - Cross-album dedup (same music can appear in multiple albums)
   - "Restore Default" feature (re-fetch from `/{lang}/musics/{id}`)

5. **Album import flow**:
   1. Fetch all albums via `/{lang}/albums` (paginated, ~75 albums across 5 pages)
   2. For each album, fetch detail via `/{lang}/albums/{id}` (returns musics with metadata but no lyrics)
   3. For each music in the album, fetch lyrics via `/{lang}/musics/{id}`
   4. Download album `url_image` as collection `cover_path`
   5. Download per-music `url_image` as hymn `cover_path`
   6. Create Collection per album, link hymns via `collection_hymns`

6. **Collections UI split**: Two tabs on `/collections` — "Albums" (API-imported) and "Custom Collections" (file-based). Album collection detail shows hymn list; file-based detail shows presentation-backed song list.

7. **Slide background from `cover_path`**: `hymnToSlides()` passes `cover_path` as `backgroundImage` on each lyrics/cover slide. User can override later; "Restore Default" re-fetches from API.

## API Endpoints Reference

Source: [louvorja/api](https://github.com/louvorja/api) (Lumen PHP)

| Endpoint | Returns | Notes |
|----------|---------|-------|
| `GET /{lang}/albums?page=N` | `PaginatedResponse<ApiAlbum>` | Paginated (15 per page, ~5 pages for pt). Each album has `id_album`, `name`, `color`, `url_image`. No nested musics. |
| `GET /{lang}/albums/{id}` | `SingleResponse<ApiAlbum>` | Album detail with nested `musics[]`. Each music has `id_music`, `track`, `name`, `url_image`, `url_music`, `url_instrumental_music`. No lyrics. |
| `GET /{lang}/musics/{id}` | `SingleResponse<ApiMusic>` | Music detail with `lyrics[]` array. Each lyric has `lyric`, `order`, `time`, `instrumental_time`. |
| `GET /{lang}/hymnal?page=N` | `PaginatedResponse<ApiMusic>` | Official hymnal. Separate from albums. Stays as-is for "Hinário" tab. |

**Key insight:** Album detail returns musics **without lyrics**. Must still call `/musics/{id}` per music to get lyrics and sync timing data.

## Data Model Changes

### New table: `collection_hymns` (migration v16)

```sql
CREATE TABLE IF NOT EXISTS collection_hymns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    hymn_id INTEGER NOT NULL REFERENCES hymns(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(collection_id, hymn_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_hymns_collection ON collection_hymns(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_hymns_hymn ON collection_hymns(hymn_id);
```

### Altered table: `collections`

```sql
ALTER TABLE collections ADD COLUMN source_type TEXT NOT NULL DEFAULT 'file';
ALTER TABLE collections ADD COLUMN api_album_id INTEGER;
```

### Altered table: `hymns`

```sql
ALTER TABLE hymns ADD COLUMN api_music_id INTEGER;
```

### New Rust models

```rust
pub struct CollectionHymn {
    pub id: i64,
    pub collection_id: i64,
    pub hymn_id: i64,
    pub item_order: i64,
    pub created_at: String,
}

pub struct CollectionWithHymns {
    pub collection: Collection,
    pub hymns: Vec<Hymn>,
}
```

### Updated Rust models

- `Collection`: add `source_type: String`, `api_album_id: Option<i64>`
- `Hymn`: add `api_music_id: Option<i64>`

## File-by-File Impact

### Backend (Rust)

| File | Change |
|------|--------|
| `src-tauri/src/db/migrations.rs` | Add `migrate_v16`: create `collection_hymns`, add `source_type`/`api_album_id` to `collections`, add `api_music_id` to `hymns` |
| `src-tauri/src/db/models.rs` | Add `CollectionHymn`, `CollectionWithHymns`. Update `Collection` (source_type, api_album_id), `Hymn` (api_music_id) |
| `src-tauri/src/db/queries/collections.rs` | Add `insert_collection_hymn`, `get_collection_hymns`, `get_collection_with_hymns`, `delete_collection_hymn`, `find_collection_by_api_album_id`. Update `insert_collection` signature (source_type, api_album_id). Update `get_collections`/`get_collection_by_id` to include source_type/api_album_id and count collection_hymns in song_count |
| `src-tauri/src/db/queries/music.rs` | Update `map_hymn_row` to include `api_music_id`. Add `find_hymn_by_api_music_id` |
| `src-tauri/src/legacy_fetch/mod.rs` | Remove `#[allow(dead_code)]` from `ApiAlbum`/`ApiCategory`. Fix `fetch_albums` to handle pagination. Add `fetch_album_detail`. Add `subtitle`/`order`/`image_version` fields to `ApiAlbum`. Update `import_music_to_db` to accept `album_name`, `api_music_id` params and return hymn ID |
| `src-tauri/src/commands/legacy_fetch.rs` | Add `include_albums` to `LegacyFetchOptions`. Implement album→collection import flow in `run_legacy_fetch_background`. Add `albums_created`/`collection_hymns_linked` to report. Add `restore_hymn_from_api` command |
| `src-tauri/src/commands/collections.rs` | Add `get_collection_hymns`, `add_hymn_to_collection`, `remove_hymn_from_collection` commands |
| `src-tauri/src/lib.rs` | Register new commands in `generate_handler![]` |

### Frontend (TypeScript/React)

| File | Change |
|------|--------|
| `src/types/legacy-fetch.ts` | Add `includeAlbums` to `LegacyFetchOptions`. Add `albumsCreated`/`collectionHymnsLinked` to `LegacyFetchReport` |
| `src/types/hymn.ts` | Add `api_music_id: number \| null` to `Hymn` and `HymnInput` |
| `src/types/collection.ts` | Add `source_type: string`, `api_album_id: number \| null` to `Collection`. Add `CollectionHymn` type |
| `src/lib/tauri.ts` | Add wrappers: `getCollectionHymns`, `addHymnToCollection`, `removeHymnFromCollection`, `restoreHymnFromApi` |
| `src/lib/queries.ts` | Add hooks: `useCollectionHymns`, `useAddHymnToCollection`, `useRemoveHymnFromCollection`, `useRestoreHymnFromApi` |
| `src/routes/hymnal/$hymnId.tsx` | Update `hymnToSlides` to accept `cover_path` and set `backgroundImage` on lyrics/cover slides. Add "Restore from API" button when `api_music_id` is set |
| `src/routes/collections/index.tsx` | Add two tabs: "Albums" (source_type='api') and "Custom Collections" (source_type='file'). Filter collections by source_type |
| `src/routes/collections/$collectionId.tsx` | When `source_type === 'api'`, render hymn list from `getCollectionHymns` instead of file-based song list. Each hymn card links to `/hymnal/{hymnId}` |
| `src/components/migration/legacy-fetch-wizard.tsx` | Add "Import Albums as Collections" toggle option. Show album stats in report |
| `src/locales/en.json` | Add i18n keys for album import, collection tabs, restore button |
| `src/locales/pt.json` | Add i18n keys (Portuguese) |
| `src/locales/es.json` | Add i18n keys (Spanish) |

## Execution Batches

### Batch 1 — Schema + Models

- Implement `migrate_v16` in `migrations.rs`: `collection_hymns` table, new columns on `collections` and `hymns`
- Update `models.rs`: add `CollectionHymn`, `CollectionWithHymns`, extend `Collection` and `Hymn`
- Update `map_collection_row` and `map_hymn_row` to read new columns

### Batch 2 — Collection-Hymn Queries

- Add to `queries/collections.rs`:
  - `insert_collection_hymn(conn, collection_id, hymn_id, item_order) -> Result<i64>`
  - `get_collection_hymns(conn, collection_id) -> Result<Vec<Hymn>>` (JOIN with hymns)
  - `get_collection_with_hymns(conn, id) -> Result<CollectionWithHymns>`
  - `delete_collection_hymn(conn, collection_id, hymn_id)`
  - `find_collection_by_api_album_id(conn, api_album_id) -> Option<i64>`
- Update `insert_collection` to accept `source_type` and `api_album_id`
- Update `get_collections` and `get_collection_by_id` to include `source_type`, `api_album_id`, and count both `collection_songs` and `collection_hymns` in `song_count`
- Add to `queries/music.rs`: `find_hymn_by_api_music_id(conn, api_music_id) -> Option<i64>`

### Batch 3 — Fix fetch_albums + Add Album Detail Fetcher

- Remove `#[allow(dead_code)]` from `ApiAlbum`, `ApiCategory` in `legacy_fetch/mod.rs`
- Fix `fetch_albums()` to handle `PaginatedResponse<ApiAlbum>` (currently broken — treats response as `Vec<ApiAlbum>`)
- Add `fetch_album_detail(lang, album_id) -> Result<ApiAlbum>` — calls `/{lang}/albums/{id}`, returns `SingleResponse<ApiAlbum>` with nested musics
- Add missing fields to `ApiAlbum`: `subtitle`, `order`, `image_version`
- Update `import_music_to_db` to accept `album_name: Option<&str>`, `api_music_id: Option<i64>` and return `Result<(bool, Option<i64>)>` (imported flag + hymn_id)

### Batch 4 — Album Import Flow in Background Fetch

- Add `include_albums: bool` to `LegacyFetchOptions`
- Add `albums_created: u64`, `collection_hymns_linked: u64` to `LegacyFetchReport`
- In `run_legacy_fetch_background`, when `include_albums` is true:
  1. Fetch all albums (paginated) → emit progress
  2. For each album:
     - Check `find_collection_by_api_album_id` to skip existing
     - Download album `url_image` as collection cover
     - Create Collection (name, cover_path, source_type='api', api_album_id)
  3. For each music in each album:
     - Check `find_hymn_by_api_music_id` to skip existing
     - Fetch lyrics via `fetch_music_detail`
     - Download per-music `url_image` as hymn `cover_path` (+ audio if enabled)
     - Import hymn with `import_music_to_db` (album_name, api_music_id)
     - Link to collection via `insert_collection_hymn`
  4. Update progress per-album and per-music
- Ensure existing hymnal/musics fetch path is unaffected

### Batch 5 — Tauri Commands + Registration

- Add to `commands/collections.rs`: `get_collection_hymns`, `add_hymn_to_collection`, `remove_hymn_from_collection`
- Add to `commands/legacy_fetch.rs`: `restore_hymn_from_api` — re-fetches `/{lang}/musics/{api_music_id}`, re-downloads `url_image`, updates hymn
- Register all new commands in `lib.rs` `generate_handler![]`

### Batch 6 — Frontend Types + Wrappers + Hooks

- Update `types/legacy-fetch.ts`: add `includeAlbums`, `albumsCreated`, `collectionHymnsLinked`
- Update `types/hymn.ts`: add `api_music_id`
- Update `types/collection.ts`: add `source_type`, `api_album_id`, `CollectionHymn`
- Add Tauri wrappers in `lib/tauri.ts`
- Add TanStack Query hooks in `lib/queries.ts`

### Batch 7 — Slide Background from cover_path

- Update `hymnToSlides()` in `routes/hymnal/$hymnId.tsx`:
  - Accept `cover_path: string | null` parameter
  - Set `backgroundImage: cover_path` on each lyrics slide and cover slide when available
- Ensure `SlideContent` type already supports `backgroundImage` via `StyledSlideMetadata` (confirmed — no type changes needed)

### Batch 8 — Hymn Detail "Restore from API" Button

- In `routes/hymnal/$hymnId.tsx`:
  - Show "Restore from API" button when `hymn.api_music_id` is set
  - On click: call `restoreHymnFromApi({ hymnId, apiMusicId, language })`
  - Invalidate hymn query cache on success
  - Show success toast

### Batch 9 — Legacy Fetch Wizard UI Update

- In `legacy-fetch-wizard.tsx`:
  - Add "Import Albums as Collections" (`includeAlbums`) toggle option (default: `true`)
  - Add hint text explaining the feature
- In `LegacyFetchProgressCard`:
  - Show `albumsCreated` and `collectionHymnsLinked` in report summary

### Batch 10 — Collections Page: Albums + Custom Collections Tabs

- In `routes/collections/index.tsx`:
  - Add tab state: `"albums" | "custom"` (default: `"albums"`)
  - "Albums" tab: filter `collections` by `source_type === 'api'`
  - "Custom Collections" tab: filter by `source_type === 'file'`
  - Keep create/import UI only in "Custom Collections" tab
  - Album collections show album cover and hymn count

### Batch 11 — Collection Detail: Album vs File View

- In `routes/collections/$collectionId.tsx`:
  - When `collection.source_type === 'api'`:
    - Fetch hymns via `useCollectionHymns(collectionId)`
    - Render hymn list with cover, title, track number
    - Each card links to `/hymnal/{hymnId}`
    - No file-import/sync UI
  - When `collection.source_type === 'file'`:
    - Keep existing presentation-backed song list behavior

### Batch 12 — i18n Keys

- Add keys to all 3 locale files:
  - `collections.tabAlbums`, `collections.tabCustom`
  - `settings.legacyFetch.optionAlbums`, `settings.legacyFetch.optionAlbumsHint`
  - `settings.legacyFetch.reportAlbumsCreated`, `settings.legacyFetch.reportCollectionHymnsLinked`
  - `hymn.restoreFromApi`, `hymn.restoreFromApiSuccess`, `hymn.restoreFromApiError`

### Batch 13 — Validation + Closure

- `cargo build --manifest-path src-tauri/Cargo.toml` — Rust compiles
- `pnpm vite build && npx tsc --noEmit` — Frontend compiles
- Manual smoke test:
  1. Open Settings → Legacy Fetch → enable "Import Albums" → start fetch
  2. Verify albums appear as Collections with covers
  3. Verify hymns within albums have `cover_path` and `api_music_id`
  4. Open collection → verify hymn list renders
  5. Open hymn → verify lyrics slides have `backgroundImage`
  6. Click "Restore from API" → verify image re-downloaded
  7. Verify `/hymnal` import still works independently (Hinário tab)
  8. Verify re-running album import doesn't create duplicates
  9. Verify "Custom Collections" tab still shows file-based collections
  10. Verify projection renders background images on lyrics slides

## De-Duplication Strategy

| Entity | Dedup Key | Behavior |
|--------|-----------|----------|
| Collection (album) | `api_album_id` | Skip creation if `find_collection_by_api_album_id` returns existing ID |
| Hymn (music) | `api_music_id` | Skip insert if `find_hymn_by_api_music_id` returns existing ID (still link to collection) |
| Collection↔Hymn link | `UNIQUE(collection_id, hymn_id)` | INSERT OR IGNORE — same hymn in multiple albums creates multiple links, but no duplicates per pair |

When `replace_existing` is true and a hymn already exists (by `api_music_id`), update its fields (lyrics, cover, audio) but don't duplicate the row.

## Progress Events

The album import enriches existing progress events with album-specific steps:

```
Step: "fetching_albums" → Fetching album list from server...
Step: "importing_album" → Importing album "Nosso Sol é Jesus" (1 of 75)...
Step: "importing_album_music" → Importing hymn "Brilha Jesus" (2 of 6 in album)...
```

## Risks and Mitigations

1. **API rate limiting / slow responses**: Each album requires 1 detail call + N music detail calls for lyrics. For 75 albums with ~6 musics each = ~525 API calls.
   - Mitigation: Sequential processing with progress events. Cancel support via `cancel_flag`.

2. **Album cover URLs returning `.bmp` format**: Album covers from the API are `.bmp` files (large). Music images are `.jpg`.
   - Mitigation: Download as-is. The slide renderer doesn't care about format. Future optimization could convert to JPEG.

3. **Same music across multiple albums**: A song can appear in multiple album playlists on the API.
   - Mitigation: Dedup hymn by `api_music_id`, create multiple `collection_hymns` links.

4. **Existing collections have no `source_type`**: The `DEFAULT 'file'` ensures backward compatibility — all existing collections are treated as file-based.

## Dependencies

- Phase 11 (Hymn CRUD + Collections) — COMPLETE
- Existing `legacy_fetch` module with reqwest HTTP client
- Existing `collections` table and CRUD queries
- Existing `StyledSlideMetadata.backgroundImage` support in `SlideContent`
