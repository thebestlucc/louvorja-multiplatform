import { invoke } from "@tauri-apps/api/core";
import type { Hymn, Album } from "../types/hymn";
import type { MonitorInfo } from "../types/settings";
import type { Presentation, SlideContentFlat, SlideContextFlat, OverlayState } from "../types/presentation";
import type { SlideRow } from "../types/presentation";
import type { MonitorConfig } from "../types/settings";
import type { AudioStatusPayload, SyncPoint } from "../types/audio";
import type { BibleVersion, Book, Verse, BibleSearchResult } from "../types/bible";
import type { Service, ServiceItem, ServiceWithItems } from "../types/service";

export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

export async function greet(name: string): Promise<string> {
  return tauriInvoke<string>("greet", { name });
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

// Display
export async function getAvailableMonitors(): Promise<MonitorInfo[]> {
  return tauriInvoke<MonitorInfo[]>("get_available_monitors");
}

export async function openProjectorWindow(monitorIndex: number): Promise<void> {
  return tauriInvoke<void>("open_projector_window", { monitorIndex });
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

export async function openReturnWindow(monitorIndex: number): Promise<void> {
  return tauriInvoke<void>("open_return_window", { monitorIndex });
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

export async function getVerseRange(versionId: number, book: string, chapter: number, start: number, end: number): Promise<Verse[]> {
  return tauriInvoke<Verse[]>("get_verse_range", { versionId, book, chapter, start, end });
}

export async function searchBible(query: string, versionId: number | null): Promise<BibleSearchResult[]> {
  return tauriInvoke<BibleSearchResult[]>("search_bible", { query, versionId });
}

export async function projectBibleVerse(versionId: number, book: string, chapter: number, start: number, end: number): Promise<void> {
  return tauriInvoke<void>("project_bible_verse", { versionId, book, chapter, start, end });
}

export async function importBibleVersion(name: string, abbreviation: string, language: string, versesJson: string): Promise<number> {
  return tauriInvoke<number>("import_bible_version", { name, abbreviation, language, versesJson });
}

export async function navigateBibleVerse(direction: "next" | "prev"): Promise<void> {
  return tauriInvoke<void>("navigate_bible_verse", { direction });
}

// Services
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
