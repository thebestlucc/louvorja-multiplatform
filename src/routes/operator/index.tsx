import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { getCurrentSlide, getOverlayState, getSlideContext } from "../../lib/tauri";
import { flatToSlideContent } from "../../types/presentation";
import { SlideRenderer } from "../../components/slides/slide-renderer";
import { useDisplayStore } from "../../stores/display-store";
import { useSlides } from "../../hooks/use-slides";
import { useAudio } from "../../hooks/use-audio";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import type { SlideContentFlat, SlideContextFlat, OverlayState, SlideContent } from "../../types/presentation";

export const Route = createFileRoute("/operator/")({
  component: OperatorScreen,
});

function OperatorScreen() {
  const { t } = useTranslation();
  const { nextSlide, prevSlide } = useSlides();
  const { togglePlayPause, status: audioStatus } = useAudio();
  const projectorWindowOpen = useDisplayStore((s) => s.projectorWindowOpen);

  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ blackScreen: false, logoScreen: false });
  // Page tracking from slide-context events (works for ALL projection types)
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideTotal, setSlideTotal] = useState(0);

  // Load initial state on mount
  useEffect(() => {
    void getCurrentSlide().then((flat) => {
      if (flat) setCurrentSlide(flatToSlideContent(flat));
    });
    void getOverlayState().then(setOverlay);
    void getSlideContext().then((ctx) => {
      if (ctx) {
        setSlideIndex(ctx.index);
        setSlideTotal(ctx.total);
      }
    });
  }, []);

  // Listen for slide-changed
  useEffect(() => {
    const unsub = listen<SlideContentFlat>("slide-changed", (e) => {
      setCurrentSlide(flatToSlideContent(e.payload));
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen for slide-cleared — reset page count when projection stops
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      setCurrentSlide(null);
      setSlideIndex(0);
      setSlideTotal(0);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen for slide-context — updates page index/total for every projection type
  useEffect(() => {
    const unsub = listen<SlideContextFlat>("slide-context", (e) => {
      setSlideIndex(e.payload.index);
      setSlideTotal(e.payload.total);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen for overlay-changed
  useEffect(() => {
    const unsub = listen<OverlayState>("overlay-changed", (e) => {
      setOverlay(e.payload);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  const isAudioControllable = audioStatus === "playing" || audioStatus === "paused";
  const isPlaying = audioStatus === "playing";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("nav.operator")}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              projectorWindowOpen ? "bg-green-500" : "bg-muted-foreground/40",
            )}
          />
          <span className="text-xs text-muted-foreground">
            {projectorWindowOpen ? t("operator.projectorActive") : t("operator.projectorInactive")}
          </span>
        </div>
      </div>

      {/* Slide preview */}
      <div className="overflow-hidden rounded-lg border border-border bg-black" style={{ aspectRatio: "16/9" }}>
        {currentSlide ? (
          <SlideRenderer slide={currentSlide} renderMode="thumbnail" className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted-foreground">{t("operator.noSlide")}</span>
          </div>
        )}
      </div>

      {/* Overlay indicators */}
      {(overlay.blackScreen || overlay.logoScreen) && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          {overlay.blackScreen && <span>{t("operator.blackScreenActive")}</span>}
          {overlay.logoScreen && <span>{t("operator.logoScreenActive")}</span>}
        </div>
      )}

      {/* Navigation controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void prevSlide()}
            disabled={slideIndex <= 0}
            aria-label={t("operator.prevSlide")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
            {slideTotal > 0
              ? `${slideIndex + 1} / ${slideTotal}`
              : "—"}
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void nextSlide()}
            disabled={slideIndex >= slideTotal - 1}
            aria-label={t("operator.nextSlide")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => void togglePlayPause()}
          disabled={!isAudioControllable}
          aria-label={isPlaying ? t("operator.pause") : t("operator.play")}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
