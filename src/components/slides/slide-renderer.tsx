import { useMemo } from "react";
import type { SlideContent, VideoSlideContent } from "../../types/presentation";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useMediaSource } from "../../hooks/use-media-source";
import { VideoSlide, type VideoRenderMode } from "./video-slide";

export type SlideRenderMode = "projector" | "return-current" | "return-next" | "editor" | "thumbnail";

interface SlideRendererProps {
  slide: SlideContent | null;
  className?: string;
  renderMode?: SlideRenderMode;
}

export function SlideRenderer({ slide, className, renderMode = "projector" }: SlideRendererProps) {
  const { t } = useTranslation();
  const backgroundPath = useMemo(() => {
    if (!slide || (slide.type !== "cover" && slide.type !== "lyrics" && slide.type !== "text")) {
      return null;
    }
    return slide.backgroundImage ?? null;
  }, [slide]);
  const imagePath = useMemo(() => {
    if (!slide || slide.type !== "image") {
      return null;
    }
    return slide.src ?? null;
  }, [slide]);
  const resolvedBackgroundPath = useMediaSource(backgroundPath);
  const resolvedImagePath = useMediaSource(imagePath);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-black text-white p-4",
        className,
      )}
    >
      {renderSlide(slide, renderMode, t, resolvedBackgroundPath, resolvedImagePath)}
    </div>
  );
}

