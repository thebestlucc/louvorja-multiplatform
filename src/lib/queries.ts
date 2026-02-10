import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchHymns, getHymn, getAlbums, getHymnsByAlbum, getAvailableMonitors, setCurrentSlide, getSyncPoints, saveSyncPoints,
  getPresentations, getPresentation, createPresentation, updatePresentation, deletePresentation,
  getSlides, createSlide, updateSlide, deleteSlide, reorderSlides, importSlja, exportSlja,
} from "./tauri";
import type { SlideContentFlat } from "../types/presentation";
import type { SyncPoint } from "../types/audio";

export const queryKeys = {
  hymns: {
    all: ["hymns"] as const,
    search: (query: string) => ["hymns", "search", query] as const,
    detail: (id: number) => ["hymns", id] as const,
    byAlbum: (album: string) => ["hymns", "album", album] as const,
  },
  albums: {
    all: ["albums"] as const,
  },
  bible: {
    versions: ["bible", "versions"] as const,
    books: (versionId: number) => ["bible", "books", versionId] as const,
    verses: (versionId: number, book: string, chapter: number) =>
      ["bible", "verses", versionId, book, chapter] as const,
    search: (query: string) => ["bible", "search", query] as const,
  },
  presentations: {
    all: ["presentations"] as const,
    detail: (id: number) => ["presentations", id] as const,
    slides: (presentationId: number) =>
      ["presentations", presentationId, "slides"] as const,
  },
  services: {
    all: ["services"] as const,
    detail: (id: number) => ["services", id] as const,
  },
  settings: {
    all: ["settings"] as const,
    detail: (key: string) => ["settings", key] as const,
  },
  monitors: {
    all: ["monitors"] as const,
  },
  syncPoints: {
    byHymn: (hymnId: number) => ["syncPoints", hymnId] as const,
  },
} as const;

export function useHymns(query: string) {
  return useQuery({
    queryKey: queryKeys.hymns.search(query),
    queryFn: () => searchHymns(query),
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

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors.all,
    queryFn: () => getAvailableMonitors(),
  });
}

export function useProjectSlide() {
  return useMutation({
    mutationFn: (slideData: SlideContentFlat) => setCurrentSlide(slideData),
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

// Presentations
export function usePresentations() {
  return useQuery({
    queryKey: queryKeys.presentations.all,
    queryFn: () => getPresentations(),
  });
}

export function usePresentation(id: number) {
  return useQuery({
    queryKey: queryKeys.presentations.detail(id),
    queryFn: () => getPresentation(id),
    enabled: id > 0,
  });
}

export function useSlides(presentationId: number) {
  return useQuery({
    queryKey: queryKeys.presentations.slides(presentationId),
    queryFn: () => getSlides(presentationId),
    enabled: presentationId > 0,
  });
}

export function useCreatePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, aspectRatio }: { title: string; aspectRatio: string }) =>
      createPresentation(title, aspectRatio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
    },
  });
}

export function useUpdatePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, aspectRatio }: { id: number; title: string; aspectRatio: string }) =>
      updatePresentation(id, title, aspectRatio),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.detail(id) });
    },
  });
}

export function useDeletePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePresentation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
    },
  });
}

export function useCreateSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presentationId, contentJson, sortOrder }: { presentationId: number; contentJson: string; sortOrder: number }) =>
      createSlide(presentationId, contentJson, sortOrder),
    onSuccess: (_, { presentationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(presentationId) });
    },
  });
}

export function useUpdateSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; contentJson: string; presentationId: number }) =>
      updateSlide(vars.id, vars.contentJson),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(vars.presentationId) });
    },
  });
}

export function useDeleteSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; presentationId: number }) =>
      deleteSlide(vars.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(vars.presentationId) });
    },
  });
}

export function useReorderSlides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presentationId, slideIds }: { presentationId: number; slideIds: number[] }) =>
      reorderSlides(presentationId, slideIds),
    onSuccess: (_, { presentationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(presentationId) });
    },
  });
}

export function useImportSlja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => importSlja(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
    },
  });
}

export function useExportSlja() {
  return useMutation({
    mutationFn: ({ presentationId, path }: { presentationId: number; path: string }) =>
      exportSlja(presentationId, path),
  });
}
