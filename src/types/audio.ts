export type PlaybackStatus = "idle" | "playing" | "paused" | "seeking";

export type PlaybackMode = "sung" | "karaoke" | "silent";

export interface SyncPoint {
  slideIndex: number;
  timestampMs: number;
}

export interface AudioStatusPayload {
  positionMs: number;
  durationMs: number | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  currentFile: string | null;
}

export interface AudioState {
  status: PlaybackStatus;
  currentFile: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
}
