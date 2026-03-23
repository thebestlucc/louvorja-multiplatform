import type { SlideContent } from "../../../types/presentation";

const EMPTY_SLIDE_PROPS = {
  text: null,
  title: null,
  subtitle: null,
  label: null,
  videoPath: null,
  backgroundImage: null,
  backgroundColor: null,
  audioPath: null,
  autoPlay: null,
  loop: null,
  muted: null,
  mode: null,
  textColor: null,
  textSize: null,
  videoUrl: null,
  videoId: null,
  videoSource: null,
  videoTitle: null,
};

export function defaultVideoSlide(): SlideContent {
  return {
    ...EMPTY_SLIDE_PROPS,
    slideType: "video",
    videoPath: "",
    autoPlay: true,
    loop: false,
    muted: false,
    mode: "fullscreen",
    text: "",
    textColor: "#ffffff",
    textSize: 42,
  };
}
