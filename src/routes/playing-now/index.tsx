import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { useMediaPlayerStore } from "../../stores/media-player-store";
import { useMediaPlayer } from "../../hooks/use-media-player";
import { usePlaybackCoordinator } from "../../hooks/use-playback-coordinator";
import { useAudioStore } from "../../stores/audio-store";
import { useDisplayStore } from "../../stores/display-store";
import { SlidePanel } from "../../components/playing-now/slide-panel";
import { QueuePanel } from "../../components/playing-now/queue-panel";
import { PreviewCanvas } from "../../components/playing-now/preview-canvas";
import { ControlBar } from "../../components/playing-now/control-bar";
import { mediaHasSlides } from "../../types/media";

export const Route = createFileRoute("/playing-now/")({
  component: PlayingNowScreen,
});

function PlayingNowScreen() {
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

  const currentSlide = slides[activeSlideIndex] ?? null;
  const showSlides = currentItem ? mediaHasSlides(currentItem) : false;

  return (
    <div className="flex h-full flex-col">
      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Slide Panel */}
        <SlidePanel
          slides={slides}
          activeSlideIndex={activeSlideIndex}
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
          <ControlBar
            currentItem={currentItem}
            status={status}
            currentTime={currentTime}
            duration={duration}
            activeSlideIndex={activeSlideIndex}
            totalSlides={slides.length}
            volume={volume}
            muted={outputMuted}
            onPlay={actions.play}
            onPause={actions.pause}
            onStop={actions.stop}
            onSeek={actions.seek}
            onPrevSlide={actions.prevSlide}
            onNextSlide={actions.nextSlide}
            onVolumeChange={(v) => useAudioStore.getState().setVolume(v)}
            onMuteToggle={() => {
              const s = useAudioStore.getState();
              s.setOutputMuted(!s.outputMuted);
            }}
            onPrevItem={actions.prevItem}
            onNextItem={actions.nextItem}
          />
        </div>

        {/* Right: Queue Panel */}
        <QueuePanel />
      </div>
    </div>
  );
}
