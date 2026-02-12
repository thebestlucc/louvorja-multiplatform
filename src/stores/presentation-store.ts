import { create } from "zustand";
import type { SlideContent } from "../types/presentation";

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
  nextSlide: () => void;
  prevSlide: () => void;
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
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
  nextSlide: () => {
    const { activeSlideIndex, slides } = get();
    if (activeSlideIndex < slides.length - 1) {
      set({ activeSlideIndex: activeSlideIndex + 1 });
    }
  },
  prevSlide: () => {
    const { activeSlideIndex } = get();
    if (activeSlideIndex > 0) {
      set({ activeSlideIndex: activeSlideIndex - 1 });
    }
  },
}));
