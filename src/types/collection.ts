import type { Hymn } from "./hymn";

export type CollectionSongSyncStatus =
  | "in_sync"
  | "stale"
  | "missing_source"
  | "error";

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  year: number | null;
  cover_path: string | null;
  auto_cover_path: string | null;
  song_count: number;
  source_type: string;
  api_album_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionSong {
  id: number;
  collection_id: number;
  source_path: string;
  source_format: string;
  source_hash: string | null;
  source_mtime_ms: number | null;
  cache_presentation_id: number | null;
  sync_status: CollectionSongSyncStatus;
  last_sync_at: string | null;
  item_order: number;
  created_at: string;
  updated_at: string;
  cache_presentation_title: string | null;
}

export interface CollectionWithSongs {
  collection: Collection;
  songs: CollectionSong[];
}

export interface CollectionSearchResult {
  kind: "collection" | "song";
  collection_id: number;
  song_id: number | null;
  collection_name: string;
  title: string;
  snippet: string;
}

export interface CollectionHymn {
  id: number;
  collectionId: number;
  hymnId: number;
  itemOrder: number;
  createdAt: string;
}

export interface CollectionWithHymns {
  collection: Collection;
  hymns: Hymn[];
}
