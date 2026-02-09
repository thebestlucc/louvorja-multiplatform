import { create } from "zustand";

interface PresentationState {
  currentPresentationId: number | null;
  activeSlideIndex: number;
  isProjectorOpen: boolean;
  setCurrentPresentation: (id: number | null) => void;
  setActiveSlideIndex: (index: number) => void;
  setProjectorOpen: (open: boolean) => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  currentPresentationId: null,
  activeSlideIndex: 0,
  isProjectorOpen: false,
  setCurrentPresentation: (id) => set({ currentPresentationId: id }),
  setActiveSlideIndex: (index) => set({ activeSlideIndex: index }),
  setProjectorOpen: (open) => set({ isProjectorOpen: open }),
}));
