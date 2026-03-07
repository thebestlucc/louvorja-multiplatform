import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Printer,
  Users2,
  Wand2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useScheduleDepartments, useScheduleMonth } from "../../lib/queries";

export const Route = createFileRoute("/utilities/schedules")({
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

function UtilitiesSchedulesPage() {
  const { t, i18n } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth);
  const { data: scheduleMonth, isLoading: isMonthLoading } = useScheduleMonth(
    currentMonth.year,
    currentMonth.month,
  );
  const { data: departments, isLoading: areDepartmentsLoading } = useScheduleDepartments();

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: "long",
        year: "numeric",
      }).format(new Date(currentMonth.year, currentMonth.month - 1, 1)),
    [currentMonth.month, currentMonth.year, i18n.language],
  );

  const departmentCount = departments?.length ?? 0;
  const selectedDayCount = scheduleMonth?.days.length ?? 0;
  const isLoading = isMonthLoading || areDepartmentsLoading;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("utilities.schedules.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("utilities.schedules.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>{t("utilities.schedules.monthPicker.label")}</CardTitle>
            <CardDescription>{t("utilities.schedules.description")}</CardDescription>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={t("utilities.schedules.monthPicker.previous")}
                onClick={() => setCurrentMonth((value) => shiftMonth(value.year, value.month, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-44 rounded-md border bg-surface px-3 py-2 text-center text-sm font-medium capitalize">
                {monthLabel}
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("utilities.schedules.monthPicker.next")}
                onClick={() => setCurrentMonth((value) => shiftMonth(value.year, value.month, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled>
                <Wand2 className="mr-2 h-4 w-4" />
                {t("utilities.schedules.generate.action")}
              </Button>
              <Button variant="outline" disabled>
                <Printer className="mr-2 h-4 w-4" />
                {t("utilities.schedules.print.action")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("utilities.schedules.placeholders.toolbar")}
          </p>
        </CardContent>
      </Card>

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
              {t("utilities.schedules.responsibleDepartment.none")}
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
              : t("utilities.schedules.placeholders.calendar")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
              {t("utilities.schedules.loading.month")}
            </div>
          ) : selectedDayCount === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
              {t("utilities.schedules.emptyStates.noDays")}
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
              {t("utilities.schedules.placeholders.calendar")}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
