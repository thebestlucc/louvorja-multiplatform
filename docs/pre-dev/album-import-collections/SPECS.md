# SPECS (TRD) — Album-Based Import: API Albums → Collections

**Feature:** Album Import as Collections with Slide Backgrounds
**Date:** 2026-02-22
**Status:** Ready for Implementation

---

## 1. Architecture Overview

```
LouvorJA API
  /{lang}/albums?page=N      → paginated album list
  /{lang}/albums/{id}        → album detail + nested musics (no lyrics)
  /{lang}/musics/{id}        → music detail with lyrics[]

Legacy Fetch Wizard (Rust)
  fetch_albums()             → PaginatedResponse<ApiAlbum> (FIXED)
  fetch_album_detail()       → SingleResponse<ApiAlbum> with musics[]
  fetch_music_detail()       → SingleResponse<ApiMusic> with lyrics[]
  import_music_to_db()       → upserts hymn, returns hymn_id
  run_legacy_fetch_background() → orchestrates full import flow

DB Layer
  collections (source_type, api_album_id)
  hymns (api_music_id, cover_path)
  collection_hymns (NEW join table)

Frontend
  /collections → tabs: Albums | Custom Collections
  /collections/{id} → hymn list (api) or song list (file)
  /hymnal/{id} → slide bg from cover_path + Restore button
```

---

## 2. Data Model Changes

### 2.1 Migration v16 (new)

```sql
-- New join table
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

-- Extend collections
ALTER TABLE collections ADD COLUMN source_type TEXT NOT NULL DEFAULT 'file';
ALTER TABLE collections ADD COLUMN api_album_id INTEGER;

-- Extend hymns
ALTER TABLE hymns ADD COLUMN api_music_id INTEGER;
```

### 2.2 Rust Models (`db/models.rs`)

**New structs:**
```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionHymn {
    pub id: i64,
    pub collection_id: i64,
    pub hymn_id: i64,
    pub item_order: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionWithHymns {
    pub collection: Collection,
    pub hymns: Vec<Hymn>,
}
```

**Updated `Collection`:** add `source_type: String`, `api_album_id: Option<i64>`
**Updated `Hymn`:** add `api_music_id: Option<i64>`

### 2.3 TypeScript Types

**`types/collection.ts`:**
```ts
export interface Collection {
  // ...existing fields
  sourceType: string;       // 'file' | 'api'
  apiAlbumId: number | null;
}

export interface CollectionHymn {
  id: number;
  collectionId: number;
  hymnId: number;
  itemOrder: number;
  createdAt: string;
}
```

**`types/hymn.ts`:**
```ts
export interface Hymn {
  // ...existing fields
  apiMusicId: number | null;
}
```

**`types/legacy-fetch.ts`:**
```ts
export interface LegacyFetchOptions {
  // ...existing fields
  includeAlbums: boolean;
}

export interface LegacyFetchReport {
  // ...existing fields
  albumsCreated: number;
  collectionHymnsLinked: number;
}
```

---

## 3. API Endpoints Reference

| Endpoint | Returns | Notes |
|----------|---------|-------|
| `GET /{lang}/albums?page=N` | `PaginatedResponse<ApiAlbum>` | ~15/page, ~5 pages for pt. Fields: `id_album`, `name`, `color`, `url_image` |
| `GET /{lang}/albums/{id}` | `SingleResponse<ApiAlbum>` | Detail with nested `musics[]`. Music has `id_music`, `track`, `name`, `url_image`, `url_music`, `url_instrumental_music`. No lyrics. |
| `GET /{lang}/musics/{id}` | `SingleResponse<ApiMusic>` | Full music with `lyrics[]` array. Each lyric: `lyric`, `order`, `time`, `instrumental_time`. |

**Bug to fix:** `fetch_albums()` currently deserializes response as `Vec<ApiAlbum>` instead of `PaginatedResponse<ApiAlbum>`.

---

## 4. De-Duplication Strategy

| Entity | Dedup Key | Behavior on re-import |
|--------|-----------|----------------------|
| Collection (album) | `api_album_id` | Skip creation; still process musics for linking |
| Hymn (music) | `api_music_id` | Skip insert; still link to collection via `collection_hymns` |
| Collection↔Hymn link | `UNIQUE(collection_id, hymn_id)` | `INSERT OR IGNORE` — silent no-op on duplicate |
| When `replace_existing=true` | `api_music_id` | UPDATE hymn fields (lyrics, cover, audio) — no new row |

---

## 5. Backend Changes

### 5.1 `db/queries/collections.rs`

New functions:
- `insert_collection_hymn(conn, collection_id, hymn_id, item_order) -> Result<i64>`
- `get_collection_hymns(conn, collection_id) -> Result<Vec<Hymn>>` — JOIN `collection_hymns` + `hymns`
- `get_collection_with_hymns(conn, id) -> Result<CollectionWithHymns>`
- `delete_collection_hymn(conn, collection_id, hymn_id) -> Result<()>`
- `find_collection_by_api_album_id(conn, api_album_id) -> Option<i64>`

Updated functions:
- `insert_collection` — add `source_type: &str`, `api_album_id: Option<i64>` params
- `get_collections` — include `source_type`, `api_album_id`; `song_count` sums both `collection_songs` and `collection_hymns`
- `get_collection_by_id` — same as above

### 5.2 `db/queries/music.rs`

New: `find_hymn_by_api_music_id(conn, api_music_id: i64) -> Option<i64>`
Updated: `map_hymn_row` reads `api_music_id` column

### 5.3 `legacy_fetch/mod.rs`

