import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import type { SlideContent, AlertState } from "../lib/bindings";
import { closeReturnWindow } from "../lib/tauri";
import { useProjectionState } from "../hooks/use-projection-state";
import { SlideRenderer } from "../components/slides/slide-renderer";
import { useAllSettings, useTimerState } from "../lib/queries";
import { AlertOverlay } from "../components/display/alert-overlay";
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
import { useVideoPlayerStore, refreshVideoPlayerPreferencesFromDisk } from "../stores/video-player-store";
import { useRustVideoPipelineStore } from "../stores/rust-video-pipeline-store";
import { attachWindow as attachVideoPipelineWindow, detachWindow as detachVideoPipelineWindow } from "../lib/tauri/video-pipeline";

export const Route = createFileRoute("/return")({
  component: ReturnPage,
});

export { ReturnPage };

function ReturnPage() {
  const { t, i18n } = useTranslation();

  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  // Buffered slide pattern (mirror of projector-view): hold back onlineVideo
  // slides under the rust pipeline until audio_sink first buffer fires.
  // Keeps the prior slide visible during pipeline init / cold-start instead
  // of a black gap. See projector-view.tsx for the full rationale.
  const [pendingSlide, _setPendingSlide] = useState<SlideContent | null>(null);
  const pendingSlideRef = useRef<SlideContent | null>(null);
  const setPendingSlide = useCallback((s: SlideContent | null) => {
    pendingSlideRef.current = s;
    _setPendingSlide(s);
  }, []);
  const [clock, setClock] = useState("");
  const [clockNow, setClockNow] = useState(() => new Date());
  const [utilityProjection, setUtilityProjection] = useState<UtilityProjectionEventPayload | null>(null);
  const projection = useProjectionState();
  const nextSlide = projection?.context?.next ?? null;
  const slideTitle = projection?.context?.title ?? "";
  const slideIndex = projection?.context?.index ?? 0;
  const slideTotal = projection?.context?.total ?? 0;
  const blackScreen = projection?.overlay === "black";
  const logoScreen = projection?.overlay === "logo";
  const alert: AlertState | null = projection?.alert
    ? {
        text: projection.alert.text,
        isVisible: true,
        isTicker: projection.alert.isTicker,
      }
    : null;
  const { data: allSettings } = useAllSettings();
  const screenDefaults = useMemo(() => parseProjectorScreenDefaults(allSettings), [allSettings]);
  const { data: timerState } = useTimerState({ enabled: screenDefaults.contentType === "timer" });
  const logoImageSrc = useMediaSource(screenDefaults.logoImagePath);
  const clockLocale = localeFromLanguage(i18n.language);
  const useRustVideoPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);
  const videoPlaybackTargets = useVideoPlayerStore((s) => s.videoPlaybackTargets);
  const isFrameReady = useRustVideoPipelineStore((s) => s.isFrameReady);

  // P3.12 — Re-read the flag from disk on mount. See `projector-view.tsx`
  // for the full rationale; mirrored here so the return monitor never starts
  // with a stale flag value either.
  useEffect(() => {
    refreshVideoPlayerPreferencesFromDisk().catch((err) =>
      console.error("[return] refresh prefs from disk failed", err),
    );
  }, []);

  // Phase 3 — attach the native GStreamer sink to the "return" window when the
  // Rust pipeline flag is on AND the return window is in the user's playback
  // targets. Mirror of the `ProjectorView` lifecycle (see projector-view.tsx).
  useEffect(() => {
    console.log(`[return] useRustVideoPipeline=${useRustVideoPipeline} targets=${JSON.stringify(videoPlaybackTargets)} (effect re-run)`);
    if (!useRustVideoPipeline) return;
    if (!videoPlaybackTargets.includes("return")) return;
    console.log("[return] attaching native GStreamer sink");
    attachVideoPipelineWindow("return")
      .then(() => console.log("[return] attach_window succeeded"))
      .catch((e) => {
        console.error("[return] attach_window failed", e);
      });
    return () => {
      console.log("[return] detaching native GStreamer sink");
      detachVideoPipelineWindow("return").catch((e) => {
        console.error("[return] detach_window failed", e);
      });
    };
  }, [useRustVideoPipeline, videoPlaybackTargets]);

  // Phase 3 — html + body transparent so the native GStreamer sink rendered
  // BELOW the webview is visible, but only when return is in playback targets
  // (see projector-view.tsx for full rationale).
  useEffect(() => {
    if (!useRustVideoPipeline || !videoPlaybackTargets.includes("return")) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, [useRustVideoPipeline, videoPlaybackTargets]);

  // Register the video-pipeline-frame-ready listener in THIS webview so the
  // local Zustand store's isFrameReady updates (return is a separate webview
  // from main — each window has its own JS heap and store instance).
  useEffect(() => {
    if (!useRustVideoPipeline) return;
    let safetyNetHandle: ReturnType<typeof setTimeout> | null = null;
    const unsubPromise = listen<{ ready: boolean }>("video-pipeline-frame-ready", (e) => {
      const ready = !!e.payload?.ready;
      useRustVideoPipelineStore.getState().setState({ isFrameReady: ready });
      if (safetyNetHandle) { clearTimeout(safetyNetHandle); safetyNetHandle = null; }
      if (!ready) {
        safetyNetHandle = setTimeout(() => {
          safetyNetHandle = null;
          if (pendingSlideRef.current) {
            useRustVideoPipelineStore.getState().setState({ isFrameReady: true });
          }
        }, 5000);
      }
    });
    return () => {
      if (safetyNetHandle) clearTimeout(safetyNetHandle);
      unsubPromise.then((fn) => fn()).catch(() => {});
    };
  }, [useRustVideoPipeline]);

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

  const handleSlide = useCallback(
    (slide: SlideContent) => {
      // See projector-view.tsx for full rationale. Read `isFrameReady` via
      // getState() to honor fresh value at fire time and avoid stale closures.
      const ready = useRustVideoPipelineStore.getState().isFrameReady;
      const shouldBuffer =
        useRustVideoPipeline &&
        (slide.slideType === "onlineVideo" || slide.slideType === "video") &&
        !ready;
      if (shouldBuffer) {
        setPendingSlide(slide);
        return;
      }
      setPendingSlide(null);
      setCurrentSlide(slide);
    },
    [useRustVideoPipeline],
  );

  // Phase 4 — drive slide flow from the Hub Snapshot. Reference-equality on
  // currentSlide is safe: applyDelta only swaps the field when a slideChanged
  // event arrives, so the previous reference is reused otherwise.
  const hubSlide = projection?.currentSlide ?? null;
  const prevHubSlideRef = useRef<SlideContent | null | undefined>(undefined);
  useEffect(() => {
    if (prevHubSlideRef.current === hubSlide) return;
    prevHubSlideRef.current = hubSlide;
    if (hubSlide === null) {
      setCurrentSlide(null);
      setPendingSlide(null);
      setUtilityProjection(null);
      return;
    }
    handleSlide(hubSlide);
  }, [hubSlide, handleSlide, setPendingSlide]);

  // Promote pending slide to live when pipeline produces first buffer.
  useEffect(() => {
    if (isFrameReady && pendingSlide) {
      setCurrentSlide(pendingSlide);
      setPendingSlide(null);
    }
  }, [isFrameReady, pendingSlide]);

  // If the rust pipeline flag flips off while a slide is buffered, promote it
  // immediately — see projector-view.tsx for rationale.
  useEffect(() => {
    if (!useRustVideoPipeline && pendingSlide) {
      setCurrentSlide(pendingSlide);
      setPendingSlide(null);
    }
  }, [useRustVideoPipeline, pendingSlide]);

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

  // Disable pointer events on body when projecting online video (hides YouTube iframe controls)
  useEffect(() => {
    document.body.style.pointerEvents = currentSlide?.slideType === "onlineVideo" ? "none" : "";
    return () => { document.body.style.pointerEvents = ""; };
  }, [currentSlide?.slideType]);

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
      label: null,
      background: { kind: "solid", color: "#1a1a2e", imagePath: null, gradientStart: null, gradientEnd: null, gradientAngle: null, opacity: null },
      text_color: null,
      text_size: null,
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

  // Phase 3 — when rendering an online video under the Rust pipeline, the
  // outer wrapper must be transparent so the native GStreamer sink (rendering
  // BELOW the WKWebView/WebView2/WebKitGTK) is visible inside the top 70%.
  // Other slide types keep the opaque `bg-neutral-950` so the desktop never
  // bleeds through the operator's reference monitor.
  const renderingNativeVideo =
    useRustVideoPipeline &&
    videoPlaybackTargets.includes("return") &&
    (currentSlideToRender?.slideType === "onlineVideo" ||
      currentSlideToRender?.slideType === "video");
  const outerBg = renderingNativeVideo ? "bg-transparent" : "bg-neutral-950";

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
    <div className={cn("flex h-screen w-screen flex-col p-3 text-white", outerBg)}>
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

      <AlertOverlay alert={alert} fontSize="1.8vw" />
    </div>
  );
}
