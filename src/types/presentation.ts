export interface Presentation {
  id: number;
  title: string;
  author: string | null;
  aspect_ratio: string;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export type SlideType =
  | "cover"
  | "lyrics"
  | "pause"
  | "text"
  | "image"
  | "bible"
  | "video";

export interface Slide {
  id: number;
  presentation_id: number;
  slide_index: number;
  slide_type: SlideType;
  content: SlideContent;
  notes: string | null;
  transition: string | null;
}

export type SlideContent =
  | { type: "cover"; title: string; subtitle?: string }
  | { type: "lyrics"; text: string; label?: string }
  | { type: "pause" }
  | { type: "text"; text: string; fontSize?: number }
  | { type: "image"; src: string; alt?: string }
  | { type: "bible"; book: string; chapter: number; verseStart: number; verseEnd: number; text: string }
  | { type: "video"; src: string };

/** Flat struct matching Rust SlideContent for Tauri IPC */
export interface SlideContentFlat {
  slide_type: string;
  text?: string | null;
  title?: string | null;
  subtitle?: string | null;
  label?: string | null;
}

/** Convert discriminated union SlideContent to flat struct for Tauri */
export function slideContentToFlat(slide: SlideContent): SlideContentFlat {
  const base: SlideContentFlat = { slide_type: slide.type };
  switch (slide.type) {
    case "cover":
      return { ...base, title: slide.title, subtitle: slide.subtitle };
    case "lyrics":
      return { ...base, text: slide.text, label: slide.label };
    case "pause":
      return base;
    case "text":
      return { ...base, text: slide.text };
    case "image":
      return { ...base, text: slide.src, title: slide.alt };
    case "bible":
      return { ...base, text: slide.text, title: `${slide.book} ${slide.chapter}:${slide.verseStart}-${slide.verseEnd}` };
    case "video":
      return { ...base, text: slide.src };
  }
}

/** Convert flat Tauri struct back to discriminated union */
export function flatToSlideContent(flat: SlideContentFlat): SlideContent {
  switch (flat.slide_type) {
    case "cover":
      return { type: "cover", title: flat.title ?? "", subtitle: flat.subtitle ?? undefined };
    case "lyrics":
      return { type: "lyrics", text: flat.text ?? "", label: flat.label ?? undefined };
    case "pause":
      return { type: "pause" };
    case "text":
      return { type: "text", text: flat.text ?? "" };
    default:
      return { type: "text", text: flat.text ?? "" };
  }
}
