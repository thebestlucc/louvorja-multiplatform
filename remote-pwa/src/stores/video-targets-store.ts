/**
 * Video targets store — persists which screens receive live video.
 * Synced to localStorage and sent to the server via video.set_targets.
 */

import { create } from "zustand";

export type VideoTarget = "projector" | "return";

export interface VideoTargetsState {
  targets: VideoTarget[];
}

interface VideoTargetsActions {
  setTargets: (targets: VideoTarget[]) => void;
}

const STORAGE_KEY = "louvorja-remote-video-targets";

const VALID_TARGETS: VideoTarget[] = ["projector", "return"];

function isValidVideoTarget(val: unknown): val is VideoTarget {
  return typeof val === "string" && VALID_TARGETS.includes(val as VideoTarget);
}

function loadTargets(): VideoTarget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(isValidVideoTarget);
        if (filtered.length > 0) return filtered;
      }
    }
  } catch {
    // ignore
  }
  return ["projector"];
}

function saveTargets(targets: VideoTarget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // ignore quota errors
  }
}

export const useVideoTargetsStore = create<VideoTargetsState & VideoTargetsActions>((set) => ({
  targets: loadTargets(),

  setTargets: (targets) => {
    set({ targets });
    saveTargets(targets);
  },
}));
