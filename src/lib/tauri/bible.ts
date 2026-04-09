import { invoke } from "@tauri-apps/api/core";
import type { BibleVersion, Book, Verse, BibleSearchResult } from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
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

export async function searchBibleGlobal(query: string): Promise<BibleSearchResult[]> {
  return tauriInvoke<BibleSearchResult[]>("search_bible_global", { query });
}

export async function importBibleVersion(
name: string, abbreviation: string, language: string, versesJson: string): Promise<number> {
  return tauriInvoke<number>("import_bible_version", { name, abbreviation, language, versesJson });
}

export async function navigateBible(direction: "next" | "prev"): Promise<void> {
  await invoke("navigate_bible", { direction });
}

export async function clearBibleProjection(): Promise<void> {
  await invoke("clear_bible_projection", {});
}
