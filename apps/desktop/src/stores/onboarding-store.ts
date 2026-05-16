import { create } from "zustand";

interface OnboardingState {
  churchName: string;
  tourRequested: boolean;
  setChurchName: (name: string) => void;
  setTourRequested: (requested: boolean) => void;
  reset: () => void;
}

const initialState = {
  churchName: "",
  tourRequested: true,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setChurchName: (churchName) => set({ churchName }),
  setTourRequested: (tourRequested) => set({ tourRequested }),
  reset: () => set(initialState),
}));
