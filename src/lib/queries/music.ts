import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchHymns,
  searchHymnsList,
  searchAllHymns,
  searchAllMusic,
  getHymn,
  getAlbums,
  getHymnsByAlbum,
  updateHymn,
  deleteHymn,
  getHymnAudioPath,
  getSyncPoints,
  saveSyncPoints,
  getAvailableMonitors,
  setCurrentSlide,
} from "../tauri";
import type { HymnWriteInput, SyncPoint, SlideContent } from "../bindings";
import { queryKeys } from "./keys";

export function useHymns(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.hymns.searchFull(query),
    queryFn: () => searchHymns(query),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useHymnsList(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.hymns.search(query),
    queryFn: () => searchHymnsList(query),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useAllHymns(query: string) {
  return useQuery({
    queryKey: ["hymns", "search-all", query],
    queryFn: () => searchAllHymns(query),
    staleTime: 30_000,
  });
}

export function useAllMusic(query: string) {
  return useQuery({
    queryKey: ["music", "all", query],
    queryFn: () => searchAllMusic(query),
    staleTime: 30_000,
  });
}

export function useHymnAudioPath(hymnId: number) {
  return useQuery({
    queryKey: queryKeys.hymns.audioPath(hymnId),
    queryFn: () => getHymnAudioPath(hymnId),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function useHymn(id: number) {
  return useQuery({
    queryKey: queryKeys.hymns.detail(id),
    queryFn: () => getHymn(id),
    enabled: id > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useHymnsByAlbum(album: string) {
  return useQuery({
    queryKey: queryKeys.hymns.byAlbum(album),
    queryFn: () => getHymnsByAlbum(album),
    enabled: album.length > 0,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
}

export function useUpdateHymn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: HymnWriteInput }) => updateHymn(vars.id, vars.input),
    onSuccess: (updatedHymn, vars) => {
      // Update detail cache directly — no IPC round-trip needed
      queryClient.setQueryData(queryKeys.hymns.detail(vars.id), updatedHymn);
      // Invalidate active search results (both list and full) — not the entire hymns namespace
      queryClient.invalidateQueries({
        queryKey: queryKeys.hymns.search(""),
        exact: false, // matches all search variants
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hymns.searchFull(""),
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
    },
  });
}

export function useDeleteHymn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteHymn(id),
    onSuccess: (_, id) => {
      // Remove stale detail cache for deleted hymn
      queryClient.removeQueries({ queryKey: queryKeys.hymns.detail(id) });
      // Invalidate active search results (both list and full) — not the entire hymns namespace
      queryClient.invalidateQueries({
        queryKey: queryKeys.hymns.search(""),
        exact: false, // matches all search variants
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hymns.searchFull(""),
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
    },
  });
}

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors.all,
    queryFn: () => getAvailableMonitors(),
    staleTime: Infinity,
    gcTime: Infinity, // monitor list never changes without app restart
  });
}

export function useProjectSlide() {
  return useMutation({
    mutationFn: (slideData: SlideContent) => setCurrentSlide(slideData),
  });
}

export function useSyncPoints(hymnId: number) {
  return useQuery({
    queryKey: queryKeys.syncPoints.byHymn(hymnId),
    queryFn: () => getSyncPoints(hymnId),
    enabled: hymnId > 0,
    staleTime: Infinity,
    gcTime: 30 * 60_000, // 30 min — keep recently edited sync data
  });
}

export function useSaveSyncPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hymnId, points }: { hymnId: number; points: SyncPoint[] }) =>
      saveSyncPoints(hymnId, points),
    onSuccess: (_, { hymnId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.syncPoints.byHymn(hymnId) });
    },
  });
}
