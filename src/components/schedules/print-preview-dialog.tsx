import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, FileOutput, GripVertical, Printer, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleMonthDetail } from "../../lib/bindings";
import { catcher } from "../../lib/catcher";
import { notify } from "../../lib/notifications";
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
import { PrintDepartmentSection, PrintDescriptionBlock } from "./print-department-section";
import { cn } from "../../lib/utils";

function mergeOrderedIds(currentIds: number[], printableIds: number[]) {
  const retainedIds = currentIds.filter((id) => printableIds.includes(id));
  const appendedIds = printableIds.filter((id) => !retainedIds.includes(id));
  return [...retainedIds, ...appendedIds];
}

function applyPrintableOrderToAllDepartments(
  allDepartmentIds: number[],
  printableDepartmentIds: number[],
  orderedPrintableDepartmentIds: number[],
) {
  const printableSet = new Set(printableDepartmentIds);
  const nextPrintableIds = [...orderedPrintableDepartmentIds];

  return allDepartmentIds.map((departmentId) => {
    if (!printableSet.has(departmentId)) {
      return departmentId;
    }

    return nextPrintableIds.shift() ?? departmentId;
  });
}

interface PrintPreviewDialogProps {
  open: boolean;
  locale: string;
  monthDetail: ScheduleMonthDetail | null;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
  onReorderDepartments?: (departmentIds: number[]) => Promise<boolean | void>;
}

function SchedulePrintPages({
  locale,
  pages,
  pageLabel,
  documentTitle,
  showPageLabel,
}: {
  locale: string;
  pages: ReturnType<typeof buildSchedulePrintPack>["pages"];
  pageLabel: (page: number) => string;
  documentTitle: string;
  showPageLabel?: boolean;
}) {
  return pages.map((page) => (
    <section key={page.pageNumber} className="schedule-print-page relative flex flex-col rounded-[1.75rem] bg-white text-slate-900 shadow-xl ring-1 ring-slate-200/70">
      {showPageLabel ? (
        <div className="schedule-print-page-label absolute right-[10mm] top-[6mm] text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {pageLabel(page.pageNumber)}
        </div>
      ) : null}
      <div className="border-b border-slate-200/80 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xl font-black uppercase tracking-[0.08em] text-slate-950">
              {documentTitle}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {page.sections.map((section) => (
          <PrintDepartmentSection
            key={`${page.pageNumber}-${section.departmentId}`}
            locale={locale}
            section={section}
          />
        ))}
      </div>
      {page.bottomDescription && page.bottomDescriptionColor ? (
        <div className="mt-auto pt-4">
          <PrintDescriptionBlock
            html={page.bottomDescription}
            accentColor={page.bottomDescriptionColor}
          />
        </div>
      ) : null}
    </section>
  ));
}

function SchedulePrintEmptyPage({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <section className="schedule-print-page relative rounded-[1.75rem] bg-white text-slate-900 shadow-xl ring-1 ring-slate-200/70">
      <div className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.04)_0%,rgba(255,255,255,0.98)_45%,rgba(59,130,246,0.05)_100%)] px-8 py-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
            {subtitle}
          </div>
          <h2 className="mt-4 overflow-hidden text-ellipsis whitespace-nowrap text-3xl font-black uppercase leading-[1.05] tracking-[0.08em] text-slate-950">
            {title}
          </h2>
          <div className="mt-5 h-0.75 w-20 rounded-full bg-slate-900/12" />
        </div>

        <div className="max-w-[32rem] rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-6 text-base leading-7 text-slate-600">
          {description}
        </div>
      </div>
    </section>
  );
}

