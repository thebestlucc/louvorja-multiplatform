import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type { AudioStatusPayload, PlaybackStatus, PlaybackMode, SyncPoint } from "../types/audio";
import { usePresentationStore } from "./presentation-store";
import { projectSlideIndex } from "../lib/projection-playback";

interface AudioStoreState {
  status: PlaybackStatus;
  currentFile: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  playbackMode: PlaybackMode;
  syncPoints: SyncPoint[];
  statusSubscription: (() => void) | null;
  subscriptionToken: number;
  lastSyncSlide: number;
  manualSyncLock: {
    slideIndex: number;
    targetTimestampMs: number;
    expiresAtMs: number;
  } | null;
  setStatus: (status: PlaybackStatus) => void;
  setCurrentFile: (file: string | null) => void;
  setPosition: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setSyncPoints: (points: SyncPoint[]) => void;
  setManualSyncLock: (slideIndex: number, targetTimestampMs: number, holdMs?: number) => void;
  clearManualSyncLock: () => void;
  startStatusSubscription: () => void;
  stopStatusSubscription: () => void;
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
  statusSubscription: null,
  subscriptionToken: 0,
  lastSyncSlide: -1,
  manualSyncLock: null,
  setStatus: (status) => set({ status }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setPosition: (ms) => set({ positionMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  setVolume: (volume) => set({ volume }),
  setPlaybackMode: (mode) => set({ playbackMode: mode }),
  setSyncPoints: (points) => {
    const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
    set({ syncPoints: sorted, lastSyncSlide: -1 });
  },
  setManualSyncLock: (slideIndex, targetTimestampMs, holdMs = 1_200) => {
    set({
      manualSyncLock: {
        slideIndex,
        targetTimestampMs,
        expiresAtMs: Date.now() + holdMs,
      },
      lastSyncSlide: slideIndex,
    });
  },
  clearManualSyncLock: () => set({ manualSyncLock: null }),
  startStatusSubscription: () => {
    const state = get();
    if (state.statusSubscription) {
      return;
    }

    const subscriptionToken = state.subscriptionToken + 1;

    let projectedSlideInFlight = false;
    let queuedSlide: number | null = null;

    const queueSlideProjection = (slideIndex: number) => {
      const state = get();
      if (slideIndex < 0 || slideIndex === state.lastSyncSlide) {
        return;
      }

      set({ lastSyncSlide: slideIndex });
      queuedSlide = slideIndex;

      if (projectedSlideInFlight) {
        return;
      }

      projectedSlideInFlight = true;
      void (async () => {
        while (queuedSlide != null) {
          const nextSlide = queuedSlide;
          queuedSlide = null;
          usePresentationStore.getState().setActiveSlideIndex(nextSlide);
          try {
            await projectSlideIndex(nextSlide);
          } catch {
            // Ignore transient projection update errors.
          }
        }
        projectedSlideInFlight = false;
      })();
    };

    const applyPayload = (payload: AudioStatusPayload) => {
      if (get().subscriptionToken !== subscriptionToken) {
        return;
      }

      const currentState = get();
      const newStatus: PlaybackStatus = payload.isPlaying
        ? "playing"
        : payload.isPaused
          ? "paused"
          : "idle";

      let manualSyncLock = currentState.manualSyncLock;
      if (manualSyncLock && Date.now() >= manualSyncLock.expiresAtMs) {
        manualSyncLock = null;
        set({ manualSyncLock: null });
      }

      set({
        positionMs: payload.positionMs,
        durationMs: payload.durationMs ?? 0,
        volume: payload.volume,
        currentFile: payload.currentFile,
        status: newStatus,
      });

      if ((payload.isPlaying || payload.isPaused) && currentState.syncPoints.length > 0) {
        const targetSlide = findSlideAtPosition(currentState.syncPoints, payload.positionMs);
        if (targetSlide >= 0) {
          if (manualSyncLock) {
            const lockReached =
              targetSlide === manualSyncLock.slideIndex ||
              Math.abs(payload.positionMs - manualSyncLock.targetTimestampMs) <= 300;

            if (!lockReached && targetSlide !== manualSyncLock.slideIndex) {
              return;
            }

            set({ manualSyncLock: null });
          }
          queueSlideProjection(targetSlide);
        }
      }

      if (!payload.isPlaying && !payload.isPaused) {
        get().stopStatusSubscription();
      }
    };

    set({ lastSyncSlide: -1, subscriptionToken });

    void listen<AudioStatusPayload>("audio-status", (event) => {
      applyPayload(event.payload);
    })
      .then((unlisten) => {
        if (get().subscriptionToken !== subscriptionToken) {
          unlisten();
          return;
        }
        set({ statusSubscription: unlisten });
      })
      .catch(() => {
        // Keep store usable even if event listener fails to initialize.
      });
  },
  stopStatusSubscription: () => {
    const { statusSubscription, subscriptionToken } = get();
    if (statusSubscription) {
      try {
        statusSubscription();
      } catch {
        // Ignore unlisten errors during teardown.
      }
    }
    set({
      statusSubscription: null,
      subscriptionToken: subscriptionToken + 1,
      lastSyncSlide: -1,
      manualSyncLock: null,
    });
  },
  reset: () => {
    const { statusSubscription, subscriptionToken } = get();
    if (statusSubscription) {
      try {
        statusSubscription();
      } catch {
        // Ignore unlisten errors during reset.
      }
    }
    set({
      status: "idle",
      currentFile: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      playbackMode: "sung",
      syncPoints: [],
      statusSubscription: null,
      subscriptionToken: subscriptionToken + 1,
      lastSyncSlide: -1,
      manualSyncLock: null,
    });
  },
}));
