import { create } from "zustand";
import type { MonitorInfo } from "../types/settings";

export interface BibleContext {
  versionId: number;
  book: string;
  chapter: number;
  verseNumber: number;
  partIndex: number;
  totalParts: number;
}

interface DisplayState {
  monitors: MonitorInfo[];
  monitorAssignments: Record<string, string>;
  projectorWindowOpen: boolean;
  returnWindowOpen: boolean;
  isBlackScreen: boolean;
  isLogoScreen: boolean;
  currentProjectionType: "bible" | "hymn" | "presentation" | "utility" | "service" | null;
  setMonitors: (monitors: MonitorInfo[]) => void;
  setMonitorAssignment: (monitorId: string, role: string) => void;
  setProjectorWindowOpen: (open: boolean) => void;
  setReturnWindowOpen: (open: boolean) => void;
  setBlackScreen: (v: boolean) => void;
  setLogoScreen: (v: boolean) => void;
  setCurrentProjectionType: (type: "bible" | "hymn" | "presentation" | "utility" | "service" | null) => void;
  bibleContext: BibleContext | null;
  setBibleContext: (ctx: BibleContext | null) => void;
}

export const useDisplayStore = create<DisplayState>((set) => ({
  monitors: [],
  monitorAssignments: {},
  projectorWindowOpen: false,
  returnWindowOpen: false,
  isBlackScreen: false,
  isLogoScreen: false,
  currentProjectionType: null,
  setMonitors: (monitors) => set({ monitors }),
  setMonitorAssignment: (monitorId, role) =>
    set((s) => ({
      monitorAssignments: { ...s.monitorAssignments, [monitorId]: role },
    })),
  setProjectorWindowOpen: (open) => set({ projectorWindowOpen: open }),
  setReturnWindowOpen: (open) => set({ returnWindowOpen: open }),
  setBlackScreen: (v) => set({ isBlackScreen: v }),
  setLogoScreen: (v) => set({ isLogoScreen: v }),
  setCurrentProjectionType: (type) => set({ currentProjectionType: type }),
  bibleContext: null,
  setBibleContext: (ctx) => set({ bibleContext: ctx }),
}));
