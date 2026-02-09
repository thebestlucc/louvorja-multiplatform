import { invoke } from "@tauri-apps/api/core";
import type { Hymn, Album } from "../types/hymn";
import type { MonitorInfo } from "../types/settings";
import type { SlideContentFlat } from "../types/presentation";
import type { AudioStatusPayload, SyncPoint } from "../types/audio";

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
