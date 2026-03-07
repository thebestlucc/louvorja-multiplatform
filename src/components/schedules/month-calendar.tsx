import { useMemo } from "react";
import type { ScheduleDay } from "../../lib/bindings";
import { buildMonthGrid } from "../../lib/schedules";
import { DayCell } from "./day-cell";

interface MonthCalendarProps {
  year: number;
  month: number;
  locale: string;
  scheduleDays: ScheduleDay[];
  disabled?: boolean;
  onSelectDate: (isoDate: string) => void;
}

export function MonthCalendar({
  year,
  month,
  locale,
  scheduleDays,
  disabled,
  onSelectDate,
}: MonthCalendarProps) {
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 7 + index)).replace(".", ""),
    );
  }, [locale]);
  const scheduleDayByDate = useMemo(
    () => new Map(scheduleDays.map((day) => [day.serviceDate, day])),
    [scheduleDays],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {weekdayLabels.map((label) => (
          <div key={label} className="rounded-md px-2 py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {grid.flat().map((cell) => (
          <DayCell
            key={cell.isoDate}
            cell={cell}
            locale={locale}
            scheduleDay={scheduleDayByDate.get(cell.isoDate)}
            disabled={disabled}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
