import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  addServiceItem,
  removeServiceItem,
  reorderServiceItems,
  duplicateService,
  updateServiceItem,
  toggleFavorite,
  getFavorites,
  isFavorite,
  getFavoriteHymns,
  getFavoriteCollections,
  getAllFavoriteIds,
  setServiceWeekDay,
  moveServiceItemToParent,
} from "../tauri";
import { queryKeys } from "./keys";

export function useLiturgies() {
  return useQuery({
    queryKey: queryKeys.services.all,
    queryFn: () => getServices(),
    staleTime: 30_000,
  });
}

export function useLiturgy(id: number) {
  return useQuery({
    queryKey: queryKeys.services.detail(id),
    queryFn: () => getService(id),
    enabled: id > 0,
    staleTime: 0,
  });
}

export function useCreateLiturgy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; date: string | null; notes: string | null }) =>
      createService(vars.title, vars.date, vars.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useUpdateLiturgy() {
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

export function useDeleteLiturgy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useDuplicateLiturgy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => duplicateService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });
}

export function useAddLiturgyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serviceId: number; itemType: string; title: string; itemId: number | null; notes: string | null; parentId?: number | null }) =>
      addServiceItem(vars.serviceId, vars.itemType, vars.title, vars.itemId, vars.notes, vars.parentId ?? null),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

export function useRemoveLiturgyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; serviceId: number }) => removeServiceItem(vars.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

export function useReorderLiturgyItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serviceId: number; itemIds: number[] }) =>
      reorderServiceItems(vars.serviceId, vars.itemIds),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

export function useSetLiturgyWeekDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; weekDay: number | null }) =>
      setServiceWeekDay(vars.id, vars.weekDay),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.id) });
    },
  });
}

export function useMoveLiturgyItemToParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; serviceId: number; parentId: number | null }) =>
      moveServiceItemToParent(vars.id, vars.parentId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

/** @deprecated Use useMoveLiturgyItemToParent */
export const useMoveServiceItemToParent = useMoveLiturgyItemToParent;

export function useUpdateLiturgyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; serviceId: number; title: string; notes: string | null }) =>
      updateServiceItem(vars.id, vars.title, vars.notes),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(vars.serviceId) });
    },
  });
}

// Backward-compatible aliases (deprecated)
/** @deprecated Use useLiturgies */
export const useServices = useLiturgies;
/** @deprecated Use useLiturgy */
export const useService = useLiturgy;
/** @deprecated Use useCreateLiturgy */
export const useCreateService = useCreateLiturgy;
/** @deprecated Use useUpdateLiturgy */
export const useUpdateService = useUpdateLiturgy;
/** @deprecated Use useDeleteLiturgy */
export const useDeleteService = useDeleteLiturgy;
/** @deprecated Use useDuplicateLiturgy */
export const useDuplicateService = useDuplicateLiturgy;
/** @deprecated Use useAddLiturgyItem */
export const useAddServiceItem = useAddLiturgyItem;
/** @deprecated Use useRemoveLiturgyItem */
export const useRemoveServiceItem = useRemoveLiturgyItem;
/** @deprecated Use useReorderLiturgyItems */
export const useReorderServiceItems = useReorderLiturgyItems;
/** @deprecated Use useSetLiturgyWeekDay */
export const useSetServiceWeekDay = useSetLiturgyWeekDay;
/** @deprecated Use useUpdateLiturgyItem */
export const useUpdateServiceItem = useUpdateLiturgyItem;

// Favorites
export function useFavorites(itemType: string) {
  return useQuery({
    queryKey: queryKeys.favorites.all(itemType),
    queryFn: () => getFavorites(itemType),
    staleTime: 60_000,
  });
}

export function useFavoriteHymns(query?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.favorites.all("hymn", query),
    queryFn: () => getFavoriteHymns(query),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useFavoriteCollections(query?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.favorites.all("collection", query),
    queryFn: () => getFavoriteCollections(query),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useIsFavorite(itemType: string, itemId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.favorites.isFavorite(itemType, itemId),
    queryFn: () => isFavorite(itemType, itemId),
    enabled: (options?.enabled ?? true) && itemId > 0,
    staleTime: 60_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemType, itemId }: { itemType: string; itemId: number }) =>
      toggleFavorite(itemType, itemId),
    onSuccess: (_, { itemType, itemId }) => {
      // Use ["favorites", itemType] prefix to invalidate ALL favorite list queries
      // regardless of the active search term
      queryClient.invalidateQueries({ queryKey: ["favorites", itemType] });
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.isFavorite(itemType, itemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.allIds(itemType) });
    },
  });
}

export function useFavoriteIds(itemType: string) {
  return useQuery({
    queryKey: queryKeys.favorites.allIds(itemType),
    queryFn: () => getAllFavoriteIds(itemType),
    staleTime: 30_000,
    select: (ids) => new Set(ids),
  });
}
