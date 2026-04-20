import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleDay, ScheduleDepartment } from "../../lib/bindings";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ConfirmationDialog } from "./confirmation-dialog";
import { DayDepartmentCard } from "./day-department-card";
import { getScheduleDepartmentIcon, getScheduleDepartmentLabel } from "./department-meta";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

interface DayDetailsDialogProps {
  open: boolean;
  locale: string;
  day: ScheduleDay | null;
  departments: ScheduleDepartment[];
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDaySettings: (params: {
    serviceDate: string;
    responsibleDepartmentId: number | null;
    departmentIds: number[];
  }) => Promise<void>;
  onRemoveDay: (serviceDate: string) => Promise<void>;
  onSaveDayDepartmentManual: (params: {
    scheduleDayDepartmentId: number;
    peoplePerDay: number;
    memberIds: number[];
  }) => Promise<void>;
  onResetDayDepartmentGenerated: (params: {
    scheduleDayDepartmentId: number;
    peoplePerDay: number;
  }) => Promise<void>;
}

export function DayDetailsDialog({
  open,
  locale,
  day,
  departments,
  disabled,
  onOpenChange,
  onSaveDaySettings,
  onRemoveDay,
  onSaveDayDepartmentManual,
  onResetDayDepartmentGenerated,
}: DayDetailsDialogProps) {
  const { t } = useTranslation();
  const [responsibleDepartmentId, setResponsibleDepartmentId] = useState<string>("none");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [confirmationState, setConfirmationState] = useState<
    | { kind: "removeDay" }
    | { kind: "removeDepartments"; count: number }
    | null
  >(null);

  useEffect(() => {
    if (!day) {
      setResponsibleDepartmentId("none");
      setSelectedDepartmentIds([]);
      return;
    }

    setResponsibleDepartmentId(day.responsibleDepartmentId == null ? "none" : String(day.responsibleDepartmentId));
    setSelectedDepartmentIds(day.departments.map((department) => department.departmentId));
  }, [day]);

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.isActive),
    [departments],
  );
  const formattedDate = useMemo(() => {
    if (!day) {
      return "";
    }

    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${day.serviceDate}T00:00:00`));
  }, [day, locale]);

  const handleToggleDepartment = (departmentId: number, checked: boolean) => {
    setSelectedDepartmentIds((current) => {
      if (checked) {
        return current.includes(departmentId) ? current : [...current, departmentId].sort((left, right) => left - right);
      }

      return current.filter((value) => value !== departmentId);
    });
  };

  const buildNextDaySettings = () => {
    if (!day) {
      return null;
    }

    const nextResponsibleDepartmentId = responsibleDepartmentId === "none" ? null : Number(responsibleDepartmentId);
    const nextDepartmentIds = new Set(selectedDepartmentIds);
    if (nextResponsibleDepartmentId != null) {
      nextDepartmentIds.add(nextResponsibleDepartmentId);
    }

    const removedDepartmentCount = day.departments.filter(
      (department) => !nextDepartmentIds.has(department.departmentId),
    ).length;

    return {
      serviceDate: day.serviceDate,
      responsibleDepartmentId: nextResponsibleDepartmentId,
      departmentIds: Array.from(nextDepartmentIds).sort((left, right) => left - right),
      removedDepartmentCount,
    };
  };

  const handleSaveDaySettings = async () => {
    const nextSettings = buildNextDaySettings();
    if (!nextSettings) {
      return;
    }

    await onSaveDaySettings({
      serviceDate: nextSettings.serviceDate,
      responsibleDepartmentId: nextSettings.responsibleDepartmentId,
      departmentIds: nextSettings.departmentIds,
    });
  };

  const handleRemoveDay = async () => {
    if (!day) {
      return;
    }
    await onRemoveDay(day.serviceDate);
    onOpenChange(false);
  };

  const handleConfirmDialog = () => {
    if (!confirmationState) {
      return;
    }

    if (confirmationState.kind === "removeDay") {
      handleRemoveDay().then(() => setConfirmationState(null));
      return;
    }

    handleSaveDaySettings().then(() => setConfirmationState(null));
  };

  const handleSaveDaySettingsClick = () => {
    const nextSettings = buildNextDaySettings();
    if (!nextSettings) {
      return;
    }

    if (nextSettings.removedDepartmentCount > 0) {
      setConfirmationState({
        kind: "removeDepartments",
        count: nextSettings.removedDepartmentCount,
      });
      return;
    }

    handleSaveDaySettings();
  };

  const handleRemoveDayClick = () => {
    if (!day || disabled) {
      return;
    }
    setConfirmationState({ kind: "removeDay" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] max-h-[88vh] max-w-5xl overflow-hidden p-0">
        <div className="flex h-full min-h-0 min-w-0 flex-col bg-background pt-10">
          <DialogHeader className="border-b border-border/80 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 capitalize">
                  <CalendarDays className="h-5 w-5" />
                  {formattedDate || t("utilities.schedules.dayDetails.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("utilities.schedules.dayDetails.description")}
                </DialogDescription>
              </div>

              {day ? (
                <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={handleRemoveDayClick}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("utilities.schedules.dayDetails.removeDay")}
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1 px-6 py-5">
            {day ? (
              <div className="space-y-5">
                <div className="grid gap-4 rounded-2xl border border-border/80 bg-surface/40 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t("utilities.schedules.responsibleDepartment.title")}
                    </label>
                    <Select value={responsibleDepartmentId} onValueChange={setResponsibleDepartmentId} disabled={disabled}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("utilities.schedules.responsibleDepartment.none")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("utilities.schedules.responsibleDepartment.none")}</SelectItem>
                        {activeDepartments.map((department) => (
                          <SelectItem key={department.id} value={String(department.id)}>
                            {getScheduleDepartmentLabel(department, locale)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {t("utilities.schedules.dayDetails.participatingDepartments")}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t("utilities.schedules.dayDetails.participatingDepartmentsHint")}
                        </p>
                      </div>
                      <Button type="button" size="sm" disabled={disabled} onClick={handleSaveDaySettingsClick}>
                        {t("utilities.schedules.dayDetails.saveDaySettings")}
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {activeDepartments.map((department) => {
                        const Icon = getScheduleDepartmentIcon(department.icon);
                        const isSelected = selectedDepartmentIds.includes(department.id);
                        return (
                          <label
                            key={department.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
                              isSelected
                                ? "border-primary/50 bg-primary/10"
                                : "border-border/80 bg-background hover:bg-surface",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={disabled}
                              onChange={(event) => handleToggleDepartment(department.id, event.target.checked)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                              style={{ backgroundColor: department.color }}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="min-w-0 truncate text-foreground">
                              {getScheduleDepartmentLabel(department, locale)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {t("utilities.schedules.dayDetails.assignmentsTitle")}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {t("utilities.schedules.dayDetails.assignmentsDescription")}
                    </p>
                  </div>

                  {day.departments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                      {t("utilities.schedules.dayDetails.noParticipatingDepartments")}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {day.departments.map((dayDepartment) => (
                        <DayDepartmentCard
                          key={dayDepartment.id}
                          locale={locale}
                          dayDepartment={dayDepartment}
                          disabled={disabled}
                          onSaveManual={onSaveDayDepartmentManual}
                          onResetGenerated={onResetDayDepartmentGenerated}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                {t("utilities.schedules.dayDetails.empty")}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={confirmationState !== null}
        title={confirmationState?.kind === "removeDay"
          ? t("utilities.schedules.dayDetails.removeDayDialogTitle")
          : t("utilities.schedules.dayDetails.removeDepartmentDialogTitle")}
        description={confirmationState?.kind === "removeDay"
          ? t("utilities.schedules.dayDetails.removeDayConfirm")
          : t("utilities.schedules.dayDetails.removeDepartmentConfirm", {
            count: confirmationState?.kind === "removeDepartments" ? confirmationState.count : 0,
          })}
        confirmLabel={confirmationState?.kind === "removeDay"
          ? t("actions.remove")
          : t("utilities.schedules.dayDetails.saveDaySettings")}
        cancelLabel={t("actions.cancel")}
        isPending={disabled}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmationState(null);
          }
        }}
        onConfirm={handleConfirmDialog}
      />
    </Dialog>
  );
}
