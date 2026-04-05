import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Users2 } from "lucide-react";
import { DayDetailsDialog } from "../../components/schedules/day-details-dialog";
import { DepartmentManagerDialog } from "../../components/schedules/department-manager-dialog";
import { MonthCalendar } from "../../components/schedules/month-calendar";
import { MonthToolbar } from "../../components/schedules/month-toolbar";
import { PrintPreviewDialog } from "../../components/schedules/print-preview-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import type {
  ScheduleDay,
  ScheduleDayDepartment,
  ScheduleDayInput,
  ScheduleDepartment,
  ScheduleMonthDetail,
} from "../../lib/bindings";
import { catcher } from "../../lib/catcher";
import { notify } from "../../lib/notifications";
import {
  useGenerateScheduleMonth,
  useReorderScheduleDepartments,
  useResetScheduleDayDepartmentManualOverride,
  useSaveScheduleDayAssignments,
  useSaveScheduleMonthDays,
  useScheduleDepartments,
  useScheduleMonth,
  useUpdateScheduleDayDepartmentPeoplePerDay,
} from "../../lib/queries";
import {
  addDepartmentToSelectedDays,
  buildDaySelectionFromLastStoredSchedule,
  getWeekdayPatternDates,
  toggleSelectedDate,
} from "../../lib/schedules";

export const Route = createFileRoute("/schedules/")({
  component: UtilitiesSchedulesPage,
});

function getInitialMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function toScheduleDayInput(day: ScheduleDay): ScheduleDayInput {
  return {
    serviceDate: day.serviceDate,
    label: day.label,
    sourceKind: day.sourceKind,
    responsibleDepartmentId: day.responsibleDepartmentId,
    departmentIds: day.departments.map((department) => department.departmentId),
  };
}

function buildDayInputs(
  existingDays: ScheduleDay[],
  nextSelectedDates: string[],
  sourceKind: "manual" | "weekday-pattern",
  defaultDepartmentIds: number[],
): ScheduleDayInput[] {
  const existingDaysByDate = new Map(existingDays.map((day) => [day.serviceDate, day]));
  const persistedDayInputs = existingDays
    .map((day) => toScheduleDayInput(day))
    .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate));
  const builtDayInputs: ScheduleDayInput[] = [];

  return nextSelectedDates
    .slice()
    .sort()
    .map((serviceDate) => {
      const existingDay = existingDaysByDate.get(serviceDate);
      if (existingDay) {
        const existingDayInput = toScheduleDayInput(existingDay);
        builtDayInputs.push(existingDayInput);
        return existingDayInput;
      }

      const inheritedDayInput = buildDaySelectionFromLastStoredSchedule({
        existingDays: persistedDayInputs,
        draftDays: builtDayInputs,
        serviceDate,
        sourceKind,
        defaultDepartmentIds,
      });
      builtDayInputs.push(inheritedDayInput);
      return inheritedDayInput;
    });
}

function buildUpdatedMonthInputs(
  existingDays: ScheduleDay[],
  update: (day: ScheduleDay) => ScheduleDayInput | null,
): ScheduleDayInput[] {
  return existingDays
    .map(update)
    .filter((day): day is ScheduleDayInput => day !== null)
    .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate));
}

function findDayDepartment(
  days: ScheduleDay[],
  scheduleDayDepartmentId: number,
): ScheduleDayDepartment | null {
  for (const day of days) {
    const department = day.departments.find((item) => item.id === scheduleDayDepartmentId);
    if (department) {
      return department;
    }
  }

  return null;
}

