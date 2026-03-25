import { useState } from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
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
  onPrevItem: () => void;
  onNextItem: () => void;
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
  onSeek,
  onPrevSlide,
  onNextSlide,
  onVolumeChange,
  onMuteToggle,
  onPrevItem,
  onNextItem,
}: ControlBarProps) {
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  if (!currentItem) return null;

  const hasTimeline = mediaHasTimeline(currentItem);
  const hasSlides = mediaHasSlides(currentItem);
  const isPlaying = status === "playing";
  const isActive = isPlaying || status === "paused";

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
            onValueChange={([v]: number[]) => setSeekPreview(v)}
            onValueCommit={([v]: number[]) => {
              onSeek(v);
              setSeekPreview(null);
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
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {hasTimeline && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevItem}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={isPlaying ? onPause : onPlay}
                disabled={status === "loading"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextItem}>
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
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {isActive && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop}>
              <Square className="h-3.5 w-3.5" />
            </Button>
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
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMuteToggle}>
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
                onValueChange={([v]: number[]) => onVolumeChange(v / 100)}
                className="w-20"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
