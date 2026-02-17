import { useState, useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { getCurrentSlide, clearCurrentSlide, getOverlayState } from "../../lib/tauri";
import type { SlideContentFlat, OverlayState } from "../../types/presentation";
import { flatToSlideContent } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import type { SlideContent } from "../../types/presentation";
import {
  formatUtilityProjectionDate,
  formatUtilityProjectionValue,
  type UtilityProjectionEventPayload,
} from "../../types/utilities";
import { cn } from "../../lib/utils";

export function ProjectorView() {
  const { t, i18n } = useTranslation();
  const [slide, setSlide] = useState<SlideContent | null>(null);
  const [utilityProjection, setUtilityProjection] = useState<UtilityProjectionEventPayload | null>(null);
  const [blackScreen, setBlackScreen] = useState(false);
  const [logoScreen, setLogoScreen] = useState(false);

  // Listen to slide changes
  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      setSlide(flatToSlideContent(event.payload));
    });

    void getCurrentSlide()
      .then((data) => {
        setSlide(data ? flatToSlideContent(data) : null);
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
      setSlide(null);
      setUtilityProjection(null);
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
        clearCurrentSlide().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderedSlide = useMemo(() => {
    if (!utilityProjection) {
      return slide;
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
  }, [i18n.language, slide, t, utilityProjection]);

  const showLogo = !renderedSlide || logoScreen;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <SlideRenderer
        slide={renderedSlide}
        renderMode="projector"
        className="h-full w-full transition-opacity duration-300"
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
        <span className="text-4xl font-bold text-white/80">LouvorJA</span>
      </div>
    </div>
  );
}
