import type { SlideContent } from "../types/presentation";
import type { Settings } from "../types/settings";
import {
  formatUtilityTimer,
  localeFromLanguage,
  type TimerMode,
  type TimerStateData,
} from "../types/utilities";

export const PROJECTOR_SCREEN_CONTENT_TYPE_KEY = "projector.default.contentType";
export const PROJECTOR_SCREEN_TEXT_KEY = "projector.default.text";
export const PROJECTOR_SCREEN_MEDIA_PATH_KEY = "projector.default.mediaPath";
export const PROJECTOR_LOGO_IMAGE_PATH_KEY = "projector.logo.imagePath";

export const DEFAULT_PROJECTOR_SCREEN_TEXT = "LouvorJA";

const FALLBACK_COUNTDOWN_MS = 5 * 60_000;

export type ProjectorScreenDefaultContentType =
  | "logo"
  | "text"
  | "image"
  | "video"
  | "clock"
  | "timer";

const PROJECTOR_SCREEN_DEFAULT_TYPES: readonly ProjectorScreenDefaultContentType[] = [
  "logo",
  "text",
  "image",
  "video",
  "clock",
  "timer",
] as const;

export interface ProjectorScreenDefaults {
  contentType: ProjectorScreenDefaultContentType;
  text: string;
  mediaPath: string;
  logoImagePath: string;
}

export function isProjectorScreenDefaultContentType(
  value: string,
): value is ProjectorScreenDefaultContentType {
  return PROJECTOR_SCREEN_DEFAULT_TYPES.includes(value as ProjectorScreenDefaultContentType);
}

export function parseProjectorScreenDefaults(
  settings: Settings[] | undefined,
): ProjectorScreenDefaults {
  const contentTypeRaw = getSettingValue(settings, PROJECTOR_SCREEN_CONTENT_TYPE_KEY);
  const contentType = contentTypeRaw && isProjectorScreenDefaultContentType(contentTypeRaw)
    ? contentTypeRaw
    : "logo";

  return {
    contentType,
    text: getSettingValue(settings, PROJECTOR_SCREEN_TEXT_KEY) ?? DEFAULT_PROJECTOR_SCREEN_TEXT,
    mediaPath: getSettingValue(settings, PROJECTOR_SCREEN_MEDIA_PATH_KEY) ?? "",
    logoImagePath: getSettingValue(settings, PROJECTOR_LOGO_IMAGE_PATH_KEY) ?? "",
  };
}

export function getProjectorDefaultContentLabel(
  type: ProjectorScreenDefaultContentType,
  labels: {
    logo: string;
    text: string;
    image: string;
    video: string;
    clock: string;
    timer: string;
  },
): string {
  switch (type) {
    case "logo":
      return labels.logo;
    case "text":
      return labels.text;
    case "image":
      return labels.image;
    case "video":
      return labels.video;
    case "clock":
      return labels.clock;
    case "timer":
      return labels.timer;
  }
}

interface BuildProjectorDefaultSlideArgs {
  defaults: ProjectorScreenDefaults;
  now: Date;
  language: string;
  timerState?: TimerStateData | null;
  labels: {
    countdown: string;
    stopwatch: string;
    missingMedia: string;
  };
}

export function buildProjectorDefaultSlide({
  defaults,
  now,
  language,
  timerState,
  labels,
}: BuildProjectorDefaultSlideArgs): SlideContent | null {
  switch (defaults.contentType) {
    case "logo":
      return null;
    case "text":
      return {
        type: "text",
        text: normalizeText(defaults.text) || DEFAULT_PROJECTOR_SCREEN_TEXT,
      };
    case "image": {
      const mediaPath = normalizeText(defaults.mediaPath);
      if (!mediaPath) {
        return {
          type: "cover",
          title: labels.missingMedia,
        };
      }
      return {
        type: "image",
        src: mediaPath,
        alt: DEFAULT_PROJECTOR_SCREEN_TEXT,
      };
    }
    case "video": {
      const mediaPath = normalizeText(defaults.mediaPath);
      if (!mediaPath) {
        return {
          type: "cover",
          title: labels.missingMedia,
        };
      }
      return {
        type: "video",
        videoPath: mediaPath,
        autoPlay: true,
        loop: true,
        muted: true,
        mode: "fullscreen",
      };
    }
    case "clock": {
      const locale = localeFromLanguage(language);
      return {
        type: "cover",
        title: now.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        subtitle: now.toLocaleDateString(locale, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    }
    case "timer": {
      const timerMode = timerState?.mode ?? "countdown";
      const valueMs = resolveTimerFallbackMs(timerState, timerMode);
      return {
        type: "cover",
        title: formatUtilityTimer(valueMs, timerMode),
        subtitle: timerMode === "countdown" ? labels.countdown : labels.stopwatch,
      };
    }
  }
}

function getSettingValue(settings: Settings[] | undefined, key: string): string | undefined {
  return settings?.find((setting) => setting.key === key)?.value;
}

function normalizeText(value: string): string {
  return value.trim();
}

function resolveTimerFallbackMs(
  timerState: TimerStateData | null | undefined,
  mode: TimerMode,
): number {
  if (!timerState) {
    return mode === "countdown" ? FALLBACK_COUNTDOWN_MS : 0;
  }

  if (mode === "stopwatch") {
    return Math.max(0, timerState.currentTimeMs);
  }

  if (timerState.currentTimeMs > 0) {
    return timerState.currentTimeMs;
  }

  if ((timerState.durationMs ?? 0) > 0) {
    return timerState.durationMs ?? FALLBACK_COUNTDOWN_MS;
  }

  return FALLBACK_COUNTDOWN_MS;
}
