import { create } from "zustand";
import type { Hymn } from "../lib/bindings";

export interface QueueItem {
  id: string;
  hymn?: Hymn;
  title?: string;
  type: "audio" | "playback" | "projection";
}

interface QueueState {
  items: QueueItem[];
  currentIndex: number;
  addToQueue: (items: QueueItem[], clearExisting?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
  shuffleQueue: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  currentIndex: -1,
  addToQueue: (newItems, clearExisting = false) => set((state) => ({
    items: clearExisting ? newItems : [...state.items, ...newItems],
    currentIndex: clearExisting ? (newItems.length > 0 ? 0 : -1) : state.currentIndex === -1 && newItems.length > 0 ? 0 : state.currentIndex
  })),
  removeFromQueue: (index) => set((state) => {
    const newItems = [...state.items];
    newItems.splice(index, 1);
    let newIndex = state.currentIndex;
    if (index < state.currentIndex) {
      newIndex--;
    } else if (index === state.currentIndex) {
      if (newItems.length === 0) {
        newIndex = -1;
      } else if (index >= newItems.length) {
        newIndex = newItems.length - 1;
      }
    }
    return { items: newItems, currentIndex: newIndex };
  }),
  clearQueue: () => set({ items: [], currentIndex: -1 }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  next: () => set((state) => ({
    currentIndex: state.currentIndex < state.items.length - 1 ? state.currentIndex + 1 : state.currentIndex
  })),
  prev: () => set((state) => ({
    currentIndex: state.currentIndex > 0 ? state.currentIndex - 1 : state.currentIndex
  })),
  shuffleQueue: () => set((state) => {
    if (state.items.length <= 1) return state;
    
    const currentItem = state.currentIndex >= 0 ? state.items[state.currentIndex] : null;
    const otherItems = state.items.filter((_, i) => i !== state.currentIndex);
    
    // Fisher-Yates shuffle
    for (let i = otherItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]];
    }
    
    if (currentItem) {
      return {
        items: [currentItem, ...otherItems],
        currentIndex: 0
      };
    }
    
    return { items: otherItems };
  }),
}));
