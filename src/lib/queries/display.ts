import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMonitorConfigs,
  setMonitorConfig,
  identifyMonitors,
  setAlert,
  clearAlert,
  toggleBlackScreen,
  toggleLogoScreen,
  getOverlayState,
  setSetting,
  updateGlobalShortcut,
} from "../tauri";
import { queryKeys } from "./keys";

export function useMonitorConfigs() {
  return useQuery({
    queryKey: queryKeys.monitors.configs,
    queryFn: () => getMonitorConfigs(),
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
        queryKey: ["setting", `shortcut.${vars.id}.${vars.layer}`],
      });
    },
  });
}

// Overlay / Display
export function useOverlayState() {
  return useQuery({
    queryKey: queryKeys.overlay,
    queryFn: () => getOverlayState(),
  });
}

export function useToggleBlackScreen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => toggleBlackScreen(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.overlay, data);
    },
  });
}

export function useToggleLogoScreen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => toggleLogoScreen(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.overlay, data);
    },
  });
}

export function useSetAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text, isTicker }: { text: string; isTicker: boolean }) =>
      setAlert(text, isTicker),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.overlay, data);
    },
  });
}

export function useClearAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearAlert(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.overlay, data);
    },
  });
}

export function useIdentifyMonitors() {
  return useMutation({
    mutationFn: () => identifyMonitors(),
  });
}

