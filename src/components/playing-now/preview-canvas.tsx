import { SlideRenderer } from "../slides/slide-renderer";
import { VideoPreviewSlot } from "../online-videos/persistent-video-player";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import type { MediaItem } from "../../types/media";
import { mediaHasVideo } from "../../types/media";

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

  // Video preview (online or offline)
  if (currentItem && mediaHasVideo(currentItem)) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-4">
        <div className="relative h-full w-full max-h-full">
          <VideoPreviewSlot className="h-full w-full" />
        </div>
      </div>
    );
  }

  // Slide preview (hymn, presentation, bible, etc.)
  if (currentSlide) {
    return (
      <div className="flex h-full items-center justify-center bg-black/90 p-4">
        <div className="relative aspect-video max-h-full max-w-full overflow-hidden rounded-lg shadow-lg">
          <SlideRenderer
            slide={currentSlide}
            renderMode="playing-now-preview"
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  // Empty state
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
