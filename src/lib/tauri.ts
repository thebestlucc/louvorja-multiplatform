import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Hymn, Album, HymnWriteInput } from "../types/hymn";
import type { MonitorInfo } from "../types/settings";
import type { Presentation, SlideContentFlat, SlideContextFlat, OverlayState } from "../types/presentation";
import type { SlideRow } from "../types/presentation";
import type { MonitorConfig } from "../types/settings";
import type { AudioStatusPayload, SyncPoint } from "../types/audio";
import type { BibleVersion, Book, Verse, BibleSearchResult } from "../types/bible";
import type { Service, ServiceItem, ServiceWithItems } from "../types/service";
import type {
  Collection,
  CollectionSearchResult,
  CollectionSong,
  CollectionSongSyncStatus,
  CollectionWithSongs,
} from "../types/collection";
import type { Setting } from "../types/settings";
import type { StreamingInfo } from "../types/streaming";
import type { TimerMode, TimerStateData, TextFormat } from "../types/utilities";
import type { VideoMetadata } from "../types/video";
import type { UpdateInfo } from "../types/updater";
import type {
  LegacyFetchOptions,
  LegacyFetchProgress,
  LegacyFetchReport,
  ApiParams,
} from "../types/legacy-fetch";

export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Music
export async function searchHymns(query: string): Promise<Hymn[]> {
  return tauriInvoke<Hymn[]>("search_hymns", { query });
}

export async function getHymn(id: number): Promise<Hymn> {
  return tauriInvoke<Hymn>("get_hymn", { id });
}

export async function getAlbums(): Promise<Album[]> {
  return tauriInvoke<Album[]>("get_albums");
}

export async function getHymnsByAlbum(album: string): Promise<Hymn[]> {
  return tauriInvoke<Hymn[]>("get_hymns_by_album", { album });
}

export async function updateHymn(id: number, input: HymnWriteInput): Promise<Hymn> {
  return tauriInvoke<Hymn>("update_hymn", { id, input });
}

export async function deleteHymn(id: number): Promise<void> {
  return tauriInvoke<void>("delete_hymn", { id });
}

export async function getHymnAudioPath(hymnId: number): Promise<string | null> {
  return tauriInvoke<string | null>("get_hymn_audio_path", { hymnId });
}

// Collections
export async function getCollections(): Promise<Collection[]> {
  return tauriInvoke<Collection[]>("get_collections");
}

export async function getCollection(id: number): Promise<CollectionWithSongs> {
  return tauriInvoke<CollectionWithSongs>("get_collection", { id });
}

