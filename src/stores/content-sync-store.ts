import { create } from "zustand";
import type {
  ContentSyncProgress,
  ContentSyncReport,
  ContentSyncSummary,
} from "../types/content-sync";

interface ContentSyncState {
  runId: string | null;
  progress: ContentSyncProgress | null;
  report: ContentSyncReport | null;
  promptSummary: ContentSyncSummary | null;
  isPromptOpen: boolean;
  setRunId: (runId: string | null) => void;
  setProgress: (progress: ContentSyncProgress | null) => void;
  setReport: (report: ContentSyncReport | null) => void;
  openPrompt: (summary: ContentSyncSummary) => void;
  closePrompt: () => void;
  resetRun: () => void;
}

export const useContentSyncStore = create<ContentSyncState>((set) => ({
  runId: null,
  progress: null,
  report: null,
  promptSummary: null,
  isPromptOpen: false,
  setRunId: (runId) => set({ runId }),
  setProgress: (progress) => set({ progress }),
  setReport: (report) => set({ report }),
  openPrompt: (summary) => set({ promptSummary: summary, isPromptOpen: true }),
  closePrompt: () => set({ isPromptOpen: false }),
  resetRun: () => set({ runId: null, progress: null, report: null }),
}));
