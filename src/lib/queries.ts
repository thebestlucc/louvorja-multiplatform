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
  getAvailableMonitors, setCurrentSlide, getSyncPoints, saveSyncPoints,
  getCollections, getCollection, createCollection, updateCollection, deleteCollection, importCollectionSong,
  checkCollectionSongSync, resyncCollectionSong, removeCollectionSong, reorderCollectionSongs,
  getCollectionHymns, addHymnToCollection, removeHymnFromCollection,
  getPresentations, getPresentation, createPresentation, updatePresentation, deletePresentation,
  getSlides, createSlide, updateSlide, deleteSlide, reorderSlides, importSlja, exportSlja,
  getBibleVersions, getBooks, getVerses, searchBible, importBibleVersion,
  getServices, getService, createService, updateService, deleteService,
  addServiceItem, removeServiceItem, reorderServiceItems, duplicateService, updateServiceItem,
  listScheduleDepartments, saveScheduleDepartment, deleteScheduleDepartment, reorderScheduleDepartments,
  replaceScheduleDepartmentMembers, getScheduleMonth, saveScheduleMonthDays,
  generateScheduleMonth, setScheduleDayResponsibleDepartment, saveScheduleDayAssignments,
  updateScheduleDayDepartmentPeoplePerDay, resetScheduleDayDepartmentManualOverride,
  getMonitorConfigs, setMonitorConfig,
  startTimer, pauseTimer, resumeTimer, resetTimer, adjustCountdownTimer, getTimerState, addLap, runLottery, formatText,
  startStreamingServer, stopStreamingServer, getStreamingStatus, setStreamingBroadcast,
  getSetting, setSetting, getAllSettings, clearDatabase,
  startLegacyFetch, getLegacyFetchProgress, cancelLegacyFetch, getLegacyFetchReport, fetchLegacyParams,
  getContentSyncSummary, planContentSync, startContentSync, getContentSyncProgress, cancelContentSync, getContentSyncReport,
  restoreHymnFromApi, restoreAlbumFromApi,
  checkForUpdates, installUpdate,
  copyVideoToMedia, copyImageToMedia, getVideoMetadata, resolveMediaPath,
  updateGlobalShortcut,
} from "./tauri";
import type {
  HymnWriteInput,
  CollectionSongSyncStatus,
  TimerMode,
  LegacyFetchOptions,
  SyncPoint,
  SlideContent,
  ScheduleAssignmentInput,
  ScheduleDayInput,
  ScheduleDepartmentInput,
  ScheduleGenerationRequest,
} from "./bindings";
import type { TextFormat } from "../types/utilities";

export const queryKeys = {
  hymns: {
    all: ["hymns"] as const,
    search: (query: string) => ["hymns", "search", query] as const,
    detail: (id: number) => ["hymns", id] as const,
    byAlbum: (album: string) => ["hymns", "album", album] as const,
    audioPath: (id: number) => ["hymns", id, "audioPath"] as const,
  },
  albums: {
    all: ["albums"] as const,
  },
  collections: {
    all: ["collections"] as const,
    detail: (id: number) => ["collections", id] as const,
    songs: (id: number) => ["collections", id, "songs"] as const,
    hymns: (id: number) => ["collections", id, "hymns"] as const,
    songSync: (songId: number) => ["collections", "songSync", songId] as const,
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
  schedule: {
    all: ["schedule"] as const,
    departments: ["schedule", "departments"] as const,
    month: (year: number, month: number) => ["schedule", "month", year, month] as const,
  },
  settings: {
    all: ["settings"] as const,
    detail: (key: string) => ["settings", key] as const,
  },
  legacyFetch: {
    progress: (runId: string) => ["legacyFetch", "progress", runId] as const,
    report: (runId: string) => ["legacyFetch", "report", runId] as const,
    params: ["legacyFetch", "params"] as const,
  },
  contentSync: {
    summary: ["contentSync", "summary"] as const,
    plan: ["contentSync", "plan"] as const,
    progress: (runId: string) => ["contentSync", "progress", runId] as const,
    report: (runId: string) => ["contentSync", "report", runId] as const,
  },
  updater: {
    info: ["updater", "info"] as const,
  },
  monitors: {
    all: ["monitors"] as const,
    configs: ["monitorConfigs"] as const,
  },
  syncPoints: {
    byHymn: (hymnId: number) => ["syncPoints", hymnId] as const,
  },
  utilities: {
    timerState: ["utilities", "timerState"] as const,
  },
  streaming: {
    status: ["streaming", "status"] as const,
  },
  video: {
    metadata: (path: string) => ["video", "metadata", path] as const,
    resolvedPath: (path: string) => ["video", "resolvedPath", path] as const,
  },
} as const;

function invalidateTimerState(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.utilities.timerState });
}

function invalidateScheduleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  month?: { year: number; month: number },
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.schedule.departments });
  if (month) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.month(month.year, month.month),
    });
    return;
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all });
}

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

// Collections
export function useCollections() {
  return useQuery({
    queryKey: queryKeys.collections.all,
    queryFn: () => getCollections(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.id) });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCollection(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

export function useResyncCollectionSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: number) => resyncCollectionSong(songId),
    onSuccess: (song) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(song.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

export function useRestoreHymnFromApi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hymnId: number; language: string }) =>
      restoreHymnFromApi(vars.hymnId, vars.language),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.detail(vars.hymnId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
    },
  });
}

export function useRestoreAlbumFromApi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { collectionId: number; language: string }) =>
      restoreAlbumFromApi(vars.collectionId, vars.language),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.hymns(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(vars.collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
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

// Schedules
export function useScheduleDepartments() {
  return useQuery({
    queryKey: queryKeys.schedule.departments,
    queryFn: () => listScheduleDepartments(),
  });
}

export function useScheduleMonth(year: number, month: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.schedule.month(year, month),
    queryFn: () => getScheduleMonth(year, month),
    enabled: (options?.enabled ?? true) && year > 0 && month >= 1 && month <= 12,
  });
}

export function useSaveScheduleDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleDepartmentInput) => saveScheduleDepartment(input),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useDeleteScheduleDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteScheduleDepartment(id),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useReorderScheduleDepartments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (departmentIds: number[]) => reorderScheduleDepartments(departmentIds),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useReplaceScheduleDepartmentMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { departmentId: number; members: string[] }) =>
      replaceScheduleDepartmentMembers(vars.departmentId, vars.members),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useSaveScheduleMonthDays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { year: number; month: number; days: ScheduleDayInput[] }) =>
      saveScheduleMonthDays(vars.year, vars.month, vars.days),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useGenerateScheduleMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleGenerationRequest) => generateScheduleMonth(input),
    onSuccess: (_, input) => {
      invalidateScheduleQueries(queryClient, { year: input.year, month: input.month });
    },
  });
}

export function useSetScheduleDayResponsibleDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      scheduleDayId: number;
      responsibleDepartmentId: number | null;
      year: number;
      month: number;
    }) =>
      setScheduleDayResponsibleDepartment(
        vars.scheduleDayId,
        vars.responsibleDepartmentId,
      ),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useSaveScheduleDayAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { year: number; month: number; input: ScheduleAssignmentInput }) =>
      saveScheduleDayAssignments(vars.input),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useUpdateScheduleDayDepartmentPeoplePerDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      year: number;
      month: number;
      scheduleDayDepartmentId: number;
      peoplePerDay: number;
    }) =>
      updateScheduleDayDepartmentPeoplePerDay(
        vars.scheduleDayDepartmentId,
        vars.peoplePerDay,
      ),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useResetScheduleDayDepartmentManualOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { year: number; month: number; scheduleDayDepartmentId: number }) =>
      resetScheduleDayDepartmentManualOverride(vars.scheduleDayDepartmentId),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

// Settings
export function useSetting(key: string) {
  return useQuery({
    queryKey: queryKeys.settings.detail(key),
    queryFn: () => getSetting(key),
  });
}

export function useAllSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => getAllSettings(),
    enabled: options?.enabled,
  });
}

export function useSetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; value: string }) =>
      setSetting(vars.key, vars.value),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.detail(vars.key) });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

export function useClearDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearDatabase(),
    onSuccess: () => {
      // Invalidate all data queries after clearing the database
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bible.versions });
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
    },
  });
}

// Legacy Fetch (From LouvorJA Server)
export function useFetchLegacyParams(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.legacyFetch.params,
    queryFn: () => fetchLegacyParams(),
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useContentSyncSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.contentSync.summary,
    queryFn: () => getContentSyncSummary(),
    enabled: options?.enabled ?? true,
    retry: false,
    staleTime: 1000 * 30,
  });
}

export function usePlanContentSync(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.contentSync.plan,
    queryFn: () => planContentSync(),
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

export function useStartContentSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startContentSync(),
    onSuccess: (runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contentSync.progress(runId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contentSync.report(runId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contentSync.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.contentSync.plan });
    },
  });
}

export function useContentSyncProgress(runId: string | null, options?: { enabled?: boolean }) {
  const enabled = Boolean(runId && (options?.enabled ?? true));
  return useQuery({
    queryKey: queryKeys.contentSync.progress(runId ?? ""),
    queryFn: () => getContentSyncProgress(runId ?? ""),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "running") {
        return 500;
      }
      return false;
    },
    refetchIntervalInBackground: true,
  });
}

