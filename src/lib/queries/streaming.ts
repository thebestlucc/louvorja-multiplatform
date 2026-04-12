import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startStreamingServer,
  stopStreamingServer,
  getStreamingStatus,
  setStreamingBroadcast,
} from "../tauri";
import { queryKeys } from "./keys";

export function useStreamingStatus() {
  return useQuery({
    queryKey: queryKeys.streaming.status,
    queryFn: () => getStreamingStatus(),
    // Event-driven — invalidation is triggered by the "streaming-status-changed"
    // listener in __root.tsx. Rust emits that event on server start/stop AND on
    // every SSE client connect/disconnect, so no polling is needed.
    refetchInterval: false,
  });
}

export function useStartStreaming() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (port?: number) => startStreamingServer(port),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
    },
  });
}

export function useStopStreaming() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => stopStreamingServer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
    },
  });
}

export function useSetStreamingBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setStreamingBroadcast(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
    },
  });
}
