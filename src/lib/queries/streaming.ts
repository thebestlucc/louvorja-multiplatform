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
    // Primary invalidation is event-driven via "streaming-status-changed" listener in __root.tsx.
    // This interval is a safety-net fallback only (e.g. app restart, missed events).
    refetchInterval: 60_000,
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
