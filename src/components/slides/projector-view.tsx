import { useState, useEffect, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { getCurrentSlide, getOverlayState } from "../../lib/tauri";
import type { SlideContentFlat, OverlayState } from "../../types/presentation";
import { flatToSlideContent } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import type { SlideContent } from "../../types/presentation";
import { useAllSettings, useTimerState } from "../../lib/queries";
import {
  buildProjectorDefaultSlide,
  parseProjectorScreenDefaults,
} from "../../lib/projector-screen-defaults";
import {
  formatUtilityProjectionDate,
  formatUtilityProjectionValue,
  type UtilityProjectionEventPayload,
} from "../../types/utilities";
import { cn } from "../../lib/utils";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { useMediaSource } from "../../hooks/use-media-source";

function getSlideBackgroundImage(slide: SlideContent): string {
  if (slide.type === "lyrics" || slide.type === "cover" || slide.type === "text") {
    return slide.backgroundImage ?? "";
  }
  return "";
}

export function ProjectorView() {
  const { t, i18n } = useTranslation();
  const [slide, setSlide] = useState<SlideContent | null>(null);
  const [utilityProjection, setUtilityProjection] = useState<UtilityProjectionEventPayload | null>(null);
  const [blackScreen, setBlackScreen] = useState(false);
  const [logoScreen, setLogoScreen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // slideKey only changes when the slide's visual identity (type + background) changes.
  // This prevents remounting the background image on every stanza change (which causes blinking).
  const [slideKey, setSlideKey] = useState(0);
  const prevSlideRef = useRef<SlideContent | null>(null);
  const { data: allSettings } = useAllSettings();
  const screenDefaults = useMemo(() => parseProjectorScreenDefaults(allSettings), [allSettings]);
  const { data: timerState } = useTimerState({ enabled: screenDefaults.contentType === "timer" });
  const logoImageSrc = useMediaSource(screenDefaults.logoImagePath);

  // Listen to slide changes
  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      const newSlide = flatToSlideContent(event.payload);
      const prev = prevSlideRef.current;
      // Only remount the renderer when the slide identity changes (type or background image).
      // Same-background stanza changes (e.g. next hymn lyric) only animate the text layer.
      if (!prev || prev.type !== newSlide.type || getSlideBackgroundImage(prev) !== getSlideBackgroundImage(newSlide)) {
        setSlideKey((k) => k + 1);
      }
      prevSlideRef.current = newSlide;
      setSlide(newSlide);
    });

    void getCurrentSlide()
      .then((data) => {
        const s = data ? flatToSlideContent(data) : null;
        prevSlideRef.current = s;
        setSlide(s);
        setSlideKey((prev) => prev + 1);
      })
      .catch(() => {});

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen to overlay changes
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-changed", (event) => {
      setBlackScreen(event.payload.blackScreen);
      setLogoScreen(event.payload.logoScreen);
    });

    void getOverlayState()
      .then((state) => {
        setBlackScreen(state.blackScreen);
        setLogoScreen(state.logoScreen);
      })
      .catch(() => {});

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen to slide cleared — reset to logo
  useEffect(() => {
    const unlisten = listen("slide-cleared", () => {
      prevSlideRef.current = null;
      setSlide(null);
      setUtilityProjection(null);
      setSlideKey((prev) => prev + 1);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen to utility live projection ticks
  useEffect(() => {
    const unlisten = listen<UtilityProjectionEventPayload>("utility-projection", (event) => {
      if (event.payload.phase === "stop") {
        setUtilityProjection(null);
        return;
      }

      setUtilityProjection(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Keyboard handling: ESC clears content to logo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stopProjectionAndSongAudio().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (screenDefaults.contentType !== "clock") {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [screenDefaults.contentType]);

  const defaultSlide = useMemo(() => {
    return buildProjectorDefaultSlide({
      defaults: screenDefaults,
      now,
      language: i18n.language,
      timerState,
      labels: {
        countdown: t("utilities.timer.countdown"),
        stopwatch: t("utilities.timer.stopwatch"),
        missingMedia: t("settings.projectorDefaultMediaMissing"),
      },
    });
  }, [i18n.language, now, screenDefaults, t, timerState]);

  const renderedSlide = useMemo(() => {
    if (!utilityProjection) {
      return slide ?? defaultSlide;
    }

    const subtitle = utilityProjection.kind === "countdown"
      ? t("utilities.timer.countdown")
      : utilityProjection.kind === "stopwatch"
        ? t("utilities.timer.stopwatch")
        : utilityProjection.showDate
          ? formatUtilityProjectionDate(utilityProjection, i18n.language)
          : t("utilities.clock.title");

    return {
      type: "cover",
      title: formatUtilityProjectionValue(utilityProjection, i18n.language),
      subtitle,
    } satisfies SlideContent;
  }, [defaultSlide, i18n.language, slide, t, utilityProjection]);

  const showLogo = logoScreen || (!renderedSlide && screenDefaults.contentType === "logo");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <SlideRenderer
        key={slideKey}
        slide={renderedSlide}
        renderMode="projector"
        className="h-full w-full transition-opacity duration-300 animate-in fade-in"
      />
      {/* Black screen overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-black transition-opacity duration-500",
          blackScreen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Logo screen overlay (also shown when no slide content) */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-500",
          showLogo ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {logoImageSrc ? (
          <img
            src={logoImageSrc}
            alt={t("settings.projectorDefaultContentLogo")}
            className="max-h-[70vh] max-w-[80vw] object-contain"
          />
        ) : (
          <span className="text-4xl font-bold text-white/80">LouvorJA</span>
        )}
      </div>
    </div>
  );
}
