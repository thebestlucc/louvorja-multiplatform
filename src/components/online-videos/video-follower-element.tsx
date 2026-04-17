import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { cn } from "../../lib/utils";

interface VideoControlCmd {
  action: "play" | "pause" | "seek";
  value?: number;
}

interface VideoFollowerElementProps {
  videoUrl: string;
  className?: string;
}

export function VideoFollowerElement({ videoUrl, className }: VideoFollowerElementProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    console.log("[VideoFollower] loading src:", videoUrl);
    video.src = videoUrl;
    video.play().catch((err) => {
      console.warn("[VideoFollower] play() rejected:", err?.message ?? err);
    });
  }, [videoUrl]);

  useEffect(() => {
    const unlisten = listen<VideoControlCmd>("video-control-cmd", (event) => {
      const video = videoRef.current;
      if (!video) return;
      const { action, value } = event.payload;
      if (action === "play") {
        video.play().catch(() => {});
      } else if (action === "pause") {
        video.pause();
      } else if (action === "seek" && value !== undefined) {
        video.currentTime = value;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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

    const tick = () => {
      if (!lastMaster) {
        rVFCHandle = video.requestVideoFrameCallback(tick);
        return;
      }
      const now = performance.now();
      const masterEstimate = lastMaster.masterTimestampMs != null
        ? lastMaster.currentTime + (now - lastMaster.masterTimestampMs) / 1000
        : lastMaster.currentTime + (now - lastMaster.receivedAt) / 1000;

      if (lastMaster.seeking) {
        if (!video.paused) video.pause();
        rVFCHandle = video.requestVideoFrameCallback(tick);
        return;
      }

      if (lastMaster.paused) {
        if (!video.paused) video.pause();
        video.playbackRate = 1.0;
        rVFCHandle = video.requestVideoFrameCallback(tick);
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
      rVFCHandle = video.requestVideoFrameCallback(tick);
    };

    if (typeof video.requestVideoFrameCallback === "function") {
      rVFCHandle = video.requestVideoFrameCallback(tick);
    } else {
      // Fallback to rAF for browsers without rVFC
      const rafTick = () => { tick(); rVFCHandle = requestAnimationFrame(rafTick); };
      rVFCHandle = requestAnimationFrame(rafTick);
    }

    return () => {
      unlistenPromise.then((fn) => fn()).catch(() => {});
      if (typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(rVFCHandle);
      } else {
        cancelAnimationFrame(rVFCHandle);
      }
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
      onCanPlay={() => console.log("[VideoFollower] canplay — ready to render")}
      className={cn("w-full h-full bg-black object-contain", className)}
    />
  );
}
