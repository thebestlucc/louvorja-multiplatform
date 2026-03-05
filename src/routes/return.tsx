import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import type { SlideContent, SlideContext, OverlayState } from "../lib/bindings";
import { getCurrentSlide, getSlideContext, getOverlayState, closeReturnWindow } from "../lib/tauri";
import { SlideRenderer } from "../components/slides/slide-renderer";
import { useAllSettings, useTimerState } from "../lib/queries";
import {
  buildProjectorDefaultSlide,
  getProjectorDefaultContentLabel,
  parseProjectorScreenDefaults,
} from "../lib/projector-screen-defaults";
import {
  formatUtilityProjectionDate,
  formatUtilityProjectionValue,
  localeFromLanguage,
  type UtilityProjectionEventPayload,
} from "../types/utilities";
import { cn } from "../lib/utils";
import { useMediaSource } from "../hooks/use-media-source";

export const Route = createFileRoute("/return")({
  component: ReturnPage,
});

function ReturnPage() {
  const { t, i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [nextSlide, setNextSlide] = useState<SlideContent | null>(null);
  const [slideTitle, setSlideTitle] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideTotal, setSlideTotal] = useState(0);
  const [clock, setClock] = useState("");
  const [clockNow, setClockNow] = useState(() => new Date());
  const [utilityProjection, setUtilityProjection] = useState<UtilityProjectionEventPayload | null>(null);
  const [blackScreen, setBlackScreen] = useState(false);
  const [logoScreen, setLogoScreen] = useState(false);
  const { data: allSettings } = useAllSettings();
  const screenDefaults = useMemo(() => parseProjectorScreenDefaults(allSettings), [allSettings]);
  const { data: timerState } = useTimerState({ enabled: screenDefaults.contentType === "timer" });
  const logoImageSrc = useMediaSource(screenDefaults.logoImagePath);
  const clockLocale = localeFromLanguage(i18n.language);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockNow(now);
      setClock(now.toLocaleTimeString(clockLocale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [clockLocale]);

  const defaultSlide = useMemo(() => {
    return buildProjectorDefaultSlide({
      defaults: screenDefaults,
      now: clockNow,
      language: i18n.language,
      timerState,
      labels: {
        countdown: t("utilities.timer.countdown"),
        stopwatch: t("utilities.timer.stopwatch"),
        missingMedia: t("settings.projectorDefaultMediaMissing"),
      },
    });
  }, [clockNow, i18n.language, screenDefaults, t, timerState]);

  // Listen to slide changes
  useEffect(() => {
    const unlisten = listen<SlideContent>("slide-changed", (event) => {
      setCurrentSlide(event.payload);
    });

    void getCurrentSlide()
      .then((data) => {
        setCurrentSlide(data);
      })
      .catch(() => {});

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen to slide context
  useEffect(() => {
    const unlisten = listen<SlideContext>("slide-context", (event) => {
      const ctx = event.payload;
      setNextSlide(ctx.next);
      setSlideIndex(ctx.index);
      setSlideTotal(ctx.total);
      setSlideTitle(ctx.title);
    });

    void getSlideContext()
      .then((ctx) => {
        if (ctx) {
          setNextSlide(ctx.next);
          setSlideIndex(ctx.index);
          setSlideTotal(ctx.total);
          setSlideTitle(ctx.title);
          return;
        }
        setNextSlide(null);
        setSlideIndex(0);
        setSlideTotal(0);
        setSlideTitle("");
      })
      .catch(() => {});

    return () => { unlisten.then((fn) => fn()); };
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

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen to slide cleared — reset to logo
  useEffect(() => {
    const unlisten = listen("slide-cleared", () => {
      setCurrentSlide(null);
      setNextSlide(null);
      setUtilityProjection(null);
      setSlideTitle("");
      setSlideIndex(0);
      setSlideTotal(0);
    });
    return () => { unlisten.then((fn) => fn()); };
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
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Keyboard: ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeReturnWindow().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentSlideToRender = useMemo(() => {
    if (!utilityProjection) {
      return currentSlide ?? defaultSlide;
    }

    const subtitle = utilityProjection.kind === "countdown"
      ? t("utilities.timer.countdown")
      : utilityProjection.kind === "stopwatch"
        ? t("utilities.timer.stopwatch")
        : utilityProjection.showDate
          ? formatUtilityProjectionDate(utilityProjection, i18n.language)
          : t("utilities.clock.title");

    return {
      slideType: "cover",
      title: formatUtilityProjectionValue(utilityProjection, i18n.language),
      subtitle,
      text: null,
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
    } satisfies SlideContent;
  }, [currentSlide, defaultSlide, i18n.language, t, utilityProjection]);

  const defaultSlideTitle = getProjectorDefaultContentLabel(screenDefaults.contentType, {
    logo: t("settings.projectorDefaultContentLogo"),
    text: t("settings.projectorDefaultContentText"),
    image: t("settings.projectorDefaultContentImage"),
    video: t("settings.projectorDefaultContentVideo"),
    clock: t("settings.projectorDefaultContentClock"),
    timer: t("settings.projectorDefaultContentTimer"),
  });

  const effectiveSlideTitle = utilityProjection
    ? utilityProjection.kind === "countdown"
      ? t("utilities.projection.context.countdown")
      : utilityProjection.kind === "stopwatch"
        ? t("utilities.projection.context.stopwatch")
        : t("utilities.projection.context.clock")
    : currentSlide
      ? slideTitle
      : defaultSlideTitle;

  const hasOverlay = blackScreen || logoScreen;
  const noContent = screenDefaults.contentType === "logo" && !currentSlideToRender && !hasOverlay;

  if (noContent) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 text-white">
        {logoImageSrc ? (
          <img
            src={logoImageSrc}
            alt={t("settings.projectorDefaultContentLogo")}
            className="max-h-[55vh] max-w-[70vw] object-contain"
          />
        ) : (
          <span className="text-4xl font-bold text-white/80">LouvorJA</span>
        )}
        <span className="mt-3 font-mono text-sm text-white/40">{clock}</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 p-3 text-white">
      {/* Current slide — top 70% */}
      <div className="relative flex-[7] overflow-hidden rounded-lg border border-white/10">
        <SlideRenderer
          slide={currentSlideToRender}
          renderMode="return-current"
          className="h-full w-full"
        />
        {/* Overlay indicator */}
        {hasOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="rounded bg-red-600 px-4 py-2 text-lg font-bold uppercase tracking-wider">
              {blackScreen ? t("display.blackScreen") : t("display.logoScreen")}
            </span>
          </div>
        )}
      </div>

      {/* Metadata bar */}
      <div className="flex items-center justify-between px-2 py-2 text-sm">
        <span className="truncate font-medium text-white/90">{effectiveSlideTitle}</span>
        <div className="flex items-center gap-4">
          {slideTotal > 0 && (
            <span className="text-white/60">
              {slideIndex + 1} / {slideTotal}
            </span>
          )}
          <span className={cn("font-mono text-white/60", hasOverlay && "text-red-400")}>
            {clock}
          </span>
        </div>
      </div>

      {/* Next slide — bottom 30% */}
      <div className="relative flex-[3] overflow-hidden rounded-lg border border-white/5 bg-neutral-900">
        {/* Always mounted so useMediaSource cache is preserved across null→slide transitions */}
        <SlideRenderer
          slide={nextSlide}
          renderMode="return-next"
          className="h-full w-full opacity-70"
        />
        {nextSlide ? (
          <div className="absolute left-2 top-1 z-10 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
            {t("display.nextSlide")}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/30">
            {t("display.noNextSlide")}
          </div>
        )}
      </div>
    </div>
  );
}
