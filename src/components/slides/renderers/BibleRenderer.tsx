import type { SlideContent, BibleMode } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { cn } from "../../../lib/utils";
import { useImageSrc } from "../../../hooks/use-image-src";
import { resolveBackground } from "./BackgroundLayer";

type BibleSlide = Extract<SlideContent, { slideType: "bible" }>;

interface BibleRendererProps {
  slide: BibleSlide;
  mode: SlideRenderMode;
}

/** Default BibleMode when the mode field is missing or is a legacy string. */
const DEFAULT_BIBLE_MODE: BibleMode = {
  alignment: "center",
  refPosition: "top",
  textShadow: false,
  gradient: null,
  fontFamily: null,
};

/**
 * Parse mode: if it's the new BibleMode object, use directly.
 * If it's a legacy string (from old DB data), parse tokens into BibleMode shape.
 */
function resolveBibleMode(mode: BibleMode | string | null | undefined): BibleMode {
  if (!mode) return DEFAULT_BIBLE_MODE;
  if (typeof mode === "object" && "alignment" in mode) return mode;

  // Legacy string parsing: "align-left ref-bottom text-shadow gradient-180-000000-333333"
  if (typeof mode === "string") {
    const tokens = mode.split(" ");
    const result: BibleMode = { ...DEFAULT_BIBLE_MODE };
    for (const token of tokens) {
      if (token === "align-left") result.alignment = "left";
      else if (token === "align-right") result.alignment = "right";
      else if (token === "ref-bottom") result.refPosition = "bottom";
      else if (token === "no-ref") result.refPosition = "hidden";
      else if (token === "text-shadow") result.textShadow = true;
      else if (token.startsWith("gradient-")) {
        const parts = token.slice("gradient-".length).split("-");
        if (parts.length >= 3) {
          result.gradient = {
            angle: Number(parts[0]) || 180,
            startColor: `#${parts[1]}`,
            endColor: `#${parts.slice(2).join("")}`,
          };
        }
      }
    }
    return result;
  }

  return DEFAULT_BIBLE_MODE;
}

export function BibleRenderer({ slide, mode: renderMode }: BibleRendererProps) {
  const isProjector = renderMode === "projector";
  const isReturn = renderMode === "return-current" || renderMode === "return-next";
  const isThumbnail = renderMode === "thumbnail";

  const bg = resolveBackground(slide.background);
  const bgColor = bg.color ?? "#0a0a0a";
  const txtColor = slide.text_color ?? "#ffffff";

  // Resolve mode (handles both new BibleMode object and legacy string)
  const bibleMode = resolveBibleMode(slide.mode as BibleMode | string);
  const textAlign = bibleMode.alignment;
  const refPosition = bibleMode.refPosition;
  const hasTextShadow = bibleMode.textShadow;
  const fontFamily = bibleMode.fontFamily ?? undefined;

  const resolvedBgImage = useImageSrc(
    bg.kind === "image" ? bg.imagePath : null,
  );

  // Font sizes scale by render mode
  let verseFontSize: number;
  let refFontSize: number;

  if (slide.text_size && Number.isFinite(slide.text_size)) {
    const base = Math.max(12, Math.min(120, slide.text_size));
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

  const textShadowValue = hasTextShadow
    ? (isProjector || isReturn)
      ? "0 2px 12px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.7)"
      : isThumbnail
        ? "0 1px 4px rgba(0,0,0,0.7)"
        : "0 2px 8px rgba(0,0,0,0.8)"
    : "none";

  const reference = refPosition === "hidden" ? null : (slide.reference ?? null);

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
        textShadow: textShadowValue,
        textAlign,
        ...(fontFamily ? { fontFamily } : {}),
      }}
    >
      {reference}
    </p>
  ) : null;

  // Background: gradient overrides solid color
  const containerBg: Record<string, string> = bibleMode.gradient
    ? { background: `linear-gradient(${bibleMode.gradient.angle}deg, ${bibleMode.gradient.startColor}, ${bibleMode.gradient.endColor})` }
    : { backgroundColor: bgColor };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        ...(resolvedBgImage ? {} : containerBg),
        padding: isThumbnail ? "4px 8px" : isProjector ? "48px 80px" : "24px 40px",
      }}
    >
      {resolvedBgImage && (
        <>
          <img src={resolvedBgImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/85" />
        </>
      )}

      {refPosition === "top" && (
        <div className="relative z-10">{referenceEl}</div>
      )}

      <div
        className={cn(
          "relative z-10 flex flex-col",
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
              textShadow: textShadowValue,
              lineHeight: isProjector ? 1.5 : 1.4,
              ...(fontFamily ? { fontFamily } : {}),
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {refPosition === "bottom" && (
        <div className={cn("relative z-10", isThumbnail ? "mt-1" : isProjector ? "mt-6" : "mt-3")}>
          {referenceEl}
        </div>
      )}
    </div>
  );
}
