import type { ScheduleDay, ScheduleDayDepartment, ScheduleMonthDetail } from "./bindings";
import { getScheduleDepartmentLabel } from "./schedule-departments";

const MM_TO_PX = 96 / 25.4;
const PRINT_PAGE_HEADER_HEIGHT_PX = 58;
const DEFAULT_PRINT_PAGE_CONTENT_HEIGHT_PX = ((297 - 24) * MM_TO_PX) - PRINT_PAGE_HEADER_HEIGHT_PX;
const PRINT_SECTION_BASE_HEIGHT_PX = 46;
const PRINT_ENTRY_GAP_PX = 2;
const PRINT_ENTRY_VERTICAL_CHROME_PX = 14;
const PRINT_ENTRY_SUBDAY_GAP_PX = 5;
const PRINT_ENTRY_LINE_HEIGHT_PX = 22;
const PRINT_ENTRY_META_LINE_HEIGHT_PX = 16;
const PRINT_ENTRY_DATE_RAIL_SINGLE_HEIGHT_PX = 24;
const PRINT_ENTRY_DATE_RAIL_GROUPED_HEIGHT_PX = 42;
const PRINT_ENTRY_CHARS_PER_LINE = 36;

export interface SchedulePrintEntryDay {
  serviceDate: string;
  label: string | null;
  assigneeNames: string[];
  isResponsible: boolean;
}

export interface SchedulePrintEntry {
  startDate: string;
  endDate: string;
  days: SchedulePrintEntryDay[];
}

export interface SchedulePrintSection {
  departmentId: number;
  title: string;
  color: string;
  icon: string;
  dayCount: number;
  repeatMembersInGroupedDates: boolean;
  description: string | null;
  entries: SchedulePrintEntry[];
  estimatedHeightPx: number;
}

export interface SchedulePrintPage {
  pageNumber: number;
  sections: SchedulePrintSection[];
  bottomDescription: string | null;
  bottomDescriptionColor: string | null;
}

export interface SchedulePrintPack {
  sections: SchedulePrintSection[];
  pages: SchedulePrintPage[];
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function areConsecutiveDates(left: string, right: string) {
  const leftDate = parseIsoDate(left);
  const rightDate = parseIsoDate(right);
  if (leftDate === null || rightDate === null) {
    return false;
  }

  return rightDate - leftDate === 24 * 60 * 60 * 1000;
}

function estimateEntryDayHeightPx(entryDay: SchedulePrintEntryDay) {
  const joinedNames = entryDay.assigneeNames.join(" • ").trim();
  const contentLength = joinedNames.length > 0 ? joinedNames.length : 12;
  const textLines = Math.max(1, Math.ceil(contentLength / PRINT_ENTRY_CHARS_PER_LINE));
  let height = textLines * PRINT_ENTRY_LINE_HEIGHT_PX;

  if (entryDay.label || entryDay.isResponsible) {
    height += PRINT_ENTRY_META_LINE_HEIGHT_PX;
  }

  return height;
}

function estimateNamesLineHeightPx(names: string[]) {
  const joinedNames = names.join(" • ").trim();
  const contentLength = joinedNames.length > 0 ? joinedNames.length : 12;
  const textLines = Math.max(1, Math.ceil(contentLength / PRINT_ENTRY_CHARS_PER_LINE));
  return textLines * PRINT_ENTRY_LINE_HEIGHT_PX;
}

export function collectEntryAssigneeNames(days: SchedulePrintEntryDay[]) {
  const seenNames = new Set<string>();
  const names: string[] = [];

  for (const day of days) {
    for (const name of day.assigneeNames) {
      const normalizedName = name.trim();
      if (!normalizedName || seenNames.has(normalizedName)) {
        continue;
      }

      seenNames.add(normalizedName);
      names.push(normalizedName);
    }
  }

  return names;
}

function estimateGroupedCollapsedHeightPx(entry: SchedulePrintEntry) {
  const groupedNames = collectEntryAssigneeNames(entry.days);
  return estimateNamesLineHeightPx(groupedNames);
}

function estimateGroupedDistinctMembersHeightPx(entry: SchedulePrintEntry) {
  return entry.days.reduce((total, day, index) => {
    const gap = index === 0 ? 0 : PRINT_ENTRY_SUBDAY_GAP_PX;
    return total + gap + estimateNamesLineHeightPx(day.assigneeNames);
  }, 0);
}

function estimateEntryHeightPx(entry: SchedulePrintEntry, repeatMembersInGroupedDates: boolean) {
  const rightColumnHeight = entry.days.length > 1
    ? repeatMembersInGroupedDates
      ? estimateGroupedCollapsedHeightPx(entry)
      : estimateGroupedDistinctMembersHeightPx(entry)
    : entry.days.reduce((total, day, index) => {
      const gap = index === 0 ? 0 : PRINT_ENTRY_SUBDAY_GAP_PX;
      return total + gap + estimateEntryDayHeightPx(day);
    }, 0);
  const leftColumnHeight = entry.days.length > 1
    ? PRINT_ENTRY_DATE_RAIL_GROUPED_HEIGHT_PX
    : PRINT_ENTRY_DATE_RAIL_SINGLE_HEIGHT_PX;

  return Math.max(leftColumnHeight, rightColumnHeight) + PRINT_ENTRY_VERTICAL_CHROME_PX;
}

function estimateDescriptionHeightPx(description: string | null | undefined) {
  if (!description || description.trim().length === 0) {
    return 0;
  }

  const withBreaks = description.replace(/<\/(p|li|br)[^>]*>/gi, "\n");
  const text = withBreaks.replace(/<[^>]*>/g, "").trim();
  if (text.length === 0) {
    return 0;
  }

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const wrappedLines = lines.reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / 60));
  }, 0);
  return wrappedLines * 18 + 24;
}

