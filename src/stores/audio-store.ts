import { create } from "zustand";
import type { PlaybackStatus, PlaybackMode, SyncPoint } from "../types/audio";
import { audioGetStatus } from "../lib/tauri";
import { usePresentationStore } from "./presentation-store";

interface AudioStoreState {
  status: PlaybackStatus;
  currentFile: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  playbackMode: PlaybackMode;
  syncPoints: SyncPoint[];
  pollingInterval: ReturnType<typeof setInterval> | null;
  lastSyncSlide: number;
  setStatus: (status: PlaybackStatus) => void;
  setCurrentFile: (file: string | null) => void;
  setPosition: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setSyncPoints: (points: SyncPoint[]) => void;
  startPolling: () => void;
  stopPolling: () => void;
  reset: () => void;
}

function findSlideAtPosition(syncPoints: SyncPoint[], positionMs: number): number {
  let slide = -1;
  for (const point of syncPoints) {
    if (positionMs >= point.timestampMs) {
      slide = point.slideIndex;
    } else {
      break;
    }
  }
  return slide;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  status: "idle",
  currentFile: null,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  playbackMode: "sung",
  syncPoints: [],
  pollingInterval: null,
  lastSyncSlide: -1,
  setStatus: (status) => set({ status }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setPosition: (ms) => set({ positionMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  setVolume: (volume) => set({ volume }),
  setPlaybackMode: (mode) => set({ playbackMode: mode }),
  setSyncPoints: (points) => {
    const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
    set({ syncPoints: sorted });
  },
  startPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) return;

    const interval = setInterval(async () => {
      try {
        const payload = await audioGetStatus();
        const state = get();

        const newStatus: PlaybackStatus = payload.isPlaying
          ? "playing"
          : payload.isPaused
            ? "paused"
            : "idle";

        set({
          positionMs: payload.positionMs,
          durationMs: payload.durationMs ?? 0,
          volume: payload.volume,
          currentFile: payload.currentFile,
          status: newStatus,
        });

        // Auto-advance slides based on sync points
        if (newStatus === "playing" && state.syncPoints.length > 0) {
          const targetSlide = findSlideAtPosition(state.syncPoints, payload.positionMs);
          if (targetSlide >= 0 && targetSlide !== state.lastSyncSlide) {
            set({ lastSyncSlide: targetSlide });
            usePresentationStore.getState().setActiveSlideIndex(targetSlide);
          }
        }

        // Stop polling if playback has ended
        if (!payload.isPlaying && !payload.isPaused && state.status === "playing") {
          get().stopPolling();
          set({ status: "idle", positionMs: 0 });
        }
      } catch {
        // Ignore polling errors
      }
    }, 100);

    set({ pollingInterval: interval });
  },
  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },
  reset: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    set({
      status: "idle",
      currentFile: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      playbackMode: "sung",
      syncPoints: [],
      pollingInterval: null,
      lastSyncSlide: -1,
    });
  },
}));
