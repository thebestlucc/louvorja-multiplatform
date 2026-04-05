import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MousePointerClick, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleDay, ScheduleDepartment } from "../../lib/bindings";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { PopoverContent } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { ConfirmationDialog } from "./confirmation-dialog";
import { DayDepartmentCard } from "./day-department-card";
import { getScheduleDepartmentLabel } from "./department-meta";

interface DayDetailsPanelProps {
  locale: string;
  scheduleDays: ScheduleDay[];
  departments: ScheduleDepartment[];
  disabled?: boolean;
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

export function DayDetailsPanel({
  locale,
  scheduleDays,
  departments,
  disabled,
  onSaveDaySettings,
  onRemoveDay,
  onSaveDayDepartmentManual,
  onResetDayDepartmentGenerated,
}: DayDetailsPanelProps) {
  const { t } = useTranslation();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const activeDepartments = useMemo(
    () => departments.filter((dept) => dept.isActive),
    [departments],
  );

  useEffect(() => {
    if (expandedDate && !scheduleDays.some((day) => day.serviceDate === expandedDate)) {
      setExpandedDate(null);
    }
  }, [scheduleDays, expandedDate]);

  if (scheduleDays.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <MousePointerClick className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t("utilities.schedules.dayDetails.panelEmptyTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("utilities.schedules.dayDetails.panelEmptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          {t("utilities.schedules.daySelection.selectedDays", { count: scheduleDays.length })}
        </span>
        {expandedDate && (
          <button
            type="button"
            onClick={() => setExpandedDate(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("utilities.schedules.dayDetails.collapseAll")}
          </button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y divide-border/40">
          {scheduleDays.map((day) => (
            <ScheduleDayItem
              key={day.serviceDate}
              locale={locale}
              day={day}
              activeDepartments={activeDepartments}
              disabled={disabled}
              isExpanded={expandedDate === day.serviceDate}
              onToggleExpand={() => setExpandedDate(
                expandedDate === day.serviceDate ? null : day.serviceDate,
              )}
              onSaveDaySettings={onSaveDaySettings}
              onRemoveDay={onRemoveDay}
              onSaveDayDepartmentManual={onSaveDayDepartmentManual}
              onResetDayDepartmentGenerated={onResetDayDepartmentGenerated}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ScheduleDayItemProps {
  locale: string;
  day: ScheduleDay;
  activeDepartments: ScheduleDepartment[];
  disabled?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSaveDaySettings: DayDetailsPanelProps["onSaveDaySettings"];
  onRemoveDay: DayDetailsPanelProps["onRemoveDay"];
  onSaveDayDepartmentManual: DayDetailsPanelProps["onSaveDayDepartmentManual"];
  onResetDayDepartmentGenerated: DayDetailsPanelProps["onResetDayDepartmentGenerated"];
}

function ScheduleDayItem({
  locale,
  day,
  activeDepartments,
  disabled,
  isExpanded,
  onToggleExpand,
  onSaveDaySettings,
  onRemoveDay,
  onSaveDayDepartmentManual,
  onResetDayDepartmentGenerated,
}: ScheduleDayItemProps) {
  const { t } = useTranslation();
  const [responsibleDepartmentId, setResponsibleDepartmentId] = useState<string>("none");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [confirmationState, setConfirmationState] = useState<
    | { kind: "removeDay" }
    | { kind: "removeDepartments"; count: number }
    | null
  >(null);

  useEffect(() => {
    setResponsibleDepartmentId(day.responsibleDepartmentId == null ? "none" : String(day.responsibleDepartmentId));
    setSelectedDepartmentIds(day.departments.map((dept) => dept.departmentId));
  }, [day]);

  const shortDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" })
      .format(new Date(`${day.serviceDate}T00:00:00`)),
    [day.serviceDate, locale],
  );

  const responsibleLabel = useMemo(
    () => getScheduleDepartmentLabel(day.responsibleDepartment, locale),
    [day.responsibleDepartment, locale],
  );

  const handleToggleDepartment = (departmentId: number, checked: boolean) => {
    setSelectedDepartmentIds((current) => {
      if (checked) {
        return current.includes(departmentId) ? current : [...current, departmentId].sort((a, b) => a - b);
      }
      return current.filter((v) => v !== departmentId);
    });
  };

  const buildNextDaySettings = () => {
    const nextResponsibleId = responsibleDepartmentId === "none" ? null : Number(responsibleDepartmentId);
    const nextDeptIds = new Set(selectedDepartmentIds);
    if (nextResponsibleId != null) {
      nextDeptIds.add(nextResponsibleId);
    }

    const removedCount = day.departments.filter(
      (dept) => !nextDeptIds.has(dept.departmentId),
    ).length;

    return {
      serviceDate: day.serviceDate,
      responsibleDepartmentId: nextResponsibleId,
      departmentIds: Array.from(nextDeptIds).sort((a, b) => a - b),
      removedDepartmentCount: removedCount,
    };
  };

  const handleSaveDaySettings = async () => {
    const next = buildNextDaySettings();
    await onSaveDaySettings({
      serviceDate: next.serviceDate,
      responsibleDepartmentId: next.responsibleDepartmentId,
      departmentIds: next.departmentIds,
    });
  };

  const handleRemoveDay = async () => {
    await onRemoveDay(day.serviceDate);
  };

  const handleConfirmDialog = () => {
    if (!confirmationState) return;

    if (confirmationState.kind === "removeDay") {
      void handleRemoveDay().then(() => setConfirmationState(null));
      return;
    }
    void handleSaveDaySettings().then(() => setConfirmationState(null));
  };

  const handleSaveDaySettingsClick = () => {
    const next = buildNextDaySettings();
    if (next.removedDepartmentCount > 0) {
      setConfirmationState({ kind: "removeDepartments", count: next.removedDepartmentCount });
      return;
    }
    void handleSaveDaySettings();
  };

  return (
    <>
      <div className={cn(isExpanded && "bg-surface/40")}>
        {/* Collapsed row — always visible */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
        >
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium capitalize text-foreground">
              {shortDate}
            </span>
            {day.departments.length > 0 && (
              <div className="mt-1 flex items-center gap-1">
                {day.departments.map((dept) => (
                  <span
                    key={dept.id}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: dept.department?.color ?? "#94a3b8" }}
                    title={getScheduleDepartmentLabel(dept.department, locale)}
                  />
                ))}
                {responsibleLabel && (
                  <span className="ml-1.5 truncate text-[10px] text-muted-foreground">
                    {responsibleLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          <ChevronDown className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )} />
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="space-y-4 px-4 pb-4">
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                {t("utilities.schedules.dayDetails.description")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-6 px-2 text-[10px] border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={disabled}
                onClick={() => setConfirmationState({ kind: "removeDay" })}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {t("utilities.schedules.dayDetails.removeDay")}
              </Button>
            </div>

            {/* Responsible department */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("utilities.schedules.responsibleDepartment.title")}
              </label>
              <Select value={responsibleDepartmentId} onValueChange={setResponsibleDepartmentId} disabled={disabled}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("utilities.schedules.responsibleDepartment.none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("utilities.schedules.responsibleDepartment.none")}</SelectItem>
                  {activeDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {getScheduleDepartmentLabel(dept, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department multi-select */}
            <DepartmentMultiSelect
              locale={locale}
              activeDepartments={activeDepartments}
              selectedDepartmentIds={selectedDepartmentIds}
              disabled={disabled}
              onToggle={handleToggleDepartment}
              onSave={handleSaveDaySettingsClick}
              saveLabel={t("utilities.schedules.dayDetails.saveDaySettings")}
              label={t("utilities.schedules.dayDetails.participatingDepartments")}
            />

            {/* Department assignment cards */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                {t("utilities.schedules.dayDetails.assignmentsTitle")}
              </h4>

              {day.departments.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("utilities.schedules.dayDetails.noParticipatingDepartments")}
                </div>
              ) : (
                <div className="space-y-2">
                  {day.departments.map((dayDept) => (
                    <DayDepartmentCard
                      key={dayDept.id}
                      locale={locale}
                      dayDepartment={dayDept}
                      disabled={disabled}
                      onSaveManual={onSaveDayDepartmentManual}
                      onResetGenerated={onResetDayDepartmentGenerated}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

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
          if (!open) setConfirmationState(null);
        }}
        onConfirm={handleConfirmDialog}
      />
    </>
  );
}

interface DepartmentMultiSelectProps {
  locale: string;
  activeDepartments: ScheduleDepartment[];
  selectedDepartmentIds: number[];
  disabled?: boolean;
  onToggle: (departmentId: number, checked: boolean) => void;
  onSave: () => void;
  saveLabel: string;
  label: string;
}

function DepartmentMultiSelect({
  locale,
  activeDepartments,
  selectedDepartmentIds,
  disabled,
  onToggle,
  onSave,
  saveLabel,
  label,
}: DepartmentMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closedAtRef = useRef(0);

  const handleClose = () => {
    setIsOpen(false);
    closedAtRef.current = Date.now();
  };

  const handleToggle = () => {
    if (Date.now() - closedAtRef.current < 100) return;
    setIsOpen((v) => !v);
  };

  const selectedDepartments = useMemo(
    () => activeDepartments.filter((dept) => selectedDepartmentIds.includes(dept.id)),
    [activeDepartments, selectedDepartmentIds],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          disabled={disabled}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
      </div>

      {/* Selected badges */}
      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDepartments.map((dept) => (
            <span
              key={dept.id}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] text-foreground"
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: dept.color }}
              />
              <span className="max-w-20 truncate">{getScheduleDepartmentLabel(dept, locale)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onToggle(dept.id, false)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
        >
          <span>
            {selectedDepartmentIds.length}/{activeDepartments.length}
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180",
          )} />
        </button>

        {isOpen && (
            <PopoverContent align="start" className="w-full min-w-0 p-1" onClose={handleClose}>
              {activeDepartments.map((dept) => {
                const isSelected = selectedDepartmentIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(dept.id, !isSelected)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                    <span className="min-w-0 truncate">
                      {getScheduleDepartmentLabel(dept, locale)}
                    </span>
                  </button>
                );
              })}
            </PopoverContent>
        )}
      </div>
    </div>
  );
}
