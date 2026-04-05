import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent } from "../ui/popover";
import { cn } from "../../lib/utils";

interface DatePickerProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
}

function formatDisplayDate(dateStr: string, locale: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T12:00:00");
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0 = Sunday, convert to Monday-based (0 = Monday)
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!value) return new Date();
    return new Date(value + "T12:00:00");
  }, [value]);

  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const displayText = value ? formatDisplayDate(value, i18n.language) : t("services.date");

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(
    new Date(viewYear, viewMonth, 1),
  );

  const weekdays = [
    t("services.calendar.weekdays.mon"),
    t("services.calendar.weekdays.tue"),
    t("services.calendar.weekdays.wed"),
    t("services.calendar.weekdays.thu"),
    t("services.calendar.weekdays.fri"),
    t("services.calendar.weekdays.sat"),
    t("services.calendar.weekdays.sun"),
  ];

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const handleSelectDay = useCallback(
    (day: number) => {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      onChange(iso);
      setOpen(false);
    },
    [viewYear, viewMonth, onChange],
  );

  const handleToggle = useCallback(() => {
    if (!open) {
      // Reset view to the selected date when opening
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
    setOpen((o) => !o);
  }, [open, parsed]);

  // Build day cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm font-mono text-muted-foreground transition-colors hover:border-border hover:bg-surface",
          className,
        )}
      >
        <Calendar className="h-3.5 w-3.5 text-primary/60" />
        <span className="capitalize">{displayText}</span>
      </button>

      {open && (
        <PopoverContent className="w-70 p-3" onClose={() => setOpen(false)}>
          {/* Month/Year header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              aria-label={t("services.calendar.prevMonth")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-foreground">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              aria-label={t("services.calendar.nextMonth")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0">
            {weekdays.map((wd) => (
              <div
                key={wd}
                className="flex h-8 items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground/60"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="h-8" />;
              }
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = iso === value;
              const isToday = iso === today;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : isToday
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-surface-hover",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
