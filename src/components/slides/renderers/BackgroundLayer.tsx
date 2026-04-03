import type { BackgroundConfig } from "../../../lib/bindings";
import { useImageSrc } from "../../../hooks/use-image-src";

const DEFAULT_BACKGROUND: BackgroundConfig = {
  kind: "solid",
  color: "#1a1a2e",
  imagePath: null,
  gradientStart: null,
  gradientEnd: null,
  gradientAngle: null,
  opacity: null,
};

/** Normalise a background that may be undefined/null (legacy flat slides). */
export function resolveBackground(bg: BackgroundConfig | null | undefined): BackgroundConfig {
  if (!bg || typeof bg !== "object" || !bg.kind) return DEFAULT_BACKGROUND;
  return bg;
}

interface BackgroundLayerProps {
  background: BackgroundConfig | null | undefined;
}

/**
 * Renders the slide background: solid color, image with overlay, or gradient.
 * Used by Cover, Lyrics, Text, and Bible renderers.
 */
export function BackgroundLayer({ background: rawBackground }: BackgroundLayerProps) {
  const background = resolveBackground(rawBackground);
  const resolvedImage = useImageSrc(background.kind === "image" ? background.imagePath : null);

  if (background.kind === "image" && resolvedImage) {
    return (
      <>
        <img
          src={resolvedImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/15" />
      </>
    );
  }

  // Gradient and solid are handled via inline styles on the parent container.
  return null;
}

/** Returns inline style for the container based on BackgroundConfig (null-safe). */
export function backgroundContainerStyle(rawBackground: BackgroundConfig | null | undefined): React.CSSProperties | undefined {
  const background = resolveBackground(rawBackground);
  if (background.kind === "gradient" && background.gradientStart && background.gradientEnd) {
    const angle = background.gradientAngle ?? 180;
    return { background: `linear-gradient(${angle}deg, ${background.gradientStart}, ${background.gradientEnd})` };
  }
  if (background.kind === "solid" || background.color) {
    return { backgroundColor: background.color ?? "#1a1a2e" };
  }
  return undefined;
}