function UtilitiesSchedulesPage() {
  const { t, i18n } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth);
  const [visibleMonth, setVisibleMonth] = useState<ScheduleMonthDetail | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [isDepartmentManagerOpen, setIsDepartmentManagerOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [overwriteManual, setOverwriteManual] = useState(false);
  const {
    data: scheduleMonth,
    isLoading: isMonthLoading,
    refetch: refetchScheduleMonth,
  } = useScheduleMonth(currentMonth.year, currentMonth.month);
  const {
    data: departments,
    isLoading: areDepartmentsLoading,
    refetch: refetchDepartments,
  } = useScheduleDepartments();
  const saveScheduleMonthDays = useSaveScheduleMonthDays();
  const generateScheduleMonth = useGenerateScheduleMonth();
  const reorderScheduleDepartments = useReorderScheduleDepartments();
  const saveScheduleDayAssignments = useSaveScheduleDayAssignments();
  const updateScheduleDayDepartmentPeoplePerDay = useUpdateScheduleDayDepartmentPeoplePerDay();
  const resetScheduleDayDepartmentManualOverride = useResetScheduleDayDepartmentManualOverride();

  useEffect(() => {
    setVisibleMonth(scheduleMonth ?? null);
  }, [currentMonth.month, currentMonth.year, scheduleMonth]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: "long",
        year: "numeric",
      }).format(new Date(currentMonth.year, currentMonth.month - 1, 1)),
    [currentMonth.month, currentMonth.year, i18n.language],
  );

  const scheduleDays = visibleMonth?.days ?? [];
  const selectedDates = useMemo(
    () => scheduleDays.map((day) => day.serviceDate).sort(),
    [scheduleDays],
  );
  const activeDepartments = useMemo(
    () => (departments ?? []).filter((department) => department.isActive),
    [departments],
  );
  const defaultDepartmentIds = useMemo(
    () => activeDepartments.map((department) => department.id),
    [activeDepartments],
  );
  const departmentCount = departments?.length ?? 0;
  const selectedDayCount = scheduleDays.length;
  const isSavingDays = saveScheduleMonthDays.isPending;
  const isBusy = isSavingDays
    || generateScheduleMonth.isPending
    || reorderScheduleDepartments.isPending
    || saveScheduleDayAssignments.isPending
    || updateScheduleDayDepartmentPeoplePerDay.isPending
    || resetScheduleDayDepartmentManualOverride.isPending;
  const isLoading = isMonthLoading || areDepartmentsLoading;
  const activeDay = useMemo(
    () => selectedDayDate
      ? scheduleDays.find((day) => day.serviceDate === selectedDayDate) ?? null
      : null,
    [scheduleDays, selectedDayDate],
  );

  useEffect(() => {
    if (selectedDayDate && !scheduleDays.some((day) => day.serviceDate === selectedDayDate)) {
      setSelectedDayDate(null);
    }
  }, [scheduleDays, selectedDayDate]);

  const refreshMonthDetail = async () => {
    const result = await refetchScheduleMonth();
    if (result.data) {
      setVisibleMonth(result.data);
      return result.data;
    }

    return null;
  };

  const refreshAllScheduleData = async () => {
    const [monthResult] = await Promise.all([refetchScheduleMonth(), refetchDepartments()]);
    if (monthResult.data) {
      setVisibleMonth(monthResult.data);
      return monthResult.data;
    }

    return null;
  };

  const persistMonthDayInputs = async (days: ScheduleDayInput[]) => {
    const [result, error] = await catcher(
      saveScheduleMonthDays.mutateAsync({
        year: currentMonth.year,
        month: currentMonth.month,
        days,
      }),
      { notify: true },
    );

    if (error || !result) {
      return null;
    }

    setVisibleMonth(result);
    return result;
  };

  const persistSelectedDates = async (
    nextSelectedDates: string[],
    sourceKind: "manual" | "weekday-pattern",
  ) => {
    await persistMonthDayInputs(
      buildDayInputs(scheduleDays, nextSelectedDates, sourceKind, defaultDepartmentIds),
    );
  };

  const handleSelectDate = (isoDate: string) => {
    if (isBusy) {
      return;
    }

    const selectedDay = scheduleDays.find((day) => day.serviceDate === isoDate);
    if (selectedDay) {
      setSelectedDayDate(selectedDay.serviceDate);
      return;
    }

    void persistSelectedDates(toggleSelectedDate(selectedDates, isoDate), "manual");
  };

  const handleToggleWeekdayPattern = (weekday: number) => {
    if (isBusy) {
      return;
    }

    const patternDates = getWeekdayPatternDates(
      currentMonth.year,
      currentMonth.month,
      weekday,
    );
    const nextSelectedDateSet = new Set(selectedDates);
    const isPatternFullySelected = patternDates.length > 0
      && patternDates.every((serviceDate) => nextSelectedDateSet.has(serviceDate));

    if (isPatternFullySelected) {
      patternDates.forEach((serviceDate) => nextSelectedDateSet.delete(serviceDate));
    } else {
      patternDates.forEach((serviceDate) => nextSelectedDateSet.add(serviceDate));
    }

    void persistSelectedDates(
      Array.from(nextSelectedDateSet).sort(),
      "weekday-pattern",
    );
  };

  const handleClearSelection = () => {
    if (isBusy || selectedDates.length === 0) {
      return;
    }

    void persistSelectedDates([], "manual");
  };

  const handleGenerateMonth = async () => {
    const [result, error] = await catcher(
      generateScheduleMonth.mutateAsync({
        year: currentMonth.year,
        month: currentMonth.month,
        overwriteManual,
      }),
      { notify: true },
    );

    if (error || !result) {
      return;
    }

    setVisibleMonth(result);
    notify.success(t("utilities.schedules.generate.success"), {
      description: t("utilities.schedules.generate.successDescription", {
        count: result.days.length,
        month: monthLabel,
      }),
    });
  };

  const handleDepartmentCreated = async (department: ScheduleDepartment) => {
    if (!department.isActive || scheduleDays.length === 0) {
      return;
    }

    await persistMonthDayInputs(
      addDepartmentToSelectedDays(
        scheduleDays.map((day) => toScheduleDayInput(day)),
        department.id,
      ),
    );
  };

  const handlePersistDepartmentOrder = async (departmentIds: number[]) => {
    const [, error] = await catcher(
      reorderScheduleDepartments.mutateAsync(departmentIds),
      { notify: true },
    );
    if (error) {
      return false;
    }

    const result = await refreshAllScheduleData();
    return Boolean(result);
  };

  const handleSaveDaySettings = async (params: {
    serviceDate: string;
    responsibleDepartmentId: number | null;
    departmentIds: number[];
  }) => {
    const result = await persistMonthDayInputs(
      buildUpdatedMonthInputs(scheduleDays, (day) => {
        if (day.serviceDate !== params.serviceDate) {
          return toScheduleDayInput(day);
        }

        return {
          ...toScheduleDayInput(day),
          responsibleDepartmentId: params.responsibleDepartmentId,
          departmentIds: params.departmentIds,
        };
      }),
    );
    if (!result) {
      return;
    }

    notify.success(t("utilities.schedules.dayDetails.saveSuccess"));
  };

  const handleRemoveDay = async (serviceDate: string) => {
    const result = await persistMonthDayInputs(
      buildUpdatedMonthInputs(scheduleDays, (day) => {
        if (day.serviceDate === serviceDate) {
          return null;
        }

        return toScheduleDayInput(day);
      }),
    );
    if (!result) {
      return;
    }

    setSelectedDayDate(null);
    notify.success(t("utilities.schedules.dayDetails.removeSuccess"));
  };

  const handleSaveDayDepartmentManual = async (params: {
    scheduleDayDepartmentId: number;
    peoplePerDay: number;
    memberIds: number[];
  }) => {
    const currentDayDepartment = findDayDepartment(scheduleDays, params.scheduleDayDepartmentId);
    if (!currentDayDepartment) {
      return;
    }

    if (currentDayDepartment.peoplePerDay !== params.peoplePerDay) {
      const [, updateError] = await catcher(
        updateScheduleDayDepartmentPeoplePerDay.mutateAsync({
          year: currentMonth.year,
          month: currentMonth.month,
          scheduleDayDepartmentId: params.scheduleDayDepartmentId,
          peoplePerDay: params.peoplePerDay,
        }),
        { notify: true },
      );
      if (updateError) {
        return;
      }
    }

    const [, assignmentError] = await catcher(
      saveScheduleDayAssignments.mutateAsync({
        year: currentMonth.year,
        month: currentMonth.month,
        input: {
          scheduleDayDepartmentId: params.scheduleDayDepartmentId,
          memberIds: params.memberIds,
        },
      }),
      { notify: true },
    );
    if (assignmentError) {
      return;
    }

    const result = await refreshMonthDetail();
    if (!result) {
      return;
    }

    notify.success(t("utilities.schedules.dayDetails.saveAssignmentsSuccess"));
  };

  const handleResetDayDepartmentGenerated = async (params: {
    scheduleDayDepartmentId: number;
    peoplePerDay: number;
  }) => {
    const currentDayDepartment = findDayDepartment(scheduleDays, params.scheduleDayDepartmentId);
    if (!currentDayDepartment) {
      return;
    }

    if (currentDayDepartment.peoplePerDay !== params.peoplePerDay) {
      const [, updateError] = await catcher(
        updateScheduleDayDepartmentPeoplePerDay.mutateAsync({
          year: currentMonth.year,
          month: currentMonth.month,
          scheduleDayDepartmentId: params.scheduleDayDepartmentId,
          peoplePerDay: params.peoplePerDay,
        }),
        { notify: true },
      );
      if (updateError) {
        return;
      }
    }

    const [, resetError] = await catcher(
      resetScheduleDayDepartmentManualOverride.mutateAsync({
        year: currentMonth.year,
        month: currentMonth.month,
        scheduleDayDepartmentId: params.scheduleDayDepartmentId,
      }),
      { notify: true },
    );
    if (resetError) {
      return;
    }

    const [result, generationError] = await catcher(
      generateScheduleMonth.mutateAsync({
        year: currentMonth.year,
        month: currentMonth.month,
        overwriteManual: false,
      }),
      { notify: true },
    );
    if (generationError || !result) {
      return;
    }

    setVisibleMonth(result);
    notify.success(t("utilities.schedules.dayDetails.resetSuccess"));
  };

  return (
    <>
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{t("utilities.schedules.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("utilities.schedules.subtitle")}</p>
        </div>

        <MonthToolbar
          year={currentMonth.year}
          month={currentMonth.month}
          monthLabel={monthLabel}
          selectedDates={selectedDates}
          isSaving={isSavingDays}
          isGenerating={generateScheduleMonth.isPending}
          overwriteManual={overwriteManual}
          onPreviousMonth={() => setCurrentMonth((value) => shiftMonth(value.year, value.month, -1))}
          onNextMonth={() => setCurrentMonth((value) => shiftMonth(value.year, value.month, 1))}
          onCurrentMonth={() => setCurrentMonth(getInitialMonth())}
          onToggleWeekdayPattern={handleToggleWeekdayPattern}
          onClearSelection={handleClearSelection}
          onOpenDepartmentManager={() => setIsDepartmentManagerOpen(true)}
          onOpenPrintPreview={() => setIsPrintPreviewOpen(true)}
          onGenerate={() => void handleGenerateMonth()}
          onOverwriteManualChange={setOverwriteManual}
          canPrint={scheduleDays.length > 0}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users2 className="h-4 w-4" />
                {t("utilities.schedules.departmentManagement.title")}
              </CardTitle>
              <CardDescription>
                {areDepartmentsLoading
                  ? t("utilities.schedules.loading.departments")
                  : departmentCount > 0
                    ? t("utilities.schedules.departmentManagement.description")
                    : t("utilities.schedules.emptyStates.noDepartments")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{departmentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                {t("utilities.schedules.daySelection.title")}
              </CardTitle>
              <CardDescription>
                {isMonthLoading
                  ? t("utilities.schedules.loading.month")
                  : selectedDayCount > 0
                    ? t("utilities.schedules.daySelection.description")
                    : t("utilities.schedules.emptyStates.noDays")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {t("utilities.schedules.daySelection.selectedDays", {
                  count: selectedDayCount,
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("utilities.schedules.responsibleDepartment.title")}
              </CardTitle>
              <CardDescription>
                {t("utilities.schedules.responsibleDepartment.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {selectedDayCount > 0
                  ? t("utilities.schedules.dayDetails.openHint")
                  : t("utilities.schedules.responsibleDepartment.none")}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("utilities.schedules.daySelection.title")}</CardTitle>
            <CardDescription>
              {isLoading
                ? t("utilities.schedules.loading.month")
                : t("utilities.schedules.daySelection.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                {t("utilities.schedules.loading.month")}
              </div>
            ) : (
              <>
                {selectedDayCount === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    {t("utilities.schedules.emptyStates.noDays")}
                  </div>
                ) : null}

                <MonthCalendar
                  year={currentMonth.year}
                  month={currentMonth.month}
                  locale={i18n.language}
                  scheduleDays={scheduleDays}
                  disabled={isBusy}
                  onSelectDate={handleSelectDate}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <DepartmentManagerDialog
        open={isDepartmentManagerOpen}
        locale={i18n.language}
        departments={departments ?? []}
        onDepartmentCreated={handleDepartmentCreated}
        onGenerateSchedule={handleGenerateMonth}
        canGenerateSchedule={selectedDayCount > 0}
        isGenerating={generateScheduleMonth.isPending}
        onOpenChange={(open) => {
          setIsDepartmentManagerOpen(open);
          if (!open) {
            void refreshAllScheduleData();
          }
        }}
      />

      <DayDetailsDialog
        open={selectedDayDate !== null}
        locale={i18n.language}
        day={activeDay}
        departments={departments ?? []}
        disabled={isBusy}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDayDate(null);
          }
        }}
        onSaveDaySettings={handleSaveDaySettings}
        onRemoveDay={handleRemoveDay}
        onSaveDayDepartmentManual={handleSaveDayDepartmentManual}
        onResetDayDepartmentGenerated={handleResetDayDepartmentGenerated}
      />

      <PrintPreviewDialog
        open={isPrintPreviewOpen}
        locale={i18n.language}
        monthDetail={visibleMonth}
        monthLabel={monthLabel}
        onReorderDepartments={handlePersistDepartmentOrder}
        onOpenChange={setIsPrintPreviewOpen}
      />
    </>
  );
}
