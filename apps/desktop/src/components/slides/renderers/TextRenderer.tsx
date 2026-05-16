import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { BackgroundLayer, backgroundContainerStyle } from "./BackgroundLayer";
import { textStyle } from "./font-scale";

type TextSlide = Extract<SlideContent, { slideType: "text" }>;

interface TextRendererProps {
  slide: TextSlide;
  mode: SlideRenderMode;
}

export function TextRenderer({ slide, mode }: TextRendererProps) {
  const textLineSt = textStyle(slide.text_color, slide.text_size, 28, mode, "text");

  return (
    <div
      className="relative flex h-full w-full items-center justify-center px-8 text-center"
      style={backgroundContainerStyle(slide.background)}
    >
      <BackgroundLayer background={slide.background} />
      <p className="relative whitespace-pre-line leading-snug" style={textLineSt}>{slide.content}</p>
    </div>
  );
}
