import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  Music2,
  MonitorPlay,
} from "lucide-react";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import type { MediaItem, MediaStatus } from "../../types/media";
import { mediaHasSlides, mediaHasTimeline } from "../../types/media";

interface ControlBarProps {
  currentItem: MediaItem | null;
  status: MediaStatus;
  currentTime: number;
  duration: number;
  activeSlideIndex: number;
  totalSlides: number;
  volume: number;
  muted: boolean;

  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (timeMs: number) => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onRestart?: () => void;
  onPrevItem: () => void;
  onNextItem: () => void;
  currentMode?: "sung" | "karaoke" | "silent";
  onModeChange?: (mode: "sung" | "karaoke" | "silent") => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ControlBar({
  currentItem,
  status,
  currentTime,
  duration,
  activeSlideIndex,
  totalSlides,
  volume,
  muted,
  onPlay,
  onPause,
  onStop,
  onRestart,
  onSeek,
  onPrevSlide,
  onNextSlide,
  onVolumeChange,
  onMuteToggle,
  onPrevItem,
  onNextItem,
  currentMode,
  onModeChange,
}: ControlBarProps) {
  const { t } = useTranslation();
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const hasTimeline = currentItem ? mediaHasTimeline(currentItem) : false;
  const hasSlides = currentItem ? mediaHasSlides(currentItem) : totalSlides > 0;
  const isPlaying = status === "playing";
  const isActive = isPlaying || status === "paused";

  // Nothing to show at all
  if (!currentItem && totalSlides === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-border bg-background px-4 py-2">
      {/* Timeline row */}
      {hasTimeline && (
        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {formatTime(seekPreview ?? currentTime)}
          </span>
          <Slider
            min={0}
            max={Math.max(duration, 1)}
            value={[seekPreview ?? currentTime]}
            onValueChange={(values) => {
              if (values[0] !== undefined) setSeekPreview(values[0]);
            }}
            onValueCommit={(values) => {
              if (values[0] !== undefined) {
                onSeek(values[0]);
                setSeekPreview(null);
              }
            }}
            className="flex-1"
          />
          <span className="w-10 text-xs tabular-nums text-muted-foreground">
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: playback controls */}
        <div className="flex items-center gap-1">
          {hasSlides && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPrevSlide}
              disabled={activeSlideIndex === 0}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {hasTimeline && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevItem} aria-label="Previous item">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={isPlaying ? onPause : onPlay}
                disabled={status === "loading"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextItem} aria-label="Next item">
                <SkipForward className="h-4 w-4" />
              </Button>
            </>
          )}

          {hasSlides && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNextSlide}
              disabled={activeSlideIndex >= totalSlides - 1}
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {isActive && onRestart && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRestart} aria-label="Restart">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}

          {isActive && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop} aria-label="Stop">
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Mode toggle (hymns only) */}
          {currentMode && onModeChange && (
            <div className="ml-2 flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Button
                variant={currentMode === "sung" ? "default" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => onModeChange("sung")}
                title={t("playingNow.modeSung")}
              >
                <Mic className="h-3 w-3" />
              </Button>
              <Button
                variant={currentMode === "karaoke" ? "default" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => onModeChange("karaoke")}
                title={t("playingNow.modeKaraoke")}
              >
                <Music2 className="h-3 w-3" />
              </Button>
              <Button
                variant={currentMode === "silent" ? "default" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => onModeChange("silent")}
                title={t("playingNow.modeSilent")}
              >
                <MonitorPlay className="h-3 w-3" />
              </Button>
            </div>
          )}

        </div>

        {/* Center: slide counter */}
        <div className="text-xs text-muted-foreground">
          {hasSlides && totalSlides > 0 && (
            <span>
              {activeSlideIndex + 1} / {totalSlides}
            </span>
          )}
        </div>

        {/* Right: volume */}
        <div className="flex items-center gap-1">
          {hasTimeline && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMuteToggle} aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </Button>
              <Slider
                min={0}
                max={100}
                value={[muted ? 0 : volume * 100]}
                onValueChange={(values) => {
                  if (values[0] !== undefined) onVolumeChange(values[0] / 100);
                }}
                className="w-20"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

