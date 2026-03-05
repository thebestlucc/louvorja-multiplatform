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

const PLAYBACK_MODES: PlaybackMode[] = ["sung", "karaoke"];

interface AudioControlsProps {
  /** Sung/cantado audio file path */
  filePath: string;
  /** Karaoke/playback audio file path (falls back to filePath if not provided) */
  playbackPath?: string | null;
  onBeforePlay?: () => Promise<void> | void;
}

export function AudioControls({ filePath, playbackPath, onBeforePlay }: AudioControlsProps) {
  const { t } = useTranslation();
  const {
    play,
    stop,
    resume,
    pause,
    seek,
    setVolume,
    status,
    currentFile,
    positionMs,
    durationMs,
    volume,
    playbackMode,
    setPlaybackMode,
  } = useAudio();

  // Determine which audio file this component should play based on mode
  const targetFile = playbackMode === "karaoke" 
    ? (playbackPath ?? filePath) 
    : filePath;

  // Check if THIS hymn's audio is currently active (playing or paused)
  const isThisHymnActive = currentFile === filePath || currentFile === playbackPath;
  const isPlaying = status === "playing" && isThisHymnActive;
  const isPaused = status === "paused" && isThisHymnActive;
  const isMuted = volume === 0;

  // Show position/duration only for this hymn's audio, otherwise show 0
  const displayPosition = isThisHymnActive ? positionMs : 0;
  const displayDuration = isThisHymnActive ? durationMs : 0;

  const handlePlay = async () => {
    if (isPaused) {
      await resume();
    } else if (isPlaying) {
      await pause();
    } else {
      // Stop any currently playing audio before starting this one
      if (status === "playing" || status === "paused") {
        await stop();
      }
      await onBeforePlay?.();
      await play(targetFile);
    }
  };

  const handleStop = async () => {
    await stop();
  };

  const handleSeek = (value: number[]) => {
    if (value[0] != null && isThisHymnActive) {
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

  const changePlaybackMode = async (mode: PlaybackMode) => {
    if (playbackMode === mode) return;
    
    setPlaybackMode(mode);
    
    // If THIS hymn is currently playing/paused, switch the file while preserving timestamp
    if (isThisHymnActive) {
      const nextFile = mode === "karaoke" ? (playbackPath ?? filePath) : filePath;
      if (nextFile !== currentFile) {
        // Capture current position before switching
        const currentPos = positionMs;
        await play(nextFile, currentPos);
        
        // If it was paused, pause the new one too (play() starts playing)
        if (isPaused) {
          await pause();
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(displayPosition)}
        </span>
        <Slider
          value={[displayPosition]}
          min={0}
          max={displayDuration || 1}
          step={100}
          onValueChange={handleSeek}
          disabled={!isThisHymnActive}
          className="flex-1"
        />
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatTime(displayDuration)}
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
          disabled={!isThisHymnActive}
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
          {PLAYBACK_MODES.map((mode) => {
            const isAvailable = mode === "sung" ? !!filePath : !!playbackPath;
            return (
              <button
                key={mode}
                disabled={!isAvailable}
                onClick={() => changePlaybackMode(mode)}
                className={`px-2 py-1 text-xs transition-colors disabled:opacity-30 ${
                  playbackMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${mode === "sung" ? "rounded-l-md" : ""} ${mode === "karaoke" ? "rounded-r-md" : ""}`}
              >
                {t(`audio.${mode}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
