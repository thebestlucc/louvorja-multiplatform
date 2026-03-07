import type { ScheduleDay, ScheduleDayDepartment, ScheduleMonthDetail } from "./bindings";
import { getScheduleDepartmentLabel } from "./schedule-departments";

const DEFAULT_PAGE_CAPACITY = 28;

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
  estimatedUnits: number;
}

export interface SchedulePrintPage {
  pageNumber: number;
  sections: SchedulePrintSection[];
}

export interface SchedulePrintPack {
  sections: SchedulePrintSection[];
  pages: SchedulePrintPage[];
}

function estimateSectionUnits(entries: SchedulePrintEntry[]) {
  return entries.reduce((total, entry) => {
    const lineUnits = Math.max(1, Math.ceil(Math.max(entry.assigneeNames.length, 1) / 2));
    return total + lineUnits;
  }, 4);
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
  options?: { pageCapacity?: number },
): SchedulePrintPack {
  const selectedSet = new Set(selectedDepartmentIds ?? []);
  const hasExplicitSelection = selectedDepartmentIds !== undefined;
  const selectedOrder = new Map(
    (selectedDepartmentIds ?? []).map((departmentId, index) => [departmentId, index]),
  );
  const pageCapacity = options?.pageCapacity ?? DEFAULT_PAGE_CAPACITY;

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
        estimatedUnits: estimateSectionUnits(entries),
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
  let usedUnits = 0;

  for (const section of sections) {
    if (currentPageSections.length > 0 && usedUnits + section.estimatedUnits > pageCapacity) {
      pages.push({
        pageNumber: pages.length + 1,
        sections: currentPageSections,
      });
      currentPageSections = [];
      usedUnits = 0;
    }

    currentPageSections.push(section);
    usedUnits += section.estimatedUnits;
  }

  if (currentPageSections.length > 0) {
    pages.push({
      pageNumber: pages.length + 1,
      sections: currentPageSections,
    });
  }

  return { sections, pages };
}