function estimateSectionHeightPx(entries: SchedulePrintEntry[], repeatMembersInGroupedDates: boolean, description?: string | null) {
  const descriptionHeight = estimateDescriptionHeightPx(description);
  return entries.reduce((total, entry, index) => {
    const gap = index === 0 ? 0 : PRINT_ENTRY_GAP_PX;
    return total + gap + estimateEntryHeightPx(entry, repeatMembersInGroupedDates);
  }, PRINT_SECTION_BASE_HEIGHT_PX + descriptionHeight);
}

function cloneEntryFromDays(days: SchedulePrintEntryDay[]): SchedulePrintEntry {
  return {
    startDate: days[0]?.serviceDate ?? "",
    endDate: days[days.length - 1]?.serviceDate ?? "",
    days,
  };
}

function splitEntryByHeight(
  entry: SchedulePrintEntry,
  repeatMembersInGroupedDates: boolean,
  maxEntryHeightPx: number,
) {
  const entryHeightPx = estimateEntryHeightPx(entry, repeatMembersInGroupedDates);
  if (entryHeightPx <= maxEntryHeightPx || entry.days.length <= 1) {
    return [entry];
  }

  const parts: SchedulePrintEntry[] = [];
  let currentDays: SchedulePrintEntryDay[] = [];

  for (const day of entry.days) {
    const nextDays = [...currentDays, day];
    const nextEntry = cloneEntryFromDays(nextDays);
    if (
      currentDays.length > 0
      && estimateEntryHeightPx(nextEntry, repeatMembersInGroupedDates) > maxEntryHeightPx
    ) {
      parts.push(cloneEntryFromDays(currentDays));
      currentDays = [day];
      continue;
    }

    currentDays = nextDays;
  }

  if (currentDays.length > 0) {
    parts.push(cloneEntryFromDays(currentDays));
  }

  return parts;
}

function normalizeSectionEntriesForPagination(
  section: SchedulePrintSection,
  pageContentHeightPx: number,
) {
  const maxEntryHeightPx = Math.max(1, pageContentHeightPx - PRINT_SECTION_BASE_HEIGHT_PX);

  return section.entries.flatMap((entry) =>
    splitEntryByHeight(entry, section.repeatMembersInGroupedDates, maxEntryHeightPx)
  );
}

