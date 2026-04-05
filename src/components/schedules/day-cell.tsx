import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleDay } from "../../lib/bindings";
import type { MonthGridCell } from "../../lib/schedules";
import { cn } from "../../lib/utils";
import { getScheduleDepartmentLabel } from "./department-meta";

interface DayCellProps {
  cell: MonthGridCell;
  locale: string;
  scheduleDay?: ScheduleDay;
  disabled?: boolean;
  onSelect: (isoDate: string) => void;
}

export function DayCell({ cell, locale, scheduleDay, disabled, onSelect }: DayCellProps) {
  const { t } = useTranslation();
  const isSelected = Boolean(scheduleDay);
  const responsibleLabel = useMemo(
    () => getScheduleDepartmentLabel(scheduleDay?.responsibleDepartment, locale),
    [locale, scheduleDay?.responsibleDepartment],
  );

  return (
    <button
      type="button"
      disabled={disabled || !cell.inCurrentMonth}
      aria-pressed={isSelected}
      onClick={() => onSelect(cell.isoDate)}
      className={cn(
        "flex min-h-28 w-full cursor-pointer flex-col rounded-xl border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
        cell.inCurrentMonth
          ? "border-border bg-background shadow-sm hover:border-primary/40 hover:bg-primary/5"
          : "border-transparent bg-surface/30 text-muted-foreground/40 opacity-40",
        isSelected && "border-primary/60 bg-gradient-to-br from-primary/12 to-primary/4 shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
            isSelected
              ? "bg-primary text-primary-foreground"
              : cell.inCurrentMonth
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {cell.dayNumber}
        </div>

        {scheduleDay?.departments.length ? (
          <div className="rounded-full bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
            {scheduleDay.departments.length}
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="text-[9px] font-medium uppercase leading-none tracking-[0.18em] text-muted-foreground/75">
          {t("utilities.schedules.responsibleDepartment.label")}
        </div>
        <div
          className={cn(
            "inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            isSelected
              ? "bg-primary/12 text-foreground"
              : "border border-dashed border-border/80 bg-surface text-muted-foreground",
          )}
        >
          <span className="max-w-full truncate">
            {isSelected ? responsibleLabel : t("utilities.schedules.responsibleDepartment.none")}
          </span>
        </div>
      </div>
    </button>
  );
}
