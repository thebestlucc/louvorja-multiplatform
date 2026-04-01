import { invoke } from "@tauri-apps/api/core";
import type {
  Favorite,
  Liturgy as Service,
  LiturgyItem as ServiceItem,
  LiturgyWithItems as ServiceWithItems,
  Collection,
  Hymn,
} from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Favorites
export async function toggleFavorite(itemType: string, itemId: number): Promise<boolean> {
  return tauriInvoke<boolean>("toggle_favorite", { itemType, itemId });
}

export async function getFavorites(itemType: string): Promise<Favorite[]> {
  return tauriInvoke<Favorite[]>("get_favorites", { itemType });
}

export async function getFavoriteHymns(query?: string | null): Promise<Hymn[]> {
  return tauriInvoke<Hymn[]>("get_favorite_hymns", { query: query ?? null });
}

export async function getFavoriteCollections(query?: string | null): Promise<Collection[]> {
  return tauriInvoke<Collection[]>("get_favorite_collections", { query: query ?? null });
}

export async function isFavorite(itemType: string, itemId: number): Promise<boolean> {
  return tauriInvoke<boolean>("is_favorite", { itemType, itemId });
}

export async function getAllFavoriteIds(itemType: string): Promise<number[]> {
  return tauriInvoke<number[]>("get_all_favorite_ids", { itemType });
}

// Liturgy
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

export async function addServiceItem(serviceId: number, itemType: string, title: string, itemId: number | null, notes: string | null, parentId: number | null = null): Promise<ServiceItem> {
  return tauriInvoke<ServiceItem>("add_service_item", { serviceId, itemType, title, itemId, notes, parentId });
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

export async function moveServiceItemToParent(id: number, parentId: number | null): Promise<void> {
  return tauriInvoke<void>("move_service_item_to_parent", { id, parentId });
}

export async function setServiceWeekDay(id: number, weekDay: number | null): Promise<void> {
  return tauriInvoke<void>("set_service_week_day", { id, weekDay });
}
