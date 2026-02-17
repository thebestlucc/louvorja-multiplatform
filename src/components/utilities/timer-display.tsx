import type { TimerMode } from "../../types/utilities";
import { cn } from "../../lib/utils";
import { formatUtilityTimer } from "../../types/utilities";

interface TimerDisplayProps {
  timeMs: number;
  mode: TimerMode;
  size?: "small" | "large";
  className?: string;
}

export function TimerDisplay({
  timeMs,
  mode,
  size = "large",
  className,
}: TimerDisplayProps) {
  const safeTimeMs = Math.max(0, timeMs);
  const textClass = getTimerTextClass(mode, safeTimeMs);
  const sizeClass = size === "large"
    ? "text-5xl font-semibold tracking-tight sm:text-6xl"
    : "text-base font-medium tabular-nums";

  return (
    <p className={cn("tabular-nums transition-colors", textClass, sizeClass, className)}>
      {formatUtilityTimer(safeTimeMs, mode)}
    </p>
  );
}

function getTimerTextClass(mode: TimerMode, timeMs: number): string {
  if (mode !== "countdown") {
    return "text-foreground";
  }

  if (timeMs <= 10_000) {
    return "text-red-400";
  }
  if (timeMs <= 60_000) {
    return "text-yellow-300";
  }

  return "text-green-400";
}
