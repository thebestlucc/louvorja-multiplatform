import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { VideoSlide, type VideoRenderMode } from "../video-slide";

type VideoSlideContent = Extract<SlideContent, { slideType: "video" }>;

interface VideoRendererProps {
  slide: VideoSlideContent;
  mode: SlideRenderMode;
}

function mapRenderMode(renderMode: SlideRenderMode): VideoRenderMode {
  if (renderMode === "return-current" || renderMode === "playing-now-preview") return "return-current";
  if (renderMode === "editor") return "editor";
  return "projector";
}

function getVideoLabel(path: string): string {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

export function VideoRenderer({ slide, mode }: VideoRendererProps) {
  const { t } = useTranslation();
  const videoLabel = getVideoLabel(slide.path ?? "");

  if (mode === "thumbnail") {
    return (
      <div className="flex h-full w-full min-w-0 max-w-full flex-col items-stretch justify-center gap-1 overflow-hidden px-2 text-center">
        <span className="self-center rounded bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/80">
          {t("presentations.types.video")}
        </span>
        <span
          className="block w-full overflow-hidden break-all text-[10px] leading-tight text-white/60"
          title={videoLabel || t("presentations.videoNoSource")}
        >
          {videoLabel || t("presentations.videoNoSource")}
        </span>
      </div>
    );
  }

  if (mode === "return-next") {
    return (
      <div className="flex h-full w-full min-w-0 max-w-full flex-col items-stretch justify-center gap-2 px-3 text-center">
        <span className="self-center rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80">
          {t("presentations.types.video")}
        </span>
        <div className="w-full min-w-0 overflow-hidden">
          <span
            className="block max-w-full truncate whitespace-nowrap text-xs text-white/60"
            title={videoLabel || t("presentations.videoNoSource")}
          >
            {videoLabel || t("presentations.videoNoSource")}
          </span>
        </div>
      </div>
    );
  }

  // VideoSlide expects the full SlideContent union — pass as-is
  return (
    <VideoSlide
      slide={slide}
      renderMode={mapRenderMode(mode)}
      className="h-full w-full"
    />
  );
}
