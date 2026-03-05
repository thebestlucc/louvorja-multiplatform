import { create } from "zustand";
import type { SlideContent } from "../lib/bindings";

interface PresentationState {
  currentPresentationId: number | null;
  activeSlideIndex: number;
  isProjectorOpen: boolean;
  slides: SlideContent[];
  activeServiceId: number | null;
  isPlayingService: boolean;
  activeServiceItemIndex: number;
  setCurrentPresentation: (id: number | null) => void;
  setActiveSlideIndex: (index: number) => void;
  setProjectorOpen: (open: boolean) => void;
  setSlides: (slides: SlideContent[]) => void;
  setActiveService: (id: number | null) => void;
  setPlayingService: (playing: boolean) => void;
  setActiveServiceItemIndex: (index: number) => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  currentPresentationId: null,
  activeSlideIndex: 0,
  isProjectorOpen: false,
  slides: [],
  activeServiceId: null,
  isPlayingService: false,
  activeServiceItemIndex: -1,
  setCurrentPresentation: (id) => set({ currentPresentationId: id }),
  setActiveService: (id) => set({ activeServiceId: id }),
  setPlayingService: (playing) => set({ isPlayingService: playing, activeServiceItemIndex: playing ? 0 : -1 }),
  setActiveServiceItemIndex: (index) => set({ activeServiceItemIndex: index }),
  setActiveSlideIndex: (index) => set({ activeSlideIndex: index }),
  setProjectorOpen: (open) => set({ isProjectorOpen: open }),
  setSlides: (slides) => set({ slides, activeSlideIndex: 0 }),
}));
