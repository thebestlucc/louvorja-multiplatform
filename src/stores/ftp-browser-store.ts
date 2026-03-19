import { create } from "zustand";
import type { FtpFileEntry } from "../lib/tauri";

// Row-level state tracked while downloading
export interface RowDownloadState {
  inProgress: boolean;
  done: boolean;
  error: string | null;
}

interface FtpBrowserState {
  entries: FtpFileEntry[];
  isLoading: boolean;
  loadError: string | null;
  checked: Set<string>;
  rowStates: Record<string, RowDownloadState>;
  
  setEntries: (entries: FtpFileEntry[]) => void;
  setIsLoading: (v: boolean) => void;
  setLoadError: (err: string | null) => void;
  setChecked: (checked: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setRowStates: (rowStates: Record<string, RowDownloadState> | ((prev: Record<string, RowDownloadState>) => Record<string, RowDownloadState>)) => void;
  clear: () => void;
}

export const useFtpBrowserStore = create<FtpBrowserState>((set) => ({
  entries: [],
  isLoading: false,
  loadError: null,
  checked: new Set(),
  rowStates: {},

  setEntries: (entries) => set({ entries }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLoadError: (loadError) => set({ loadError }),
  setChecked: (updater) => set((state) => ({ 
    checked: typeof updater === "function" ? updater(state.checked) : updater 
  })),
  setRowStates: (updater) => set((state) => ({ 
    rowStates: typeof updater === "function" ? updater(state.rowStates) : updater 
  })),
  clear: () => set({ 
    entries: [], 
    isLoading: false, 
    loadError: null,
    checked: new Set(),
    rowStates: {},
  }),
}));
