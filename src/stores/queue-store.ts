// src/stores/queue-store.ts
import { create } from "zustand";
import type { Hymn } from "../lib/bindings";

export interface QueueItem {
  id: string;
  hymn?: Hymn;
  title?: string;
  type: "audio" | "playback" | "projection";
}

interface QueueState {
  // Two-section model
  manualQueue: QueueItem[];
  sourceQueue: QueueItem[];
  sourceLabel: string;

  // Playback state
  currentIndex: number; // index into allItems (manualQueue + sourceQueue)
  repeat: "off" | "one" | "all";
  shuffle: boolean;

  // Derived (set explicitly on every mutation)
  items: QueueItem[]; // = manualQueue + sourceQueue (backwards compatible)

  // Existing actions (backwards compatible)
  addToQueue: (items: QueueItem[], clearExisting?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
  shuffleQueue: () => void;

  // New actions
  addToQueueNext: (item: QueueItem) => void;
  setSourceQueue: (items: QueueItem[], label: string) => void;
  clearManualQueue: () => void;
  setRepeat: (mode: "off" | "one" | "all") => void;
  setShuffle: (enabled: boolean) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  manualQueue: [],
  sourceQueue: [],
  sourceLabel: "",
  currentIndex: -1,
  repeat: "off",
  shuffle: false,

  // items is derived — set explicitly in every mutation below
  items: [],

  // -- Backwards-compatible actions --

  addToQueue: (newItems, clearExisting = false) =>
    set((state) => {
      const manualQueue = clearExisting ? newItems : [...state.manualQueue, ...newItems];
      const sourceQueue = clearExisting ? [] : state.sourceQueue;
      const allItems = [...manualQueue, ...sourceQueue];
      return {
        manualQueue,
        sourceQueue: clearExisting ? [] : state.sourceQueue,
        sourceLabel: clearExisting ? "" : state.sourceLabel,
        items: allItems,
        currentIndex: clearExisting
          ? (newItems.length > 0 ? 0 : -1)
          : state.currentIndex === -1 && newItems.length > 0
            ? 0
            : state.currentIndex,
      };
    }),

  removeFromQueue: (index) =>
    set((state) => {
      const allItems = [...state.manualQueue, ...state.sourceQueue];
      if (index < 0 || index >= allItems.length) return state;

      const manualQueue = [...state.manualQueue];
      const sourceQueue = [...state.sourceQueue];

      if (index < manualQueue.length) {
        manualQueue.splice(index, 1);
      } else {
        sourceQueue.splice(index - state.manualQueue.length, 1);
      }

      const newAll = [...manualQueue, ...sourceQueue];
      let newIndex = state.currentIndex;
      if (index < state.currentIndex) {
        newIndex--;
      } else if (index === state.currentIndex) {
        if (newAll.length === 0) newIndex = -1;
        else if (index >= newAll.length) newIndex = newAll.length - 1;
      }

      return { manualQueue, sourceQueue, items: newAll, currentIndex: newIndex };
    }),

  clearQueue: () =>
    set({ manualQueue: [], sourceQueue: [], sourceLabel: "", items: [], currentIndex: -1 }),

  setCurrentIndex: (index) => set({ currentIndex: index }),

  next: () =>
    set((state) => {
      const allItems = [...state.manualQueue, ...state.sourceQueue];
      if (state.repeat === "one") return state; // handled by audio onFinished re-triggering same index
      if (state.currentIndex < allItems.length - 1) {
        return { currentIndex: state.currentIndex + 1 };
      }
      if (state.repeat === "all" && allItems.length > 0) {
        return { currentIndex: 0 };
      }
      return state;
    }),

  prev: () =>
    set((state) => ({
      currentIndex: state.currentIndex > 0 ? state.currentIndex - 1 : state.currentIndex,
    })),

  shuffleQueue: () =>
    set((state) => {
      if (state.manualQueue.length <= 1) return state;
      const currentItem = state.currentIndex >= 0 && state.currentIndex < state.manualQueue.length
        ? state.manualQueue[state.currentIndex]
        : null;
      const otherItems = state.manualQueue.filter((_, i) => i !== state.currentIndex);

      for (let i = otherItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]];
      }

      const manualQueue = currentItem ? [currentItem, ...otherItems] : otherItems;
      return {
        manualQueue,
        items: [...manualQueue, ...state.sourceQueue],
        currentIndex: currentItem ? 0 : state.currentIndex,
      };
    }),

  // -- New actions --

  addToQueueNext: (item) =>
    set((state) => {
      const insertAt = Math.min(state.currentIndex + 1, state.manualQueue.length);
      const manualQueue = [...state.manualQueue];
      manualQueue.splice(insertAt, 0, item);
      return { manualQueue, items: [...manualQueue, ...state.sourceQueue] };
    }),

  setSourceQueue: (items, label) =>
    set((state) => ({
      sourceQueue: items,
      sourceLabel: label,
      items: [...state.manualQueue, ...items],
    })),

  clearManualQueue: () =>
    set((state) => ({
      manualQueue: [],
      items: [...state.sourceQueue],
      currentIndex: state.currentIndex >= state.manualQueue.length
        ? state.currentIndex - state.manualQueue.length
        : 0,
    })),

  setRepeat: (mode) => set({ repeat: mode }),
  setShuffle: (enabled) => set({ shuffle: enabled }),
}));
