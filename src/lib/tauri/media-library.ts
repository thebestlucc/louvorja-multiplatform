import { invoke } from "@tauri-apps/api/core";
import type {
  MediaLibraryCategory,
  MediaLibraryCategoryInput,
  MediaLibraryItem,
  MediaLibraryItemInput,
} from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Media Library
export async function getMediaLibraryCategories(language: string): Promise<MediaLibraryCategory[]> {
  return tauriInvoke<MediaLibraryCategory[]>("get_media_library_categories", { language });
}

export async function upsertMediaLibraryCategory(input: MediaLibraryCategoryInput): Promise<number> {
  return tauriInvoke<number>("upsert_media_library_category", { input });
}

export async function deleteMediaLibraryCategory(id: number): Promise<void> {
  return tauriInvoke<void>("delete_media_library_category", { id });
}

export async function getMediaLibraryItems(categoryId: number): Promise<MediaLibraryItem[]> {
  return tauriInvoke<MediaLibraryItem[]>("get_media_library_items", { categoryId });
}

export async function getMediaLibraryItemsByDate(
  categoryId: number,
  date: string | null,
): Promise<MediaLibraryItem[]> {
  return tauriInvoke<MediaLibraryItem[]>("get_media_library_items_by_date", { categoryId, date });
}

export async function getMediaLibraryItemDates(categoryId: number): Promise<string[]> {
  return tauriInvoke<string[]>("get_media_library_item_dates", { categoryId });
}

export async function upsertMediaLibraryItem(input: MediaLibraryItemInput): Promise<number> {
  return tauriInvoke<number>("upsert_media_library_item", { input });
}

export async function deleteMediaLibraryItem(id: number): Promise<void> {
  return tauriInvoke<void>("delete_media_library_item", { id });
}

export async function searchMediaLibraryItems(query: string): Promise<MediaLibraryItem[]> {
  return tauriInvoke<MediaLibraryItem[]>("search_media_library_items", { query });
}

export async function getScheduledMediaItem(categoryId: number, date: string): Promise<MediaLibraryItem | null> {
  return tauriInvoke<MediaLibraryItem | null>("get_scheduled_media_item", { categoryId, date });
}
