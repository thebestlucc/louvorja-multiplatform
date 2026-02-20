// src/stores/onboarding-store.ts
import { create } from "zustand";

type OnboardingMode = "fresh" | "import" | null;

interface OnboardingState {
  mode: OnboardingMode;
  setMode: (mode: OnboardingMode) => void;
  reset: () => void;
}

const initialState = {
  mode: null as OnboardingMode,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  reset: () => set(initialState),
}));
