import { useTranslation } from "react-i18next";
import { Play, Pause, Square, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "../../hooks/use-audio";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import type { PlaybackMode } from "../../types/audio";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const PLAYBACK_MODES: PlaybackMode[] = ["sung", "karaoke", "silent"];

interface AudioControlsProps {
  filePath: string;
  onBeforePlay?: () => Promise<void> | void;
}

export function AudioControls({ filePath, onBeforePlay }: AudioControlsProps) {
  const { t } = useTranslation();
  const {
    play,
    stop,
    togglePlayPause,
    seek,
    setVolume,
    status,
    positionMs,
    durationMs,
    volume,
    playbackMode,
    setPlaybackMode,
  } = useAudio();

  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const isActive = isPlaying || isPaused;
  const isMuted = volume === 0;

  const handlePlay = async () => {
    if (isActive) {
      await togglePlayPause();
    } else {
      await onBeforePlay?.();
      await play(filePath);
    }
  };

  const handleStop = async () => {
    await stop();
  };

  const handleSeek = (value: number[]) => {
    if (value[0] != null) {
      seek(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (value[0] != null) {
      setVolume(value[0] / 100);
    }
  };

  const handleMuteToggle = () => {
    setVolume(isMuted ? 1 : 0);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(positionMs)}
        </span>
        <Slider
          value={[positionMs]}
          min={0}
          max={durationMs || 1}
          step={100}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handlePlay}>
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleStop}
          disabled={!isActive}
        >
          <Square className="h-4 w-4" />
        </Button>

        {/* Volume */}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleMuteToggle}>
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[volume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>

        {/* Playback mode selector */}
        <div className="flex items-center gap-1 rounded-md border border-border">
          {PLAYBACK_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setPlaybackMode(mode)}
              className={`px-2 py-1 text-xs transition-colors ${
                playbackMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              } ${mode === "sung" ? "rounded-l-md" : ""} ${mode === "silent" ? "rounded-r-md" : ""}`}
            >
              {t(`audio.${mode}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
