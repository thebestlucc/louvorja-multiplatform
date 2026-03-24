import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen, emit } from "@tauri-apps/api/event";
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
import { PlayingQueue } from "../../components/playing-now/playing-queue";
import type { VideoStateEvent } from "../../components/online-videos/online-video-slide";
import { useDisplayStore } from "../../stores/display-store";
import { useSlides } from "../../hooks/use-slides";
import { useAudio } from "../../hooks/use-audio";
import { useQueueStore } from "../../stores/queue-store";
import { usePresentationStore } from "../../stores/presentation-store";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { cn } from "../../lib/utils";
import {
  resolveProgressRatio,
  resolvePlaybackTargetFile,
  resolvePlaybackVariantPaths,
  resolveReplayStartPosition,
  resolveSlideTimingWindow,
} from "../../lib/audio-sync";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { ScrollArea } from "../../components/ui/scroll-area";
import type { SlideContext, OverlayState, SlideContent } from "../../lib/bindings";

export const Route = createFileRoute("/playing-now/")({
  component: PlayingNowScreen,
});

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function hasSlideText(slide: SlideContent | null | undefined) {
  return Boolean(slide?.text?.trim() || slide?.title?.trim());
}

function isPlaybackGapSlide(slide: SlideContent | null | undefined) {
  if (!slide) {
    return false;
  }

  const slideType = slide.slideType.toLowerCase();
  if (slideType !== "text" && slideType !== "lyrics") {
    return false;
  }

  return !hasSlideText(slide);
}

