// src/stores/media-player-store.ts
import { create } from "zustand";
import type { SlideContent, SyncPoint } from "../lib/bindings";
import type { MediaItem, MediaStatus, TimelineSource } from "../types/media";

interface MediaPlayerState {
  // --- Current item ---
  currentItem: MediaItem | null;
  status: MediaStatus;

  // --- Timeline (normalized to ms) ---
  currentTime: number;
  duration: number;
  timelineSource: TimelineSource;

  // --- Slides ---
  slides: SlideContent[];
  activeSlideIndex: number;
  syncPoints: SyncPoint[];

  // --- Overlay ---
  overlay: "black" | "logo" | null;

  // --- Error ---
  error: string | null;

  // --- Actions ---
  load: (item: MediaItem) => void;
  setStatus: (status: MediaStatus) => void;
  setError: (error: string | null) => void;

  updateTimeline: (currentTime: number, duration: number, source: TimelineSource) => void;

  setSlides: (slides: SlideContent[], syncPoints?: SyncPoint[]) => void;
  setActiveSlideIndex: (index: number) => void;

  setOverlay: (overlay: "black" | "logo" | null) => void;

  stop: () => void;
}

const initialState = {
  currentItem: null,
  status: "idle" as MediaStatus,
  currentTime: 0,
  duration: 0,
  timelineSource: "none" as TimelineSource,
  slides: [] as SlideContent[],
  activeSlideIndex: 0,
  syncPoints: [] as SyncPoint[],
  overlay: null as "black" | "logo" | null,
  error: null as string | null,
};

export const useMediaPlayerStore = create<MediaPlayerState>((set) => ({
  ...initialState,

  load: (item) =>
    set({
      currentItem: item,
      status: "loading",
      currentTime: 0,
      duration: 0,
      error: null,
      overlay: null,
      // Slides populated immediately for hymn/presentation
      slides: "slides" in item ? item.slides : [],
      syncPoints: "syncPoints" in item ? item.syncPoints : [],
      activeSlideIndex: 0,
      timelineSource:
        item.type === "hymn" && item.mode !== "silent"
          ? "audio"
          : item.type === "online_video" || item.type === "offline_video"
            ? "video"
            : "none",
    }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: error ? "error" : "idle" }),

  updateTimeline: (currentTime, duration, source) =>
    set((state) => {
      // Only accept updates from the active source
      if (state.timelineSource !== source) return state;
      return { currentTime, duration };
    }),

  setSlides: (slides, syncPoints) =>
    set({
      slides,
      activeSlideIndex: 0,
      ...(syncPoints !== undefined ? { syncPoints } : {}),
    }),

  setActiveSlideIndex: (index) =>
    set((state) => {
      if (index < 0 || index >= state.slides.length) return state;
      return { activeSlideIndex: index };
    }),

  setOverlay: (overlay) => set({ overlay }),

  stop: () => set({ ...initialState }),
}));
