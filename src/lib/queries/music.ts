import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchHymns,
  searchAllHymns,
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

export function useHymns(query: string) {
  return useQuery({
    queryKey: queryKeys.hymns.search(query),
    queryFn: () => searchHymns(query),
  });
}

export function useAllHymns(query: string) {
  return useQuery({
    queryKey: ["hymns", "search-all", query],
    queryFn: () => searchAllHymns(query),
  });
}

export function useHymnAudioPath(hymnId: number) {
  return useQuery({
    queryKey: queryKeys.hymns.audioPath(hymnId),
    queryFn: () => getHymnAudioPath(hymnId),
  });
}

export function useHymn(id: number) {
  return useQuery({
    queryKey: queryKeys.hymns.detail(id),
    queryFn: () => getHymn(id),
    enabled: id > 0,
  });
}

export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
  });
}

export function useHymnsByAlbum(album: string) {
  return useQuery({
    queryKey: queryKeys.hymns.byAlbum(album),
    queryFn: () => getHymnsByAlbum(album),
    enabled: album.length > 0,
  });
}

export function useUpdateHymn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: HymnWriteInput }) => updateHymn(vars.id, vars.input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
    },
  });
}

export function useDeleteHymn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteHymn(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
    },
  });
}

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors.all,
    queryFn: () => getAvailableMonitors(),
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
