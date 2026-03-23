import { invoke } from "@tauri-apps/api/core";
import type { Hymn, Album, HymnWriteInput } from "../bindings";

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

export async function searchAllHymns(query: string): Promise<Hymn[]> {
  return tauriInvoke<Hymn[]>("search_all_hymns", { query });
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

export async function createHymn(input: HymnWriteInput): Promise<Hymn> {
  return tauriInvoke<Hymn>("create_hymn", { input });
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
