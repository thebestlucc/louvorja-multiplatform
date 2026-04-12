import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface SeekSliderProps {
  position: number;
  duration: number;
  onSeek: (secs: number) => void;
  className?: string;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SeekSlider({ position, duration, onSeek, className }: SeekSliderProps) {
  const { t } = useTranslation();
  // Track local value during drag to avoid jumpy behavior
  const [localValue, setLocalValue] = useState<number | null>(null);
  const displayValue = localValue ?? position;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <input
        type="range"
        role="slider"
        aria-label={t("remote.queue.seek")}
        min={0}
        // TODO(review): max={duration || 1} — when duration=0 before media loads, slider shows
        // full range but position=0. Consider showing a disabled/loading state when duration=0.
        // (ring:business-logic-reviewer, 2026-04-12, Low)
        max={duration || 1}
        value={displayValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onPointerUp={(e) => {
          const val = Number((e.target as HTMLInputElement).value);
          setLocalValue(null);
          onSeek(val);
        }}
        className="w-full h-1.5 appearance-none rounded-full bg-border accent-primary cursor-pointer"
      />
      <div className="flex justify-between text-xs text-fg-muted tabular-nums">
        <span>{formatTime(displayValue)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
