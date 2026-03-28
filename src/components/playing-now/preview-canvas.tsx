import { useRef, useEffect } from "react";
import { SlideRenderer } from "../slides/slide-renderer";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import type { MediaItem } from "../../types/media";
import { mediaHasVideo } from "../../types/media";
import type { OnlineVideoMediaItem, OfflineVideoMediaItem } from "../../types/media";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { localVideoMasterRef } from "../online-videos/persistent-video-player";
import { YouTubePlayer } from "../online-videos/online-video-slide";

interface PreviewCanvasProps {
  currentItem: MediaItem | null;
  currentSlide: SlideContent | null;
  overlay: "black" | "logo" | null;
  isProjectorOpen: boolean;
}

export function PreviewCanvas({
  currentItem,
  currentSlide,
  overlay,
  isProjectorOpen,
}: PreviewCanvasProps) {
  const { t } = useTranslation();
  const ytCurrentTime = useVideoPlayerStore((s) => s.currentTime);
  const ytDuration = useVideoPlayerStore((s) => s.duration);

  // Overlay takes priority
  if (overlay === "black") {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <span className="animate-pulse text-sm text-white/30">
          {t("playingNow.blackScreen")}
        </span>
      </div>
    );
  }

  if (overlay === "logo") {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <span className="text-sm text-white/50">
          {t("playingNow.logoScreen")}
        </span>
      </div>
    );
  }

  // Video preview — live video for both local (canvas) and YouTube (muted follower)
  if (currentItem && mediaHasVideo(currentItem)) {
    if (currentItem.type === "offline_video") {
      return <LocalVideoPreview videoPath={(currentItem as OfflineVideoMediaItem).videoPath} />;
    }

    // YouTube — live muted follower (synced via video-state / video-control-cmd events)
    const ytItem = currentItem as OnlineVideoMediaItem;
    const progress = ytDuration > 0 ? Math.min(ytCurrentTime / ytDuration, 1) : 0;

    return (
      <div className="relative h-full w-full bg-black overflow-hidden pointer-events-none">
        <YouTubePlayer
          videoId={ytItem.videoId}
          title={ytItem.title}
          className="h-full w-full"
          muted
          isFollower
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col gap-2 pointer-events-none">
          <p className="text-xs text-white/80 truncate">{ytItem.title}</p>
          {ytDuration > 0 && (
            <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white/60 rounded-full transition-[width] duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Slide preview (hymn, presentation, bible, etc.)
  if (currentSlide) {
    return (
      <div className="flex h-full items-center justify-center bg-black/90 p-4">
        <div className="relative aspect-video h-full max-w-full overflow-hidden rounded-lg shadow-lg">
          <SlideRenderer
            slide={currentSlide}
            renderMode="playing-now-preview"
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  // Empty state — no item and no slide
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <MonitorPlay className="h-12 w-12 opacity-30" />
      <div className="text-center text-sm">
        {t("playingNow.emptyPreview")}
      </div>
      {isProjectorOpen && (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          {t("playingNow.projectorConnected")}
        </div>
      )}
    </div>
  );
}

// ─── LocalVideoPreview ────────────────────────────────────────────────────

function LocalVideoPreview(_: { videoPath: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Preview resolution — good enough for operator reference, still below projector quality
    canvas.width = 640;
    canvas.height = 360;

    let rafId: number;
    let lastDraw = 0;
    const DRAW_INTERVAL = 1000 / 24; // 24 fps

    const draw = (time: number) => {
      if (time - lastDraw >= DRAW_INTERVAL) {
        const master = localVideoMasterRef.current;
        if (master && master.readyState >= 2) {
          ctx.drawImage(master, 0, 0, 640, 360);
        }
        lastDraw = time;
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full bg-black"
      style={{ objectFit: "contain", imageRendering: "auto" }}
    />
  );
}
