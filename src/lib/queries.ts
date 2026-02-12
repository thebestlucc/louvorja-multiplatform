import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchHymns, getHymn, getAlbums, getHymnsByAlbum, getAvailableMonitors, setCurrentSlide, getSyncPoints, saveSyncPoints,
  getPresentations, getPresentation, createPresentation, updatePresentation, deletePresentation,
  getSlides, createSlide, updateSlide, deleteSlide, reorderSlides, importSlja, exportSlja,
  getBibleVersions, getBooks, getVerses, searchBible, importBibleVersion,
  getServices, getService, createService, updateService, deleteService,
  addServiceItem, removeServiceItem, reorderServiceItems, duplicateService, updateServiceItem,
  getMonitorConfigs, setMonitorConfig,
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
    search: (query: string, versionId: number | null) => ["bible", "search", query, versionId] as const,
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
    items: (serviceId: number) => ["services", serviceId, "items"] as const,
  },
  settings: {
    all: ["settings"] as const,
    detail: (key: string) => ["settings", key] as const,
  },
  monitors: {
    all: ["monitors"] as const,
    configs: ["monitorConfigs"] as const,
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

// Bible
export function useBibleVersions() {
  return useQuery({
    queryKey: queryKeys.bible.versions,
    queryFn: () => getBibleVersions(),
  });
}

export function useBooks(versionId: number) {
  return useQuery({
    queryKey: queryKeys.bible.books(versionId),
    queryFn: () => getBooks(versionId),
    enabled: versionId > 0,
  });
}

export function useVerses(versionId: number, book: string, chapter: number) {
  return useQuery({
    queryKey: queryKeys.bible.verses(versionId, book, chapter),
    queryFn: () => getVerses(versionId, book, chapter),
    enabled: versionId > 0 && book.length > 0 && chapter > 0,
  });
}

export function useBibleSearch(query: string, versionId: number | null) {
  return useQuery({
    queryKey: queryKeys.bible.search(query, versionId),
    queryFn: () => searchBible(query, versionId),
    enabled: query.trim().length >= 2,
  });
}

export function useImportBible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; abbreviation: string; language: string; versesJson: string }) =>
      importBibleVersion(vars.name, vars.abbreviation, vars.language, vars.versesJson),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bible.versions });
    },
  });
}

// Services
export function useServices() {
  return useQuery({
    queryKey: queryKeys.services.all,
    queryFn: () => getServices(),
  });
}

export function useService(id: number) {
  return useQuery({
    queryKey: queryKeys.services.detail(id),
    queryFn: () => getService(id),
    enabled: id > 0,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; date: string | null; notes: string | null }) =>
      createService(vars.title, vars.date, vars.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; title: string; date: string | null; notes: string | null }) =>
      updateService(vars.id, vars.title, vars.date, vars.notes),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.id) });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useDuplicateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => duplicateService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useAddServiceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serviceId: number; itemType: string; title: string; itemId: number | null; notes: string | null }) =>
      addServiceItem(vars.serviceId, vars.itemType, vars.title, vars.itemId, vars.notes),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

export function useRemoveServiceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; serviceId: number }) => removeServiceItem(vars.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

export function useReorderServiceItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serviceId: number; itemIds: number[] }) =>
      reorderServiceItems(vars.serviceId, vars.itemIds),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

export function useUpdateServiceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; serviceId: number; title: string; notes: string | null }) =>
      updateServiceItem(vars.id, vars.title, vars.notes),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

// Monitor Configs
export function useMonitorConfigs() {
  return useQuery({
    queryKey: queryKeys.monitors.configs,
    queryFn: () => getMonitorConfigs(),
  });
}

export function useSaveMonitorConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { monitorId: string; role: string }) =>
      setMonitorConfig(vars.monitorId, vars.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
    },
  });
}
