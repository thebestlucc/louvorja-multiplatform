import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../bindings";
import { queryKeys } from "./keys";
import { notify } from "../notifications";

export function useRemoteStatus() {
  return useQuery({
    queryKey: queryKeys.remote.status,
    queryFn: async () => {
      const result = await commands.getRemoteStatus();
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    // Event-driven — invalidation triggered by "remote-server-status" listener.
    refetchInterval: false,
  });
}

export function useStartRemoteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (port?: number) => {
      const result = await commands.startRemoteServer(port ?? null);
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.status });
    },
  });
}

export function useStopRemoteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await commands.stopRemoteServer();
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.status });
    },
  });
}

export function useBeginPairing() {
  return useMutation({
    mutationFn: async () => {
      const result = await commands.beginPairing();
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
  });
}

export function useCancelPairing() {
  return useMutation({
    mutationFn: async () => {
      const result = await commands.cancelPairing();
      if (result.status === "error") throw new Error(String(result.error));
    },
  });
}

export function usePairedDevices() {
  return useQuery({
    queryKey: queryKeys.remote.devices,
    queryFn: async () => {
      const result = await commands.listPairedDevices();
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
  });
}

export function useRevokePairedDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await commands.revokePairedDevice(id);
      if (result.status === "error") throw new Error(String(result.error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.devices });
    },
    onError: () => {
      notify.error("Failed to revoke device");
    },
  });
}
