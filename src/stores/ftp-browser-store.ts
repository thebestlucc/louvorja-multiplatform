import { create } from "zustand";
import type { FtpFileEntry } from "../lib/tauri";

interface FtpBrowserState {
  entries: FtpFileEntry[];
  isLoading: boolean;
  loadError: string | null;
  setEntries: (entries: FtpFileEntry[]) => void;
  setIsLoading: (v: boolean) => void;
  setLoadError: (err: string | null) => void;
  clear: () => void;
}

export const useFtpBrowserStore = create<FtpBrowserState>((set) => ({
  entries: [],
  isLoading: false,
  loadError: null,
  setEntries: (entries) => set({ entries }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLoadError: (loadError) => set({ loadError }),
  clear: () => set({ entries: [], isLoading: false, loadError: null }),
}));
