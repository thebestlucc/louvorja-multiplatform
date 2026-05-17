import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { useMediaPlayerStore } from "../../stores/media-player-store";
import { useMediaPlayer } from "../../hooks/use-media-player";
import { usePlaybackCoordinator } from "../../hooks/use-playback-coordinator";
import { usePlayingNowKeyboard } from "../../hooks/use-playing-now-keyboard";
import { useAudioStore } from "../../stores/audio-store";
import { useDisplayStore } from "../../stores/display-store";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { useRustVideoPipelineStore } from "../../stores/rust-video-pipeline-store";
import { navigateBible } from "../../lib/tauri/bible";
import { toggleBlackScreen, setIsFrozen } from "../../lib/tauri/display";
import { useMemo } from "react";
import { wrapBibleAwareSlideActions } from "../../lib/bible-aware-slide-actions";
import * as videoPipeline from "../../lib/tauri/video-pipeline";
import { usePresentationStore } from "../../stores/presentation-store";
import { QueuePanel } from "../../components/playing-now/queue-panel";
import { PreviewCanvas } from "../../components/playing-now/preview-canvas";
import { ControlBar } from "../../components/playing-now/control-bar";
import { NowPlayingHeader } from "../../components/playing-now/now-playing-header";
import { SlideFilmstrip } from "../../components/playing-now/slide-filmstrip";
import { mediaHasSlides, mediaHasVideo } from "../../types/media";
import { useRouteTour } from "../../hooks/use-route-tour";
import { SpotlightTour } from "../../components/tour/spotlight-tour";
import { Button } from "../../components/ui/button";
import { MonitorPlay, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/playing-now/")({
  component: PlayingNowScreen,
});

