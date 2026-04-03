import type { SlideContent } from "../../../lib/bindings";

export function defaultVideoSlide(): Extract<SlideContent, { slideType: "video" }> {
  return {
    slideType: "video",
    path: "",
    auto_play: true,
    loop_video: false,
    muted: false,
    mode: "fullscreen",
    overlay_text: null,
    audio_path: null,
  };
}
