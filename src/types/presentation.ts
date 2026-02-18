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

export type VideoSlideMode = "fullscreen" | "background";

export interface VideoSlideContent {
  type: "video";
  videoPath: string;
  autoPlay: boolean;
  loop: boolean;
  muted: boolean;
  mode: VideoSlideMode;
  text?: string;
  textColor?: string;
  textSize?: number;
}

export interface StyledSlideMetadata {
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  audioPath?: string;
}

export type SlideContent =
  | ({ type: "cover"; title: string; subtitle?: string } & StyledSlideMetadata)
  | ({ type: "lyrics"; text: string; label?: string } & StyledSlideMetadata)
  | { type: "pause" }
  | ({ type: "text"; text: string } & StyledSlideMetadata)
  | ({ type: "image"; src: string; alt?: string } & Pick<StyledSlideMetadata, "audioPath">)
  | { type: "bible"; book: string; chapter: number; verseStart: number; verseEnd: number; text: string }
  | VideoSlideContent;

/** Raw slide row from DB — content is a JSON string */
export interface SlideRow {
  id: number;
  presentation_id: number;
  slide_index: number;
  slide_type: string;
  content: string;
  notes: string | null;
  transition: string | null;
}

/** Parse a SlideRow into a Slide with parsed content */
export function parseSlideRow(row: SlideRow): Slide {
  let content: SlideContent;
  try {
    const parsed = JSON.parse(row.content) as SlideContent | { type: "video"; src: string };
    content = normalizeSlideContent(parsed);
  } catch {
    content = { type: "text", text: row.content };
  }
  return {
    ...row,
    slide_type: content.type as SlideType,
    content,
  };
}

function normalizeSlideContent(content: SlideContent | { type: "video"; src: string }): SlideContent {
  if (content.type === "video") {
    const legacy = content as { type: "video"; src?: string };
    const normalized = content as Partial<VideoSlideContent>;
    return {
      type: "video",
      videoPath: normalized.videoPath ?? legacy.src ?? "",
      autoPlay: normalized.autoPlay ?? true,
      loop: normalized.loop ?? false,
      muted: normalized.muted ?? false,
      mode: normalized.mode === "background" ? "background" : "fullscreen",
      text: normalized.text,
      textColor: normalized.textColor,
      textSize: normalized.textSize,
    };
  }

  return content;
}

/** Context for return monitor: next slide, position, title */
export interface SlideContextFlat {
  next: SlideContentFlat | null;
  index: number;
  total: number;
  title: string;
}

/** Overlay state from Rust */
export interface OverlayState {
  blackScreen: boolean;
  logoScreen: boolean;
}

/** Flat struct matching Rust SlideContent for Tauri IPC */
export interface SlideContentFlat {
  slide_type: string;
  text?: string | null;
  title?: string | null;
  subtitle?: string | null;
  label?: string | null;
  video_path?: string | null;
  background_image?: string | null;
  background_color?: string | null;
  audio_path?: string | null;
  auto_play?: boolean | null;
  loop?: boolean | null;
  muted?: boolean | null;
  mode?: string | null;
  text_color?: string | null;
  text_size?: number | null;
}