function takeSectionFragment(
  section: SchedulePrintSection,
  entries: SchedulePrintEntry[],
  availableHeightPx: number,
  pageContentHeightPx: number,
) {
  if (entries.length === 0) {
    return null;
  }

  const firstEntryHeightPx = estimateEntryHeightPx(entries[0], section.repeatMembersInGroupedDates);
  const minimumHeightPx = PRINT_SECTION_BASE_HEIGHT_PX + firstEntryHeightPx;
  const canMoveToNextPage = availableHeightPx < pageContentHeightPx;

  if (canMoveToNextPage && minimumHeightPx > availableHeightPx) {
    return null;
  }

  const takenEntries: SchedulePrintEntry[] = [];
  let usedHeightPx = PRINT_SECTION_BASE_HEIGHT_PX;

  for (const entry of entries) {
    const entryHeightPx = estimateEntryHeightPx(entry, section.repeatMembersInGroupedDates);
    const gapPx = takenEntries.length === 0 ? 0 : PRINT_ENTRY_GAP_PX;

    if (
      takenEntries.length > 0
      && usedHeightPx + gapPx + entryHeightPx > availableHeightPx
    ) {
      break;
    }

    takenEntries.push(entry);
    usedHeightPx += gapPx + entryHeightPx;
  }

  if (takenEntries.length === 0) {
    takenEntries.push(entries[0]);
    usedHeightPx = estimateSectionHeightPx(
      takenEntries,
      section.repeatMembersInGroupedDates,
    );
  }

  return {
    section: {
      ...section,
      entries: takenEntries,
      estimatedHeightPx: usedHeightPx,
    } satisfies SchedulePrintSection,
    remainingEntries: entries.slice(takenEntries.length),
  };
}

function findDepartmentEntry(day: ScheduleDay, departmentId: number): ScheduleDayDepartment | undefined {
  return day.departments.find((department) => department.departmentId === departmentId);
}

function groupEntryDays(days: SchedulePrintEntryDay[], groupDatesInPrint: boolean) {
  if (!groupDatesInPrint) {
    return days.map((day) => ({
      startDate: day.serviceDate,
      endDate: day.serviceDate,
      days: [day],
    }) satisfies SchedulePrintEntry);
  }

  const entries: SchedulePrintEntry[] = [];
  let currentDays: SchedulePrintEntryDay[] = [];

  for (const day of days) {
    const lastDay = currentDays[currentDays.length - 1];
    if (!lastDay || areConsecutiveDates(lastDay.serviceDate, day.serviceDate)) {
      currentDays.push(day);
      continue;
    }

    entries.push({
      startDate: currentDays[0]?.serviceDate ?? day.serviceDate,
      endDate: currentDays[currentDays.length - 1]?.serviceDate ?? day.serviceDate,
      days: currentDays,
    });
    currentDays = [day];
  }

  if (currentDays.length > 0) {
    entries.push({
      startDate: currentDays[0]?.serviceDate ?? "",
      endDate: currentDays[currentDays.length - 1]?.serviceDate ?? "",
      days: currentDays,
    });
  }

  return entries;
}

export function getPrintableDepartmentIds(detail: ScheduleMonthDetail) {
  const ids: number[] = [];

  for (const department of detail.departments) {
    if (!department.isActive) {
      continue;
    }

    const hasEntries = detail.days.some((day) => Boolean(findDepartmentEntry(day, department.id)));
    if (hasEntries) {
      ids.push(department.id);
    }
  }

  return ids;
}