export async function searchCollections(query: string): Promise<CollectionSearchResult[]> {
  return tauriInvoke<CollectionSearchResult[]>("search_collections", { query });
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

// Display
export async function getAvailableMonitors(): Promise<MonitorInfo[]> {
  return tauriInvoke<MonitorInfo[]>("get_available_monitors");
}

export async function openProjectorWindow(monitorId: string): Promise<void> {
  return tauriInvoke<void>("open_projector_window", { monitorId });
}

export async function closeProjectorWindow(): Promise<void> {
  return tauriInvoke<void>("close_projector_window");
}

export async function setCurrentSlide(slideData: SlideContentFlat): Promise<void> {
  return tauriInvoke<void>("set_current_slide", { slideData });
}

export async function getCurrentSlide(): Promise<SlideContentFlat | null> {
  return tauriInvoke<SlideContentFlat | null>("get_current_slide");
}

export async function clearCurrentSlide(): Promise<void> {
  return tauriInvoke<void>("clear_current_slide");
}

export async function openReturnWindow(monitorId: string): Promise<void> {
  return tauriInvoke<void>("open_return_window", { monitorId });
}

export async function closeReturnWindow(): Promise<void> {
  return tauriInvoke<void>("close_return_window");
}

export async function toggleBlackScreen(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("toggle_black_screen");
}

export async function toggleLogoScreen(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("toggle_logo_screen");
}

export async function getOverlayState(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("get_overlay_state");
}

export async function setSlideContext(contextData: SlideContextFlat): Promise<void> {
  return tauriInvoke<void>("set_slide_context", { contextData });
}

export async function getSlideContext(): Promise<SlideContextFlat | null> {
  return tauriInvoke<SlideContextFlat | null>("get_slide_context");
}

export async function setMonitorConfig(monitorId: string, role: string): Promise<void> {
  return tauriInvoke<void>("set_monitor_config", { monitorId, role });
}

export async function getMonitorConfigs(): Promise<MonitorConfig[]> {
  return tauriInvoke<MonitorConfig[]>("get_monitor_configs");
}

// Audio
export async function audioPlay(filePath: string): Promise<void> {
  return tauriInvoke<void>("audio_play", { filePath });
}

export async function audioPlayAlert(filePath?: string | null, volume?: number | null): Promise<void> {
  return tauriInvoke<void>("audio_play_alert", {
    filePath: filePath ?? null,
    volume: volume ?? null,
  });
}

export async function audioPause(): Promise<void> {
  return tauriInvoke<void>("audio_pause");
}

export async function audioResume(): Promise<void> {
  return tauriInvoke<void>("audio_resume");
}

export async function audioStop(): Promise<void> {
  return tauriInvoke<void>("audio_stop");
}

export async function audioSeek(positionMs: number): Promise<void> {
  return tauriInvoke<void>("audio_seek", { positionMs });
}

export async function audioSetVolume(volume: number): Promise<void> {
  return tauriInvoke<void>("audio_set_volume", { volume });
}

export async function audioGetPosition(): Promise<number> {
  return tauriInvoke<number>("audio_get_position");
}

export async function audioGetStatus(): Promise<AudioStatusPayload> {
  return tauriInvoke<AudioStatusPayload>("audio_get_status");
}

// Sync Points
export async function getSyncPoints(hymnId: number): Promise<SyncPoint[]> {
  return tauriInvoke<SyncPoint[]>("get_sync_points", { hymnId });
}

export async function saveSyncPoints(hymnId: number, points: SyncPoint[]): Promise<void> {
  return tauriInvoke<void>("save_sync_points", { hymnId, points });
}

// Presentations
export async function getPresentations(): Promise<Presentation[]> {
  return tauriInvoke<Presentation[]>("get_presentations");
}

export async function getPresentation(id: number): Promise<Presentation> {
  return tauriInvoke<Presentation>("get_presentation", { id });
}

export async function createPresentation(title: string, aspectRatio: string): Promise<Presentation> {
  return tauriInvoke<Presentation>("create_presentation", { title, aspectRatio });
}

export async function updatePresentation(id: number, title: string, aspectRatio: string): Promise<void> {
  return tauriInvoke<void>("update_presentation", { id, title, aspectRatio });
}

export async function deletePresentation(id: number): Promise<void> {
  return tauriInvoke<void>("delete_presentation", { id });
}

// Slides
export async function getSlides(presentationId: number): Promise<SlideRow[]> {
  return tauriInvoke<SlideRow[]>("get_slides", { presentationId });
}

export async function createSlide(presentationId: number, contentJson: string, sortOrder: number): Promise<SlideRow> {
  return tauriInvoke<SlideRow>("create_slide", { presentationId, contentJson, sortOrder });
}

export async function updateSlide(id: number, contentJson: string): Promise<void> {
  return tauriInvoke<void>("update_slide", { id, contentJson });
}

export async function deleteSlide(id: number): Promise<void> {
  return tauriInvoke<void>("delete_slide", { id });
}

export async function reorderSlides(presentationId: number, slideIds: number[]): Promise<void> {
  return tauriInvoke<void>("reorder_slides", { presentationId, slideIds });
}

export async function importSlja(path: string): Promise<Presentation> {
  return tauriInvoke<Presentation>("import_slja", { path });
}

export async function exportSlja(presentationId: number, path: string): Promise<void> {
  return tauriInvoke<void>("export_slja", { presentationId, path });
}

// Bible
export async function getBibleVersions(): Promise<BibleVersion[]> {
  return tauriInvoke<BibleVersion[]>("get_bible_versions");
}

export async function getBooks(versionId: number): Promise<Book[]> {
  return tauriInvoke<Book[]>("get_books", { versionId });
}

export async function getVerses(versionId: number, book: string, chapter: number): Promise<Verse[]> {
  return tauriInvoke<Verse[]>("get_verses", { versionId, book, chapter });
}

export async function searchBible(query: string, versionId: number | null): Promise<BibleSearchResult[]> {
  return tauriInvoke<BibleSearchResult[]>("search_bible", { query, versionId });
}

export async function importBibleVersion(name: string, abbreviation: string, language: string, versesJson: string): Promise<number> {
  return tauriInvoke<number>("import_bible_version", { name, abbreviation, language, versesJson });
}

export async function getServices(): Promise<Service[]> {
  return tauriInvoke<Service[]>("get_services");
}

export async function getService(id: number): Promise<ServiceWithItems> {
  return tauriInvoke<ServiceWithItems>("get_service", { id });
}

export async function createService(title: string, date: string | null, notes: string | null): Promise<Service> {
  return tauriInvoke<Service>("create_service", { title, date, notes });
}

export async function updateService(id: number, title: string, date: string | null, notes: string | null): Promise<void> {
  return tauriInvoke<void>("update_service", { id, title, date, notes });
}

export async function deleteService(id: number): Promise<void> {
  return tauriInvoke<void>("delete_service", { id });
}

export async function addServiceItem(serviceId: number, itemType: string, title: string, itemId: number | null, notes: string | null): Promise<ServiceItem> {
  return tauriInvoke<ServiceItem>("add_service_item", { serviceId, itemType, title, itemId, notes });
}

export async function removeServiceItem(id: number): Promise<void> {
  return tauriInvoke<void>("remove_service_item", { id });
}

export async function reorderServiceItems(serviceId: number, itemIds: number[]): Promise<void> {
  return tauriInvoke<void>("reorder_service_items", { serviceId, itemIds });
}

export async function duplicateService(id: number): Promise<Service> {
  return tauriInvoke<Service>("duplicate_service", { id });
}

export async function updateServiceItem(id: number, title: string, notes: string | null): Promise<void> {
  return tauriInvoke<void>("update_service_item", { id, title, notes });
}

// Settings
export async function getSetting(key: string): Promise<Setting> {
  return tauriInvoke<Setting>("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return tauriInvoke<void>("set_setting", { key, value });
}

export async function getAllSettings(): Promise<Setting[]> {
  return tauriInvoke<Setting[]>("get_all_settings");
}

export async function clearDatabase(): Promise<{ success: boolean }> {
  return tauriInvoke<{ success: boolean }>("clear_database");
}

// Legacy Fetch (From LouvorJA Server)
export async function startLegacyFetch(options: LegacyFetchOptions): Promise<string> {
  return tauriInvoke<string>("start_legacy_fetch", { options });
}

export async function getLegacyFetchProgress(runId: string): Promise<LegacyFetchProgress> {
  return tauriInvoke<LegacyFetchProgress>("get_legacy_fetch_progress", { runId });
}

export async function cancelLegacyFetch(runId: string): Promise<void> {
  return tauriInvoke<void>("cancel_legacy_fetch", { runId });
}

export async function getLegacyFetchReport(runId: string): Promise<LegacyFetchReport | null> {
  return tauriInvoke<LegacyFetchReport | null>("get_legacy_fetch_report", { runId });
}

export async function fetchLegacyParams(): Promise<ApiParams> {
  return tauriInvoke<ApiParams>("fetch_legacy_params");
}

export async function restoreHymnFromApi(hymnId: number, language: string): Promise<void> {
  return tauriInvoke<void>("restore_hymn_from_api", { hymnId, language });
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  return tauriInvoke<UpdateInfo | null>("check_for_updates");
}

export async function installUpdate(): Promise<void> {
  return tauriInvoke<void>("install_update");
}

// Utilities
export async function startTimer(mode: TimerMode, durationMs?: number | null): Promise<void> {
  return tauriInvoke<void>("start_timer", { mode, durationMs: durationMs ?? null });
}

export async function pauseTimer(): Promise<void> {
  return tauriInvoke<void>("pause_timer");
}

export async function resumeTimer(): Promise<void> {
  return tauriInvoke<void>("resume_timer");
}

export async function resetTimer(): Promise<void> {
  return tauriInvoke<void>("reset_timer");
}

export async function adjustCountdownTimer(deltaMs: number): Promise<void> {
  return tauriInvoke<void>("adjust_countdown_timer", { deltaMs });
}

export async function getTimerState(): Promise<TimerStateData> {
  return tauriInvoke<TimerStateData>("get_timer_state");
}

export async function addLap(): Promise<number> {
  return tauriInvoke<number>("add_lap");
}

export async function startCountdownProjection(
  contextTitle: string,
  countdownTitle: string,
  initialTimeMs: number,
): Promise<void> {
  return tauriInvoke<void>("start_countdown_projection", {
    contextTitle,
    countdownTitle,
    initialTimeMs,
  });
}

export async function startStopwatchProjection(
  contextTitle: string,
  stopwatchTitle: string,
  initialTimeMs: number,
): Promise<void> {
  return tauriInvoke<void>("start_stopwatch_projection", {
    contextTitle,
    stopwatchTitle,
    initialTimeMs,
  });
}

export async function startClockProjection(
  contextTitle: string,
  clockTitle: string,
  use24Hour: boolean,
  showDate: boolean,
): Promise<void> {
  return tauriInvoke<void>("start_clock_projection", {
    contextTitle,
    clockTitle,
    use24Hour,
    showDate,
  });
}

export async function stopUtilityProjection(): Promise<void> {
  return tauriInvoke<void>("stop_utility_projection");
}

export async function runLottery(names: string[]): Promise<string> {
  return tauriInvoke<string>("run_lottery", { names });
}

export async function formatText(text: string, format: TextFormat): Promise<string> {
  return tauriInvoke<string>("format_text", { text, format });
}

// Streaming
export async function startStreamingServer(port?: number): Promise<StreamingInfo> {
  return tauriInvoke<StreamingInfo>("start_streaming_server", { port: port ?? null });
}

export async function stopStreamingServer(): Promise<void> {
  return tauriInvoke<void>("stop_streaming_server");
}

export async function getStreamingStatus(): Promise<StreamingInfo> {
  return tauriInvoke<StreamingInfo>("get_streaming_status");
}

export async function setStreamingBroadcast(enabled: boolean): Promise<void> {
  return tauriInvoke<void>("set_streaming_broadcast", { enabled });
}

// Video
/**
 * Copy a video file to the managed media directory.
 *
 * The Rust command returns immediately (to avoid blocking the IPC bridge on
 * Windows for large files). This wrapper sets up event listeners before
 * invoking so the Promise resolves when the background copy finishes.
 *
 * Events emitted by Rust: `"video-copy-complete"` and `"video-copy-error"`,
 * each carrying `[presentationId, payload]`.
 */
export async function copyVideoToMedia(videoPath: string, presentationId: number): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let unlistenComplete: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    function cleanup() {
      unlistenComplete?.();
      unlistenError?.();
    }

    // Register listeners before invoking — the background thread could theoretically
    // emit before an after-invoke listen() call has time to register.
    unlistenComplete = await listen<[number, string]>("video-copy-complete", (event) => {
      const [pid, relPath] = event.payload;
      if (pid === presentationId) {
        cleanup();
        resolve(relPath);
      }
    });

    unlistenError = await listen<[number, string]>("video-copy-error", (event) => {
      const [pid, err] = event.payload;
      if (pid === presentationId) {
        cleanup();
        reject(new Error(err));
      }
    });

    tauriInvoke<void>("copy_video_to_media", { videoPath, presentationId }).catch((e) => {
      cleanup();
      reject(e as Error);
    });
  });
}

export async function copyImageToMedia(imagePath: string): Promise<string> {
  return tauriInvoke<string>("copy_image_to_media", { imagePath });
}

export async function getVideoMetadata(path: string): Promise<VideoMetadata> {
  return tauriInvoke<VideoMetadata>("get_video_metadata", { path });
}

export async function resolveMediaPath(path: string): Promise<string> {
  return tauriInvoke<string>("resolve_media_path", { path });
}

export async function updateGlobalShortcut(
  action: string,
  shortcutStr: string,
): Promise<void> {
  return tauriInvoke<void>("update_global_shortcut", { action, shortcutStr });
}

export async function spotlightSelect(
  kind: "navigate" | "action" | "hide",
  payload: string,
): Promise<void> {
  return tauriInvoke<void>("spotlight_select", { kind, payload });
}

export async function spotlightHide(): Promise<void> {
  return tauriInvoke<void>("spotlight_hide");
}
