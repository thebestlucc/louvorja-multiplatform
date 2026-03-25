import { create } from "zustand";

export interface PreviewRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface VideoPlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  videoId: string | null;
  videoSrc: string | null;
  videoSource: "youtube" | "local" | null;
  previewRect: PreviewRect | null;
  setVideoState: (partial: Partial<Omit<VideoPlayerState, "setVideoState" | "resetVideoState" | "setPreviewRect">>) => void;
  resetVideoState: () => void;
  setPreviewRect: (rect: PreviewRect | null) => void;
}

type VideoPlayerData = Omit<VideoPlayerState, "setVideoState" | "resetVideoState" | "setPreviewRect">;

const initialState: VideoPlayerData = {
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  videoId: null,
  videoSrc: null,
  videoSource: null,
  previewRect: null,
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,
  setVideoState: (partial) => set(partial),
  resetVideoState: () => set({ ...initialState, previewRect: useVideoPlayerStore.getState().previewRect }),
  setPreviewRect: (rect) => set({ previewRect: rect }),
}));
