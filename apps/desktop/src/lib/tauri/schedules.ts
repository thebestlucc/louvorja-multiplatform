import { invoke } from "@tauri-apps/api/core";
import type {
  ScheduleAssignmentInput,
  ScheduleDayInput,
  ScheduleDepartment,
  ScheduleDepartmentInput,
  ScheduleGenerationRequest,
  ScheduleMonthDetail,
} from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Schedules
export async function listScheduleDepartments(): Promise<ScheduleDepartment[]> {
  return tauriInvoke<ScheduleDepartment[]>("list_schedule_departments");
}

export async function saveScheduleDepartment(input: ScheduleDepartmentInput): Promise<ScheduleDepartment> {
  return tauriInvoke<ScheduleDepartment>("save_schedule_department", { input });
}

export async function deleteScheduleDepartment(id: number): Promise<void> {
  return tauriInvoke<void>("delete_schedule_department", { id });
}

export async function reorderScheduleDepartments(departmentIds: number[]): Promise<void> {
  return tauriInvoke<void>("reorder_schedule_departments", { departmentIds });
}

export async function replaceScheduleDepartmentMembers(
  departmentId: number,
  members: string[],
): Promise<void> {
  return tauriInvoke<void>("replace_schedule_department_members", { departmentId, members });
}

export async function getScheduleMonth(year: number, month: number): Promise<ScheduleMonthDetail> {
  return tauriInvoke<ScheduleMonthDetail>("get_schedule_month", { year, month });
}

export async function saveScheduleMonthDays(
  year: number,
  month: number,
  days: ScheduleDayInput[],
): Promise<ScheduleMonthDetail> {
  return tauriInvoke<ScheduleMonthDetail>("save_schedule_month_days", { year, month, days });
}

export async function generateScheduleMonth(
  input: ScheduleGenerationRequest,
): Promise<ScheduleMonthDetail> {
  return tauriInvoke<ScheduleMonthDetail>("generate_schedule_month", { input });
}

export async function setScheduleDayResponsibleDepartment(
  scheduleDayId: number,
  responsibleDepartmentId: number | null,
): Promise<void> {
  return tauriInvoke<void>("set_schedule_day_responsible_department", {
    scheduleDayId,
    responsibleDepartmentId,
  });
}

export async function saveScheduleDayAssignments(
  input: ScheduleAssignmentInput,
): Promise<void> {
  return tauriInvoke<void>("save_schedule_day_assignments", { input });
}

export async function updateScheduleDayDepartmentPeoplePerDay(
  scheduleDayDepartmentId: number,
  peoplePerDay: number,
): Promise<void> {
  return tauriInvoke<void>("update_schedule_day_department_people_per_day", {
    scheduleDayDepartmentId,
    peoplePerDay,
  });
}

export async function resetScheduleDayDepartmentManualOverride(
  scheduleDayDepartmentId: number,
): Promise<void> {
  return tauriInvoke<void>("reset_schedule_day_department_manual_override", {
    scheduleDayDepartmentId,
  });
}
