import { useEffect, useMemo, useState } from "react";
import { CheckSquare, FileOutput, Printer, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleMonthDetail } from "../../lib/bindings";
import { buildSchedulePrintPack, getPrintableDepartmentIds } from "../../lib/schedule-print";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { getScheduleDepartmentIcon, getScheduleDepartmentLabel } from "./department-meta";
import { PrintDepartmentSection } from "./print-department-section";
import { cn } from "../../lib/utils";

interface PrintPreviewDialogProps {
  open: boolean;
  locale: string;
  monthDetail: ScheduleMonthDetail | null;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
}

export function PrintPreviewDialog({
  open,
  locale,
  monthDetail,
  monthLabel,
  onOpenChange,
}: PrintPreviewDialogProps) {
  const { t } = useTranslation();
  const printableDepartmentIds = useMemo(
    () => monthDetail ? getPrintableDepartmentIds(monthDetail) : [],
    [monthDetail],
  );
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>(printableDepartmentIds);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedDepartmentIds((current) => {
      const nextIds = printableDepartmentIds.filter((id) => current.includes(id));
      return nextIds.length > 0 ? nextIds : printableDepartmentIds;
    });
  }, [open, printableDepartmentIds]);

  useEffect(() => {
    const cleanup = () => document.body.classList.remove("schedule-print-mode");
    window.addEventListener("afterprint", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("afterprint", cleanup);
    };
  }, []);

  const pack = useMemo(
    () => monthDetail
      ? buildSchedulePrintPack(monthDetail, selectedDepartmentIds, locale)
      : { sections: [], pages: [] },
    [locale, monthDetail, selectedDepartmentIds],
  );

  const handleToggleDepartment = (departmentId: number, checked: boolean) => {
    setSelectedDepartmentIds((current) => {
      if (checked) {
        return current.includes(departmentId)
          ? current
          : [...current, departmentId].sort((left, right) => left - right);
      }

      return current.filter((id) => id !== departmentId);
    });
  };

  const handlePrint = () => {
    document.body.classList.add("schedule-print-mode");
    window.print();
  };

  const printableDepartments = useMemo(
    () => monthDetail
      ? monthDetail.departments.filter((department) => printableDepartmentIds.includes(department.id))
      : [],
    [monthDetail, printableDepartmentIds],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-7xl border-none bg-transparent p-0 shadow-none">
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="grid min-h-[78vh] pt-12 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside data-print-hidden className="border-b border-border/80 bg-surface/70 lg:border-r lg:border-b-0">
              <DialogHeader className="border-b border-border/80 px-5 py-4">
                <DialogTitle className="flex items-center gap-2">
                  <FileOutput className="h-5 w-5" />
                  {t("utilities.schedules.print.previewTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("utilities.schedules.print.previewDescription", { month: monthLabel })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDepartmentIds(printableDepartmentIds)}
                    disabled={printableDepartmentIds.length === 0}
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {t("utilities.schedules.print.selectAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDepartmentIds([])}
                    disabled={selectedDepartmentIds.length === 0}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {t("utilities.schedules.print.clear")}
                  </Button>
                </div>

                <Button type="button" className="w-full" onClick={handlePrint} disabled={pack.pages.length === 0}>
                  <Printer className="mr-2 h-4 w-4" />
                  {t("utilities.schedules.print.dialogAction")}
                </Button>

                <p className="text-xs leading-5 text-muted-foreground">
                  {t("utilities.schedules.print.pdfHint")}
                </p>
              </div>

              <ScrollArea className="h-[calc(78vh-13.75rem)] px-3 py-3">
                <div className="space-y-2">
                  {printableDepartments.map((department) => {
                    const Icon = getScheduleDepartmentIcon(department.icon);
                    const isChecked = selectedDepartmentIds.includes(department.id);
                    return (
                      <label
                        key={department.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
                          isChecked
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/70 bg-background hover:bg-surface",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => handleToggleDepartment(department.id, event.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: department.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">
                            {getScheduleDepartmentLabel(department, locale)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t("utilities.schedules.print.departmentDays", {
                              count: pack.sections.find((section) => section.departmentId === department.id)?.entries.length ?? 0,
                            })}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </aside>

            <div className="min-h-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
              <ScrollArea className="h-[78vh] px-6 py-6">
                <div data-schedule-print-root className="schedule-print-root space-y-6">
                  {pack.pages.length === 0 ? (
                    <div data-print-hidden className="rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-sm text-muted-foreground">
                      {t("utilities.schedules.print.empty")}
                    </div>
                  ) : (
                    pack.pages.map((page) => (
                      <section key={page.pageNumber} className="schedule-print-page rounded-[28px] bg-white p-[12mm] text-slate-900 shadow-xl ring-1 ring-slate-200/70">
                        <div data-print-hidden className="schedule-print-page-label mb-4 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {t("utilities.schedules.print.pageLabel", { page: page.pageNumber })}
                        </div>
                        <div className="space-y-4">
                          {page.sections.map((section) => (
                            <PrintDepartmentSection
                              key={`${page.pageNumber}-${section.departmentId}`}
                              locale={locale}
                              section={section}
                            />
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
