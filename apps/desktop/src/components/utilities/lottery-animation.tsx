import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

interface LotteryAnimationProps {
  isDrawing: boolean;
  winner: string | null;
  candidates: string[];
  emptyLabel?: string;
  className?: string;
  onDisplayValueChange?: (value: string | null) => void;
}

export function LotteryAnimation({
  isDrawing,
  winner,
  candidates,
  emptyLabel,
  className,
  onDisplayValueChange,
}: LotteryAnimationProps) {
  const [displayValue, setDisplayValue] = useState<string | null>(winner);
  const normalizedCandidates = useMemo(
    () => candidates.filter((value) => value.trim().length > 0),
    [candidates],
  );

  useEffect(() => {
    if (!isDrawing) {
      setDisplayValue(winner);
      return;
    }

    if (normalizedCandidates.length === 0) {
      setDisplayValue(null);
      return;
    }

    let index = 0;
    setDisplayValue(normalizedCandidates[0]);
    index = 1;
    const timer = window.setInterval(() => {
      setDisplayValue(normalizedCandidates[index % normalizedCandidates.length]);
      index += 1;
    }, 75);

    return () => window.clearInterval(timer);
  }, [isDrawing, normalizedCandidates, winner]);

  useEffect(() => {
    onDisplayValueChange?.(displayValue);
  }, [displayValue, onDisplayValueChange]);

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/30 bg-primary/10 px-4 py-6 text-center",
        className,
      )}
    >
      <p
        className={cn(
          "text-2xl font-semibold tracking-tight",
          !displayValue && "text-sm font-normal text-muted-foreground",
          isDrawing && "animate-pulse",
        )}
      >
        {displayValue ?? emptyLabel}
      </p>
    </div>
  );
}
