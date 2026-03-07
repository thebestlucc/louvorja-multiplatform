import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Eraser, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        <span>{t("utilities.schedules.patterns.title")}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {patternDefinitions.map((pattern) => {
          const patternDates = getWeekdayPatternDates(year, month, pattern.weekday);
          const isActive = patternDates.length > 0
            && patternDates.every((date) => selectedDateSet.has(date));

          return (
            <Button
              key={pattern.weekday}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              disabled={disabled}
              onClick={() => onToggleWeekdayPattern(pattern.weekday)}
            >
              {t(pattern.labelKey)}
            </Button>
          );
        })}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || selectedDates.length === 0}
          onClick={onClearSelection}
        >
          <Eraser className="mr-2 h-3.5 w-3.5" />
          {t("utilities.schedules.patterns.clear")}
        </Button>
      </div>
    </div>
  );
}
