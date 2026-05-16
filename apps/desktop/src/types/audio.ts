import type { AudioStatusPayload, SyncPoint } from "../lib/bindings";

export type { AudioStatusPayload, SyncPoint };

export type PlaybackStatus = "idle" | "playing" | "paused" | "seeking" | "error";
export type PlaybackMode = "sung" | "karaoke" | "silent";
