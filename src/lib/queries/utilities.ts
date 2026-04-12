import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  adjustCountdownTimer,
  getTimerState,
  addLap,
  runLottery,
  formatText,
  copyImageToMedia,
  getVideoMetadata,
} from "../tauri";
import type { TimerMode, TimerStateData } from "../bindings";
import type { TextFormat } from "../../types/utilities";
import { queryKeys } from "./keys";

function invalidateTimerState(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.utilities.timerState });
}

export function useTimerState(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (options?.enabled === false) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const unsubscribe = await listen<TimerStateData>("timer-state-updated", (event) => {
        if (cancelled) return;
        queryClient.setQueryData(queryKeys.utilities.timerState, event.payload);
      });

      if (cancelled) {
        unsubscribe();
        return;
      }
      unlisten = unsubscribe;
    };

    setup();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [queryClient, options?.enabled]);

  return useQuery({
    queryKey: queryKeys.utilities.timerState,
    queryFn: () => getTimerState(),
    enabled: options?.enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { mode: TimerMode; durationMs?: number | null }) =>
      startTimer(vars.mode, vars.durationMs),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function usePauseTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pauseTimer(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useResumeTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumeTimer(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useResetTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetTimer(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useAdjustCountdownTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { deltaMs: number }) => adjustCountdownTimer(vars.deltaMs),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useAddLap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => addLap(),
    onSuccess: () => {
      invalidateTimerState(queryClient);
    },
  });
}

export function useRunLottery() {
  return useMutation({
    mutationFn: (names: string[]) => runLottery(names),
  });
}

export function useFormatText() {
  return useMutation({
    mutationFn: (vars: { text: string; format: TextFormat }) =>
      formatText(vars.text, vars.format),
  });
}

// Video
export function useGetVideoMetadata(path: string | null) {
  return useQuery({
    queryKey: queryKeys.video.metadata(path ?? ""),
    queryFn: () => getVideoMetadata(path ?? ""),
    enabled: Boolean(path && path.trim().length > 0),
  });
}

export function useCopyImageToMedia() {
  return useMutation({
    mutationFn: (imagePath: string) => copyImageToMedia(imagePath),
  });
}