function PlayingNowScreen() {
  const { t } = useTranslation();

  // Mount coordination hooks
  usePlaybackCoordinator();
  const actions = useMediaPlayer();

  // Read store state
  const {
    currentItem,
    status,
    currentTime,
    duration,
    slides,
    activeSlideIndex,
    overlay,
  } = useMediaPlayerStore(
    useShallow((s) => ({
      currentItem: s.currentItem,
      status: s.status,
      currentTime: s.currentTime,
      duration: s.duration,
      slides: s.slides,
      activeSlideIndex: s.activeSlideIndex,
      overlay: s.overlay,
    }))
  );

  const volume = useAudioStore((s) => s.volume);
  const outputMuted = useAudioStore((s) => s.outputMuted);
  const isProjectorOpen = useDisplayStore((s) => s.projectorWindowOpen);
  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const bibleContext = useDisplayStore((s) => s.bibleContext);
  const navigate = useNavigate();

  // Bible projection routes prev/next through navigate_bible (split-aware,
  // updates Rust bp.context). Hand the same wrapped handlers to the keyboard
  // hook so ArrowLeft/Right behave like the on-screen Prev/Next buttons.
  const isBibleProjection = currentProjectionType === "bible" && bibleContext !== null;
  const keyboardActions = useMemo(
    () => wrapBibleAwareSlideActions(actions, isBibleProjection, navigateBible),
    [actions, isBibleProjection],
  );
  usePlayingNowKeyboard(keyboardActions);

  // When the Rust pipeline flag is on AND the active item is video, source
  // currentTime/duration/volume from the 10 Hz Rust state stream instead of
  // the legacy `video-state` Tauri events bridged into useMediaPlayerStore.
  const useRustPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);
  const loopMode = useVideoPlayerStore((s) => s.loopMode);
  const setLoopMode = useVideoPlayerStore((s) => s.setLoopMode);
  const videoPlaybackTargets = useVideoPlayerStore((s) => s.videoPlaybackTargets);
  const setVideoPlaybackTargets = useVideoPlayerStore((s) => s.setVideoPlaybackTargets);
  const rustPositionSecs = useRustVideoPipelineStore((s) => s.positionSecs);
  const rustDurationSecs = useRustVideoPipelineStore((s) => s.durationSecs);
  const rustVolume = useRustVideoPipelineStore((s) => s.volume);
  const isVideoTimeline = currentItem ? mediaHasVideo(currentItem) : false;
  const isVideoItem = isVideoTimeline;
  const usePipelineState = useRustPipeline && isVideoTimeline;
  const effectiveCurrentTime = usePipelineState ? rustPositionSecs * 1000 : currentTime;
  const effectiveDuration = usePipelineState ? rustDurationSecs * 1000 : duration;
  const effectiveVolume = usePipelineState ? rustVolume : volume;

  const handleGoToBible = () => {
    if (bibleContext) {
      navigate({
        to: "/bible",
        search: {
          book: bibleContext.book,
          chapter: bibleContext.chapter,
          verse: bibleContext.verseNumber,
        },
      }).catch(() => {});
    }
  };

  const presentationActiveIndex = usePresentationStore((s) => s.activeSlideIndex);
  const isPlayingLiturgy = usePresentationStore((s) => s.isPlayingLiturgy);
  const isFrozen = useDisplayStore((s) => s.isFrozen);
  const effectiveSlides = slides;
  const effectiveActiveIndex = slides.length > 0 ? activeSlideIndex : presentationActiveIndex;

  const currentSlide = effectiveSlides[effectiveActiveIndex] ?? null;
  const showFilmstrip = currentItem ? mediaHasSlides(currentItem) : effectiveSlides.length > 0 || isPlayingLiturgy;
  const currentMode = currentItem?.type === "hymn" ? currentItem.mode : undefined;
  const { showTour, steps, handleComplete, handleSkip } = useRouteTour("/playing-now");

  // Derive header title/subtitle from currentItem
  const headerTitle = (() => {
    if (!currentItem) return "Nothing Playing";
    switch (currentItem.type) {
      case "hymn": return currentItem.hymn.title;
      case "online_video":
      case "offline_video":
      case "image":
      case "annotation": return currentItem.title;
      case "bible": return currentItem.reference;
      case "presentation": return "Presentation";
    }
  })();

  const headerSubtitle = (() => {
    if (effectiveSlides.length > 0) {
      return `${effectiveActiveIndex + 1} / ${effectiveSlides.length} slides`;
    }
    if (currentItem?.type === "hymn" && currentItem.hymn.album) {
      return currentItem.hymn.album;
    }
    return undefined;
  })();

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Header */}
      <NowPlayingHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        frozen={isFrozen}
        isBlack={overlay === "black"}
        onBlackToggle={() => { toggleBlackScreen().catch(() => {}); }}
        onFreezeToggle={() => {
          const next = !useDisplayStore.getState().isFrozen;
          useDisplayStore.getState().setFrozen(next);
          // Rust set_is_frozen flushes the latest slide + context on unfreeze.
          // No frontend re-project — that path (projectSlideWithContext) would
          // clobber currentProjectionType to "hymn" for bible projections.
          setIsFrozen(next).catch(() => {});
        }}
      />

      {/* Video screen target toggles — only shown when a video item is active */}
      {isVideoItem && (
        <div className="flex shrink-0 items-center gap-1 px-1">
          <span className="text-xs text-muted-foreground mr-1">{t("playingNow.videoScreens")}:</span>
          <Button
            variant={videoPlaybackTargets.includes("projector") ? "default" : "ghost"}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              const targets = useVideoPlayerStore.getState().videoPlaybackTargets;
              const has = targets.includes("projector");
              setVideoPlaybackTargets(
                has ? targets.filter((target) => target !== "projector") : [...targets, "projector"],
              );
            }}
            aria-label={t("playingNow.toggleProjector")}
            aria-pressed={videoPlaybackTargets.includes("projector")}
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
            {t("display.projector")}
          </Button>
          <Button
            variant={videoPlaybackTargets.includes("return") ? "default" : "ghost"}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              const targets = useVideoPlayerStore.getState().videoPlaybackTargets;
              const has = targets.includes("return");
              setVideoPlaybackTargets(
                has ? targets.filter((target) => target !== "return") : [...targets, "return"],
              );
            }}
            aria-label={t("playingNow.toggleReturn")}
            aria-pressed={videoPlaybackTargets.includes("return")}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            {t("display.return")}
          </Button>
        </div>
      )}

      {/* Main area: stage + queue */}
      <div className={cn(
        "min-h-0 flex-1",
        showFilmstrip
          ? "grid grid-cols-[124px_minmax(0,1fr)_auto] gap-3"
          : "grid grid-cols-[minmax(0,1fr)_auto] gap-3"
      )}>
        {/* Left rail: slide filmstrip */}
        {showFilmstrip && (
          <aside className="self-start max-h-[50vh] overflow-y-auto" aria-label="Slides">
            <SlideFilmstrip
              slides={effectiveSlides}
              activeIndex={effectiveActiveIndex}
              onSlideClick={actions.goToSlide}
            />
          </aside>
        )}

        {/* Center: preview canvas */}
        <section className="self-start aspect-video min-w-0 overflow-hidden rounded-lg">
          <PreviewCanvas
            currentItem={currentItem}
            currentSlide={currentSlide}
            overlay={overlay}
            isProjectorOpen={isProjectorOpen}
          />
        </section>

        {/* Right: queue */}
        <div data-tour="playing-queue" className="h-full">
          <QueuePanel />
        </div>
      </div>

      {/* Bottom: transport controls */}
      <div data-tour="playback-controls">
        <ControlBar
          currentItem={currentItem}
          status={status}
          currentTime={effectiveCurrentTime}
          duration={effectiveDuration}
          activeSlideIndex={effectiveActiveIndex}
          totalSlides={effectiveSlides.length}
          volume={effectiveVolume}
          muted={outputMuted}
          onPlay={actions.play}
          onPause={actions.pause}
          onStop={actions.stop}
          onRestart={actions.restart}
          onSeek={actions.seek}
          onPrevSlide={isBibleProjection ? () => navigateBible("prev").catch(() => {}) : actions.prevSlide}
          onNextSlide={isBibleProjection ? () => navigateBible("next").catch(() => {}) : actions.nextSlide}
          onVolumeChange={actions.setVolume}
          onMuteToggle={() => {
            const s = useAudioStore.getState();
            const willBeMuted = !s.outputMuted;
            s.setOutputMuted(willBeMuted).catch(() => {});
            // Under rust pipeline, audio bypasses the rodio audio-store path
            // and goes straight from GStreamer's autoaudiosink to the OS.
            // Mute/unmute by toggling the pipeline volume to 0 / saved volume
            // — without touching the audio-store volume field, so the slider
            // position is preserved as the "volume to restore on unmute".
            if (usePipelineState) {
              const target = willBeMuted ? 0 : s.volume;
              videoPipeline
                .setVolume(target)
                .catch((err) => console.error("[video-pipeline] mute setVolume failed", err));
            }
          }}
          onPrevItem={actions.prevItem}
          onNextItem={actions.nextItem}
          currentMode={currentMode}
          onModeChange={actions.switchMode}
          isBibleProjection={isBibleProjection}
          onGoToBible={handleGoToBible}
          isLooping={loopMode === "one"}
          onLoopToggle={
            usePipelineState
              ? () => setLoopMode(loopMode === "one" ? "none" : "one")
              : undefined
          }
        />
      </div>

      {showTour && steps.length > 0 && (
        <SpotlightTour steps={steps} onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </div>
  );
}
