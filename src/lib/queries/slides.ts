import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPresentations,
  getPresentation,
  createPresentation,
  updatePresentation,
  deletePresentation,
  getSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  importSlja,
  exportSlja,
} from "../tauri";
import { queryKeys } from "./keys";

export function usePresentations() {
  return useQuery({
    queryKey: queryKeys.presentations.all,
    queryFn: () => getPresentations(),
  });
}

export function usePresentation(id: number) {
  return useQuery({
    queryKey: queryKeys.presentations.detail(id),
    queryFn: () => getPresentation(id),
    enabled: id > 0,
  });
}

export function useSlides(presentationId: number) {
  return useQuery({
    queryKey: queryKeys.presentations.slides(presentationId),
    queryFn: () => getSlides(presentationId),
    enabled: presentationId > 0,
  });
}

export function useCreatePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, aspectRatio }: { title: string; aspectRatio: string }) =>
      createPresentation(title, aspectRatio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
    },
  });
}

export function useUpdatePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, aspectRatio }: { id: number; title: string; aspectRatio: string }) =>
      updatePresentation(id, title, aspectRatio),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.detail(id) });
    },
  });
}

export function useDeletePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePresentation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
    },
  });
}

export function useCreateSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presentationId, contentJson, sortOrder }: { presentationId: number; contentJson: string; sortOrder: number }) =>
      createSlide(presentationId, contentJson, sortOrder),
    onSuccess: (_, { presentationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(presentationId) });
    },
  });
}

export function useUpdateSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; contentJson: string; presentationId: number }) =>
      updateSlide(vars.id, vars.contentJson),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(vars.presentationId) });
    },
  });
}

export function useDeleteSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; presentationId: number }) =>
      deleteSlide(vars.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(vars.presentationId) });
    },
  });
}

export function useReorderSlides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presentationId, slideIds }: { presentationId: number; slideIds: number[] }) =>
      reorderSlides(presentationId, slideIds),
    onSuccess: (_, { presentationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.slides(presentationId) });
    },
  });
}

export function useImportSlja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => importSlja(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
    },
  });
}

export function useExportSlja() {
  return useMutation({
    mutationFn: ({ presentationId, path }: { presentationId: number; path: string }) =>
      exportSlja(presentationId, path),
  });
}