/** Convert discriminated union SlideContent to flat struct for Tauri */
export function slideContentToFlat(slide: SlideContent): SlideContentFlat {
  const base: SlideContentFlat = { slide_type: slide.type };
  switch (slide.type) {
    case "cover":
      return {
        ...base,
        title: slide.title,
        subtitle: slide.subtitle,
        background_image: slide.backgroundImage ?? null,
        background_color: slide.backgroundColor ?? null,
        text_color: slide.textColor ?? null,
        text_size: slide.fontSize ?? null,
        audio_path: slide.audioPath ?? null,
      };
    case "lyrics":
      return {
        ...base,
        text: slide.text,
        label: slide.label,
        background_image: slide.backgroundImage ?? null,
        background_color: slide.backgroundColor ?? null,
        text_color: slide.textColor ?? null,
        text_size: slide.fontSize ?? null,
        audio_path: slide.audioPath ?? null,
      };
    case "pause":
      return base;
    case "text":
      return {
        ...base,
        text: slide.text,
        background_image: slide.backgroundImage ?? null,
        background_color: slide.backgroundColor ?? null,
        text_color: slide.textColor ?? null,
        text_size: slide.fontSize ?? null,
        audio_path: slide.audioPath ?? null,
      };
    case "image":
      return {
        ...base,
        text: slide.src,
        title: slide.alt,
        audio_path: slide.audioPath ?? null,
      };
    case "bible":
      return { ...base, text: slide.text, title: `${slide.book} ${slide.chapter}:${slide.verseStart}-${slide.verseEnd}` };
    case "video":
      return {
        ...base,
        text: slide.text ?? null,
        video_path: slide.videoPath,
        auto_play: slide.autoPlay,
        loop: slide.loop,
        muted: slide.muted,
        mode: slide.mode,
        text_color: slide.textColor ?? null,
        text_size: slide.textSize ?? null,
      };
  }
}

/** Convert flat Tauri struct back to discriminated union */
export function flatToSlideContent(flat: SlideContentFlat): SlideContent {
  switch (flat.slide_type) {
    case "cover":
      return {
        type: "cover",
        title: flat.title ?? "",
        subtitle: flat.subtitle ?? undefined,
        backgroundImage: flat.background_image ?? undefined,
        backgroundColor: flat.background_color ?? undefined,
        textColor: flat.text_color ?? undefined,
        fontSize: flat.text_size ?? undefined,
        audioPath: flat.audio_path ?? undefined,
      };
    case "lyrics":
      return {
        type: "lyrics",
        text: flat.text ?? "",
        label: flat.label ?? undefined,
        backgroundImage: flat.background_image ?? undefined,
        backgroundColor: flat.background_color ?? undefined,
        textColor: flat.text_color ?? undefined,
        fontSize: flat.text_size ?? undefined,
        audioPath: flat.audio_path ?? undefined,
      };
    case "pause":
      return { type: "pause" };
    case "text":
      return {
        type: "text",
        text: flat.text ?? "",
        backgroundImage: flat.background_image ?? undefined,
        backgroundColor: flat.background_color ?? undefined,
        textColor: flat.text_color ?? undefined,
        fontSize: flat.text_size ?? undefined,
        audioPath: flat.audio_path ?? undefined,
      };
    case "image":
      return {
        type: "image",
        src: flat.text ?? "",
        alt: flat.title ?? undefined,
        audioPath: flat.audio_path ?? undefined,
      };
    case "bible": {
      // title is formatted as "Book Chapter:Start-End" by the backend
      const ref = flat.title ?? "";
      const match = ref.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
      if (match) {
        const book = match[1];
        const chapter = parseInt(match[2], 10);
        const verseStart = parseInt(match[3], 10);
        const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart;
        return { type: "bible", book, chapter, verseStart, verseEnd, text: flat.text ?? "" };
      }
      return { type: "bible", book: "", chapter: 0, verseStart: 0, verseEnd: 0, text: flat.text ?? "" };
    }
    case "video": {
      const hasDedicatedPath = Boolean(flat.video_path && flat.video_path.length > 0);
      return {
        type: "video",
        videoPath: flat.video_path ?? flat.text ?? "",
        autoPlay: flat.auto_play ?? true,
        loop: flat.loop ?? false,
        muted: flat.muted ?? false,
        mode: flat.mode === "background" ? "background" : "fullscreen",
        text: hasDedicatedPath ? flat.text ?? undefined : undefined,
        textColor: flat.text_color ?? undefined,
        textSize: flat.text_size ?? undefined,
      };
    }
    default:
      return { type: "text", text: flat.text ?? "" };
  }
}
