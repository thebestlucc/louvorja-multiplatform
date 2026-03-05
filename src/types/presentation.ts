import type { SlideContent, Slide, Presentation, SlideContext, OverlayState } from "../lib/bindings";
import { catcherSync } from "../lib/catcher";

export type { SlideContent, Slide, Presentation, SlideContext, OverlayState };

export type SlideType =
  | "cover"
  | "lyrics"
  | "pause"
  | "text"
  | "image"
  | "bible"
  | "video";

/** Raw slide row from DB — content is a JSON string */
export interface SlideRow {
  id: number;
  presentationId: number;
  slideIndex: number;
  slideType: string;
  content: string;
  notes: string | null;
  transition: string | null;
}

export interface SlideWithContent extends Omit<Slide, "content"> {
  content: SlideContent;
}

/** Parse a SlideRow into a Slide with parsed content */
export function parseSlideRow(row: SlideRow): SlideWithContent {
  const [content] = catcherSync(() => JSON.parse(row.content) as SlideContent);

  return {
    ...row,
    content: content ?? {
      slideType: "text",
      text: row.content,
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
    },
  };
}