function renderSlide(
  slide: SlideContent | null,
  renderMode: SlideRenderMode,
  t: (key: string) => string,
  resolvedBackgroundPath: string | null,
  resolvedImagePath: string | null,
) {
  if (!slide || slide.type === "pause") {
    return <div />;
  }

  if (slide.type === "cover") {
    const titleStyle = textStyle(slide, 48, renderMode, "cover-title");
    const subtitleStyle = secondaryTextStyle(slide, 28, renderMode);
    const backgroundImage = resolvedBackgroundPath ?? slide.backgroundImage ?? null;
    const showCoverTextPanel = shouldRenderCoverTextPanel(renderMode, backgroundImage);
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
        style={backgroundStyle(slide)}
      >
        {backgroundImage ? (
          <>
            <img
              src={backgroundImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/15" />
          </>
        ) : null}
        <div
          className={cn(
            "relative flex flex-col items-center gap-3",
            showCoverTextPanel && [
              "max-w-[92%] rounded-md bg-black/62 px-8 py-7 shadow-2xl",
              "md:max-w-[80%] md:px-10 md:py-8",
            ],
          )}
        >
          <h1 className="text-4xl font-bold leading-tight" style={titleStyle}>{slide.title}</h1>
          {slide.subtitle && (
            <p className="text-xl text-white/70" style={subtitleStyle}>{slide.subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  if (slide.type === "lyrics") {
    const textLineStyle = textStyle(slide, 36, renderMode, "lyrics");
    const labelStyle = secondaryTextStyle(slide, 13, renderMode);
    const backgroundImage = resolvedBackgroundPath ?? slide.backgroundImage ?? null;
    const showLyricTextPanel = shouldRenderLyricTextPanel(renderMode, backgroundImage);
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
        style={backgroundStyle(slide)}
      >
        {backgroundImage ? (
          <>
            <img
              src={backgroundImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/15" />
          </>
        ) : null}
        {slide.label && (
          <p className="relative text-sm uppercase tracking-widest text-white/50" style={labelStyle}>
            {slide.label}
          </p>
        )}
        <p
          className={cn(
            "relative whitespace-pre-line font-semibold leading-snug",
            showLyricTextPanel && [
              "max-w-[90%] rounded-md bg-black/68 px-8 py-6 shadow-2xl",
              "md:max-w-[82%] md:px-10 md:py-7",
            ],
          )}
          style={textLineStyle}
        >
          {slide.text}
        </p>
      </div>
    );
  }

  if (slide.type === "text") {
    const textLineStyle = textStyle(slide, 28, renderMode, "text");
    const backgroundImage = resolvedBackgroundPath ?? slide.backgroundImage ?? null;
    return (
      <div
        className="relative flex h-full w-full items-center justify-center px-8 text-center"
        style={backgroundStyle(slide)}
      >
        {backgroundImage ? (
          <>
            <img
              src={backgroundImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/15" />
          </>
        ) : null}
        <p className="relative whitespace-pre-line leading-snug" style={textLineStyle}>{slide.text}</p>
      </div>
    );
  }

  if (slide.type === "image") {
    return (
      <img
        src={resolvedImagePath ?? slide.src}
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

function backgroundStyle(slide: {
  backgroundColor?: string;
}) {
  if (!slide.backgroundColor) {
    return undefined;
  }
  return {
    backgroundColor: slide.backgroundColor,
  };
}

function textStyle(
  slide: { textColor?: string; fontSize?: number },
  fallbackSize: number,
  renderMode: SlideRenderMode,
  variant: "cover-title" | "lyrics" | "text",
) {
  const style: Record<string, string> = {};
  if (slide.textColor) {
    style.color = slide.textColor;
  }
  const baseSize = typeof slide.fontSize === "number" && Number.isFinite(slide.fontSize)
    ? Math.max(12, Math.min(120, slide.fontSize))
    : fallbackSize;
  const size = resolveRenderFontSize(baseSize, slide.fontSize, renderMode, variant);
  style.fontSize = `${size}px`;
  return style;
}

function secondaryTextStyle(
  slide: { textColor?: string; fontSize?: number },
  fallbackSize: number,
  renderMode: SlideRenderMode,
) {
  const style: Record<string, string> = {};
  if (slide.textColor) {
    style.color = slide.textColor;
    style.opacity = "0.8";
  }
  const baseSize = typeof slide.fontSize === "number" && Number.isFinite(slide.fontSize)
    ? Math.max(12, Math.min(120, slide.fontSize)) * 0.55
    : fallbackSize;
  const size = resolveRenderFontSize(baseSize, slide.fontSize, renderMode, "text");
  if (typeof slide.fontSize === "number" && Number.isFinite(slide.fontSize)) {
    style.fontSize = `${Math.max(10, Math.round(size))}px`;
    return style;
  }
  style.fontSize = `${Math.max(10, Math.round(size))}px`;
  return style;
}

function resolveRenderFontSize(
  baseSize: number,
  sourceSize: number | undefined,
  renderMode: SlideRenderMode,
  variant: "cover-title" | "lyrics" | "text",
): number {
  const hasExplicitSourceSize = typeof sourceSize === "number" && Number.isFinite(sourceSize);
  let scale = 1;

  // Legacy .slja values (e.g. 23/30) are tuned for other engines and appear too small here.
  if (hasExplicitSourceSize) {
    if (renderMode === "projector") {
      if (variant === "lyrics") {
        scale = 2.8;
      } else if (variant === "cover-title") {
        scale = 2.3;
      } else {
        scale = 2.0;
      }
    } else if (renderMode === "return-current") {
      if (variant === "lyrics") {
        scale = 2.05;
      } else if (variant === "cover-title") {
        scale = 1.8;
      } else {
        scale = 1.55;
      }
    } else if (renderMode === "return-next") {
      if (variant === "lyrics") {
        scale = 1.3;
      } else if (variant === "cover-title") {
        scale = 1.2;
      } else {
        scale = 1.1;
      }
    } else if (renderMode === "thumbnail") {
      scale = 0.5;
    }
  } else if (renderMode === "thumbnail") {
    scale = 0.52;
  }

  const raw = baseSize * scale;
  if (variant === "cover-title") {
    if (renderMode === "projector") {
      return Math.max(62, Math.min(220, Math.round(raw)));
    }
    if (renderMode === "return-current") {
      return Math.max(40, Math.min(140, Math.round(raw)));
    }
    if (renderMode === "return-next") {
      return Math.max(20, Math.min(88, Math.round(raw)));
    }
  }

  if (variant === "lyrics") {
    if (renderMode === "projector") {
      return Math.max(58, Math.min(210, Math.round(raw)));
    }
    if (renderMode === "return-current") {
      return Math.max(36, Math.min(140, Math.round(raw)));
    }
    if (renderMode === "return-next") {
      return Math.max(20, Math.min(84, Math.round(raw)));
    }
  }

  return Math.max(10, Math.min(180, Math.round(raw)));
}

function shouldRenderLyricTextPanel(
  renderMode: SlideRenderMode,
  backgroundImage: string | null,
): boolean {
  if (!backgroundImage) {
    return false;
  }
  return renderMode === "projector" || renderMode === "return-current";
}

function shouldRenderCoverTextPanel(
  renderMode: SlideRenderMode,
  backgroundImage: string | null,
): boolean {
  if (!backgroundImage) {
    return false;
  }
  return renderMode === "projector" || renderMode === "return-current";
}
