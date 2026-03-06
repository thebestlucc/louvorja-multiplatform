import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { catcher, catcherSync } from "../lib/catcher";
import type { AudioStatusPayload, SyncPoint } from "../lib/bindings";
import type { PlaybackStatus, PlaybackMode } from "../types/audio";
import { usePresentationStore } from "./presentation-store";
import { useDisplayStore } from "./display-store";
import { projectSlideIndex } from "../lib/projection-playback";
import { audioPlay, audioPause, audioResume, audioStop, audioSeek, audioSetVolume } from "../lib/tauri";

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
  onFinished: (() => void) | null;
  seekLock: {
    targetMs: number;
    expiresAtMs: number;
  } | null;
  setStatus: (status: PlaybackStatus) => void;
  setCurrentFile: (file: string | null) => void;
  setPosition: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setSyncPoints: (points: SyncPoint[]) => void;
  setOnFinished: (callback: (() => void) | null) => void;
  /** Immediately sync active slide to a given audio position (e.g. after seek). */
  syncToPosition: (positionMs: number) => void;
  startStatusSubscription: () => void;
  stopStatusSubscription: () => void;
  reset: () => void;

  // Centralized Audio Actions
  play: (filePath: string, positionMs?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
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
  // Before the first sync point → title/cover slide (index 0)
  return slide >= 0 ? slide : 0;
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
  onFinished: null,
  seekLock: null,
  setStatus: (status) => set({ status }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setPosition: (ms) => set({ positionMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  setVolume: async (volume) => {
    await audioSetVolume(volume);
    set({ volume });
  },
  setPlaybackMode: (mode) => set({ playbackMode: mode }),
  setSyncPoints: (points) => {
    console.log("[audio-store] setSyncPoints called with", points.length, "points:", points);
    const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
    set({ syncPoints: sorted, lastSyncSlide: -1 });
  },
  setOnFinished: (callback) => set({ onFinished: callback }),
  syncToPosition: (positionMs: number) => {
    const state = get();
    if (state.syncPoints.length === 0) return;
    const slideIndex = findSlideAtPosition(state.syncPoints, positionMs);
    if (slideIndex >= 0 && slideIndex !== state.lastSyncSlide) {
      set({ lastSyncSlide: slideIndex });
      usePresentationStore.getState().setActiveSlideIndex(slideIndex);
      // Only project if projection is explicitly active
      const displayState = useDisplayStore.getState();
      if (displayState.currentProjectionType !== null &&
          (displayState.projectorWindowOpen || displayState.returnWindowOpen)) {
        void projectSlideIndex(slideIndex);
      }
    }
  },
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
      console.log("[audio-store] queueSlideProjection called with slideIndex=", slideIndex, "lastSyncSlide=", state.lastSyncSlide);
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
          // Check fresh state each iteration: only project if projection is
          // explicitly active (not just because windows happen to be open).
          const displayState = useDisplayStore.getState();
          const shouldProject = displayState.currentProjectionType !== null &&
            (displayState.projectorWindowOpen || displayState.returnWindowOpen);
          console.log("[audio-store] Syncing slide:", nextSlide, "shouldProject:", shouldProject);
          usePresentationStore.getState().setActiveSlideIndex(nextSlide);
          if (shouldProject) {
            await catcher(projectSlideIndex(nextSlide), { notify: false });
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
      
      // Handle seek lock: ignore stale payloads from before a recent seek
      let seekLock = currentState.seekLock;
      if (seekLock) {
        if (Date.now() >= seekLock.expiresAtMs) {
          seekLock = null;
          set({ seekLock: null });
        } else if (Math.abs(payload.positionMs - seekLock.targetMs) > 400) {
          // Payload is likely stale (prior to the seek), ignore it
          return;
        } else {
          // Payload has caught up to the seek
          seekLock = null;
          set({ seekLock: null });
        }
      }

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

      if ((payload.isPlaying || payload.isPaused) && currentState.syncPoints.length > 0) {
        const targetSlide = findSlideAtPosition(currentState.syncPoints, payload.positionMs);
        console.log("[audio-store] Sync check: positionMs=", payload.positionMs, "targetSlide=", targetSlide, "syncPoints=", currentState.syncPoints.length);
        if (targetSlide >= 0) {
          queueSlideProjection(targetSlide);
        }
      } else if (payload.isPlaying || payload.isPaused) {
        console.log("[audio-store] No sync points available, syncPoints.length=", currentState.syncPoints.length);
      }

      if (!payload.isPlaying && !payload.isPaused) {
        const finishedCallback = get().onFinished;
        get().stopStatusSubscription();
        if (finishedCallback) {
          console.log("[audio-store] Playback finished, calling onFinished callback");
          finishedCallback();
        }
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
      catcherSync(statusSubscription, { notify: false });
    }
    set({
      statusSubscription: null,
      subscriptionToken: subscriptionToken + 1,
      lastSyncSlide: -1,
      seekLock: null,
    });
  },
  reset: () => {
    const { statusSubscription, subscriptionToken } = get();
    if (statusSubscription) {
      catcherSync(statusSubscription, { notify: false });
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
      seekLock: null,
    });
  },

  play: async (filePath: string, positionMs?: number) => {
    get().startStatusSubscription();
    await audioPlay(filePath, positionMs);
  },
  pause: async () => {
    await audioPause();
    set({ status: "paused" });
  },
  resume: async () => {
    get().startStatusSubscription();
    await audioResume();
  },
  stop: async () => {
    await audioStop();
    get().stopStatusSubscription();
    set({ status: "idle", positionMs: 0 });
  },
  seek: async (ms: number) => {
    // Optimistically apply the new position and lock it to prevent flicker
    set({
      positionMs: ms,
      seekLock: { targetMs: ms, expiresAtMs: Date.now() + 1000 }
    });
    get().syncToPosition(ms);
    await audioSeek(ms);
  }
}));
