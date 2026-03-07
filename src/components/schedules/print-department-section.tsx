import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SchedulePrintSection } from "../../lib/schedule-print";
import { getScheduleDepartmentIcon } from "./department-meta";

interface PrintDepartmentSectionProps {
  locale: string;
  section: SchedulePrintSection;
}

function formatPrintDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}`;
}

function formatPrintDayLabel(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return {
      weekday: "",
      date: formatPrintDate(value),
    };
  }

  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" })
    .format(date)
    .replace(/,$/, "");

  return {
    weekday,
    date: formatPrintDate(value),
  };
}

export function PrintDepartmentSection({ locale, section }: PrintDepartmentSectionProps) {
  const { t } = useTranslation();
  const Icon = getScheduleDepartmentIcon(section.icon);
  const formatDayLabel = useMemo(
    () => (value: string) => formatPrintDayLabel(value, locale),
    [locale],
  );

  return (
    <article className="schedule-print-section overflow-hidden rounded-[20px] border border-slate-200 bg-white">
      <div className="h-2 w-full" style={{ backgroundColor: section.color }} />

      <div className="px-5 py-4">
        <header className="flex items-center gap-3 border-b border-slate-200 pb-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: section.color }}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold uppercase tracking-[0.16em] text-slate-900">
              {section.title}
            </h3>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {t("utilities.schedules.print.departmentDays", { count: section.entries.length })}
            </p>
          </div>
        </header>

        <div className="mt-4 space-y-2.5">
          {section.entries.map((entry) => {
            const dayLabel = formatDayLabel(entry.serviceDate);

            return (
              <div
                key={`${section.departmentId}-${entry.serviceDate}`}
                className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 px-3 py-2.5"
              >
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-1 text-[12px] tracking-[0.08em] text-slate-700">
                    {dayLabel.weekday ? (
                      <span className="font-semibold uppercase">{dayLabel.weekday}</span>
                    ) : null}
                    <span className="font-bold">{dayLabel.date}</span>
                  </div>
                {entry.label ? (
                  <div className="mt-1 text-[11px] text-slate-500">{entry.label}</div>
                ) : null}
                {entry.isResponsible ? (
                  <div className="mt-2 inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    {t("utilities.schedules.print.responsibleBadge")}
                  </div>
                ) : null}
                </div>

                <div className="min-w-0 self-center text-sm leading-6 text-slate-800">
                  {entry.assigneeNames.length > 0
                    ? entry.assigneeNames.join(" • ")
                    : t("utilities.schedules.print.unassigned")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
