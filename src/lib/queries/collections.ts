import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  importCollectionSong,
  checkCollectionSongSync,
  resyncCollectionSong,
  removeCollectionSong,
  reorderCollectionSongs,
  getCollectionHymns,
  addHymnToCollection,
  removeHymnFromCollection,
} from "../tauri";
import type { CollectionSongSyncStatus } from "../bindings";
import { queryKeys } from "./keys";

export function useCollections(query?: string) {
  return useQuery({
    queryKey: queryKeys.collections.all(query),
    queryFn: () => getCollections(query),
  });
}

export function useCollection(id: number) {
  return useQuery({
    queryKey: queryKeys.collections.detail(id),
    queryFn: () => getCollection(id),
    enabled: id > 0,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      description: string | null;
      year: number | null;
      coverPath: string | null;
    }) => createCollection(vars.name, vars.description, vars.year, vars.coverPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      name: string;
      description: string | null;
      year: number | null;
      coverPath: string | null;
    }) => updateCollection(vars.id, vars.name, vars.description, vars.year, vars.coverPath),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.id) });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCollection(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
      queryClient.removeQueries({ queryKey: queryKeys.collections.detail(id) });
    },
  });
}

export function useImportCollectionSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { collectionId: number; path: string }) =>
      importCollectionSong(vars.collectionId, vars.path),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}

export function useCheckCollectionSongSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: number) => checkCollectionSongSync(songId),
    onSuccess: (status, songId) => {
      queryClient.setQueryData(
        queryKeys.collections.songSync(songId),
        status as CollectionSongSyncStatus,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}

export function useResyncCollectionSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: number) => resyncCollectionSong(songId),
    onSuccess: (song) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(song.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}

export function useRemoveCollectionSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { songId: number; collectionId: number }) =>
      removeCollectionSong(vars.songId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}

export function useReorderCollectionSongs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { collectionId: number; songIds: number[] }) =>
      reorderCollectionSongs(vars.collectionId, vars.songIds),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.collectionId) });
    },
  });
}

export function useCollectionHymns(collectionId: number) {
  return useQuery({
    queryKey: queryKeys.collections.hymns(collectionId),
    queryFn: () => getCollectionHymns(collectionId),
    enabled: collectionId > 0,
  });
}

export function useAddHymnToCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { collectionId: number; hymnId: number; itemOrder: number }) =>
      addHymnToCollection(vars.collectionId, vars.hymnId, vars.itemOrder),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.hymns(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}

export function useRemoveHymnFromCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { collectionId: number; hymnId: number }) =>
      removeHymnFromCollection(vars.collectionId, vars.hymnId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.hymns(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    },
  });
}
