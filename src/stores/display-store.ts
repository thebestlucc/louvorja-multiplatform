import { create } from "zustand";
import type { MonitorInfo } from "../types/settings";

interface DisplayState {
  monitors: MonitorInfo[];
  monitorAssignments: Record<string, string>;
  projectorWindowOpen: boolean;
  returnWindowOpen: boolean;
  setMonitors: (monitors: MonitorInfo[]) => void;
  setMonitorAssignment: (monitorId: string, role: string) => void;
  setProjectorWindowOpen: (open: boolean) => void;
  setReturnWindowOpen: (open: boolean) => void;
}

export const useDisplayStore = create<DisplayState>((set) => ({
  monitors: [],
  monitorAssignments: {},
  projectorWindowOpen: false,
  returnWindowOpen: false,
  setMonitors: (monitors) => set({ monitors }),
  setMonitorAssignment: (monitorId, role) =>
    set((s) => ({
      monitorAssignments: { ...s.monitorAssignments, [monitorId]: role },
    })),
  setProjectorWindowOpen: (open) => set({ projectorWindowOpen: open }),
  setReturnWindowOpen: (open) => set({ returnWindowOpen: open }),
}));
