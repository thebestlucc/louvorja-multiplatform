import { invoke } from "@tauri-apps/api/core";
import type { Hymn, Album } from "../types/hymn";
import type { MonitorInfo } from "../types/settings";
import type { SlideContentFlat } from "../types/presentation";

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
