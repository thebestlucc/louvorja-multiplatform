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
