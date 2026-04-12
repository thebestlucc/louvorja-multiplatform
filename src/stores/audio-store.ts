import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { catcher, catcherSync } from "../lib/catcher";
import type { AudioStatusPayload, SyncPoint } from "../lib/bindings";
import type { PlaybackStatus, PlaybackMode } from "../types/audio";
import {
  findSlideAtPosition,
  resolvePlaybackModeSwitchPosition,
  resolvePlaybackSeekLockAction,
} from "../lib/audio-sync";
import { usePresentationStore } from "./presentation-store";
import { useDisplayStore } from "./display-store";
import { useMediaPlayerStore } from "./media-player-store";
import { projectSlideIndex } from "../lib/projection-playback";
import {
  audioPlay,
  audioPlayVariants,
  audioPause,
  audioResume,
  audioSetOutputMuted,
  audioStop,
  audioSeek,
  audioSetVolume,
  audioSwitchVariant,
} from "../lib/tauri";

interface AudioStoreState {
  status: PlaybackStatus;
  currentFile: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  outputMuted: boolean;
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
  setOutputMuted: (muted: boolean) => Promise<void>;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setSyncPoints: (points: SyncPoint[]) => void;
  setOnFinished: (callback: (() => void) | null) => void;
  /** Immediately sync active slide to a given audio position (e.g. after seek). */
  syncToPosition: (positionMs: number) => void;
  startStatusSubscription: () => void;
  stopStatusSubscription: () => void;
  reset: () => void;

  // Centralized Audio Actions
  play: (filePath: string, positionMs?: number, preserveLivePosition?: boolean) => Promise<void>;
  playVariants: (
    sungFilePath: string,
    karaokeFilePath: string,
    activeMode: "sung" | "karaoke",
    positionMs?: number,
  ) => Promise<void>;
  switchVariant: (
    activeMode: "sung" | "karaoke",
    activeFilePath: string,
  ) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
}

export const useAudioStore = create<AudioStoreState>((set, get) => {
  let projectedSlideInFlight = false;
  let queuedProjectionSlide: number | null = null;

  const queueProjectedSlide = (slideIndex: number) => {
    if (slideIndex < 0) {
      return;
    }

    queuedProjectionSlide = slideIndex;
    if (projectedSlideInFlight) {
      return;
    }

    projectedSlideInFlight = true;
    void (async () => {
      while (queuedProjectionSlide != null) {
        const nextSlide = queuedProjectionSlide;
        queuedProjectionSlide = null;
        await catcher(projectSlideIndex(nextSlide), { notify: false });
      }
      projectedSlideInFlight = false;
    })();
  };

  const syncPlaybackSlide = (slideIndex: number) => {
    const state = get();
    if (slideIndex < 0 || slideIndex === state.lastSyncSlide) {
      return;
    }

    set({ lastSyncSlide: slideIndex });
    usePresentationStore.getState().setActiveSlideIndex(slideIndex);
    useMediaPlayerStore.getState().setActiveSlideIndex(slideIndex);

    const displayState = useDisplayStore.getState();
    if (displayState.currentProjectionType === "hymn") {
      queueProjectedSlide(slideIndex);
    }
  };

  return ({
  status: "idle",
  currentFile: null,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  outputMuted: false,
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
  setOutputMuted: async (muted) => {
    await audioSetOutputMuted(muted);
    set({ outputMuted: muted });
  },
  setPlaybackMode: (mode) => set({ playbackMode: mode }),
  setSyncPoints: (points) => set({ syncPoints: [...points], lastSyncSlide: -1 }),
  setOnFinished: (callback) => set({ onFinished: callback }),
  syncToPosition: (positionMs: number) => {
    const state = get();
    if (state.syncPoints.length === 0) return;
    const slideIndex = findSlideAtPosition(state.syncPoints, positionMs, state.playbackMode);
    syncPlaybackSlide(slideIndex);
  },
  startStatusSubscription: () => {
    const state = get();
    if (state.statusSubscription) {
      return;
    }

    const subscriptionToken = state.subscriptionToken + 1;

    const applyPayload = (payload: AudioStatusPayload) => {
      if (get().subscriptionToken !== subscriptionToken) {
        return;
      }

      const currentState = get();
      
      // Handle seek lock: ignore stale payloads from before a recent seek
      let seekLock = currentState.seekLock;
      if (seekLock) {
        const seekLockAction = resolvePlaybackSeekLockAction(payload.positionMs, seekLock);
        if (seekLockAction === "expired" || seekLockAction === "release") {
          seekLock = null;
          set({ seekLock: null });
        } else if (seekLockAction === "ignore") {
          return;
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
        const targetSlide = findSlideAtPosition(
          currentState.syncPoints,
          payload.positionMs,
          currentState.playbackMode,
        );
        syncPlaybackSlide(targetSlide);
      }

      if (!payload.isPlaying && !payload.isPaused) {
        const finishedCallback = get().onFinished;
        get().stopStatusSubscription();
        if (finishedCallback) {
          finishedCallback();
        }
      }
    };

    set({ lastSyncSlide: -1, subscriptionToken });

    listen<AudioStatusPayload>("audio-status", (event) => {
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
    queuedProjectionSlide = null;
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
    queuedProjectionSlide = null;
    set({
      status: "idle",
      currentFile: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      outputMuted: false,
      playbackMode: "sung",
      syncPoints: [],
      statusSubscription: null,
      subscriptionToken: subscriptionToken + 1,
      lastSyncSlide: -1,
      seekLock: null,
    });
  },

  play: async (filePath: string, positionMs?: number, preserveLivePosition?: boolean) => {
    const targetMs = positionMs != null ? resolvePlaybackModeSwitchPosition(positionMs) : undefined;
    if (targetMs != null && targetMs > 0) {
      set({
        positionMs: targetMs,
        currentFile: filePath,
        seekLock: { targetMs, expiresAtMs: Date.now() + 1000 },
      });
    }
    get().startStatusSubscription();
    await audioPlay(filePath, targetMs, preserveLivePosition ?? false);
  },
  playVariants: async (
    sungFilePath: string,
    karaokeFilePath: string,
    activeMode: "sung" | "karaoke",
    positionMs?: number,
  ) => {
    const targetMs = positionMs != null ? resolvePlaybackModeSwitchPosition(positionMs) : undefined;
    const activeFilePath = activeMode === "karaoke" ? karaokeFilePath : sungFilePath;
    if (targetMs != null && targetMs > 0) {
      set({
        positionMs: targetMs,
        currentFile: activeFilePath,
        seekLock: { targetMs, expiresAtMs: Date.now() + 1000 },
      });
    } else {
      set({ currentFile: activeFilePath });
    }
    get().startStatusSubscription();
    await audioPlayVariants(sungFilePath, karaokeFilePath, activeMode, targetMs);
  },
  switchVariant: async (activeMode: "sung" | "karaoke", activeFilePath: string) => {
    set({ currentFile: activeFilePath });
    await audioSwitchVariant(activeMode);
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
    // audioStop may fail if audio was never initialized (e.g. video-only playback)
    await catcher(audioStop(), { notify: false });
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
  });
});
