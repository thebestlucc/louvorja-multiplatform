import { invoke } from "@tauri-apps/api/core";
import type {
  Collection,
  CollectionSearchResult,
  CollectionSong,
  CollectionSongSyncStatus,
  CollectionWithSongs,
  Hymn,
} from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Collections
export async function getCollections(query?: string | null): Promise<Collection[]> {
  return tauriInvoke<Collection[]>("get_collections", { query: query ?? null });
}

export async function getCollection(id: number): Promise<CollectionWithSongs> {
  return tauriInvoke<CollectionWithSongs>("get_collection", { id });
}

export async function searchCollections(query: string): Promise<CollectionSearchResult[]> {
  return tauriInvoke<CollectionSearchResult[]>("search_collections", { query });
}

export async function searchCollectionsContent(query: string): Promise<CollectionSearchResult[]> {
  return tauriInvoke<CollectionSearchResult[]>("search_collections_content", { query });
}

export async function createCollection(
  name: string,
  description: string | null,
  year: number | null,
  coverPath: string | null,
): Promise<Collection> {
  return tauriInvoke<Collection>("create_collection", {
    name,
    description,
    year,
    coverPath,
  });
}

export async function updateCollection(
  id: number,
  name: string,
  description: string | null,
  year: number | null,
  coverPath: string | null,
): Promise<Collection> {
  return tauriInvoke<Collection>("update_collection", {
    id,
    name,
    description,
    year,
    coverPath,
  });
}

export async function deleteCollection(id: number): Promise<void> {
  return tauriInvoke<void>("delete_collection", { id });
}

export async function importCollectionSong(
  collectionId: number,
  path: string,
): Promise<CollectionSong> {
  return tauriInvoke<CollectionSong>("import_collection_song", {
    collectionId,
    path,
  });
}

export async function checkCollectionSongSync(songId: number): Promise<CollectionSongSyncStatus> {
  return tauriInvoke<CollectionSongSyncStatus>("check_collection_song_sync", { songId });
}

export async function resyncCollectionSong(songId: number): Promise<CollectionSong> {
  return tauriInvoke<CollectionSong>("resync_collection_song", { songId });
}

export async function removeCollectionSong(songId: number): Promise<void> {
  return tauriInvoke<void>("remove_collection_song", { songId });
}

export async function reorderCollectionSongs(
  collectionId: number,
  songIds: number[],
): Promise<void> {
  return tauriInvoke<void>("reorder_collection_songs", {
    collectionId,
    songIds,
  });
}

export async function getCollectionHymns(collectionId: number): Promise<Hymn[]> {
  return tauriInvoke<Hymn[]>("get_collection_hymns", { collectionId });
}

export async function addHymnToCollection(
  collectionId: number,
  hymnId: number,
  itemOrder: number,
): Promise<boolean> {
  return tauriInvoke<boolean>("add_hymn_to_collection", {
    collectionId,
    hymnId,
    itemOrder,
  });
}

export async function removeHymnFromCollection(
  collectionId: number,
  hymnId: number,
): Promise<void> {
  return tauriInvoke<void>("remove_hymn_from_collection", {
    collectionId,
    hymnId,
  });
}
