// src/components/online-videos/youtube-master.tsx
import { useEffect } from "react";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import type { VideoStateEvent } from "./online-video-slide";

/** Heartbeat interval matching PersistentVideoPlayer (ms). */
const HEARTBEAT_INTERVAL_MS = 100;

export interface YouTubeMasterProps {
  playerHostRef: React.RefObject<HTMLDivElement | null>;
  ytPlayerRef: React.MutableRefObject<YTPlayer | null>;
  pollTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  seekingRef: React.MutableRefObject<boolean>;
  playSessionId: number;
  activeVideoId: string | undefined;
  activeVideoSource: string | undefined;
  onBroadcast: (snap: VideoStateEvent, meta: { videoId: string | null; videoSrc: string | null; videoSource: "youtube" | "local" | null }, force?: boolean) => void;
  onVideoEnded: () => void;
}

/**
 * Purely behavioral component — returns null.
 * Manages the YouTube IFrame Player API lifecycle:
 * loading the API, creating/destroying the player, the poll timer, and seek handling.
 * The iframe container div lives in PersistentVideoPlayer's JSX (playerHostRef).
 */
export function YouTubeMaster({
  playerHostRef,
  ytPlayerRef,
  pollTimerRef,
  seekingRef,
  playSessionId,
  activeVideoId,
  activeVideoSource,
  onBroadcast,
  onVideoEnded,
}: YouTubeMasterProps) {
  useEffect(() => {
    const videoId = activeVideoId ?? null;
    if (!videoId || !playerHostRef.current) return;

    let destroyed = false;

    // Clean up any previous YouTube player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
    }

    // Create container div imperatively (React must not manage this node)
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;overflow:hidden;";
    playerHostRef.current.appendChild(container);
    const uid = `yt-master-${Math.random().toString(36).slice(2)}`;
    container.id = uid;

    loadYouTubeAPI().then(() => {
      if (destroyed || !container.isConnected) return;

      const player = new window.YT.Player(uid, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1, controls: 0, rel: 0,
          modestbranding: 1, showinfo: 0,
          disablekb: 1, iv_load_policy: 3, cc_load_policy: 0,
          mute: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (destroyed) return;
            ytPlayerRef.current = target;
            const iframe = target.getIframe();
            iframe.style.cssText =
              "width:100%;height:100%;pointer-events:none;border:none;" +
              "transform:scale(1.06);transform-origin:center;display:block;";

            pollTimerRef.current = setInterval(() => {
              if (target.getPlayerState() !== 1) return; // only heartbeat while playing
              const snap: VideoStateEvent = {
                paused: false,
                currentTime: target.getCurrentTime(),
                duration: target.getDuration(),
                volume: target.getVolume() / 100,
              };
              onBroadcast(snap, { videoId, videoSrc: null, videoSource: "youtube" });
            }, HEARTBEAT_INTERVAL_MS);
          },
          onStateChange: ({ data, target }) => {
            if (destroyed) return;
            seekingRef.current = false;
            const snap: VideoStateEvent = {
              paused: data !== 1,
              currentTime: target.getCurrentTime(),
              duration: target.getDuration(),
              volume: target.getVolume() / 100,
            };
            onBroadcast(snap, { videoId, videoSrc: null, videoSource: "youtube" }, true);
            // data === 0 means ENDED
            if (data === 0) {
              onVideoEnded();
            }
          },
        },
      });
      ytPlayerRef.current = player;
    });

    return () => {
      destroyed = true;
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
      container.remove();
    };
  }, [activeVideoId, activeVideoSource, onBroadcast, playSessionId, playerHostRef, pollTimerRef, seekingRef, ytPlayerRef, onVideoEnded]);

  return null;
}
