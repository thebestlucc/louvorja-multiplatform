import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  Music2,
  MonitorPlay,
  BookOpen,
} from "lucide-react";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
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
  isBibleProjection?: boolean;
  onGoToBible?: () => void;
  /** Task 3.1: loop toggle. Only rendered when `onLoopToggle` is provided. */
  isLooping?: boolean;
  onLoopToggle?: () => void;
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
  isBibleProjection,
  onGoToBible,
  isLooping,
  onLoopToggle,
}: ControlBarProps) {
  const { t } = useTranslation();
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const hasTimeline = currentItem ? mediaHasTimeline(currentItem) : false;
  const hasSlides = currentItem ? mediaHasSlides(currentItem) : totalSlides > 0;
  const isPlaying = status === "playing";
  const isActive = isPlaying || status === "paused";

  // Nothing to show at all
  if (!currentItem && totalSlides === 0 && !isBibleProjection) return null;

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
          {!isBibleProjection && hasSlides && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onPrevSlide}
                  disabled={activeSlideIndex === 0}
                  aria-label={t("playingNow.prevSlide")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("playingNow.prevSlide")}</TooltipContent>
            </Tooltip>
          )}

          {hasTimeline && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevItem} aria-label={t("playingNow.prevQueue")}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("playingNow.prevQueue")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={isPlaying ? onPause : onPlay}
                    disabled={status === "loading"}
                    aria-label={isPlaying ? t("playingNow.pause") : t("playingNow.play")}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{isPlaying ? t("playingNow.pause") : t("playingNow.play")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextItem} aria-label={t("playingNow.nextQueue")}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("playingNow.nextQueue")}</TooltipContent>
              </Tooltip>
            </>
          )}

          {!isBibleProjection && hasSlides && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onNextSlide}
                  disabled={activeSlideIndex >= totalSlides - 1}
                  aria-label={t("playingNow.nextSlide")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("playingNow.nextSlide")}</TooltipContent>
            </Tooltip>
          )}

          {isActive && onRestart && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRestart} aria-label={t("shortcuts.items.restart")}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("shortcuts.items.restart")}</TooltipContent>
            </Tooltip>
          )}

          {onLoopToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isLooping ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={onLoopToggle}
                  aria-label={t("shortcuts.items.loop")}
                  aria-pressed={isLooping ?? false}
                >
                  {isLooping ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("shortcuts.items.loop")}</TooltipContent>
            </Tooltip>
          )}

          {isActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop} aria-label={t("playingNow.stop")}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("playingNow.stop")}</TooltipContent>
            </Tooltip>
          )}

          {/* Mode toggle (hymns only) */}
          {currentMode && onModeChange && (
            <div className="ml-2 flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentMode === "sung" ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onModeChange("sung")}
                    aria-label={t("playingNow.modeSung")}
                  >
                    <Mic className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("playingNow.modeSung")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentMode === "karaoke" ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onModeChange("karaoke")}
                    aria-label={t("playingNow.modeKaraoke")}
                  >
                    <Music2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("playingNow.modeKaraoke")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentMode === "silent" ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onModeChange("silent")}
                    aria-label={t("playingNow.modeSilent")}
                  >
                    <MonitorPlay className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("playingNow.modeSilent")}</TooltipContent>
              </Tooltip>
            </div>
          )}

          {isBibleProjection && (
            <div className="ml-2 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevSlide} aria-label="Previous verse">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Previous verse</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextSlide} aria-label="Next verse">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Next verse</TooltipContent>
              </Tooltip>
              {onGoToBible && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={onGoToBible}
                      aria-label={t("playingNow.goToBible")}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("playingNow.goToBible")}</TooltipContent>
                </Tooltip>
              )}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMuteToggle} aria-label={muted ? "Unmute" : "Mute"}>
                    {muted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{muted ? "Unmute" : "Mute"}</TooltipContent>
              </Tooltip>
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

