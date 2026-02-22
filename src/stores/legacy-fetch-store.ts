import { create } from "zustand";
import type { LegacyFetchProgress, LegacyFetchReport } from "../types/legacy-fetch";

interface LegacyFetchState {
  runId: string | null;
  progress: LegacyFetchProgress | null;
  report: LegacyFetchReport | null;
  isCancelling: boolean;
  
  setRunId: (runId: string | null) => void;
  setProgress: (progress: LegacyFetchProgress | null) => void;
  setReport: (report: LegacyFetchReport | null) => void;
  setIsCancelling: (isCancelling: boolean) => void;
  reset: () => void;
}

export const useLegacyFetchStore = create<LegacyFetchState>((set) => ({
  runId: null,
  progress: null,
  report: null,
  isCancelling: false,
  
  setRunId: (runId) => set({ runId }),
  setProgress: (progress) => set({ progress }),
  setReport: (report) => set({ report }),
  setIsCancelling: (isCancelling) => set({ isCancelling }),
  reset: () => set({ runId: null, progress: null, report: null, isCancelling: false }),
}));
