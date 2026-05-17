import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { getOverlayState } from "../../lib/tauri";
import { useSlideVersion } from "../../hooks/use-slide-version";
import type { AlertState, OverlayState, SlideContent } from "../../lib/bindings";
import { SlideRenderer } from "./slide-renderer";
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
import { AlertOverlay } from "../display/alert-overlay";
import { useVideoPlayerStore, refreshVideoPlayerPreferencesFromDisk } from "../../stores/video-player-store";
import { useRustVideoPipelineStore } from "../../stores/rust-video-pipeline-store";
import { attachWindow as attachVideoPipelineWindow, detachWindow as detachVideoPipelineWindow } from "../../lib/tauri/video-pipeline";

function getSlideBackgroundImage(slide: SlideContent): string {
  if (slide.slideType === "lyrics" || slide.slideType === "cover" || slide.slideType === "text" || slide.slideType === "bible") {
    return slide.background.imagePath ?? "";
  }
  if (slide.slideType === "image") {
    return slide.path;
  }
  return "";
}

export function ProjectorView() {
  const { t, i18n } = useTranslation();
  const [slide, setSlide] = useState<SlideContent | null>(null);
  // Buffered slide pattern (rust pipeline only): when an `onlineVideo` slide
  // arrives while the pipeline isn't producing samples yet (`!isFrameReady`),
  // we hold the new slide here instead of swapping `slide`. The previous
  // content (lyric, prior video, logo) keeps rendering — far better UX than
  // a black gap during pipeline init / cold-start / network buffering.
  // Promoted to `slide` by the `isFrameReady` effect below when ready flips
  // true, or cleared by `slide-cleared` / a non-video slide arrival.
  const [pendingSlide, _setPendingSlide] = useState<SlideContent | null>(null);
  const pendingSlideRef = useRef<SlideContent | null>(null);
  const setPendingSlide = useCallback((s: SlideContent | null) => {
    pendingSlideRef.current = s;
    _setPendingSlide(s);
  }, []);
  const [utilityProjection, setUtilityProjection] = useState<UtilityProjectionEventPayload | null>(null);
  const [blackScreen, setBlackScreen] = useState(false);
  const [logoScreen, setLogoScreen] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const useRustVideoPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);
  const videoPlaybackTargets = useVideoPlayerStore((s) => s.videoPlaybackTargets);
  const isFrameReady = useRustVideoPipelineStore((s) => s.isFrameReady);

  // P3.12 — Re-read the flag from disk on mount. Defensive belt-and-braces
  // for the case where the projector window was opened AFTER the user
  // toggled the flag in main settings, but before the cross-webview event
  // listener was registered (or while bootstrap's `initStorePreferences()`
  // hit a permission error and left the cache empty). `getPreference()`
  // bypasses the sync cache and goes straight to disk via the
  // `store:allow-get` capability that the projector window has. Triggers
  // a re-render via `setState()` once the fresh value is loaded.
  useEffect(() => {
    refreshVideoPlayerPreferencesFromDisk().catch((err) =>
      console.error("[projector] refresh prefs from disk failed", err),
    );
  }, []);

  // Phase 3 — attach the native GStreamer sink to this window when the Rust
  // pipeline flag is on AND this window is in the user's playback targets.
  // Webview is transparent (see display/window.rs); the native sink renders
  // BELOW it. When the flag is off or projector is not in targets, the legacy
  // WebRTC path stays in charge via `RustVideoConsumer` / YouTube iframe.
  useEffect(() => {
    console.log(`[projector] useRustVideoPipeline=${useRustVideoPipeline} targets=${JSON.stringify(videoPlaybackTargets)} (effect re-run)`);
    if (!useRustVideoPipeline) return;
    if (!videoPlaybackTargets.includes("projector")) return;
    console.log("[projector] attaching native GStreamer sink");
    attachVideoPipelineWindow("projector")
      .then(() => console.log("[projector] attach_window succeeded"))
      .catch((e) => {
        console.error("[projector] attach_window failed", e);
      });
    return () => {
      console.log("[projector] detaching native GStreamer sink");
      detachVideoPipelineWindow("projector").catch((e) => {
        console.error("[projector] detach_window failed", e);
      });
    };
  }, [useRustVideoPipeline, videoPlaybackTargets]);

  // Phase 3 — when the Rust pipeline owns rendering AND projector is in targets,
  // html + body must be transparent so the native GStreamer sink underneath the
  // WKWebView is visible. Component-scoped tweak (no global CSS) so the legacy
  // path's body background stays unchanged when the flag is off or projector
  // is not in targets.
  useEffect(() => {
    if (!useRustVideoPipeline || !videoPlaybackTargets.includes("projector")) return;
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
  // local Zustand store's isFrameReady updates (projector is a separate webview
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
          // Only unblock if a slide is actually waiting — avoids spurious state flip
          // when no video is buffered (e.g. pipeline reset between songs).
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

  // slideKey only changes when the slide's visual identity (type + background) changes.
  // This prevents remounting the background image on every stanza change (which causes blinking).
  const [slideKey, setSlideKey] = useState(0);
  const prevSlideRef = useRef<SlideContent | null>(null);
  const { data: allSettings } = useAllSettings();
  const screenDefaults = useMemo(() => parseProjectorScreenDefaults(allSettings), [allSettings]);
  const { data: timerState } = useTimerState({ enabled: screenDefaults.contentType === "timer" });
  const logoImageSrc = useMediaSource(screenDefaults.logoImagePath);

  const commitSlide = useCallback((newSlide: SlideContent) => {
    const prev = prevSlideRef.current;
    // Only remount the renderer when the slide identity changes (type or background image).
    // Same-background stanza changes (e.g. next hymn lyric) only animate the text layer.
    if (!prev || prev.slideType !== newSlide.slideType || getSlideBackgroundImage(prev) !== getSlideBackgroundImage(newSlide)) {
      setSlideKey((k) => k + 1);
    }
    prevSlideRef.current = newSlide;
    setSlide(newSlide);
  }, []);

  const handleSlide = useCallback((newSlide: SlideContent) => {
    // Buffered slide pattern: hold back onlineVideo slides under the rust
    // pipeline until the audio sink starts producing buffers. For every
    // other slide type — and for non-rust playback — render immediately.
    // Reading `isFrameReady` from `getState()` instead of the captured closure
    // value so a fresh value at fire time is honored (avoids stale closure
    // when the slide event arrives milliseconds before/after the ready flip).
    const ready = useRustVideoPipelineStore.getState().isFrameReady;
    const shouldBuffer =
      useRustVideoPipeline &&
      (newSlide.slideType === "onlineVideo" || newSlide.slideType === "video") &&
      !ready;

    if (shouldBuffer) {
      setPendingSlide(newSlide);
      return;
    }

    // Non-buffered path: clear any leftover pending slide (e.g. user switched
    // from a still-loading video to a text slide; throw the video away rather
    // than letting it pop in once frame-ready fires later) and render now.
    setPendingSlide(null);
    commitSlide(newSlide);
  }, [commitSlide, useRustVideoPipeline]);

  useSlideVersion({ onSlide: handleSlide });

  // Promote pending slide to live once the pipeline starts producing samples.
  // This is the swap moment — the buffered onlineVideo slide replaces the
  // prior content with no black gap, because by definition the GStreamer
  // surface beneath has just rendered its first frame.
  useEffect(() => {
    if (isFrameReady && pendingSlide) {
      commitSlide(pendingSlide);
      setPendingSlide(null);
    }
  }, [isFrameReady, pendingSlide, commitSlide]);

  // If the rust pipeline flag flips off while a slide is buffered, promote
  // it immediately — the legacy YouTube/HTML5 path doesn't honor the
  // frame-ready gate so holding back would strand the slide forever.
  useEffect(() => {
    if (!useRustVideoPipeline && pendingSlide) {
      commitSlide(pendingSlide);
      setPendingSlide(null);
    }
  }, [useRustVideoPipeline, pendingSlide, commitSlide]);

  // Listen to overlay changes
  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    listen<OverlayState>("overlay-changed", (event) => {
      if (!isMounted) return;
      setBlackScreen(event.payload.blackScreen);
      setLogoScreen(event.payload.logoScreen);
      setAlert(event.payload.alert ?? null);
    }).then((fn) => {
      if (isMounted) {
        unlistenFn = fn;
      } else {
        fn();
      }
    });

    getOverlayState()
      .then((state) => {
        if (!isMounted) return;
        setBlackScreen(state.blackScreen);
        setLogoScreen(state.logoScreen);
        setAlert(state.alert ?? null);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, []);

  // Listen to slide cleared — reset to logo
  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    listen("slide-cleared", () => {
      if (!isMounted) return;
      prevSlideRef.current = null;
      setSlide(null);
      // Drop any buffered onlineVideo slide too — clearing means "no content
      // anywhere", we don't want a stale held slide to pop in if frame-ready
      // arrives moments later.
      setPendingSlide(null);
      setUtilityProjection(null);
      setSlideKey((prev) => prev + 1);
    }).then((fn) => {
      if (isMounted) {
        unlistenFn = fn;
      } else {
        fn();
      }
    });

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, []);

  // Listen to utility live projection ticks
  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    listen<UtilityProjectionEventPayload>("utility-projection", (event) => {
      if (!isMounted) return;
      if (event.payload.phase === "stop") {
        setUtilityProjection(null);
        return;
      }
      setUtilityProjection(event.payload);
    }).then((fn) => {
      if (isMounted) {
        unlistenFn = fn;
      } else {
        fn();
      }
    });

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, []);

  // Disable pointer events on body when projecting online video (hides YouTube iframe controls)
  useEffect(() => {
    document.body.style.pointerEvents = slide?.slideType === "onlineVideo" ? "none" : "";
    return () => { document.body.style.pointerEvents = ""; };
  }, [slide?.slideType]);

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
      slideType: "cover",
      title: formatUtilityProjectionValue(utilityProjection, i18n.language),
      subtitle,
      label: null,
      background: { kind: "solid", color: "#1a1a2e", imagePath: null, gradientStart: null, gradientEnd: null, gradientAngle: null, opacity: null },
      text_color: null,
      text_size: null,
    } satisfies SlideContent;
  }, [defaultSlide, i18n.language, slide, t, utilityProjection]);

  const showLogo = logoScreen || (!renderedSlide && screenDefaults.contentType === "logo");

  // Phase 3 — when rendering an online video under the Rust pipeline, keep
  // the wrapper transparent so the native GStreamer sink is visible BELOW the
  // webview. For every other slide type (lyrics/text/bible/etc) we still
  // want the opaque black backdrop so the OS desktop never bleeds through.
  const renderingNativeVideo =
    useRustVideoPipeline &&
    videoPlaybackTargets.includes("projector") &&
    (renderedSlide?.slideType === "onlineVideo" || renderedSlide?.slideType === "video");

  return (
    <div className={cn("relative h-screen w-screen overflow-hidden", renderingNativeVideo ? "bg-transparent" : "bg-black")}>
      <SlideRenderer
        key={slideKey}
        slide={renderedSlide}
        renderMode="projector"
        className="h-full w-full transition-opacity duration-300 animate-in fade-in"
      />
      {/* Black screen overlay */}
      <div
        className={cn(
          "absolute inset-0 z-[100] bg-black transition-opacity duration-500",
          blackScreen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Logo screen overlay (also shown when no slide content) */}
      <div
        className={cn(
          "absolute inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500",
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

      <AlertOverlay alert={alert} />
    </div>
  );
}
