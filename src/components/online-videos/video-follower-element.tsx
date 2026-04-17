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
    const unlisten = listen<{ currentTime: number; duration: number; paused: boolean; seeking?: boolean; emitTs?: number }>("video-state", (event) => {
      const video = videoRef.current;
      if (!video) return;
      const { currentTime, paused, seeking, emitTs } = event.payload;
      if (seeking) return; // master is mid-seek, don't correct yet

      if (paused && !video.paused) {
        video.pause();
        video.playbackRate = 1;
        return;
      }
      if (!paused && video.paused) {
        video.play().catch(() => {});
      }
      if (paused) return;

      // Latency compensation: master's currentTime was captured at emitTs.
      // One-way latency ≈ (now - emitTs). Add it so follower targets master's
      // current real-time position, not its stale snapshot.
      const latencySec = emitTs != null ? Math.max(0, (performance.now() - emitTs) / 1000) : 0;
      const target = currentTime + latencySec;
      const drift = video.currentTime - target; // + = ahead, − = behind

      if (Math.abs(drift) < 0.08) {
        // In sync — restore normal rate
        if (video.playbackRate !== 1) video.playbackRate = 1;
      } else if (Math.abs(drift) < 1.0) {
        // Small drift — nudge playbackRate smoothly (imperceptible)
        video.playbackRate = drift < 0 ? 1.05 : 0.95;
      } else {
        // Big jump — hard seek
        video.currentTime = target;
        video.playbackRate = 1;
      }
    });
    return () => { unlisten.then((fn) => fn()); };
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
