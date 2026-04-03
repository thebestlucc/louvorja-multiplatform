import type { SlideContent } from "../../../lib/bindings";
import { useImageSrc } from "../../../hooks/use-image-src";

type ImageSlide = Extract<SlideContent, { slideType: "image" }>;

interface ImageRendererProps {
  slide: ImageSlide;
}

const FIT_CLASS: Record<string, string> = {
  contain: "object-contain",
  cover: "object-cover",
  fill: "object-fill",
};

export function ImageRenderer({ slide }: ImageRendererProps) {
  const resolvedPath = useImageSrc(slide.path);
  if (!resolvedPath) return null;

  return (
    <img
      src={resolvedPath}
      alt={slide.caption ?? ""}
      className={`h-full w-full ${FIT_CLASS[slide.fit] ?? "object-contain"}`}
    />
  );
}
