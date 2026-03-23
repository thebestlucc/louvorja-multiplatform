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
    refetchInterval: (query) => {
      return query.state.data?.isRunning ? 2000 : 30000;
    },
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
