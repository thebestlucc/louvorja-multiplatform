import { create } from "zustand";
import type { SlideContent } from "../types/presentation";

interface PresentationState {
  currentPresentationId: number | null;
  activeSlideIndex: number;
  isProjectorOpen: boolean;
  slides: SlideContent[];
  setCurrentPresentation: (id: number | null) => void;
  setActiveSlideIndex: (index: number) => void;
  setProjectorOpen: (open: boolean) => void;
  setSlides: (slides: SlideContent[]) => void;
  nextSlide: () => void;
  prevSlide: () => void;
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  currentPresentationId: null,
  activeSlideIndex: 0,
  isProjectorOpen: false,
  slides: [],
  setCurrentPresentation: (id) => set({ currentPresentationId: id }),
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
