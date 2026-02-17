import type { SlideContent, VideoSlideContent } from "../../types/presentation";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { VideoSlide, type VideoRenderMode } from "./video-slide";

export type SlideRenderMode = "projector" | "return-current" | "return-next" | "editor" | "thumbnail";

interface SlideRendererProps {
  slide: SlideContent | null;
  className?: string;
  renderMode?: SlideRenderMode;
}

export function SlideRenderer({ slide, className, renderMode = "projector" }: SlideRendererProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-black text-white p-4",
        className,
      )}
    >
      {renderSlide(slide, renderMode, t)}
    </div>
  );
}

function renderSlide(
  slide: SlideContent | null,
  renderMode: SlideRenderMode,
  t: (key: string) => string,
) {
  if (!slide || slide.type === "pause") {
    return <div />;
  }

  if (slide.type === "cover") {
    return (
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <h1 className="text-4xl font-bold">{slide.title}</h1>
        {slide.subtitle && (
          <p className="text-xl text-white/70">{slide.subtitle}</p>
        )}
      </div>
    );
  }

  if (slide.type === "lyrics") {
    return (
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        {slide.label && (
          <p className="text-sm uppercase tracking-widest text-white/50">
            {slide.label}
          </p>
        )}
        <p className="whitespace-pre-line text-3xl font-semibold leading-relaxed">
          {slide.text}
        </p>
      </div>
    );
  }

  if (slide.type === "text") {
    return (
      <div className="px-8 text-center">
        <p className="whitespace-pre-line text-2xl">{slide.text}</p>
      </div>
    );
  }

  if (slide.type === "image") {
    return (
      <img
        src={slide.src}
        alt={slide.alt ?? ""}
        className="h-full w-full object-contain"
      />
    );
  }

  if (slide.type === "bible") {
    return (
      <div className="flex flex-col items-center gap-6 px-12 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-white/50 font-serif">
          {`${slide.book} ${slide.chapter}:${slide.verseStart}${slide.verseEnd !== slide.verseStart ? `-${slide.verseEnd}` : ""}`}
        </p>
        <div className="flex flex-col gap-3">
          {slide.text.split("\n").map((line, i) => (
            <p key={i} className="text-2xl font-serif leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (slide.type === "video") {
    if (renderMode === "thumbnail") {
      const videoLabel = getVideoLabel(slide.videoPath);
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

    if (renderMode === "return-next") {
      const videoLabel = getVideoLabel(slide.videoPath);
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

    return (
      <VideoSlide
        slide={slide as VideoSlideContent}
        renderMode={mapRenderMode(renderMode)}
        className="h-full w-full"
      />
    );
  }

  return null;
}

function mapRenderMode(renderMode: SlideRenderMode): VideoRenderMode {
  if (renderMode === "return-current") {
    return "return-current";
  }
  if (renderMode === "editor") {
    return "editor";
  }
  return "projector";
}

function getVideoLabel(path: string): string {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}