function PlayingNowScreen() {
  const { t } = useTranslation();
  const {
    nextSlide,
    prevSlide,
    goToSlide,
    slides,
    activeSlideIndex,
    currentSlide: selectedSlide,
  } = useSlides();
  const {
    status: audioStatus,
    positionMs,
    durationMs,
    seek,
    outputMuted,
    playbackMode,
    syncPoints,
    setOutputMuted,
    setPlaybackMode,
    stop: stopAudio,
    play,
    playVariants,
    switchVariant,
    pause,
    resume,
  } = useAudio();
  const projectorWindowOpen = useDisplayStore((s) => s.projectorWindowOpen);
  const { items, currentIndex, next: nextQueueItem, prev: prevQueueItem, clearQueue, shuffleQueue } = useQueueStore();
  const setActiveSlideIndex = usePresentationStore((s) => s.setActiveSlideIndex);

  const currentItem = items[currentIndex];
  const variantPaths = resolvePlaybackVariantPaths(
    currentItem?.hymn?.audioPath,
    currentItem?.hymn?.playbackPath,
  );
  const hasPlaybackPath = !!currentItem?.hymn?.playbackPath;
  const currentAudioPath = resolvePlaybackTargetFile(
    playbackMode,
    currentItem?.hymn?.audioPath,
    currentItem?.hymn?.playbackPath,
  );
  const selectedOutputMode: "silent" | "sung" | "karaoke" = outputMuted
    ? "silent"
    : playbackMode;

  const handleModeChange = async (mode: "silent" | "sung" | "karaoke") => {
    if (mode === selectedOutputMode) return;

    if (!currentItem) return;

    if (mode === "silent") {
      await setOutputMuted(true);
      return;
    }

    await setOutputMuted(false);

    const audioPath = resolvePlaybackTargetFile(
      mode,
      currentItem.hymn?.audioPath,
      currentItem.hymn?.playbackPath,
    );

    if (!audioPath) {
      return;
    }

    if (mode === playbackMode) {
      if (audioStatus === "idle") {
        const startMs = resolveReplayStartPosition(positionMs, durationMs);
        if (variantPaths) {
          await playVariants(
            variantPaths.sungPath,
            variantPaths.karaokePath,
            mode,
            startMs,
          );
        } else {
          await play(audioPath, startMs);
        }
      }
      return;
    }

    setPlaybackMode(mode);
    if (variantPaths) {
      if (audioStatus === "playing" || audioStatus === "paused") {
        const activeFilePath = mode === "karaoke"
          ? variantPaths.karaokePath
          : variantPaths.sungPath;
        await switchVariant(mode, activeFilePath);
      } else {
        const startMs = resolveReplayStartPosition(positionMs, durationMs);
        await playVariants(
          variantPaths.sungPath,
          variantPaths.karaokePath,
          mode,
          startMs,
        );
      }
    } else {
      const preserveLivePosition = audioStatus === "playing" || audioStatus === "paused";
      await play(audioPath, positionMs, preserveLivePosition);
      if (audioStatus === "paused") {
        await pause();
      }
    }
  };

  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ blackScreen: false, logoScreen: false, alert: null });
  // slideIndex/slideTotal from context events (can be different from local store if remote controlled)
  const [contextIndex, setContextIndex] = useState(0);
  const [contextTotal, setContextTotal] = useState(0);
  const [seekPreviewMs, setSeekPreviewMs] = useState<number | null>(null);
  const [videoState, setVideoState] = useState<VideoStateEvent | null>(null);

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
      setVideoState(null);
      usePresentationStore.getState().setCurrentVideoProjectionId(null);
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

  // Listen for video-state emitted by the projector window (local video slides)
  useEffect(() => {
    const unsub = listen<VideoStateEvent>("video-state", (e) => {
      setVideoState(e.payload);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  const isVideoSlide = currentSlide?.slideType === "video" || currentSlide?.slideType === "online_video";
  const isLocalVideo =
    currentSlide?.slideType === "video" ||
    (currentSlide?.slideType === "online_video" && currentSlide.videoSource === "local");
  const hasAudioLoaded =
    !isVideoSlide &&
    (!!currentAudioPath || ((audioStatus === "playing" || audioStatus === "paused") && durationMs > 0));
  const isPlaying = isVideoSlide ? videoState?.paused === false : audioStatus === "playing";
  const displayedSeekMs = seekPreviewMs ?? positionMs;
  const previewSlide = selectedSlide ?? currentSlide;
  const isGapIndicatorCandidate =
    hasAudioLoaded
    && (audioStatus === "playing" || audioStatus === "paused")
    && isPlaybackGapSlide(previewSlide);
  const gapTimingWindow = isGapIndicatorCandidate
    ? resolveSlideTimingWindow(syncPoints, activeSlideIndex, playbackMode)
    : null;
  const showGapIndicator = Boolean(
    gapTimingWindow
    && gapTimingWindow.startMs != null
    && gapTimingWindow.endMs != null
    && gapTimingWindow.endMs > gapTimingWindow.startMs,
  );
  const gapStartMs = gapTimingWindow && showGapIndicator ? gapTimingWindow.startMs : null;
  const gapEndMs = gapTimingWindow && showGapIndicator ? gapTimingWindow.endMs : null;
  const gapProgressRatio = showGapIndicator
    ? resolveProgressRatio(gapStartMs, gapEndMs, positionMs)
    : null;
  const gapProgressPercent = gapProgressRatio == null
    ? null
    : Math.max(10, Math.round(gapProgressRatio * 100));
  
  const canPrevQueue = currentIndex > 0;
  const canNextQueue = currentIndex < items.length - 1;

  useEffect(() => {
    if (seekPreviewMs != null && !hasAudioLoaded) {
      setSeekPreviewMs(null);
    }
  }, [hasAudioLoaded, seekPreviewMs]);

  const handleSeekPreviewChange = (value: number[]) => {
    if (value[0] !== undefined) {
      setSeekPreviewMs(value[0]);
    }
  };

  const handleSeek = async (value: number[]) => {
    setSeekPreviewMs(null);
    if (value[0] !== undefined) {
      if (audioStatus === "idle" && currentAudioPath) {
        if (variantPaths && playbackMode !== "silent") {
          await playVariants(
            variantPaths.sungPath,
            variantPaths.karaokePath,
            playbackMode === "karaoke" ? "karaoke" : "sung",
            value[0],
          );
          return;
        }

        await play(currentAudioPath, value[0]);
        return;
      }

      await seek(value[0]);
    }
  };

  const handlePrimaryPlayPause = async () => {
    if (audioStatus === "playing") {
      await pause();
      return;
    }

    if (audioStatus === "paused") {
      await resume();
      return;
    }

    if (!currentAudioPath) {
      return;
    }

    const startMs = resolveReplayStartPosition(positionMs, durationMs);
    if (variantPaths && playbackMode !== "silent") {
      await playVariants(
        variantPaths.sungPath,
        variantPaths.karaokePath,
        playbackMode === "karaoke" ? "karaoke" : "sung",
        startMs,
      );
      return;
    }

    await play(currentAudioPath, startMs);
  };

  const handleVideoPlayPause = async () => {
    const action = videoState?.paused === false ? "pause" : "play";
    await emit("video-control", { action }).catch(() => {});
  };

  const handleVideoSeek = async (value: number[]) => {
    if (value[0] !== undefined) {
      await emit("video-control", { action: "seek", value: value[0] }).catch(() => {});
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
                {t("playingNow.noSlide")}
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
              {t("nav.playingNow")}
            </h1>
            <div className="flex items-center gap-4">
              {/* Overlay indicators */}
              {(overlay.blackScreen || overlay.logoScreen) && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                  {overlay.blackScreen && <span>{t("playingNow.blackScreenActive")}</span>}
                  {overlay.logoScreen && <span>{t("playingNow.logoScreenActive")}</span>}
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
                  {projectorWindowOpen ? t("playingNow.projectorActive") : t("playingNow.projectorInactive")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full rounded-xl border border-border bg-black relative overflow-hidden flex items-center justify-center shadow-inner">
            {previewSlide ? (
              <>
                <SlideRenderer
                slide={previewSlide}
                renderMode={
                  previewSlide?.slideType === "online_video" || previewSlide?.slideType === "video"
                    ? "playing-now-preview"
                    : "return-current"
                }
                className="h-full w-full"
              />
                {showGapIndicator && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-6">
                    <div className="w-full max-w-md rounded-full border border-white/10 bg-black/55 px-4 py-3 shadow-2xl backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400/90",
                            isPlaying && "animate-pulse",
                          )}
                        />
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                          {gapProgressPercent != null ? (
                            <div
                              className={cn(
                                "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500/55 via-emerald-300 to-white transition-[width] duration-300 ease-linear",
                                isPlaying && "animate-pulse",
                              )}
                              style={{ width: `${gapProgressPercent}%` }}
                            />
                          ) : (
                            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-emerald-300 to-white animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <MonitorPlay className="h-12 w-12 text-muted-foreground/20" />
                <span className="text-sm text-muted-foreground text-center px-4">{t("playingNow.noSlide")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Controls Section */}
        <div className="flex flex-col items-center gap-6 py-6 border-t border-border bg-muted/5">
            {/* Playback Modes — hidden for video slides */}
            <div className={cn("flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border", isVideoSlide && "invisible")}>
              <button 
                onClick={() => handleModeChange("silent")}
                className={cn("px-4 py-1.5 rounded-md text-sm transition-colors", selectedOutputMode === "silent" ? "bg-surface text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {t("playingNow.modeSlides")}
              </button>
              <button 
                onClick={() => handleModeChange("sung")}
                className={cn("px-4 py-1.5 rounded-md text-sm transition-colors", selectedOutputMode === "sung" ? "bg-surface text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {t("playingNow.modeAudio")}
              </button>
              <button 
                onClick={() => handleModeChange("karaoke")}
                disabled={!hasPlaybackPath}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm transition-colors", 
                  selectedOutputMode === "karaoke" ? "bg-surface text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground",
                  !hasPlaybackPath && "opacity-50 cursor-not-allowed hover:text-muted-foreground"
                )}
              >
                {t("playingNow.modeInstrumental")}
              </button>
            </div>

            {/* Main Controls Row */}
            <div className="flex items-center justify-center gap-4 sm:gap-8">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-10 w-10 sm:h-12 sm:w-12"
                onClick={handleStop}
                title={t("playingNow.stop")}
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
                  aria-label={t("playingNow.prevQueue")}
                >
                  <SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-10 w-10 sm:h-12 sm:w-12"
                  onClick={() => void prevSlide()}
                  disabled={contextIndex <= 0 && slides.length === 0}
                  aria-label={t("playingNow.prevSlide")}
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>

                <Button
                  variant="default"
                  size="icon"
                  className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg"
                  onClick={() => void (isVideoSlide ? handleVideoPlayPause() : handlePrimaryPlayPause())}
                  disabled={isVideoSlide ? !isLocalVideo : (!hasAudioLoaded && slides.length === 0)}
                  aria-label={isPlaying ? t("playingNow.pause") : t("playingNow.play")}
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
                  aria-label={t("playingNow.nextSlide")}
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-10 w-10 sm:h-12 sm:w-12"
                  onClick={nextQueueItem}
                  disabled={!canNextQueue}
                  aria-label={t("playingNow.nextQueue")}
                >
                  <SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </div>

            {/* Progress Bar Row */}
            <div className="w-full max-w-2xl flex items-center gap-4 px-4">
              {isVideoSlide && isLocalVideo ? (
                <>
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px] text-right">
                    {formatTime((videoState?.currentTime ?? 0) * 1000)}
                  </span>
                  <Slider
                    value={[videoState?.currentTime ?? 0]}
                    max={(videoState?.duration ?? 0) > 0 ? videoState!.duration : 100}
                    step={0.1}
                    onValueCommit={(value) => void handleVideoSeek(value)}
                    disabled={!videoState}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px]">
                    {formatTime((videoState?.duration ?? 0) * 1000)}
                  </span>
                </>
              ) : isVideoSlide ? (
                // YouTube / non-local online video — no seek control available
                <p className="flex-1 text-center text-xs text-muted-foreground">
                  {currentSlide?.videoTitle ?? currentSlide?.videoId ?? ""}
                </p>
              ) : hasAudioLoaded ? (
                <>
                  <span className="text-xs text-muted-foreground tabular-nums min-w-[45px] text-right">
                    {formatTime(displayedSeekMs)}
                  </span>
                  <Slider
                    value={[displayedSeekMs]}
                    max={durationMs > 0 ? durationMs : 100}
                    step={100}
                    onValueChange={handleSeekPreviewChange}
                    onValueCommit={(value) => {
                      void handleSeek(value);
                    }}
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
              {t("playingNow.playingQueue")}
            </h2>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={shuffleQueue}
                title={t("playingNow.shuffleQueue")}
                disabled={items.length <= 1}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={clearQueue}
                title={t("playingNow.clearQueue")}
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
