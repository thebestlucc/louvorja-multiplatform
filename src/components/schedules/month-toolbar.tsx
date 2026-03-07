import { useTranslation } from "react-i18next";
import { CalendarCog, ChevronLeft, ChevronRight, Printer, Wand2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const isBusy = isSaving || isGenerating;
  const arePatternsBusy = Boolean(isSaving);

  return (
    <Card className="border-border/80 bg-gradient-to-br from-surface to-surface/70 shadow-sm">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle>{t("utilities.schedules.monthPicker.label")}</CardTitle>
          <CardDescription>{t("utilities.schedules.description")}</CardDescription>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("utilities.schedules.monthPicker.previous")}
              disabled={isBusy}
              onClick={onPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-48 rounded-md border border-border/80 bg-background px-4 py-2 text-center text-sm font-semibold capitalize shadow-sm">
              {monthLabel}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("utilities.schedules.monthPicker.next")}
              disabled={isBusy}
              onClick={onNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy || isCurrentMonth}
              onClick={onCurrentMonth}
            >
              {t("utilities.schedules.monthPicker.current")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>{t("utilities.schedules.daySelection.selectedDays", { count: selectedDates.length })}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <MonthPatternPicker
          year={year}
          month={month}
          selectedDates={selectedDates}
          disabled={arePatternsBusy}
          onToggleWeekdayPattern={onToggleWeekdayPattern}
          onClearSelection={onClearSelection}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={isBusy} onClick={onOpenDepartmentManager}>
            <CalendarCog className="mr-2 h-4 w-4" />
            {t("utilities.schedules.departmentManagement.action")}
          </Button>
          <Button type="button" disabled={isBusy || selectedDates.length === 0} onClick={onGenerate}>
            <Wand2 className="mr-2 h-4 w-4" />
            {t("utilities.schedules.generate.action")}
          </Button>
          <Button type="button" variant="outline" disabled={isBusy || !canPrint} onClick={onOpenPrintPreview}>
            <Printer className="mr-2 h-4 w-4" />
            {t("utilities.schedules.print.action")}
          </Button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={overwriteManual}
              disabled={isBusy}
              onChange={(event) => onOverwriteManualChange(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{t("utilities.schedules.generate.overwriteManual")}</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
