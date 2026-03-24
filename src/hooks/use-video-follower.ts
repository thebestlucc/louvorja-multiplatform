import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import type { YTPlayer } from "../lib/youtube-api";
import type { VideoStateEvent } from "../components/online-videos/online-video-slide";

/**
 * Keeps a muted follower player (projector or return window) synchronized with
 * the master player in the main window.
 *
 * @param playerRef  Ref to the YTPlayer or HTMLVideoElement managed by the caller.
 * @param playerKind "youtube" or "local" — explicit discriminant because YTPlayer
 *                   is an interface (no instanceof check possible).
 * @param enabled    Pass false to deactivate (Rules of Hooks safe, always called).
 * @returns          A ref containing the latest received VideoStateEvent.
 *                   The caller should use this in onReady / canplay to seek to the
 *                   correct position when the player first becomes ready.
 */
export function useVideoFollower(
  playerRef: RefObject<YTPlayer | HTMLVideoElement | null>,
  playerKind: "youtube" | "local",
  enabled = true,
): RefObject<VideoStateEvent | null> {
  const lastStateRef = useRef<VideoStateEvent | null>(null);

  // Reset stale position on clear so the next video doesn't seek to the old time (Bug 1 fix)
  useEffect(() => {
    if (!enabled) return;
    const unsub = listen("slide-cleared", () => {
      lastStateRef.current = null;
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, [enabled, lastStateRef]);

  useEffect(() => {
    if (!enabled) return;

    const unsub = listen<VideoStateEvent>("video-state", (e) => {
      lastStateRef.current = e.payload;
      const p = playerRef.current;
      if (!p) return;

      const { paused, currentTime } = e.payload;

      if (playerKind === "youtube") {
        const yp = p as YTPlayer;
        const state = yp.getPlayerState();
        if (paused && state === 1) yp.pauseVideo();
        else if (!paused && state !== 1) yp.playVideo();
        if (Math.abs(yp.getCurrentTime() - currentTime) > 0.5) {
          yp.seekTo(currentTime, true);
        }
      } else {
        const v = p as HTMLVideoElement;
        if (paused && !v.paused) v.pause();
        else if (!paused && v.paused) void v.play().catch(() => {});
        if (Math.abs(v.currentTime - currentTime) > 0.5) {
          v.currentTime = currentTime;
        }
      }
    }).catch(() => () => {});

    return () => {
      void unsub.then((fn) => fn());
    };
  }, [playerRef, playerKind, enabled]);

  return lastStateRef;
}
