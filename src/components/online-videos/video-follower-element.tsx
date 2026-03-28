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
    video.src = videoUrl;
    video.play().catch(() => {});
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
    const unlisten = listen<{ currentTime: number; duration: number; paused: boolean; seeking?: boolean }>("video-state", (event) => {
      const video = videoRef.current;
      if (!video) return;
      const { currentTime, paused, seeking } = event.payload;
      if (seeking) return; // master is mid-seek, don't correct yet
      // Correct drift > 0.5 seconds
      if (Math.abs(video.currentTime - currentTime) > 0.5) {
        video.currentTime = currentTime;
      }
      if (paused && !video.paused) video.pause();
      else if (!paused && video.paused) video.play().catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      className={cn("w-full h-full bg-black object-contain", className)}
    />
  );
}
