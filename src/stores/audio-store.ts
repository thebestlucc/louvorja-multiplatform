import { create } from "zustand";
import type { PlaybackStatus } from "../types/audio";

interface AudioStoreState {
  status: PlaybackStatus;
  currentFile: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  setStatus: (status: PlaybackStatus) => void;
  setCurrentFile: (file: string | null) => void;
  setPosition: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  status: "idle",
  currentFile: null,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  setStatus: (status) => set({ status }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setPosition: (ms) => set({ positionMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  setVolume: (volume) => set({ volume }),
}));
