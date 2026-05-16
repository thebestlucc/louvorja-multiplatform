import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Eraser } from "lucide-react";
import { cn } from "../../lib/utils";
import { getWeekdayPatternDates } from "../../lib/schedules";

interface MonthPatternPickerProps {
  year: number;
  month: number;
  selectedDates: string[];
  disabled?: boolean;
  onToggleWeekdayPattern: (weekday: number) => void;
  onClearSelection: () => void;
}

const patternDefinitions = [
  { weekday: 0, labelKey: "utilities.schedules.patterns.allSundays" },
  { weekday: 3, labelKey: "utilities.schedules.patterns.allWednesdays" },
  { weekday: 6, labelKey: "utilities.schedules.patterns.allSaturdays" },
] as const;

export function MonthPatternPicker({
  year,
  month,
  selectedDates,
  disabled,
  onToggleWeekdayPattern,
  onClearSelection,
}: MonthPatternPickerProps) {
  const { t } = useTranslation();
  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  return (
    <div className="flex flex-col gap-0.5">
      {patternDefinitions.map((pattern) => {
        const patternDates = getWeekdayPatternDates(year, month, pattern.weekday);
        const isActive = patternDates.length > 0
          && patternDates.every((date) => selectedDateSet.has(date));

        return (
          <button
            key={pattern.weekday}
            type="button"
            disabled={disabled}
            onClick={() => onToggleWeekdayPattern(pattern.weekday)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:pointer-events-none disabled:opacity-50",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground",
            )}
          >
            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            <span>{t(pattern.labelKey)}</span>
          </button>
        );
      })}

      <div className="my-1 h-px bg-border/60" />

      <button
        type="button"
        disabled={disabled || selectedDates.length === 0}
        onClick={onClearSelection}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <Eraser className="h-3.5 w-3.5" />
        <span>{t("utilities.schedules.patterns.clear")}</span>
      </button>
    </div>
  );
}
