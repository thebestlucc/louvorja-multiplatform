import type { SlideContent, SlideContext, TimerMode, TimerStateData } from "../lib/bindings";

export type { TimerMode, TimerStateData };
export type UtilityLiveKind = "countdown" | "stopwatch" | "clock";
export type UtilityProjectionPhase = "start" | "tick" | "stop";

export interface UtilityProjectionEventPayload {
  phase: UtilityProjectionPhase;
  sessionId: string;
  kind: UtilityLiveKind;
  valueMs: number;
  use24Hour: boolean;
  showDate: boolean;
}

export type TextFormat = "uppercase" | "lowercase" | "title_case" | "sentence_case";

export type UtilityProjectionKind = "timer" | "clock" | "lottery";

export interface UtilityProjectionState {
  isProjecting: boolean;
  projectedKind: UtilityProjectionKind | null;
}

export interface UtilityProjectionPayload {
  slide: SlideContent;
  context: SlideContext;
}

interface UtilityProjectionPayloadInput {
  kind: UtilityProjectionKind;
  displayValue: string;
  subtitle?: string;
  contextTitle: string;
}

export function formatUtilityTimer(milliseconds: number, mode: TimerMode = "countdown"): string {
  const safeMilliseconds = Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (mode === "stopwatch") {
    const millisecondsPart = safeMilliseconds % 1000;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millisecondsPart).padStart(3, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millisecondsPart).padStart(3, "0")}`;
  }

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatUtilityProjectionValue(
  payload: UtilityProjectionEventPayload,
  language: string,
): string {
  if (payload.kind === "countdown") {
    return formatUtilityTimer(payload.valueMs, "countdown");
  }
  if (payload.kind === "stopwatch") {
    return formatUtilityTimer(payload.valueMs, "stopwatch");
  }

  return new Date(Math.max(0, Math.floor(payload.valueMs))).toLocaleTimeString(
    localeFromLanguage(language),
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: !payload.use24Hour,
    },
  );
}

export function formatUtilityProjectionDate(
  payload: UtilityProjectionEventPayload,
  language: string,
): string {
  return new Date(Math.max(0, Math.floor(payload.valueMs))).toLocaleDateString(
    localeFromLanguage(language),
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

export function localeFromLanguage(language: string): string {
  if (language.startsWith("en")) {
    return "en-US";
  }
  if (language.startsWith("es")) {
    return "es-ES";
  }
  return "pt-BR";
}

export function createUtilityProjectionPayload({
  kind,
  displayValue,
  subtitle,
  contextTitle,
}: UtilityProjectionPayloadInput): UtilityProjectionPayload {
  const safeDisplayValue = sanitizeProjectionText(displayValue, 120);
  const safeSubtitle = subtitle ? sanitizeProjectionText(subtitle, 160) : null;
  const safeContextTitle = sanitizeProjectionText(contextTitle, 120);

  return {
    slide: {
      slideType: "cover",
      title: safeDisplayValue,
      subtitle: safeSubtitle,
      label: kind,
      text: null,
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
    },
    context: {
      next: null,
      index: 0,
      total: 1,
      title: safeContextTitle,
      currentSlideStartMs: null,
      nextSlideStartMs: null,
      audioDurationMs: null,
    },
  };
}

function sanitizeProjectionText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
}
