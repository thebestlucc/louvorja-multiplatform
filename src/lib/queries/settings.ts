import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSetting,
  setSetting,
  getAllSettings,
  clearDatabase,
} from "../tauri";
import { getPreference, getPreferenceSync, setPreference } from "../store";
import { queryKeys } from "./keys";

export function useStorePreference<T>(key: string, fallback: T) {
  return useQuery({
    queryKey: queryKeys.storePrefs.detail(key),
    queryFn: () => getPreference<T>(key, fallback),
    // Synchronous hit from the pre-hydrated store cache avoids a flash of
    // default content on first render (see src/lib/store.ts).
    initialData: () => getPreferenceSync<T>(key, fallback),
    staleTime: Infinity,
  });
}

export function useSetStorePreference<T>(key: string) {
  const queryClient = useQueryClient();
  return (value: T) => {
    queryClient.setQueryData(queryKeys.storePrefs.detail(key), value);
    setPreference(key, value);
  };
}

export function useSetting(key: string) {
  return useQuery({
    queryKey: queryKeys.settings.detail(key),
    queryFn: () => getSetting(key),
  });
}

export function useAllSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => getAllSettings(),
    enabled: options?.enabled,
  });
}

export function useSetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; value: string }) =>
      setSetting(vars.key, vars.value),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.detail(vars.key) });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

export function useClearDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearDatabase(),
    onSuccess: () => {
      // Invalidate all data queries after clearing the database
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.presentations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bible.versions });
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
      // Remove pack sync plan cache so the next check reflects the cleared state
      // (selected_languages is wiped by clear_database; stale cache would show "up to date")
      queryClient.removeQueries({ queryKey: queryKeys.packSyncPlan });
    },
  });
}
