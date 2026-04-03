import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { OnlineVideoSlide } from "../../online-videos/online-video-slide";

type OnlineVideoSlideContent = Extract<SlideContent, { slideType: "onlineVideo" }>;

interface OnlineVideoRendererProps {
  slide: OnlineVideoSlideContent;
  mode: SlideRenderMode;
}

export function OnlineVideoRenderer({ slide, mode }: OnlineVideoRendererProps) {
  // OnlineVideoSlide expects the full SlideContent union — pass as-is
  return <OnlineVideoSlide slide={slide} renderMode={mode} className="h-full w-full" />;
}
