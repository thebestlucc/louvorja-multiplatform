import type { SlideContent, BackgroundConfig, Slide, Presentation, SlideContext, OverlayState } from "../lib/bindings";
import { catcherSync } from "../lib/catcher";

export type { SlideContent, BackgroundConfig, Slide, Presentation, SlideContext, OverlayState };

export type SlideType = SlideContent["slideType"];

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

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isCoverSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "cover" }> {
  return s.slideType === "cover";
}

export function isLyricsSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "lyrics" }> {
  return s.slideType === "lyrics";
}

export function isTextSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "text" }> {
  return s.slideType === "text";
}

export function isImageSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "image" }> {
  return s.slideType === "image";
}

export function isVideoSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "video" }> {
  return s.slideType === "video";
}

export function isBibleSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "bible" }> {
  return s.slideType === "bible";
}

export function isOnlineVideoSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "onlineVideo" }> {
  return s.slideType === "onlineVideo";
}

export function isPauseSlide(s: SlideContent): s is Extract<SlideContent, { slideType: "pause" }> {
  return s.slideType === "pause";
}

// ─── Factories ────────────────────────────────────────────────────────────────

export function defaultBackground(): BackgroundConfig {
  return {
    kind: "solid",
    color: "#1a1a2e",
    imagePath: null,
    gradientStart: null,
    gradientEnd: null,
    gradientAngle: null,
    opacity: null,
  };
}

export function defaultSlide(type: SlideType): SlideContent {
  switch (type) {
    case "cover":
      return {
        slideType: "cover",
        title: "",
        subtitle: null,
        label: null,
        background: defaultBackground(),
        text_color: null,
        text_size: null,
      };
    case "lyrics":
      return {
        slideType: "lyrics",
        text: "",
        label: null,
        background: defaultBackground(),
        text_color: null,
        text_size: null,
      };
    case "text":
      return {
        slideType: "text",
        content: "",
        background: defaultBackground(),
        text_color: null,
        text_size: null,
      };
    case "image":
      return {
        slideType: "image",
        path: "",
        caption: null,
        fit: "contain",
        background: defaultBackground(),
      };
    case "video":
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
    case "bible":
      return {
        slideType: "bible",
        reference: "",
        text: "",
        mode: {
          alignment: "center",
          refPosition: "bottom",
          textShadow: false,
          gradient: null,
        },
        background: defaultBackground(),
        text_color: null,
        text_size: null,
      };
    case "onlineVideo":
      return {
        slideType: "onlineVideo",
        url: "",
        video_id: "",
        source: "youtube",
        title: null,
      };
    case "pause":
      return { slideType: "pause" };
  }
}

// ─── Legacy format migration ───────────────────────────────────────────────────

/** Flat (old) slide content shape stored in pre-refactor DB rows */
interface LegacySlideContent {
  slideType?: string;
  text?: string | null;
  title?: string | null;
  subtitle?: string | null;
  label?: string | null;
  videoPath?: string | null;
  backgroundImage?: string | null;
  backgroundColor?: string | null;
  audioPath?: string | null;
  autoPlay?: boolean | null;
  loop?: boolean | null;
  muted?: boolean | null;
  mode?: string | null;
  textColor?: string | null;
  textSize?: number | null;
  videoUrl?: string | null;
  videoId?: string | null;
  videoSource?: string | null;
  videoTitle?: string | null;
}

function isNewFormat(obj: LegacySlideContent | SlideContent): obj is SlideContent {
  // New format has a `background` object (with `kind`) or is slideType "pause"/"onlineVideo"
  const asNew = obj as SlideContent;
  if (asNew.slideType === "pause") return true;
  if (asNew.slideType === "onlineVideo") return true;
  const withBg = asNew as Extract<SlideContent, { background?: unknown }>;
  return (
    "background" in withBg &&
    withBg.background !== null &&
    typeof withBg.background === "object" &&
    "kind" in (withBg.background as object)
  );
}

/**
 * Accepts either a JSON string or an already-parsed object.
 * If the parsed value already matches the new discriminated union shape, returns it as-is.
 * If it matches the old flat format, converts to the nearest new equivalent.
 * Returns `defaultSlide("text")` on any parse failure.
 */
export function parseLegacySlideContent(raw: string | SlideContent): SlideContent {
  let obj: LegacySlideContent | SlideContent;

  if (typeof raw === "string") {
    const [parsed] = catcherSync(() => JSON.parse(raw) as LegacySlideContent | SlideContent, { notify: false });
    if (!parsed) return defaultSlide("text");
    obj = parsed;
  } else {
    obj = raw;
  }

  if (isNewFormat(obj)) return obj as SlideContent;

  // Convert legacy flat shape → new shape
  const legacy = obj as LegacySlideContent;
  const bg: BackgroundConfig = {
    kind: legacy.backgroundImage ? "image" : "solid",
    color: legacy.backgroundColor ?? "#1a1a2e",
    imagePath: legacy.backgroundImage ?? null,
    gradientStart: null,
    gradientEnd: null,
    gradientAngle: null,
    opacity: null,
  };

  const type = legacy.slideType ?? "text";

  switch (type) {
    case "cover":
      return {
        slideType: "cover",
        title: legacy.title ?? "",
        subtitle: legacy.subtitle ?? null,
        label: legacy.label ?? null,
        background: bg,
        text_color: legacy.textColor ?? null,
        text_size: legacy.textSize ?? null,
      };
    case "lyrics":
      return {
        slideType: "lyrics",
        text: legacy.text ?? "",
        label: legacy.label ?? null,
        background: bg,
        text_color: legacy.textColor ?? null,
        text_size: legacy.textSize ?? null,
      };
    case "image":
      return {
        slideType: "image",
        path: legacy.backgroundImage ?? "",
        caption: null,
        fit: "contain",
        background: bg,
      };
    case "video":
      return {
        slideType: "video",
        path: legacy.videoPath ?? "",
        auto_play: legacy.autoPlay ?? false,
        loop_video: legacy.loop ?? false,
        muted: legacy.muted ?? false,
        mode: (legacy.mode as "fullscreen" | "background") ?? "fullscreen",
        overlay_text: legacy.text ?? null,
        audio_path: legacy.audioPath ?? null,
      };
    case "bible":
      return {
        slideType: "bible",
        reference: legacy.title ?? "",
        text: legacy.text ?? "",
        mode: {
          alignment: "center",
          refPosition: "bottom",
          textShadow: false,
          gradient: null,
        },
        background: bg,
        text_color: legacy.textColor ?? null,
        text_size: legacy.textSize ?? null,
      };
    case "online_video":
    case "onlineVideo":
      return {
        slideType: "onlineVideo",
        url: legacy.videoUrl ?? "",
        video_id: legacy.videoId ?? "",
        source: (legacy.videoSource as "local" | "youtube") ?? "youtube",
        title: legacy.videoTitle ?? null,
      };
    case "pause":
      return { slideType: "pause" };
    default:
      return {
        slideType: "text",
        content: legacy.text ?? "",
        background: bg,
        text_color: legacy.textColor ?? null,
        text_size: legacy.textSize ?? null,
      };
  }
}

/** Parse a SlideRow into a SlideWithContent */
export function parseSlideRow(row: SlideRow): SlideWithContent {
  return {
    ...row,
    content: parseLegacySlideContent(row.content),
  };
}
