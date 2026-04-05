import { create } from "zustand";

interface OnboardingState {
  churchName: string;
  selectedTheme: string;
  tourRequested: boolean;
  contentSkipped: boolean;
  setChurchName: (name: string) => void;
  setSelectedTheme: (theme: string) => void;
  setTourRequested: (requested: boolean) => void;
  setContentSkipped: (skipped: boolean) => void;
  reset: () => void;
}

const initialState = {
  churchName: "",
  selectedTheme: "",
  tourRequested: true,
  contentSkipped: false,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setChurchName: (churchName) => set({ churchName }),
  setSelectedTheme: (selectedTheme) => set({ selectedTheme }),
  setTourRequested: (tourRequested) => set({ tourRequested }),
  setContentSkipped: (contentSkipped) => set({ contentSkipped }),
  reset: () => set(initialState),
}));
