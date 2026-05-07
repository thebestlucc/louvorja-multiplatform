import { useRef, useEffect, useState } from "react";
import { SlideRenderer } from "../slides/slide-renderer";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import type { MediaItem } from "../../types/media";
import { mediaHasVideo } from "../../types/media";
import type { OnlineVideoMediaItem, OfflineVideoMediaItem } from "../../types/media";
import { cn } from "../../lib/utils";

const SLIDE_W = 1920;
const SLIDE_H = 1080;

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

  // Video preview — always static thumbnail/placeholder on the main window.
  // The projector + return native sinks (or legacy followers) handle live
  // rendering. Never show live video here to keep main window CPU/GPU low.
  if (currentItem && mediaHasVideo(currentItem)) {
    const ytId =
      currentItem.type === "online_video"
        ? (currentItem as OnlineVideoMediaItem).videoId
        : null;
    const title =
      currentItem.type === "online_video"
        ? (currentItem as OnlineVideoMediaItem).title
        : (currentItem as OfflineVideoMediaItem).title ?? "";
    const thumbUrl = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
    return (
      <div className="relative h-full w-full overflow-hidden bg-black pointer-events-none">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MonitorPlay className="h-16 w-16 opacity-25" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-xs text-white/80 truncate">{title}</p>
        </div>
      </div>
    );
  }

  // Slide preview (hymn, presentation, bible, etc.)
  if (currentSlide) {
    return (
      <div className="flex h-full items-center justify-center bg-black/90 p-4">
        <ScaledSlidePreview slide={currentSlide} />
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

// ─── ScaledSlidePreview ───────────────────────────────────────────────────

function ScaledSlidePreview({ slide, className }: { slide: SlideContent; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scaleByW = width / SLIDE_W;
      const scaleByH = height / SLIDE_H;
      setScale(Math.min(scaleByW, scaleByH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full max-h-full overflow-hidden rounded-lg shadow-lg", className)}
      style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
    >
      {scale !== null && (
        <div
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: -(SLIDE_H / 2),
            marginLeft: -(SLIDE_W / 2),
          }}
        >
          <SlideRenderer slide={slide} renderMode="projector" className="h-full w-full" />
        </div>
      )}
    </div>
  );
}

