import { SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TransportBarProps {
  isPlaying: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onBlack: () => void;
  onFreeze: () => void;
  blackActive: boolean;
  frozenActive: boolean;
  className?: string;
}

export function TransportBar({
  isPlaying,
  onPrev,
  onPlayPause,
  onNext,
  onBlack,
  onFreeze,
  blackActive,
  frozenActive,
  className,
}: TransportBarProps) {
  return (
    <div
      className={cn(
        "h-16 flex items-center justify-between px-4 gap-3 border-t border-border bg-surface flex-shrink-0",
        className,
      )}
    >
      {/* Left: transport controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous slide"
          onClick={onPrev}
          className="h-10 w-10"
        >
          <SkipBack className="h-5 w-5" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
          className="h-10 w-10"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Next slide"
          onClick={onNext}
          className="h-10 w-10"
        >
          <SkipForward className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: overlay pills */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Black screen"
          aria-pressed={blackActive}
          onClick={onBlack}
          className={cn(
            blackActive && "bg-fg text-background border-fg",
          )}
        >
          Black
        </Button>

        <Button
          variant="outline"
          size="sm"
          aria-label="Freeze screen"
          aria-pressed={frozenActive}
          onClick={onFreeze}
          className={cn(
            frozenActive && "bg-fg text-background border-fg",
          )}
        >
          Freeze
        </Button>
      </div>
    </div>
  );
}
