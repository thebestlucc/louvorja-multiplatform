import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listScheduleDepartments,
  saveScheduleDepartment,
  deleteScheduleDepartment,
  reorderScheduleDepartments,
  replaceScheduleDepartmentMembers,
  getScheduleMonth,
  saveScheduleMonthDays,
  generateScheduleMonth,
  setScheduleDayResponsibleDepartment,
  saveScheduleDayAssignments,
  updateScheduleDayDepartmentPeoplePerDay,
  resetScheduleDayDepartmentManualOverride,
} from "../tauri";
import type {
  ScheduleAssignmentInput,
  ScheduleDayInput,
  ScheduleDepartmentInput,
  ScheduleGenerationRequest,
} from "../bindings";
import { queryKeys } from "./keys";

function invalidateScheduleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  month?: { year: number; month: number },
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.schedule.departments });
  if (month) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.month(month.year, month.month),
    });
    return;
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all });
}

export function useScheduleDepartments() {
  return useQuery({
    queryKey: queryKeys.schedule.departments,
    queryFn: () => listScheduleDepartments(),
  });
}

export function useScheduleMonth(year: number, month: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.schedule.month(year, month),
    queryFn: () => getScheduleMonth(year, month),
    enabled: (options?.enabled ?? true) && year > 0 && month >= 1 && month <= 12,
  });
}

export function useSaveScheduleDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleDepartmentInput) => saveScheduleDepartment(input),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useDeleteScheduleDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteScheduleDepartment(id),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useReorderScheduleDepartments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (departmentIds: number[]) => reorderScheduleDepartments(departmentIds),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useReplaceScheduleDepartmentMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { departmentId: number; members: string[] }) =>
      replaceScheduleDepartmentMembers(vars.departmentId, vars.members),
    onSuccess: () => {
      invalidateScheduleQueries(queryClient);
    },
  });
}

export function useSaveScheduleMonthDays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { year: number; month: number; days: ScheduleDayInput[] }) =>
      saveScheduleMonthDays(vars.year, vars.month, vars.days),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useGenerateScheduleMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleGenerationRequest) => generateScheduleMonth(input),
    onSuccess: (_, input) => {
      invalidateScheduleQueries(queryClient, { year: input.year, month: input.month });
    },
  });
}

export function useSetScheduleDayResponsibleDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      scheduleDayId: number;
      responsibleDepartmentId: number | null;
      year: number;
      month: number;
    }) =>
      setScheduleDayResponsibleDepartment(
        vars.scheduleDayId,
        vars.responsibleDepartmentId,
      ),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useSaveScheduleDayAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { year: number; month: number; input: ScheduleAssignmentInput }) =>
      saveScheduleDayAssignments(vars.input),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useUpdateScheduleDayDepartmentPeoplePerDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      year: number;
      month: number;
      scheduleDayDepartmentId: number;
      peoplePerDay: number;
    }) =>
      updateScheduleDayDepartmentPeoplePerDay(
        vars.scheduleDayDepartmentId,
        vars.peoplePerDay,
      ),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}

export function useResetScheduleDayDepartmentManualOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { year: number; month: number; scheduleDayDepartmentId: number }) =>
      resetScheduleDayDepartmentManualOverride(vars.scheduleDayDepartmentId),
    onSuccess: (_, vars) => {
      invalidateScheduleQueries(queryClient, { year: vars.year, month: vars.month });
    },
  });
}
