import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMediaLibraryCategories,
  upsertMediaLibraryCategory,
  deleteMediaLibraryCategory,
  getMediaLibraryItems,
  getMediaLibraryItemsByDate,
  getMediaLibraryItemDates,
  getScheduledMediaItem,
  upsertMediaLibraryItem,
  deleteMediaLibraryItem,
  searchMediaLibraryItems,
} from "../tauri";
import type { MediaLibraryCategoryInput, MediaLibraryItemInput } from "../bindings";
import { queryKeys } from "./keys";

export function useMediaLibraryCategories(language: string) {
  return useQuery({
    queryKey: queryKeys.mediaLibrary.categories(language),
    queryFn: () => getMediaLibraryCategories(language),
  });
}

export function useUpsertMediaLibraryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MediaLibraryCategoryInput) => upsertMediaLibraryCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mediaLibrary", "categories"] });
    },
  });
}

export function useDeleteMediaLibraryCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMediaLibraryCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mediaLibrary", "categories"] });
    },
  });
}

export function useMediaLibraryItems(categoryId: number) {
  return useQuery({
    queryKey: queryKeys.mediaLibrary.items(categoryId),
    queryFn: () => getMediaLibraryItems(categoryId),
    enabled: categoryId > 0,
  });
}

export function useMediaLibraryItemsByDate(categoryId: number, date: string | null) {
  return useQuery({
    queryKey: queryKeys.mediaLibrary.itemsByDate(categoryId, date),
    queryFn: () => getMediaLibraryItemsByDate(categoryId, date),
    enabled: categoryId > 0,
  });
}

export function useMediaLibraryItemDates(categoryId: number) {
  return useQuery({
    queryKey: queryKeys.mediaLibrary.itemDates(categoryId),
    queryFn: () => getMediaLibraryItemDates(categoryId),
    enabled: categoryId > 0,
  });
}

export function useScheduledMediaItem(categoryId: number, date: string | null) {
  return useQuery({
    queryKey: ["mediaLibrary", "scheduled", categoryId, date],
    queryFn: () => getScheduledMediaItem(categoryId, date!),
    enabled: categoryId > 0 && !!date,
  });
}

export function useUpsertMediaLibraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MediaLibraryItemInput) => upsertMediaLibraryItem(input),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mediaLibrary.items(input.categoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mediaLibrary.itemDates(input.categoryId) });
    },
  });
}

export function useDeleteMediaLibraryItem(categoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMediaLibraryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mediaLibrary.items(categoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mediaLibrary.itemDates(categoryId) });
    },
  });
}

export function useSearchMediaLibraryItems(query: string) {
  return useQuery({
    queryKey: queryKeys.mediaLibrary.search(query),
    queryFn: () => searchMediaLibraryItems(query),
    enabled: query.trim().length >= 2,
  });
}
