import type { ScheduleDay, ScheduleDayDepartment, ScheduleMonthDetail } from "./bindings";
import { getScheduleDepartmentLabel } from "./schedule-departments";

const MM_TO_PX = 96 / 25.4;
const DEFAULT_PRINT_PAGE_CONTENT_HEIGHT_PX = (297 - 24) * MM_TO_PX;
const PRINT_SECTION_BASE_HEIGHT_PX = 124;
const PRINT_ENTRY_GAP_PX = 10;
const PRINT_ENTRY_VERTICAL_CHROME_PX = 24;
const PRINT_ENTRY_LINE_HEIGHT_PX = 28;
const PRINT_ENTRY_DATE_HEIGHT_PX = 18;
const PRINT_ENTRY_LABEL_HEIGHT_PX = 16;
const PRINT_ENTRY_RESPONSIBLE_HEIGHT_PX = 22;
const PRINT_ENTRY_CHARS_PER_LINE = 28;

export interface SchedulePrintEntry {
  serviceDate: string;
  label: string | null;
  assigneeNames: string[];
  isResponsible: boolean;
}

export interface SchedulePrintSection {
  departmentId: number;
  title: string;
  color: string;
  icon: string;
  entries: SchedulePrintEntry[];
  estimatedHeightPx: number;
}

export interface SchedulePrintPage {
  pageNumber: number;
  sections: SchedulePrintSection[];
}

export interface SchedulePrintPack {
  sections: SchedulePrintSection[];
  pages: SchedulePrintPage[];
}

function estimateEntryHeightPx(entry: SchedulePrintEntry) {
  const joinedNames = entry.assigneeNames.join(" • ").trim();
  const contentLength = joinedNames.length > 0 ? joinedNames.length : 12;
  const textLines = Math.max(1, Math.ceil(contentLength / PRINT_ENTRY_CHARS_PER_LINE));
  const rightColumnHeight = textLines * PRINT_ENTRY_LINE_HEIGHT_PX;
  let leftColumnHeight = PRINT_ENTRY_DATE_HEIGHT_PX;

  if (entry.label) {
    leftColumnHeight += PRINT_ENTRY_LABEL_HEIGHT_PX;
  }

  if (entry.isResponsible) {
    leftColumnHeight += PRINT_ENTRY_RESPONSIBLE_HEIGHT_PX;
  }

  return Math.max(leftColumnHeight, rightColumnHeight) + PRINT_ENTRY_VERTICAL_CHROME_PX;
}

function estimateSectionHeightPx(entries: SchedulePrintEntry[]) {
  return entries.reduce((total, entry, index) => {
    const gap = index === 0 ? 0 : PRINT_ENTRY_GAP_PX;
    return total + gap + estimateEntryHeightPx(entry);
  }, PRINT_SECTION_BASE_HEIGHT_PX);
}

function findDepartmentEntry(day: ScheduleDay, departmentId: number): ScheduleDayDepartment | undefined {
  return day.departments.find((department) => department.departmentId === departmentId);
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
      const entries = detail.days
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
          } satisfies SchedulePrintEntry;
        })
        .filter((entry): entry is SchedulePrintEntry => entry !== null);

      return {
        departmentId: department.id,
        title: getScheduleDepartmentLabel(department, locale),
        color: department.color,
        icon: department.icon,
        entries,
        estimatedHeightPx: estimateSectionHeightPx(entries),
      } satisfies SchedulePrintSection;
    })
    .filter((section) => section.entries.length > 0)
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

  for (const section of sections) {
    if (
      currentPageSections.length > 0
      && usedHeightPx + section.estimatedHeightPx > pageContentHeightPx
    ) {
      pages.push({
        pageNumber: pages.length + 1,
        sections: currentPageSections,
      });
      currentPageSections = [];
      usedHeightPx = 0;
    }

    currentPageSections.push(section);
    usedHeightPx += section.estimatedHeightPx;
  }

  if (currentPageSections.length > 0) {
    pages.push({
      pageNumber: pages.length + 1,
      sections: currentPageSections,
    });
  }

  return { sections, pages };
}
