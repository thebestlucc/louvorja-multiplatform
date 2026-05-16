import type { SlideRenderMode } from "../slide-renderer";

/**
 * Resolves font size for a slide element given the base size, optional explicit
 * source size from the slide data, render mode, and variant.
 *
 * Preserves the legacy .slja scaling multipliers exactly as they were in the
 * monolithic slide-renderer so every visual detail is identical.
 */
export function resolveRenderFontSize(
  baseSize: number,
  sourceSize: number | undefined,
  renderMode: SlideRenderMode,
  variant: "cover-title" | "lyrics" | "text",
): number {
  const hasExplicitSourceSize = typeof sourceSize === "number" && Number.isFinite(sourceSize);
  let scale = 1;

  if (hasExplicitSourceSize) {
    if (renderMode === "projector") {
      if (variant === "lyrics") scale = 2.8;
      else if (variant === "cover-title") scale = 2.3;
      else scale = 2.0;
    } else if (renderMode === "return-current") {
      if (variant === "lyrics") scale = 2.05;
      else if (variant === "cover-title") scale = 1.8;
      else scale = 1.55;
    } else if (renderMode === "return-next") {
      if (variant === "lyrics") scale = 1.3;
      else if (variant === "cover-title") scale = 1.2;
      else scale = 1.1;
    } else if (renderMode === "thumbnail") {
      scale = 0.5;
    }
  } else if (renderMode === "thumbnail") {
    scale = 0.52;
  }

  const raw = baseSize * scale;

  if (variant === "cover-title") {
    if (renderMode === "projector") return Math.max(62, Math.min(1400, Math.round(raw)));
    if (renderMode === "return-current") return Math.max(40, Math.min(700, Math.round(raw)));
    if (renderMode === "return-next") return Math.max(20, Math.min(440, Math.round(raw)));
  }

  if (variant === "lyrics") {
    if (renderMode === "projector") return Math.max(58, Math.min(1400, Math.round(raw)));
    if (renderMode === "return-current") return Math.max(36, Math.min(700, Math.round(raw)));
    if (renderMode === "return-next") return Math.max(20, Math.min(420, Math.round(raw)));
  }

  return Math.max(10, Math.min(900, Math.round(raw)));
}

/** Compute primary text style (color + fontSize). */
export function textStyle(
  textColor: string | null | undefined,
  textSize: number | null | undefined,
  fallbackSize: number,
  renderMode: SlideRenderMode,
  variant: "cover-title" | "lyrics" | "text",
): Record<string, string> {
  const style: Record<string, string> = {};
  if (textColor) style.color = textColor;
  const baseSize = typeof textSize === "number" && Number.isFinite(textSize)
    ? Math.max(12, Math.min(120, textSize))
    : fallbackSize;
  const size = resolveRenderFontSize(baseSize, textSize ?? undefined, renderMode, variant);
  style.fontSize = `${size}px`;
  return style;
}

/** Compute secondary/subtitle text style (color + smaller fontSize). */
export function secondaryTextStyle(
  textColor: string | null | undefined,
  textSize: number | null | undefined,
  fallbackSize: number,
  renderMode: SlideRenderMode,
): Record<string, string> {
  const style: Record<string, string> = {};
  if (textColor) {
    style.color = textColor;
    style.opacity = "0.8";
  }
  const baseSize = typeof textSize === "number" && Number.isFinite(textSize)
    ? Math.max(12, Math.min(120, textSize)) * 0.55
    : fallbackSize;
  const size = resolveRenderFontSize(baseSize, textSize ?? undefined, renderMode, "text");
  style.fontSize = `${Math.max(10, Math.round(size))}px`;
  return style;
}
