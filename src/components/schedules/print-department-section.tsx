import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  collectEntryAssigneeNames,
  type SchedulePrintEntry,
  type SchedulePrintEntryDay,
  type SchedulePrintSection,
} from "../../lib/schedule-print";
import { getScheduleDepartmentIcon } from "./department-meta";

interface PrintDepartmentSectionProps {
  locale: string;
  section: SchedulePrintSection;
}

function withAlpha(color: string, alpha: number, fallback: string) {
  const normalized = color.trim().replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) {
    return fallback;
  }

  const hex = normalized.length === 3
    ? normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
    : normalized;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

function PrintEntryDayDetails({
  day,
  accentBorder,
}: {
  day: SchedulePrintEntryDay;
  accentBorder: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start gap-2">
        {day.label ? (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {day.label}
          </span>
        ) : null}
        {day.isResponsible ? (
          <span
            className="inline-flex rounded-full border bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-800"
            style={{ borderColor: accentBorder }}
          >
            {t("utilities.schedules.print.responsibleBadge")}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-[16px] leading-7 text-slate-700">
        {day.assigneeNames.length > 0 ? (
          day.assigneeNames.map((name, index) => (
            <Fragment key={`${day.serviceDate}-${name}`}>
              {index > 0 ? <span className="mx-2 text-slate-300">•</span> : null}
              <span className="font-semibold text-slate-950">{name}</span>
            </Fragment>
          ))
        ) : (
          <span className="italic text-slate-400">
            {t("utilities.schedules.print.unassigned")}
          </span>
        )}
      </div>
    </div>
  );
}

function PrintGroupedMembersRow({
  names,
  className,
}: {
  names: string[];
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={`min-w-0 text-[14px] leading-6 text-slate-700 ${className ?? ""}`}>
      {names.length > 0 ? (
        names.map((name, index) => (
          <Fragment key={`grouped-members-${name}-${index}`}>
            {index > 0 ? <span className="mx-2 text-slate-300">•</span> : null}
            <span className="font-semibold text-slate-950">{name}</span>
          </Fragment>
        ))
      ) : (
        <span className="italic text-slate-400">
          {t("utilities.schedules.print.unassigned")}
        </span>
      )}
    </div>
  );
}

function PrintGroupedDistinctMembers({
  entry,
}: {
  entry: SchedulePrintEntry;
}) {
  return (
    <div className="flex h-full flex-col">
      {entry.days.map((day, index) => (
        <div
          key={`grouped-members-${day.serviceDate}`}
          className={`flex min-h-0 flex-1 items-center ${
            index > 0 ? "border-t border-slate-200" : ""
          }`}
        >
          <PrintGroupedMembersRow
            names={day.assigneeNames}
            className="w-full py-2 text-[16px] leading-7"
          />
        </div>
      ))}
    </div>
  );
}

function PrintGroupedDateRail({
  startLabel,
  endLabel,
  dayCount,
  alignToMembers,
}: {
  startLabel: { weekday: string; date: string };
  endLabel: { weekday: string; date: string };
  dayCount: number;
  alignToMembers: boolean;
}) {
  if (!alignToMembers) {
    return (
      <>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
            {startLabel.weekday}
          </span>
          <span className="text-[16px] font-black tracking-[0.04em] text-slate-950">
            {startLabel.date}
          </span>
        </div>
        <div className="my-1.5 h-6 w-px rounded-full border-l border-dotted border-slate-400/70" />
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
            {endLabel.weekday}
          </span>
          <span className="text-[16px] font-black tracking-[0.04em] text-slate-950">
            {endLabel.date}
          </span>
        </div>
      </>
    );
  }

  const rowCount = Math.max(2, dayCount);

  return (
    <div
      className="relative grid h-full w-full"
      style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 border-l border-dotted border-slate-400/70"
        style={{
          maxHeight: "1.25rem",
        }}
      />

      <div
        className="flex items-center justify-center"
        style={{ gridRow: "1 / 2" }}
      >
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
            {startLabel.weekday}
          </span>
          <span className="text-[16px] font-black tracking-[0.04em] text-slate-950">
            {startLabel.date}
          </span>
        </div>
      </div>

      <div
        className="flex items-center justify-center"
        style={{ gridRow: `${rowCount} / ${rowCount + 1}` }}
      >
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
            {endLabel.weekday}
          </span>
          <span className="text-[16px] font-black tracking-[0.04em] text-slate-950">
            {endLabel.date}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PrintDepartmentSection({ locale, section }: PrintDepartmentSectionProps) {
  const { t } = useTranslation();
  const Icon = getScheduleDepartmentIcon(section.icon);
  const formatDayLabel = useMemo(
    () => (value: string) => formatPrintDayLabel(value, locale),
    [locale],
  );
  const accentSoft = withAlpha(section.color, 0.12, "rgba(148, 163, 184, 0.12)");
  const accentStrong = withAlpha(section.color, 0.2, "rgba(148, 163, 184, 0.2)");
  const accentBorder = withAlpha(section.color, 0.28, "rgba(148, 163, 184, 0.28)");
  const accentGradient =
    `linear-gradient(135deg, ${withAlpha(section.color, 0.18, accentSoft)} 0%, ${
      withAlpha(section.color, 0.08, "rgba(255, 255, 255, 0.88)")
    } 45%, rgba(255, 255, 255, 0.98) 100%)`;

  return (
    <article className="schedule-print-section rounded-[24px] border border-slate-200/90 bg-white p-3">
      <div className="px-1 pb-1">
        <header
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-[20px] border px-4 py-4"
          style={{
            background: accentGradient,
            borderColor: accentBorder,
          }}
        >
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]"
            style={{ backgroundColor: section.color }}
          >
            <Icon className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-[18px] font-black uppercase tracking-[0.12em] text-slate-950">
              {section.title}
            </h3>
            <div
              className="mt-2 h-[2px] w-16 rounded-full"
              style={{ backgroundColor: accentBorder }}
            />
          </div>

          <div
            className="inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.82)",
              borderColor: accentBorder,
            }}
          >
            {t("utilities.schedules.print.departmentDays", { count: section.dayCount })}
          </div>
        </header>

        <div className="mt-3 space-y-2.5">
          {section.entries.map((entry) => {
            const startLabel = formatDayLabel(entry.startDate);
            const endLabel = formatDayLabel(entry.endDate);
            const isGroupedEntry = entry.days.length > 1;
            const shouldShowRepeatedGroupSummary = isGroupedEntry && section.repeatMembersInGroupedDates;
            const shouldShowDistinctGroupedMembers = isGroupedEntry && !section.repeatMembersInGroupedDates;

            return (
              <div
                key={`${section.departmentId}-${entry.startDate}-${entry.endDate}`}
                className={`grid overflow-hidden rounded-[18px] border border-slate-200/90 bg-white ${
                  isGroupedEntry
                    ? "grid-cols-[7.4rem_minmax(0,1fr)]"
                    : "grid-cols-[7.4rem_minmax(0,1fr)]"
                }`}
              >
                <div
                  className={`flex h-full flex-col items-center justify-center text-center ${
                    isGroupedEntry ? "px-3 py-3" : "px-3 py-3"
                  }`}
                  style={{
                    background: `linear-gradient(180deg, ${accentStrong} 0%, ${accentSoft} 100%)`,
                    borderRight: `1px solid ${accentBorder}`,
                  }}
                >
                  {isGroupedEntry ? (
                    <PrintGroupedDateRail
                      startLabel={startLabel}
                      endLabel={endLabel}
                      dayCount={entry.days.length}
                      alignToMembers={shouldShowDistinctGroupedMembers}
                    />
                  ) : (
                    <>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                        {startLabel.weekday || "\u00A0"}
                      </div>
                      <div className="mt-1 text-[18px] font-black tracking-[0.08em] text-slate-950">
                        {startLabel.date}
                      </div>
                    </>
                  )}
                </div>

                <div className="min-w-0 px-4 py-3">
                  {shouldShowRepeatedGroupSummary ? (
                    <div className="flex h-full items-center">
                      <PrintGroupedMembersRow
                        names={collectEntryAssigneeNames(entry.days)}
                        className="text-[16px] leading-7"
                      />
                    </div>
                  ) : shouldShowDistinctGroupedMembers ? (
                    <PrintGroupedDistinctMembers entry={entry} />
                  ) : (
                    <div className="space-y-2.5">
                      {entry.days.map((day, index) => (
                        <div
                          key={`${section.departmentId}-${entry.startDate}-${day.serviceDate}`}
                          className={index > 0 ? "border-t border-slate-200 pt-2.5" : ""}
                        >
                          <PrintEntryDayDetails
                            day={day}
                            accentBorder={accentBorder}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
