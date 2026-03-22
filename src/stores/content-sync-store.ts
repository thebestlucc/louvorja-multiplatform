import { create } from "zustand";
import type {
  ContentSyncProgress,
  ContentSyncReport,
  ContentSyncSummary,
  PackSyncProgress,
  PackSyncPlan,
} from "../types/content-sync";

interface ContentSyncState {
  runId: string | null;
  progress: ContentSyncProgress | null;
  report: ContentSyncReport | null;
  promptSummary: ContentSyncSummary | null;
  isPromptOpen: boolean;
  packSyncRunId: string | null;
  packSyncProgress: PackSyncProgress | null;
  packSyncPlanOpen: boolean;
  packSyncPendingCount: number;
  packSyncPlan: PackSyncPlan | null;
  setRunId: (runId: string | null) => void;
  setProgress: (progress: ContentSyncProgress | null) => void;
  setReport: (report: ContentSyncReport | null) => void;
  openPrompt: (summary: ContentSyncSummary) => void;
  closePrompt: () => void;
  resetRun: () => void;
  setPackSyncRunId: (runId: string | null) => void;
  setPackSyncProgress: (progress: PackSyncProgress | null) => void;
  openPackSyncPlan: () => void;
  closePackSyncPlan: () => void;
  packSyncProgressOpen: boolean;
  openPackSyncProgress: () => void;
  closePackSyncProgress: () => void;
  setPackSyncPendingCount: (count: number) => void;
  setPackSyncPlan: (plan: PackSyncPlan | null) => void;
}

export const useContentSyncStore = create<ContentSyncState>((set) => ({
  runId: null,
  progress: null,
  report: null,
  promptSummary: null,
  isPromptOpen: false,
  packSyncRunId: null,
  packSyncProgress: null,
  packSyncPlanOpen: false,
  packSyncProgressOpen: false,
  packSyncPendingCount: 0,
  packSyncPlan: null,
  setRunId: (runId) => set({ runId }),
  setProgress: (progress) => set({ progress }),
  setReport: (report) => set({ report }),
  openPrompt: (summary) => set({ promptSummary: summary, isPromptOpen: true }),
  closePrompt: () => set({ isPromptOpen: false }),
  resetRun: () => set({ runId: null, progress: null, report: null }),
  setPackSyncRunId: (runId) => set({ packSyncRunId: runId }),
  setPackSyncProgress: (progress) => set({ packSyncProgress: progress }),
  openPackSyncPlan: () => set({ packSyncPlanOpen: true }),
  closePackSyncPlan: () => set({ packSyncPlanOpen: false }),
  openPackSyncProgress: () => set({ packSyncProgressOpen: true }),
  closePackSyncProgress: () => set({ packSyncProgressOpen: false }),
  setPackSyncPendingCount: (count) => set({ packSyncPendingCount: count }),
  setPackSyncPlan: (plan) => set({ packSyncPlan: plan }),
}));