export function buildSchedulePrintPack(
  detail: ScheduleMonthDetail,
  selectedDepartmentIds: number[] | undefined,
  locale: string,
  options?: { pageContentHeightPx?: number },
): SchedulePrintPack {
  const selectedSet = new Set(selectedDepartmentIds ?? []);
  const hasExplicitSelection = selectedDepartmentIds !== undefined;
  const selectedOrder = new Map(
    (selectedDepartmentIds ?? []).map((departmentId, index) => [departmentId, index]),
  );
  const pageContentHeightPx = options?.pageContentHeightPx ?? DEFAULT_PRINT_PAGE_CONTENT_HEIGHT_PX;

  const sections = detail.departments
    .filter((department) => department.isActive)
    .filter((department) => !hasExplicitSelection || selectedSet.has(department.id))
    .map((department) => {
      const entryDays = detail.days
        .slice()
        .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate))
        .map((day) => {
          const dayDepartment = findDepartmentEntry(day, department.id);
          if (!dayDepartment) {
            return null;
          }

          return {
            serviceDate: day.serviceDate,
            label: day.label,
            assigneeNames: dayDepartment.assignments
              .slice()
              .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id)
              .map((assignment) => assignment.member?.name)
              .filter((name): name is string => Boolean(name && name.trim().length > 0)),
            isResponsible: day.responsibleDepartmentId === department.id,
          } satisfies SchedulePrintEntryDay;
        })
        .filter((entry): entry is SchedulePrintEntryDay => entry !== null);
      const entries = groupEntryDays(entryDays, department.groupDatesInPrint);

      return {
        departmentId: department.id,
        title: getScheduleDepartmentLabel(department, locale),
        color: department.color,
        icon: department.icon,
        dayCount: entryDays.length,
        repeatMembersInGroupedDates: department.repeatMembersInGroupedDates,
        description: department.description ?? null,
        entries,
        estimatedHeightPx: estimateSectionHeightPx(entries, department.repeatMembersInGroupedDates, department.description),
      } satisfies SchedulePrintSection;
    })
    .filter((section) => section.dayCount > 0)
    .sort((left, right) => {
      if (!hasExplicitSelection) {
        return 0;
      }

      return (selectedOrder.get(left.departmentId) ?? Number.MAX_SAFE_INTEGER)
        - (selectedOrder.get(right.departmentId) ?? Number.MAX_SAFE_INTEGER);
    });

  const pages: SchedulePrintPage[] = [];
  let currentPageSections: SchedulePrintSection[] = [];
  let usedHeightPx = 0;
  let pendingDescription: string | null = null;
  let pendingDescriptionColor: string | null = null;

  function flushCurrentPage(attachDescription = true) {
    if (currentPageSections.length === 0) {
      return;
    }

    pages.push({
      pageNumber: pages.length + 1,
      sections: currentPageSections,
      bottomDescription: attachDescription ? pendingDescription : null,
      bottomDescriptionColor: attachDescription ? pendingDescriptionColor : null,
    });
    currentPageSections = [];
    usedHeightPx = 0;
    if (attachDescription) {
      pendingDescription = null;
      pendingDescriptionColor = null;
    }
  }

  for (const section of sections) {
    // Only start a new page if the section doesn't fit in the remaining space on the current page
    const availableForSection = pageContentHeightPx - usedHeightPx;
    const sectionFitsOnCurrentPage =
      currentPageSections.length === 0 || section.estimatedHeightPx <= availableForSection;
    if (!sectionFitsOnCurrentPage) {
      flushCurrentPage();
    }

    let remainingEntries = normalizeSectionEntriesForPagination(section, pageContentHeightPx);

    while (remainingEntries.length > 0) {
      const availableHeightPx = pageContentHeightPx - usedHeightPx;
      const fragment = takeSectionFragment(
        section,
        remainingEntries,
        availableHeightPx,
        pageContentHeightPx,
      );

      if (!fragment) {
        flushCurrentPage(false);
        continue;
      }

      currentPageSections.push(fragment.section);
      usedHeightPx += fragment.section.estimatedHeightPx;
      remainingEntries = fragment.remainingEntries;

      if (remainingEntries.length > 0) {
        flushCurrentPage(false);
      }
    }

    // All entries for this department are done — set pending description
    // It will be attached when this page is flushed (by next department or end)
    if (section.description) {
      pendingDescription = section.description;
      pendingDescriptionColor = section.color;
    }
  }

  flushCurrentPage();

  return { sections, pages };
}
