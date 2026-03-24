import { create } from "zustand";

interface VideoPlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  videoId: string | null;
  videoSrc: string | null;
  videoSource: "youtube" | "local" | null;
  setVideoState: (partial: Partial<Omit<VideoPlayerState, "setVideoState" | "resetVideoState">>) => void;
  resetVideoState: () => void;
}

type VideoPlayerData = Omit<VideoPlayerState, "setVideoState" | "resetVideoState">;

const initialState: VideoPlayerData = {
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  videoId: null,
  videoSrc: null,
  videoSource: null,
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,
  setVideoState: (partial) => set(partial),
  resetVideoState: () => set(initialState),
}));
