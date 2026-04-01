import { create } from "zustand";
import type { SlideContent } from "../lib/bindings";

interface PresentationState {
  currentPresentationId: number | null;
  activeSlideIndex: number;
  isProjectorOpen: boolean;
  slides: SlideContent[];
  activeLiturgyId: number | null;
  isPlayingLiturgy: boolean;
  activeLiturgyItemIndex: number;
  currentVideoProjectionId: string | null;
  setCurrentPresentation: (id: number | null) => void;
  setActiveSlideIndex: (index: number) => void;
  setProjectorOpen: (open: boolean) => void;
  setSlides: (slides: SlideContent[]) => void;
  setActiveLiturgy: (id: number | null) => void;
  setPlayingLiturgy: (playing: boolean) => void;
  setActiveLiturgyItemIndex: (index: number) => void;
  setCurrentVideoProjectionId: (id: string | null) => void;

  // Backward-compatible aliases (deprecated)
  /** @deprecated Use activeLiturgyId */
  activeServiceId: number | null;
  /** @deprecated Use isPlayingLiturgy */
  isPlayingService: boolean;
  /** @deprecated Use activeLiturgyItemIndex */
  activeServiceItemIndex: number;
  /** @deprecated Use setActiveLiturgy */
  setActiveService: (id: number | null) => void;
  /** @deprecated Use setPlayingLiturgy */
  setPlayingService: (playing: boolean) => void;
  /** @deprecated Use setActiveLiturgyItemIndex */
  setActiveServiceItemIndex: (index: number) => void;
}

export const usePresentationStore = create<PresentationState>((set) => {
  const setActiveLiturgy = (id: number | null) => set({ activeLiturgyId: id, activeServiceId: id });
  const setPlayingLiturgy = (playing: boolean) =>
    set({
      isPlayingLiturgy: playing,
      isPlayingService: playing,
      activeLiturgyItemIndex: playing ? 0 : -1,
      activeServiceItemIndex: playing ? 0 : -1,
    });
  const setActiveLiturgyItemIndex = (index: number) =>
    set({ activeLiturgyItemIndex: index, activeServiceItemIndex: index });

  return {
    currentPresentationId: null,
    activeSlideIndex: 0,
    isProjectorOpen: false,
    slides: [],
    activeLiturgyId: null,
    isPlayingLiturgy: false,
    activeLiturgyItemIndex: -1,
    currentVideoProjectionId: null,
    setCurrentPresentation: (id) => set({ currentPresentationId: id }),
    setActiveLiturgy,
    setPlayingLiturgy,
    setActiveLiturgyItemIndex,
    setActiveSlideIndex: (index) => set({ activeSlideIndex: index }),
    setProjectorOpen: (open) => set({ isProjectorOpen: open }),
    setSlides: (slides) => set({ slides, activeSlideIndex: 0 }),
    setCurrentVideoProjectionId: (id) => set({ currentVideoProjectionId: id }),

    // Backward-compatible aliases
    activeServiceId: null,
    isPlayingService: false,
    activeServiceItemIndex: -1,
    setActiveService: setActiveLiturgy,
    setPlayingService: setPlayingLiturgy,
    setActiveServiceItemIndex: setActiveLiturgyItemIndex,
  };
});
