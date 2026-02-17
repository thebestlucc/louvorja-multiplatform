import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

interface ClockDisplayProps {
  date?: Date;
  use24Hour: boolean;
  showDate: boolean;
  size?: "small" | "large";
  className?: string;
}

export function ClockDisplay({
  date,
  use24Hour,
  showDate,
  size = "large",
  className,
}: ClockDisplayProps) {
  const [internalDate, setInternalDate] = useState(() => new Date());

  useEffect(() => {
    if (date) {
      return;
    }

    const timer = window.setInterval(() => {
      setInternalDate(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [date]);

  const activeDate = date ?? internalDate;
  const timeText = useMemo(
    () =>
      activeDate.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: !use24Hour,
      }),
    [activeDate, use24Hour],
  );
  const dateText = useMemo(
    () =>
      activeDate.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [activeDate],
  );
  const timeClass = size === "large"
    ? "text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
    : "text-lg font-semibold";
  const dateClass = size === "large"
    ? "mt-4 text-sm capitalize text-muted-foreground sm:text-base"
    : "mt-1 text-xs capitalize text-muted-foreground";

  return (
    <div className={cn("text-center", className)}>
      <p className={cn("tabular-nums", timeClass)}>{timeText}</p>
      {showDate && <p className={dateClass}>{dateText}</p>}
    </div>
  );
}
