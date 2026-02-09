export type PlaybackStatus = "idle" | "playing" | "paused" | "seeking";

export interface AudioState {
  status: PlaybackStatus;
  currentFile: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
}
