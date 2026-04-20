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
import { usePresentationStore } from "../../stores/presentation-store";
import { SlidePanel } from "../../components/playing-now/slide-panel";
import { QueuePanel } from "../../components/playing-now/queue-panel";
import { PreviewCanvas } from "../../components/playing-now/preview-canvas";
import { ControlBar } from "../../components/playing-now/control-bar";
import { mediaHasSlides, mediaHasVideo } from "../../types/media";
import { useRouteTour } from "../../hooks/use-route-tour";
import { SpotlightTour } from "../../components/tour/spotlight-tour";

export const Route = createFileRoute("/playing-now/")({
  component: PlayingNowScreen,
});

function PlayingNowScreen() {
  // Mount coordination hooks
  usePlaybackCoordinator();
  const actions = useMediaPlayer();
  usePlayingNowKeyboard(actions);

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

  // When the Rust pipeline flag is on AND the active item is video, source
  // currentTime/duration/volume from the 10 Hz Rust state stream instead of
  // the legacy `video-state` Tauri events bridged into useMediaPlayerStore.
  const useRustPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);
  const loopMode = useVideoPlayerStore((s) => s.loopMode);
  const setLoopMode = useVideoPlayerStore((s) => s.setLoopMode);
  const rustPositionSecs = useRustVideoPipelineStore((s) => s.positionSecs);
  const rustDurationSecs = useRustVideoPipelineStore((s) => s.durationSecs);
  const rustVolume = useRustVideoPipelineStore((s) => s.volume);
  const isVideoTimeline = currentItem ? mediaHasVideo(currentItem) : false;
  const usePipelineState = useRustPipeline && isVideoTimeline;
  const effectiveCurrentTime = usePipelineState ? rustPositionSecs * 1000 : currentTime;
  const effectiveDuration = usePipelineState ? rustDurationSecs * 1000 : duration;
  const effectiveVolume = usePipelineState ? rustVolume : volume;

  const isBibleProjection = currentProjectionType === "bible" && bibleContext !== null;

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
  const effectiveSlides = slides;
  const effectiveActiveIndex = slides.length > 0 ? activeSlideIndex : presentationActiveIndex;

  const currentSlide = effectiveSlides[effectiveActiveIndex] ?? null;
  const showSlides = currentItem ? mediaHasSlides(currentItem) : effectiveSlides.length > 0 || isPlayingLiturgy;
  const currentMode = currentItem?.type === "hymn" ? currentItem.mode : undefined;
  const { showTour, steps, handleComplete, handleSkip } = useRouteTour("/playing-now");

  return (
    <div className="flex h-full flex-col">
      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Slide Panel */}
        <SlidePanel
          slides={effectiveSlides}
          activeSlideIndex={effectiveActiveIndex}
          onSlideClick={actions.goToSlide}
          visible={showSlides}
        />

        {/* Center: Preview + Controls */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <PreviewCanvas
              currentItem={currentItem}
              currentSlide={currentSlide}
              overlay={overlay}
              isProjectorOpen={isProjectorOpen}
            />
          </div>
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
            onPrevSlide={isBibleProjection ? () => navigateBible("prev") : actions.prevSlide}
            onNextSlide={isBibleProjection ? () => navigateBible("next") : actions.nextSlide}
            onVolumeChange={actions.setVolume}
            onMuteToggle={() => {
              const s = useAudioStore.getState();
              s.setOutputMuted(!s.outputMuted);
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
        </div>

        {/* Right: Queue Panel */}
        <div data-tour="playing-queue">
          <QueuePanel />
        </div>
      </div>

      {showTour && steps.length > 0 && (
        <SpotlightTour steps={steps} onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </div>
  );
}
