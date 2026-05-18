import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMonitorConfigs,
  setMonitorConfig,
  identifyMonitors,
  setAlert,
  clearAlert,
  toggleBlackScreen,
  toggleLogoScreen,
  setSetting,
  updateGlobalShortcut,
} from "../tauri";
import { queryKeys } from "./keys";

export function useMonitorConfigs() {
  return useQuery({
    queryKey: queryKeys.monitors.configs,
    queryFn: () => getMonitorConfigs(),
    staleTime: Infinity,
    gcTime: Infinity, // monitor role assignments persist for the session
  });
}

export function useSaveMonitorConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { monitorId: string; role: string }) =>
      setMonitorConfig(vars.monitorId, vars.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
    },
  });
}

export function useSetShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; layer: "local" | "global"; value: string }) => {
      const key = `shortcut.${vars.id}.${vars.layer}`;
      await setSetting(key, vars.value);
      if (vars.layer === "global") {
        await updateGlobalShortcut(vars.id, vars.value);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.detail(`shortcut.${vars.id}.${vars.layer}`),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

// Overlay / Display — read state via useProjectionState (Phase 5). The
// mutations below no longer cache their response in queryKeys.overlay; the
// Hub broadcasts a projection-delta that all consumers pick up directly.
export function useToggleBlackScreen() {
  return useMutation({ mutationFn: () => toggleBlackScreen() });
}

export function useToggleLogoScreen() {
  return useMutation({ mutationFn: () => toggleLogoScreen() });
}

export function useSetAlert() {
  return useMutation({
    mutationFn: ({ text, isTicker }: { text: string; isTicker: boolean }) =>
      setAlert(text, isTicker),
  });
}

export function useClearAlert() {
  return useMutation({ mutationFn: () => clearAlert() });
}

export function useIdentifyMonitors() {
  return useMutation({
    mutationFn: () => identifyMonitors(),
  });
}

