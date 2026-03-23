import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  planPackSync,
  startPackSync,
  cancelPackSync,
  clearManifestCache,
} from "../tauri";
import type { PackSyncPlanItem } from "../../types/content-sync";
import { queryKeys } from "./keys";

export function usePlanPackSync(options?: {
  enabled?: boolean;
  forceRefresh?: boolean;
  selectedLanguages?: string[];
}) {
  const forceRefresh = options?.forceRefresh ?? false;
  const selectedLanguages = options?.selectedLanguages?.length ? options.selectedLanguages : null;
  return useQuery({
    queryKey: [...queryKeys.packSyncPlan, forceRefresh, selectedLanguages],
    queryFn: () => planPackSync(forceRefresh, selectedLanguages),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartPackSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars?: { items?: PackSyncPlanItem[] | null; selectedLanguages?: string[] | null }) =>
      startPackSync(vars?.items, vars?.selectedLanguages),
    onSuccess: () => {
      // Clear the manifest cache so the bell disappears and the next check fetches fresh
      void clearManifestCache();
      void queryClient.invalidateQueries({ queryKey: queryKeys.packSyncPlan });
    },
  });
}

export function useClearManifestCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearManifestCache(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.packSyncPlan });
    },
  });
}

export function useCancelPackSync() {
  return useMutation({
    mutationFn: (runId: string) => cancelPackSync(runId),
  });
}
