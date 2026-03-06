import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  List, 
  SkipBack, 
  SkipForward, 
  MonitorPlay,
  Square,
  Shuffle,
  XCircle
} from "lucide-react";
import { getCurrentSlide, getOverlayState, getSlideContext } from "../../lib/tauri";
import { SlideRenderer } from "../../components/slides/slide-renderer";
import { PlayingQueue } from "../../components/operator/playing-queue";
import { useDisplayStore } from "../../stores/display-store";
import { useSlides } from "../../hooks/use-slides";
import { useAudio } from "../../hooks/use-audio";
import { useQueueStore } from "../../stores/queue-store";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { resolveSlideSeekTimestamp } from "../../hooks/use-slides";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { ScrollArea } from "../../components/ui/scroll-area";
import type { SlideContext, OverlayState, SlideContent } from "../../lib/bindings";

export const Route = createFileRoute("/operator/")({
  component: OperatorScreen,
});

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function OperatorScreen() {
  const { t } = useTranslation();
  const { nextSlide, prevSlide, goToSlide, slides, activeSlideIndex } = useSlides();
  const { togglePlayPause, status: audioStatus, positionMs, durationMs, seek, playbackMode, setPlaybackMode, stop: stopAudio, play } = useAudio();
  const projectorWindowOpen = useDisplayStore((s) => s.projectorWindowOpen);
  const { items, currentIndex, next: nextQueueItem, prev: prevQueueItem, clearQueue, shuffleQueue } = useQueueStore();
  const setActiveSlideIndex = usePresentationStore((s) => s.setActiveSlideIndex);

  const currentItem = items[currentIndex];
  const hasPlaybackPath = !!currentItem?.hymn?.playbackPath;

  const handleModeChange = async (mode: "silent" | "sung" | "karaoke") => {
    if (mode === playbackMode) return;
    
    setPlaybackMode(mode);
    
    if (!currentItem) return;

    if (mode === "silent") {
      void stopAudio();
    } else {
      const audioPath = mode === "karaoke" 
        ? (currentItem.hymn?.playbackPath || currentItem.hymn?.audioPath) 
        : currentItem.hymn?.audioPath;
      
      if (audioPath) {
        // Find sync point for current activeSlideIndex to keep it synced
        const syncPoints = useAudioStore.getState().syncPoints;
        const targetMs = resolveSlideSeekTimestamp(syncPoints, activeSlideIndex) ?? positionMs;
        await play(audioPath, targetMs);
      }
    }
  };

  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ blackScreen: false, logoScreen: false });
  // slideIndex/slideTotal from context events (can be different from local store if remote controlled)
  const [contextIndex, setContextIndex] = useState(0);
  const [contextTotal, setContextTotal] = useState(0);

  // Load initial state on mount
  useEffect(() => {
    void getCurrentSlide().then((slide) => {
      if (slide) setCurrentSlide(slide);
    });
    void getOverlayState().then(setOverlay);
    void getSlideContext().then((ctx) => {
      if (ctx) {
        setContextIndex(ctx.index);
        setContextTotal(ctx.total);
      }
    });
  }, []);

  // Listen for slide-changed
  useEffect(() => {
    const unsub = listen<SlideContent>("slide-changed", (e) => {
      setCurrentSlide(e.payload);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen for slide-cleared
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      setCurrentSlide(null);
      setContextIndex(0);
      setContextTotal(0);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen for slide-context
  useEffect(() => {
    const unsub = listen<SlideContext>("slide-context", (e) => {
      setContextIndex(e.payload.index);
      setContextTotal(e.payload.total);
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
  
  const canPrevQueue = currentIndex > 0;
  const canNextQueue = currentIndex < items.length - 1;

  const handleSeek = (value: number[]) => {
    if (value[0] !== undefined) {
      void seek(value[0]);
    }
  };

  const handleStop = async () => {
    await stopProjectionAndSongAudio();
    usePresentationStore.getState().setSlides([]);
    setActiveSlideIndex(0);
    void stopAudio();
  };

  return (
    <div className="flex h-full w-full gap-6 overflow-hidden">
      {/* Left Sidebar - All Slides (20%) */}
      <div className="w-[20%] shrink-0 flex flex-col gap-4 border-r border-border pr-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 px-2">
          <MonitorPlay className="h-4 w-4" />
          {t("hymnal.slides")}
        </h2>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-3 p-2">
            {slides.map((slide, index) => (
              <button
                key={index}
                onClick={() => void goToSlide(index, { seekAudio: true })}
                className={cn(
                  "relative aspect-video w-full rounded-md border-2 overflow-hidden transition-all",
                  activeSlideIndex === index 
                    ? "border-primary ring-2 ring-primary/20 shadow-md" 
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <SlideRenderer slide={slide} renderMode="thumbnail" className="h-full w-full pointer-events-none" />
                <div className={cn(
                  "absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                  activeSlideIndex === index ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
                )}>
                  {index + 1}
                </div>
              </button>
            ))}
            {slides.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-10">
                {t("operator.noSlide")}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Center - Current Slide & Controls */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Current Slide Preview - Occupying all available height */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              {t("nav.operator")}
            </h1>
            <div className="flex items-center gap-4">
              {/* Overlay indicators */}
              {(overlay.blackScreen || overlay.logoScreen) && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                  {overlay.blackScreen && <span>{t("operator.blackScreenActive")}</span>}
                  {overlay.logoScreen && <span>{t("operator.logoScreenActive")}</span>}
                </div>
              )}
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
          </div>

          <div className="flex-1 w-full rounded-xl border border-border bg-black relative overflow-hidden flex items-center justify-center shadow-inner">
            {currentSlide ? (
              <SlideRenderer slide={currentSlide} renderMode="return-current" className="h-full w-full" />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <MonitorPlay className="h-12 w-12 text-muted-foreground/20" />
                <span className="text-sm text-muted-foreground text-center px-4">{t("operator.noSlide")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Controls Section */}
        <div className="flex flex-col items-center gap-6 py-6 border-t border-border bg-muted/5">
            {/* Playback Modes */}
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border">
              <button 
                onClick={() => handleModeChange("silent")}
                className={cn("px-4 py-1.5 rounded-md text-sm transition-colors", playbackMode === "silent" ? "bg-surface text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {t("operator.modeSlides")}
              </button>
              <button 
                onClick={() => handleModeChange("sung")}
                className={cn("px-4 py-1.5 rounded-md text-sm transition-colors", playbackMode === "sung" ? "bg-surface text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {t("operator.modeAudio")}
              </button>
              <button 
                onClick={() => handleModeChange("karaoke")}
                disabled={!hasPlaybackPath}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm transition-colors", 
                  playbackMode === "karaoke" ? "bg-surface text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground",
                  !hasPlaybackPath && "opacity-50 cursor-not-allowed hover:text-muted-foreground"
                )}
              >
                {t("operator.modeInstrumental")}
              </button>
            </div>

            {/* Main Controls Row */}
            <div className="flex items-center justify-center gap-4 sm:gap-8">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-10 w-10 sm:h-12 sm:w-12"
                onClick={handleStop}
                title={t("operator.stop")}
              >
                <Square className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
              </Button>

              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-10 w-10 sm:h-12 sm:w-12"
                  onClick={prevQueueItem}
                  disabled={!canPrevQueue}
                  aria-label={t("operator.prevQueue")}
                >
                  <SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-10 w-10 sm:h-12 sm:w-12"
                  onClick={() => void prevSlide()}
                  disabled={contextIndex <= 0 && slides.length === 0}
                  aria-label={t("operator.prevSlide")}
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>

                <Button
                  variant="default"
                  size="icon"
                  className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg"
                  onClick={() => void togglePlayPause()}
                  disabled={!isAudioControllable && playbackMode === "silent" && slides.length === 0}
                  aria-label={isPlaying ? t("operator.pause") : t("operator.play")}
                >
                  {isPlaying ? (
                    <Pause className="h-7 w-7 sm:h-8 sm:w-8 fill-current" />
                  ) : (
                    <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-current translate-x-0.5" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-10 w-10 sm:h-12 sm:w-12"
                  onClick={() => void nextSlide()}
                  disabled={contextIndex >= contextTotal - 1 && contextTotal > 0}
                  aria-label={t("operator.nextSlide")}
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-10 w-10 sm:h-12 sm:w-12"
                  onClick={nextQueueItem}
                  disabled={!canNextQueue}
                  aria-label={t("operator.nextQueue")}
                >
                  <SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </div>

            {/* Progress Bar Row */}
            <div className="w-full max-w-2xl flex items-center gap-4 px-4">
              {isAudioControllable ? (
                <>
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px] text-right">
                    {formatTime(positionMs)}
                  </span>
                  <Slider 
                    value={[positionMs]} 
                    max={durationMs > 0 ? durationMs : 100} 
                    step={100}
                    onValueChange={handleSeek}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px]">
                    {formatTime(durationMs)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px] text-right">
                    {contextTotal > 0 ? contextIndex + 1 : 0}
                  </span>
                  <Slider 
                    value={[contextTotal > 0 ? contextIndex + 1 : 0]} 
                    max={contextTotal > 0 ? contextTotal : 1} 
                    step={1}
                    disabled
                    className="flex-1 opacity-50 cursor-not-allowed"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px]">
                    {contextTotal}
                  </span>
                </>
              )}
            </div>
        </div>
      </div>

      {/* Right Sidebar - Playing Queue (~25%) */}
      <div className="w-[25%] shrink-0 flex flex-col min-w-[250px]">
        <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <List className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("operator.playingQueue")}
            </h2>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={shuffleQueue}
                title={t("operator.shuffleQueue")}
                disabled={items.length <= 1}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={clearQueue}
                title={t("operator.clearQueue")}
                disabled={items.length === 0}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground ml-1">
                {items.length}
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PlayingQueue />
          </div>
        </div>
      </div>
    </div>
  );
}