function waitForPrintTitleCommit() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function PrintPreviewDialog({
  open,
  locale,
  monthDetail,
  monthLabel,
  onOpenChange,
  onReorderDepartments,
}: PrintPreviewDialogProps) {
  const { t } = useTranslation();
  const printableDepartmentIds = useMemo(
    () => monthDetail ? getPrintableDepartmentIds(monthDetail) : [],
    [monthDetail],
  );
  const [isPersistingOrder, setIsPersistingOrder] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>(printableDepartmentIds);
  const [orderedDepartmentIds, setOrderedDepartmentIds] = useState<number[]>(printableDepartmentIds);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setOrderedDepartmentIds((current) => mergeOrderedIds(current, printableDepartmentIds));
    setSelectedDepartmentIds((current) => current.filter((id) => printableDepartmentIds.includes(id)));
  }, [open, printableDepartmentIds]);

  useEffect(() => {
    const cleanup = () => document.body.classList.remove("schedule-print-mode");
    window.addEventListener("afterprint", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("afterprint", cleanup);
    };
  }, []);

  const orderedSelectedDepartmentIds = useMemo(
    () => orderedDepartmentIds.filter((id) => selectedDepartmentIds.includes(id)),
    [orderedDepartmentIds, selectedDepartmentIds],
  );
  const pack = useMemo(
    () => monthDetail
      ? buildSchedulePrintPack(monthDetail, orderedSelectedDepartmentIds, locale)
      : { sections: [], pages: [] },
    [locale, monthDetail, orderedSelectedDepartmentIds],
  );

  const handleToggleDepartment = (departmentId: number, checked: boolean) => {
    setSelectedDepartmentIds((current) => {
      if (checked) {
        return current.includes(departmentId)
          ? current
          : [...current, departmentId];
      }

      return current.filter((id) => id !== departmentId);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedDepartmentIds.indexOf(Number(active.id));
    const newIndex = orderedDepartmentIds.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const nextOrderedDepartmentIds = arrayMove(orderedDepartmentIds, oldIndex, newIndex);
    setOrderedDepartmentIds(nextOrderedDepartmentIds);

    if (!monthDetail || !onReorderDepartments) {
      return;
    }

    const nextFullOrder = applyPrintableOrderToAllDepartments(
      monthDetail.departments.map((department) => department.id),
      printableDepartmentIds,
      nextOrderedDepartmentIds,
    );

    setIsPersistingOrder(true);
    void onReorderDepartments(nextFullOrder)
      .then((result) => {
        if (result === false) {
          setOrderedDepartmentIds(orderedDepartmentIds);
        }
      })
      .finally(() => {
        setIsPersistingOrder(false);
      });
  };

  const handlePrint = async () => {
    document.body.classList.add("schedule-print-mode");
    const previousTitle = document.title;
    document.title = printStageTitle;
    await waitForPrintTitleCommit();
    const [, error] = await catcher(async () => {
      await window.print();
      return true;
    }, { notify: false });
    document.title = previousTitle;
    if (error) {
      document.body.classList.remove("schedule-print-mode");
      notify.error(t("utilities.schedules.print.error"), {
        description: error.message || t("utilities.schedules.print.errorDescription"),
      });
    }
  };

  const printableDepartments = useMemo(
    () => monthDetail
      ? monthDetail.departments.filter(
        (department) => department.isActive && printableDepartmentIds.includes(department.id),
      )
      : [],
    [monthDetail, printableDepartmentIds],
  );
  const orderedPrintableDepartments = useMemo(() => {
    const departmentsById = new Map(printableDepartments.map((department) => [department.id, department]));
    return orderedDepartmentIds
      .map((departmentId) => departmentsById.get(departmentId))
      .filter((department): department is NonNullable<typeof department> => Boolean(department));
  }, [orderedDepartmentIds, printableDepartments]);
  const pageLabel = (page: number) => t("utilities.schedules.print.pageLabel", { page });
  const printStageTitle = `${t("utilities.schedules.print.documentTitle")} - ${monthLabel}`;
  const printStageSubtitle = t("utilities.schedules.print.title");
  const exportPrintRoot = open && typeof document !== "undefined"
    ? createPortal(
      <div data-schedule-print-export-root className="schedule-print-root space-y-6">
        {pack.pages.length === 0 ? (
          <SchedulePrintEmptyPage
            title={printStageTitle}
            subtitle={printStageSubtitle}
            description={t("utilities.schedules.print.empty")}
          />
        ) : (
          <SchedulePrintPages
            locale={locale}
            pages={pack.pages}
            pageLabel={pageLabel}
            documentTitle={printStageTitle}
          />
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      {exportPrintRoot}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-[84rem] border-none bg-transparent p-0 shadow-none">
          <div data-schedule-print-shell className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            <div data-schedule-print-grid className="grid min-h-[78vh] pt-12 lg:grid-cols-[340px_minmax(0,1fr)]">
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
                    onClick={() => {
                      setOrderedDepartmentIds((current) => mergeOrderedIds(current, printableDepartmentIds));
                      setSelectedDepartmentIds(printableDepartmentIds);
                    }}
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

                <Button type="button" className="w-full" onClick={() => void handlePrint()} disabled={pack.pages.length === 0}>
                  <Printer className="mr-2 h-4 w-4" />
                  {t("utilities.schedules.print.dialogAction")}
                </Button>

                <p className="text-xs leading-5 text-muted-foreground">
                  {t("utilities.schedules.print.pdfHint")}
                </p>
              </div>

              <ScrollArea className="h-[calc(78vh-13.75rem)] px-3 py-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={orderedDepartmentIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {orderedPrintableDepartments.map((department) => (
                        <SortablePrintDepartmentRow
                          key={department.id}
                          locale={locale}
                          department={department}
                          checked={selectedDepartmentIds.includes(department.id)}
                          dayCount={pack.sections.find((section) => section.departmentId === department.id)?.dayCount ?? 0}
                          disabled={isPersistingOrder}
                          onToggle={handleToggleDepartment}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </ScrollArea>
            </aside>

              <div data-schedule-print-stage className="min-h-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
                <ScrollArea data-schedule-print-scroll className="h-[78vh] px-6 py-6">
                  <div data-schedule-print-root className="schedule-print-root space-y-6">
                  {pack.pages.length === 0 ? (
                    <div data-print-hidden>
                      <SchedulePrintEmptyPage
                        title={printStageTitle}
                        subtitle={printStageSubtitle}
                        description={t("utilities.schedules.print.empty")}
                      />
                    </div>
                  ) : (
                    <SchedulePrintPages
                      locale={locale}
                      pages={pack.pages}
                      pageLabel={pageLabel}
                      documentTitle={printStageTitle}
                      showPageLabel
                    />
                  )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortablePrintDepartmentRow({
  locale,
  department,
  checked,
  dayCount,
  disabled,
  onToggle,
}: {
  locale: string;
  department: NonNullable<ScheduleMonthDetail["departments"]>[number];
  checked: boolean;
  dayCount: number;
  disabled?: boolean;
  onToggle: (departmentId: number, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: department.id, disabled });
  const Icon = getScheduleDepartmentIcon(department.icon);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
        checked
          ? "border-primary/50 bg-primary/10"
          : "border-border/70 bg-background hover:bg-surface",
        isDragging && "opacity-70 shadow-md",
      )}
    >
      <button
        type="button"
        className="self-center rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        aria-label={t("utilities.schedules.print.reorderDepartment", {
          department: getScheduleDepartmentLabel(department, locale),
        })}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(department.id, event.target.checked)}
          className="h-4 w-4 self-center rounded border-border"
        />
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: department.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div
            title={getScheduleDepartmentLabel(department, locale)}
            className="overflow-hidden text-pretty text-sm font-medium leading-5 text-foreground"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {getScheduleDepartmentLabel(department, locale)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("utilities.schedules.print.departmentDays", { count: dayCount })}
          </div>
        </div>
      </label>
    </div>
  );
}