- Remove `#[allow(dead_code)]` from `ApiAlbum`, `ApiCategory`
- Fix `fetch_albums()` to use `PaginatedResponse<ApiAlbum>` with pagination loop
- Add `fetch_album_detail(client, base_url, lang, album_id) -> Result<ApiAlbum>`
- Add fields to `ApiAlbum`: `subtitle: Option<String>`, `order: Option<i64>`, `image_version: Option<String>`
- Update `import_music_to_db` signature:
  - Add `album_name: Option<&str>`, `api_music_id: Option<i64>`
  - Return `Result<(bool, Option<i64>)>` — (was_imported, hymn_id)

### 5.4 `commands/legacy_fetch.rs`

- Add `include_albums: bool` to `LegacyFetchOptions`
- Add album import flow in `run_legacy_fetch_background` (when `include_albums = true`):
  1. Fetch all albums (all pages) → emit `fetching_albums` step
  2. For each album: dedup check → download cover → create Collection → emit `importing_album`
  3. For each music in album: dedup check → fetch lyrics → download music image → import hymn → link → emit `importing_album_music`
- Add `restore_hymn_from_api` command: re-fetches `/{lang}/musics/{api_music_id}`, re-downloads `url_image`, updates hymn row

### 5.5 `commands/collections.rs`

New commands:
- `get_collection_hymns(collection_id: i64, state) -> Result<Vec<Hymn>>`
- `add_hymn_to_collection(collection_id: i64, hymn_id: i64, item_order: i64, state) -> Result<i64>`
- `remove_hymn_from_collection(collection_id: i64, hymn_id: i64, state) -> Result<()>`

### 5.6 `lib.rs`

Register in `generate_handler![]`:
- `get_collection_hymns`
- `add_hymn_to_collection`
- `remove_hymn_from_collection`
- `restore_hymn_from_api`

---

## 6. Frontend Changes

### 6.1 `lib/tauri.ts`

```ts
export const getCollectionHymns = (collectionId: number) =>
  invoke<Hymn[]>("get_collection_hymns", { collectionId });

export const addHymnToCollection = (collectionId: number, hymnId: number, itemOrder: number) =>
  invoke<number>("add_hymn_to_collection", { collectionId, hymnId, itemOrder });

export const removeHymnFromCollection = (collectionId: number, hymnId: number) =>
  invoke<void>("remove_hymn_from_collection", { collectionId, hymnId });

export const restoreHymnFromApi = (hymnId: number, apiMusicId: number, language: string) =>
  invoke<void>("restore_hymn_from_api", { hymnId, apiMusicId, language });
```

### 6.2 `lib/queries.ts`

```ts
export const useCollectionHymns = (collectionId: number) =>
  useQuery({ queryKey: ["collection-hymns", collectionId], queryFn: () => getCollectionHymns(collectionId) });

export const useAddHymnToCollection = () =>
  useMutation({ mutationFn: (vars) => addHymnToCollection(vars.collectionId, vars.hymnId, vars.itemOrder),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["collection-hymns", vars.collectionId] }) });

export const useRemoveHymnFromCollection = () =>
  useMutation({ mutationFn: (vars) => removeHymnFromCollection(vars.collectionId, vars.hymnId),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["collection-hymns", vars.collectionId] }) });

export const useRestoreHymnFromApi = () =>
  useMutation({ mutationFn: (vars) => restoreHymnFromApi(vars.hymnId, vars.apiMusicId, vars.language),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["hymn", vars.hymnId] }) });
```

### 6.3 `routes/hymnal/$hymnId.tsx`

- `hymnToSlides(hymn, stanzas)` → pass `coverPath: string | null` → set `backgroundImage: coverPath` on each lyrics + cover slide
- Show "Restore from API" button when `hymn.apiMusicId != null`
- On click: call `useRestoreHymnFromApi`, show success toast via `sonner`

### 6.4 `routes/collections/index.tsx`

- Add `const [tab, setTab] = useState<"albums" | "custom">("albums")`
- Filter: albums tab → `collections.filter(c => c.sourceType === 'api')`
- Filter: custom tab → `collections.filter(c => c.sourceType === 'file')`
- Create/import button rendered only in custom tab

### 6.5 `routes/collections/$collectionId.tsx`

```tsx
if (collection.sourceType === 'api') {
  // render hymn list from useCollectionHymns(collection.id)
  // each hymn card: cover, title, track → Link to /hymnal/{hymnId}
} else {
  // existing presentation-backed song list (unchanged)
}
```

### 6.6 `components/migration/legacy-fetch-wizard.tsx`

- Add toggle: `includeAlbums` (default `true`) with hint text
- Show in report: `albumsCreated` and `collectionHymnsLinked` counts

---

## 7. Progress Events

```
fetching_albums          → "Fetching album list from server..."
importing_album          → "Importing album '{name}' ({n} of {total})..."
importing_album_music    → "Importing hymn '{name}' ({n} of {m} in album)..."
```

---

## 8. i18n Keys (all 3 locales)

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

## 9. Constraints & Notes

- **No new Cargo dependencies** — `reqwest` already in `legacy_fetch`; `rusqlite` already used.
- **No pnpm dependencies** — all frontend changes use existing libraries.
- **Backward compat** — `source_type DEFAULT 'file'` means zero migration risk for existing rows.
- **`.bmp` covers** — download as-is; the slide renderer and `convertFileSrc` handle any image format.
- **Cancel support** — album import loop must check `cancel_flag` between albums to honor wizard cancellation.
- **Thread safety** — `run_legacy_fetch_background` already runs on a background thread; no changes needed.
