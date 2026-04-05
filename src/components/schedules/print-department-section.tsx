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

function createDayLabelFormatter(locale: string) {
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });

  return (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { weekday: "", date: formatPrintDate(value) };
    }

    return {
      weekday: weekdayFmt.format(date).replace(/,$/, ""),
      date: formatPrintDate(value),
    };
  };
}

function NamesDisplay({
  names,
  className,
}: {
  names: string[];
  className?: string;
}) {
  const { t } = useTranslation();

  if (names.length === 0) {
    return (
      <span className={`italic text-slate-400 ${className ?? ""}`}>
        {t("utilities.schedules.print.unassigned")}
      </span>
    );
  }

  return (
    <span className={className}>
      {names.map((name, index) => (
        <Fragment key={`name-${name}-${index}`}>
          {index > 0 ? <span className="mx-1.5 text-slate-300">&middot;</span> : null}
          <span className="font-semibold text-slate-900">{name}</span>
        </Fragment>
      ))}
    </span>
  );
}

export function PrintDepartmentSection({ locale, section }: PrintDepartmentSectionProps) {
  const Icon = getScheduleDepartmentIcon(section.icon);
  const formatDay = useMemo(() => createDayLabelFormatter(locale), [locale]);
  const accentRule = withAlpha(section.color, 0.3, "rgba(148, 163, 184, 0.3)");

  return (
    <article
      className="schedule-print-section border-l-[3px] pl-3"
      style={{ borderLeftColor: section.color }}
    >
      <div className="flex items-center gap-2 pb-2">
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white"
          style={{ backgroundColor: section.color }}
        >
          <Icon className="h-2.5 w-2.5" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-950">
          {section.title}
        </h3>
        <div className="h-px flex-1" style={{ backgroundColor: accentRule }} />
      </div>

      <div>
        {section.entries.map((entry, entryIndex) => {
          const startLabel = formatDay(entry.startDate);
          const endLabel = formatDay(entry.endDate);
          const isGrouped = entry.days.length > 1;
          const showCollapsed = isGrouped && section.repeatMembersInGroupedDates;
          const showDistinct = isGrouped && !section.repeatMembersInGroupedDates;

          return (
            <div
              key={`${section.departmentId}-${entry.startDate}-${entry.endDate}`}
              className={`py-1.5 ${entryIndex > 0 ? "border-t border-dashed border-slate-200" : ""}`}
            >
              {!isGrouped && entry.days[0] ? (
                <SingleDateRow
                  day={entry.days[0]}
                  dateLabel={startLabel}
                  accentColor={section.color}
                />
              ) : null}

              {showCollapsed ? (
                <GroupedCollapsedRow
                  startLabel={startLabel}
                  endLabel={endLabel}
                  days={entry.days}
                />
              ) : null}

              {showDistinct ? (
                <GroupedDistinctRows
                  entry={entry}
                  startLabel={startLabel}
                  endLabel={endLabel}
                  formatDay={formatDay}
                />
              ) : null}
            </div>
          );
        })}
      </div>

    </article>
  );
}

function InlineDateLabel({
  weekday,
  date,
}: {
  weekday: string;
  date: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
        {weekday || "\u00A0"}
      </span>
      <span className="text-sm font-black text-slate-900">{date}</span>
    </span>
  );
}

function MetaBadges({
  day,
  accentColor,
}: {
  day: SchedulePrintEntryDay;
  accentColor: string;
}) {
  const { t } = useTranslation();
  if (!day.label && !day.isResponsible) {
    return null;
  }

  return (
    <div className="mb-0.5 flex items-center gap-2">
      {day.label ? (
        <span className="rounded-full bg-slate-100 px-2 py-px text-[8px] font-medium text-slate-600">
          {day.label}
        </span>
      ) : null}
      {day.isResponsible ? (
        <span
          className="text-[8px] font-bold uppercase tracking-[0.18em]"
          style={{ color: accentColor }}
        >
          {t("utilities.schedules.print.responsibleBadge")}
        </span>
      ) : null}
    </div>
  );
}

function SingleDateRow({
  day,
  dateLabel,
  accentColor,
}: {
  day: SchedulePrintEntryDay;
  dateLabel: { weekday: string; date: string };
  accentColor: string;
}) {
  return (
    <div>
      <MetaBadges day={day} accentColor={accentColor} />
      <div className="flex items-baseline gap-3">
        <div className="w-20 shrink-0">
          <InlineDateLabel weekday={dateLabel.weekday} date={dateLabel.date} />
        </div>
        <NamesDisplay names={day.assigneeNames} className="text-sm leading-6" />
      </div>
    </div>
  );
}

function GroupedCollapsedRow({
  startLabel,
  endLabel,
  days,
}: {
  startLabel: { weekday: string; date: string };
  endLabel: { weekday: string; date: string };
  days: SchedulePrintEntryDay[];
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <InlineDateLabel weekday={startLabel.weekday} date={startLabel.date} />
        <span className="mx-0.5 text-[10px] text-slate-400">&mdash;</span>
        <InlineDateLabel weekday={endLabel.weekday} date={endLabel.date} />
      </div>
      <div className="mt-1 pl-1">
        <NamesDisplay
          names={collectEntryAssigneeNames(days)}
          className="text-sm leading-6"
        />
      </div>
    </div>
  );
}

function GroupedDistinctRows({
  entry,
  startLabel,
  endLabel,
  formatDay,
}: {
  entry: SchedulePrintEntry;
  startLabel: { weekday: string; date: string };
  endLabel: { weekday: string; date: string };
  formatDay: (value: string) => { weekday: string; date: string };
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <InlineDateLabel weekday={startLabel.weekday} date={startLabel.date} />
        <span className="mx-0.5 text-[10px] text-slate-400">&mdash;</span>
        <InlineDateLabel weekday={endLabel.weekday} date={endLabel.date} />
      </div>
      <div className="mt-1.5 space-y-1 border-l-2 border-slate-200 pl-3">
        {entry.days.map((day) => {
          const dayLabel = formatDay(day.serviceDate);
          return (
            <div key={day.serviceDate} className="flex items-baseline gap-2">
              <span className="w-11 shrink-0 text-[10px] font-bold text-slate-600">
                {dayLabel.date}
              </span>
              <NamesDisplay names={day.assigneeNames} className="text-sm leading-6" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renders department description HTML at page bottom.
 * Content is authored by the local desktop app user via Tiptap editor
 * (not from untrusted external sources), so innerHTML is safe here.
 */
export function PrintDescriptionBlock({
  html,
  accentColor,
}: {
  html: string;
  accentColor: string;
}) {
  const isEmpty = !html || html.replace(/<[^>]*>/g, "").trim().length === 0;
  if (isEmpty) {
    return null;
  }

  const panelBg = withAlpha(accentColor, 0.1, "rgba(148, 163, 184, 0.1)");

  return (
    <div
      className="px-5 py-3.5"
      style={{ borderTop: `3px solid ${accentColor}`, backgroundColor: panelBg }}
    >
      {/* eslint-disable-next-line react/no-danger -- content authored by local user via Tiptap */}
      <div
        className="schedule-print-description text-[10.5px] leading-[1.6] text-slate-700"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
