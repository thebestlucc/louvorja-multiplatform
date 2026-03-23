import { useMemo } from "react";
import type { SlideContent } from "../../lib/bindings";
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
    if (!slide || (slide.slideType !== "cover" && slide.slideType !== "lyrics" && slide.slideType !== "text")) {
      return null;
    }
    return slide.backgroundImage ?? null;
  }, [slide]);
  const imagePath = useMemo(() => {
    if (!slide || slide.slideType !== "image") {
      return null;
    }
    // Note: old 'src' field was renamed to 'backgroundImage' in unified SlideContent for simple cases,
    // or we use 'backgroundImage' for standard backgrounds. For image slides specifically, 
    // we use backgroundImage as the main image source.
    return slide.backgroundImage ?? null;
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
  if (!slide || slide.slideType === "pause") {
    return <div />;
  }

  if (slide.slideType === "cover") {
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

  if (slide.slideType === "lyrics") {
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
          <p key={slide.label} className="relative text-sm uppercase tracking-widest text-white/50 animate-in fade-in duration-200" style={labelStyle}>
            {slide.label}
          </p>
        )}
        <p
          key={slide.text ?? ""}
          className={cn(
            "relative whitespace-pre-line font-semibold leading-snug animate-in fade-in duration-300",
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

  if (slide.slideType === "text") {
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

  if (slide.slideType === "image") {
    return (
      <img
        src={resolvedImagePath ?? slide.backgroundImage ?? ""}
        alt={slide.label ?? ""}
        className="h-full w-full object-contain"
      />
    );
  }

  if (slide.slideType === "bible") {
    return renderBibleSlide(slide, renderMode);
  }

  if (slide.slideType === "video") {
    if (renderMode === "thumbnail") {
      const videoLabel = getVideoLabel(slide.videoPath ?? "");
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
      const videoLabel = getVideoLabel(slide.videoPath ?? "");
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
        slide={slide}
        renderMode={mapRenderMode(renderMode)}
        className="h-full w-full"
      />
    );
  }

  return null;
}

function renderBibleSlide(slide: SlideContent, renderMode: SlideRenderMode) {
  const isProjector = renderMode === "projector";
  const isReturn = renderMode === "return-current" || renderMode === "return-next";
  const isThumbnail = renderMode === "thumbnail";

  const bgColor = slide.backgroundColor ?? "#0a0a0a";
  const txtColor = slide.textColor ?? "#ffffff";

  // Font sizes scale by render mode
  let verseFontSize: number;
  let refFontSize: number;

  if (slide.textSize && Number.isFinite(slide.textSize)) {
    const base = Math.max(12, Math.min(120, slide.textSize));
    if (isProjector) {
      verseFontSize = Math.max(32, Math.round(base * 1.6));
      refFontSize = Math.max(14, Math.round(base * 0.5));
    } else if (renderMode === "return-current") {
      verseFontSize = Math.max(24, Math.round(base * 1.1));
      refFontSize = Math.max(12, Math.round(base * 0.38));
    } else if (renderMode === "return-next") {
      verseFontSize = Math.max(16, Math.round(base * 0.7));
      refFontSize = Math.max(10, Math.round(base * 0.28));
    } else if (isThumbnail) {
      verseFontSize = Math.max(9, Math.round(base * 0.28));
      refFontSize = Math.max(7, Math.round(base * 0.14));
    } else {
      verseFontSize = Math.max(20, Math.round(base * 0.9));
      refFontSize = Math.max(11, Math.round(base * 0.35));
    }
  } else {
    if (isProjector) {
      verseFontSize = 48;
      refFontSize = 18;
    } else if (renderMode === "return-current") {
      verseFontSize = 32;
      refFontSize = 14;
    } else if (renderMode === "return-next") {
      verseFontSize = 20;
      refFontSize = 11;
    } else if (isThumbnail) {
      verseFontSize = 12;
      refFontSize = 8;
    } else {
      verseFontSize = 28;
      refFontSize = 13;
    }
  }

  const textShadow = (isProjector || isReturn)
    ? "0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6)"
    : isThumbnail
      ? "0 1px 3px rgba(0,0,0,0.6)"
      : "0 2px 6px rgba(0,0,0,0.7)";

  const textAlign = (slide.mode === "left" ? "left" : slide.mode === "right" ? "right" : "center") as "left" | "center" | "right";

  // Reference label (from slide.label)
  const reference = slide.label ?? slide.title ?? null;

  // Detect reference position from title field convention:
  // If title is set and label is set, reference goes to top (default).
  // We use "mode" field to encode ref position: if it contains "ref-bottom", position is bottom.
  const refPosition = slide.mode?.includes("ref-bottom") ? "bottom" : "top";

  const referenceEl = reference ? (
    <p
      className={cn(
        "uppercase tracking-[0.2em] font-medium",
        isThumbnail ? "tracking-[0.15em]" : "",
      )}
      style={{
        fontSize: `${refFontSize}px`,
        color: txtColor,
        opacity: 0.6,
        textShadow,
        textAlign,
      }}
    >
      {reference}
    </p>
  ) : null;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{
        backgroundColor: bgColor,
        padding: isThumbnail ? "4px 8px" : isProjector ? "48px 80px" : "24px 40px",
      }}
    >
      {refPosition === "top" && referenceEl}

      <div
        className={cn(
          "flex flex-col",
          isThumbnail ? "gap-0.5" : isProjector ? "gap-4" : "gap-2",
        )}
        style={{ textAlign }}
      >
        {(slide.text ?? "").split("\n").map((line, i) => (
          <p
            key={i}
            className="whitespace-pre-line font-serif leading-relaxed"
            style={{
              fontSize: `${verseFontSize}px`,
              color: txtColor,
              textShadow,
              lineHeight: isProjector ? 1.5 : 1.4,
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {refPosition === "bottom" && (
        <div className={isThumbnail ? "mt-1" : isProjector ? "mt-6" : "mt-3"}>
          {referenceEl}
        </div>
      )}
    </div>
  );
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
  backgroundColor?: string | null;
}) {
  if (!slide.backgroundColor) {
    return undefined;
  }
  return {
    backgroundColor: slide.backgroundColor,
  };
}

function textStyle(
  slide: { textColor?: string | null; textSize?: number | null },
  fallbackSize: number,
  renderMode: SlideRenderMode,
  variant: "cover-title" | "lyrics" | "text",
) {
  const style: Record<string, string> = {};
  if (slide.textColor) {
    style.color = slide.textColor;
  }
  const baseSize = typeof slide.textSize === "number" && Number.isFinite(slide.textSize)
    ? Math.max(12, Math.min(120, slide.textSize))
    : fallbackSize;
  const size = resolveRenderFontSize(baseSize, slide.textSize ?? undefined, renderMode, variant);
  style.fontSize = `${size}px`;
  return style;
}

function secondaryTextStyle(
  slide: { textColor?: string | null; textSize?: number | null },
  fallbackSize: number,
  renderMode: SlideRenderMode,
) {
  const style: Record<string, string> = {};
  if (slide.textColor) {
    style.color = slide.textColor;
    style.opacity = "0.8";
  }
  const baseSize = typeof slide.textSize === "number" && Number.isFinite(slide.textSize)
    ? Math.max(12, Math.min(120, slide.textSize)) * 0.55
    : fallbackSize;
  const size = resolveRenderFontSize(baseSize, slide.textSize ?? undefined, renderMode, "text");
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