export function useContentSyncReport(runId: string | null, options?: { enabled?: boolean }) {
  const enabled = Boolean(runId && (options?.enabled ?? true));
  return useQuery({
    queryKey: queryKeys.contentSync.report(runId ?? ""),
    queryFn: () => getContentSyncReport(runId ?? ""),
    enabled,
    retry: false,
  });
}

export function useCancelContentSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => cancelContentSync(runId),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contentSync.progress(runId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contentSync.report(runId) });
    },
  });
}

export function useStartLegacyFetch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: LegacyFetchOptions) => startLegacyFetch(options),
    onSuccess: (runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legacyFetch.progress(runId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.legacyFetch.report(runId) });
    },
  });
}

export function useLegacyFetchProgress(runId: string | null, options?: { enabled?: boolean }) {
  const enabled = Boolean(runId && (options?.enabled ?? true));
  return useQuery({
    queryKey: queryKeys.legacyFetch.progress(runId ?? ""),
    queryFn: () => getLegacyFetchProgress(runId ?? ""),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "fetching" || status === "importing" || status === "downloading") {
        return 500;
      }
      return false;
    },
    refetchIntervalInBackground: true,
  });
}

export function useLegacyFetchReport(runId: string | null, options?: { enabled?: boolean }) {
  const enabled = Boolean(runId && (options?.enabled ?? true));
  return useQuery({
    queryKey: queryKeys.legacyFetch.report(runId ?? ""),
    queryFn: () => getLegacyFetchReport(runId ?? ""),
    enabled,
    retry: false,
  });
}

export function useCancelLegacyFetch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => cancelLegacyFetch(runId),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legacyFetch.progress(runId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.legacyFetch.report(runId) });
      // Also invalidate hymns since new ones may have been imported
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
    },
  });
}

// Updater
export function useCheckForUpdates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.updater.info,
    queryFn: () => checkForUpdates(),
    enabled: options?.enabled,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });
}

export function useInstallUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => installUpdate(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.updater.info, null);
    },
  });
}

// Utilities
export function useTimerState(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.utilities.timerState,
    queryFn: () => getTimerState(),
    refetchInterval: (query) => (query.state.data?.isRunning ? 250 : 2000),
    refetchIntervalInBackground: true,
    enabled: options?.enabled,
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { mode: TimerMode; durationMs?: number | null }) =>
      startTimer(vars.mode, vars.durationMs),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function usePauseTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pauseTimer(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useResumeTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumeTimer(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useResetTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetTimer(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useAdjustCountdownTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { deltaMs: number }) => adjustCountdownTimer(vars.deltaMs),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useAddLap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => addLap(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useRunLottery() {
  return useMutation({
    mutationFn: (names: string[]) => runLottery(names),
  });
}

export function useFormatText() {
  return useMutation({
    mutationFn: (vars: { text: string; format: TextFormat }) =>
      formatText(vars.text, vars.format),
  });
}

// Video
export function useGetVideoMetadata(path: string | null) {
  return useQuery({
    queryKey: queryKeys.video.metadata(path ?? ""),
    queryFn: () => getVideoMetadata(path ?? ""),
    enabled: Boolean(path && path.trim().length > 0),
  });
}

export function useResolveMediaPath(path: string | null) {
  return useQuery({
    queryKey: queryKeys.video.resolvedPath(path ?? ""),
    queryFn: () => resolveMediaPath(path ?? ""),
    enabled: Boolean(path && path.trim().length > 0),
  });
}

export function useCopyVideoToMedia() {
  return useMutation({
    mutationFn: (vars: { videoPath: string; presentationId: number }) =>
      copyVideoToMedia(vars.videoPath, vars.presentationId),
  });
}

export function useCopyImageToMedia() {
  return useMutation({
    mutationFn: (imagePath: string) => copyImageToMedia(imagePath),
  });
}

// Streaming
export function useStreamingStatus() {
  return useQuery({
    queryKey: queryKeys.streaming.status,
    queryFn: () => getStreamingStatus(),
    refetchInterval: (query) => {
      return query.state.data?.isRunning ? 2000 : 30000;
    },
  });
}

export function useStartStreaming() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (port?: number) => startStreamingServer(port),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
    },
  });
}

export function useStopStreaming() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => stopStreamingServer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
    },
  });
}

export function useSetStreamingBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setStreamingBroadcast(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
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

export function useSetShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; layer: "local" | "global"; value: string }) => {
      const key = `shortcut.${vars.id}.${vars.layer}`;
      await setSetting(key, vars.value);
      if (vars.layer === "global") {
        await updateGlobalShortcut(vars.id, vars.value);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["setting", `shortcut.${vars.id}.${vars.layer}`],
      });
    },
  });
}
