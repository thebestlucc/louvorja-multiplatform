import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { cn } from "../../lib/utils";

interface VideoFollowerElementProps {
  videoUrl: string;
  className?: string;
}

export function VideoFollowerElement({ videoUrl, className }: VideoFollowerElementProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.src = videoUrl;
    video.play().catch(() => {});
  }, [videoUrl]);

  // Sync is driven entirely by `video-state` broadcasts from the master —
  // play/pause is applied from lastMaster.paused and seeks from drift correction.
  // No `video-control-cmd` listener needed.

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastMaster: {
      currentTime: number;
      paused: boolean;
      seeking: boolean;
      receivedAt: number;
      masterTimestampMs: number | null;
    } | null = null;
    let rVFCHandle = 0;

    const unlistenPromise = listen<{
      currentTime: number;
      duration: number;
      paused: boolean;
      volume: number;
      seeking?: boolean;
      masterTimestampMs?: number;
    }>("video-state", (event) => {
      lastMaster = {
        currentTime: event.payload.currentTime,
        paused: event.payload.paused,
        seeking: event.payload.seeking === true,
        receivedAt: performance.now(),
        masterTimestampMs: event.payload.masterTimestampMs ?? null,
      };
    });

    const hasRVFC = typeof video.requestVideoFrameCallback === "function";

    const scheduleNext = (cb: () => void): number => {
      return hasRVFC
        ? video.requestVideoFrameCallback(cb)
        : requestAnimationFrame(cb);
    };

    const cancel = (handle: number) => {
      if (hasRVFC && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(handle);
      } else {
        cancelAnimationFrame(handle);
      }
    };

    const tick = () => {
      if (!lastMaster) {
        rVFCHandle = scheduleNext(tick);
        return;
      }
      const now = performance.now();
      const masterEstimate = lastMaster.masterTimestampMs != null
        ? lastMaster.currentTime + (now - lastMaster.masterTimestampMs) / 1000
        : lastMaster.currentTime + (now - lastMaster.receivedAt) / 1000;

      if (lastMaster.seeking) {
        if (!video.paused) video.pause();
        rVFCHandle = scheduleNext(tick);
        return;
      }

      if (lastMaster.paused) {
        if (!video.paused) video.pause();
        video.playbackRate = 1.0;
        rVFCHandle = scheduleNext(tick);
        return;
      }
      if (video.paused) {
        video.play().catch(() => {});
      }

      const drift = video.currentTime - masterEstimate; // >0 means follower is AHEAD
      const absDrift = Math.abs(drift);
      if (absDrift > 0.15) {
        // >150 ms — hard seek
        video.playbackRate = 1.0;
        video.currentTime = masterEstimate;
      } else if (absDrift > 0.02) {
        // 20–150 ms — rate nudge (±3%)
        video.playbackRate = drift > 0 ? 0.97 : 1.03;
      } else {
        video.playbackRate = 1.0;
      }
      rVFCHandle = scheduleNext(tick);
    };

    rVFCHandle = scheduleNext(tick);

    return () => {
      unlistenPromise.then((fn) => fn()).catch(() => {});
      cancel(rVFCHandle);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      onError={(e) => {
        const v = e.currentTarget;
        const err = v.error;
        console.error(
          "[VideoFollower] video error:",
          err ? `code=${err.code} message="${err.message}"` : "unknown",
          "src:", v.src,
        );
      }}
      className={cn("w-full h-full bg-black object-contain", className)}
    />
  );
}
