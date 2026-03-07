export interface MonthGridCell {
  isoDate: string;
  dayNumber: number;
  weekday: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

function createUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(value: string | Date): string {
  if (typeof value === "string") {
    const dateMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
    return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
  }

  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

export function buildMonthGrid(year: number, month: number): MonthGridCell[][] {
  const firstDayOfMonth = createUtcDate(year, month, 1);
  const startOffset = firstDayOfMonth.getUTCDay();
  const gridStart = createUtcDate(year, month, 1 - startOffset);
  const todayIso = toIsoDate(new Date());
  const weeks: MonthGridCell[][] = [];

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: MonthGridCell[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = createUtcDate(
        gridStart.getUTCFullYear(),
        gridStart.getUTCMonth() + 1,
        gridStart.getUTCDate() + weekIndex * 7 + dayIndex,
      );
      const isoDate = toIsoDate(date);
      week.push({
        isoDate,
        dayNumber: date.getUTCDate(),
        weekday: date.getUTCDay(),
        inCurrentMonth: date.getUTCMonth() === month - 1,
        isToday: isoDate === todayIso,
      });
    }
    weeks.push(week);
  }

  return weeks;
}

export function getWeekdayPatternDates(
  year: number,
  month: number,
  weekday: number,
): string[] {
  const daysInMonth = createUtcDate(year, month + 1, 0).getUTCDate();
  const patternDates: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = createUtcDate(year, month, day);
    if (date.getUTCDay() === weekday) {
      patternDates.push(toIsoDate(date));
    }
  }

  return patternDates;
}

export function toggleSelectedDate(
  selectedDates: readonly (string | Date)[],
  nextDate: string | Date,
): string[] {
  const normalizedNextDate = toIsoDate(nextDate);
  const nextSelectedDates = new Set(selectedDates.map((date) => toIsoDate(date)));

  if (nextSelectedDates.has(normalizedNextDate)) {
    nextSelectedDates.delete(normalizedNextDate);
  } else {
    nextSelectedDates.add(normalizedNextDate);
  }

  return Array.from(nextSelectedDates).sort();
}
