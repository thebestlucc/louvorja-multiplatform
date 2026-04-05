import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarCog,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  Wand2,
} from "lucide-react";
import { Button } from "../ui/button";
import { PopoverContent } from "../ui/popover";
import { MonthPatternPicker } from "./month-pattern-picker";

interface MonthToolbarProps {
  year: number;
  month: number;
  monthLabel: string;
  selectedDates: string[];
  isSaving?: boolean;
  isGenerating?: boolean;
  overwriteManual: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onToggleWeekdayPattern: (weekday: number) => void;
  onClearSelection: () => void;
  onOpenDepartmentManager: () => void;
  onOpenPrintPreview: () => void;
  onGenerate: () => void;
  onOverwriteManualChange: (value: boolean) => void;
  canPrint?: boolean;
}

export function MonthToolbar({
  year,
  month,
  monthLabel,
  selectedDates,
  isSaving,
  isGenerating,
  overwriteManual,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  onToggleWeekdayPattern,
  onClearSelection,
  onOpenDepartmentManager,
  onOpenPrintPreview,
  onGenerate,
  onOverwriteManualChange,
  canPrint,
}: MonthToolbarProps) {
  const { t } = useTranslation();
  const [isPatternOpen, setIsPatternOpen] = useState(false);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const isBusy = isSaving || isGenerating;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("utilities.schedules.monthPicker.previous")}
            disabled={isBusy}
            onClick={onPreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="min-w-40 px-3 py-1.5 text-center text-base font-semibold capitalize">
            {monthLabel}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("utilities.schedules.monthPicker.next")}
            disabled={isBusy}
            onClick={onNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isCurrentMonth && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={onCurrentMonth}
            >
              {t("utilities.schedules.monthPicker.current")}
            </Button>
          )}

          {selectedDates.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {t("utilities.schedules.daySelection.selectedDays", { count: selectedDates.length })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative inline-flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => setIsPatternOpen((v) => !v)}
            >
              {t("utilities.schedules.patterns.title")}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            {isPatternOpen && (
              <PopoverContent align="end" className="w-52 p-1.5" onClose={() => setIsPatternOpen(false)}>
                <MonthPatternPicker
                  year={year}
                  month={month}
                  selectedDates={selectedDates}
                  disabled={isSaving}
                  onToggleWeekdayPattern={onToggleWeekdayPattern}
                  onClearSelection={onClearSelection}
                />
              </PopoverContent>
            )}
          </div>

          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={onOpenDepartmentManager}>
            <CalendarCog className="mr-1.5 h-3.5 w-3.5" />
            {t("utilities.schedules.departmentManagement.action")}
          </Button>

          <Button type="button" size="sm" disabled={isBusy || selectedDates.length === 0} onClick={onGenerate}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            {t("utilities.schedules.generate.action")}
          </Button>

          <Button type="button" variant="outline" size="sm" disabled={isBusy || !canPrint} onClick={onOpenPrintPreview}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            {t("utilities.schedules.print.action")}
          </Button>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={overwriteManual}
              disabled={isBusy}
              onChange={(event) => onOverwriteManualChange(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span>{t("utilities.schedules.generate.overwriteManual")}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
