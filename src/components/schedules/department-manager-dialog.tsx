import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Settings2, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleDepartment } from "../../lib/bindings";
import { catcher } from "../../lib/catcher";
import { notify } from "../../lib/notifications";
import {
  useDeleteScheduleDepartment,
  useReplaceScheduleDepartmentMembers,
  useSaveScheduleDepartment,
} from "../../lib/queries";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  buildEmptyDepartmentDraft,
  DepartmentForm,
  departmentDraftFromEntity,
  getRequiredLocalizedName,
  toScheduleDepartmentInput,
  type ScheduleDepartmentDraft,
} from "./department-form";
import { ConfirmationDialog } from "./confirmation-dialog";
import { getScheduleDepartmentIcon, getScheduleDepartmentLabel } from "./department-meta";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

interface DepartmentManagerDialogProps {
  open: boolean;
  locale: string;
  departments: ScheduleDepartment[];
  onOpenChange: (open: boolean) => void;
  onDepartmentCreated?: (department: ScheduleDepartment) => Promise<void> | void;
  onGenerateSchedule?: () => Promise<void>;
  canGenerateSchedule?: boolean;
  isGenerating?: boolean;
}

export function DepartmentManagerDialog({
  open,
  locale,
  departments,
  onOpenChange,
  onDepartmentCreated,
  onGenerateSchedule,
  canGenerateSchedule,
  isGenerating,
}: DepartmentManagerDialogProps) {
  const { t } = useTranslation();
  const saveDepartment = useSaveScheduleDepartment();
  const deleteDepartment = useDeleteScheduleDepartment();
  const replaceMembers = useReplaceScheduleDepartmentMembers();
  const [selectedDepartmentKey, setSelectedDepartmentKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDepartmentDraft | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const sortedDepartments = useMemo(
    () => departments.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id),
    [departments],
  );
  const maxSortOrder = useMemo(
    () => sortedDepartments.reduce((current, department) => Math.max(current, department.sortOrder), 0),
    [sortedDepartments],
  );
  const isPending = saveDepartment.isPending || deleteDepartment.isPending || replaceMembers.isPending || Boolean(isGenerating);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (selectedDepartmentKey === "new") {
      return;
    }

    const selectedDepartment = sortedDepartments.find(
      (department) => String(department.id) === selectedDepartmentKey,
    ) ?? sortedDepartments[0];

    if (!selectedDepartment) {
      setSelectedDepartmentKey("new");
      setDraft(buildEmptyDepartmentDraft(maxSortOrder + 1));
      return;
    }

    setSelectedDepartmentKey(String(selectedDepartment.id));
    setDraft(departmentDraftFromEntity(selectedDepartment));
  }, [maxSortOrder, open, selectedDepartmentKey, sortedDepartments]);

  const handleSelectDepartment = (key: string) => {
    if (key === "new") {
      setSelectedDepartmentKey("new");
      setDraft(buildEmptyDepartmentDraft(maxSortOrder + 1));
      return;
    }

    const department = sortedDepartments.find((item) => String(item.id) === key);
    if (!department) {
      return;
    }

    setSelectedDepartmentKey(key);
    setDraft(departmentDraftFromEntity(department));
  };

  const handleSave = async (options?: { generateAfterSave?: boolean }) => {
    if (!draft) {
      return false;
    }

    const isNewDepartment = draft.id == null;

    if (!draft.isSystem && getRequiredLocalizedName(draft, locale).length === 0) {
      notify.error(t("utilities.schedules.departmentManagement.activeLocaleRequired"));
      return false;
    }

    const [savedDepartment, saveError] = await catcher(
      saveDepartment.mutateAsync(toScheduleDepartmentInput(draft)),
      { notify: true },
    );
    if (saveError || !savedDepartment) {
      return false;
    }

    const members = draft.members
      .map((member) => member.name.trim())
      .filter((memberName) => memberName.length > 0);
    const [, membersError] = await catcher(
      replaceMembers.mutateAsync({ departmentId: savedDepartment.id, members }),
      { notify: true },
    );
    if (membersError) {
      return false;
    }

    if (isNewDepartment && savedDepartment.isActive) {
      const [, syncError] = await catcher(
        Promise.resolve(onDepartmentCreated?.(savedDepartment)),
        { notify: true },
      );
      if (syncError) {
        return false;
      }
    }

    setSelectedDepartmentKey(String(savedDepartment.id));
    setDraft(
      departmentDraftFromEntity({
        ...savedDepartment,
        members: members.map((name, index) => ({ id: index + 1, name })),
      }),
    );
    notify.success(t("utilities.schedules.departmentManagement.saveSuccess"));

    if (options?.generateAfterSave && onGenerateSchedule) {
      await onGenerateSchedule();
    }

    return true;
  };

  const handleDelete = async () => {
    if (!draft?.id || draft.isSystem) {
      return false;
    }

    const [, error] = await catcher(deleteDepartment.mutateAsync(draft.id), { notify: true });
    if (error) {
      return false;
    }

    const nextDepartment = sortedDepartments.find((department) => department.id !== draft.id);
    if (nextDepartment) {
      setSelectedDepartmentKey(String(nextDepartment.id));
      setDraft(departmentDraftFromEntity(nextDepartment));
      notify.success(t("utilities.schedules.departmentManagement.deleteSuccess"));
      return true;
    }

    setSelectedDepartmentKey("new");
    setDraft(buildEmptyDepartmentDraft(maxSortOrder + 1));
    notify.success(t("utilities.schedules.departmentManagement.deleteSuccess"));
    return true;
  };

  const handleDeleteClick = () => {
    if (!draft?.id || draft.isSystem || isPending) {
      return;
    }
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    void handleDelete().then((deleted) => {
      if (deleted) {
        setIsDeleteDialogOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] max-h-[88vh] max-w-6xl overflow-hidden p-0">
        <div className="grid h-full min-h-0 pt-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-border/80 bg-surface/60 lg:border-r lg:border-b-0">
            <DialogHeader className="border-b border-border/80 px-5 py-4">
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                {t("utilities.schedules.departmentManagement.title")}
              </DialogTitle>
              <DialogDescription>
                {t("utilities.schedules.departmentManagement.dialogDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="shrink-0 border-b border-border/80 px-4 py-4">
              <Button type="button" className="w-full" onClick={() => handleSelectDepartment("new")}>
                <Plus className="mr-2 h-4 w-4" />
                {t("utilities.schedules.departmentManagement.addCustom")}
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-3 py-3">
              <div className="space-y-2">
                {sortedDepartments.map((department) => {
                  const Icon = getScheduleDepartmentIcon(department.icon);
                  const isSelected = selectedDepartmentKey === String(department.id);
                  return (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => handleSelectDepartment(String(department.id))}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/10 shadow-sm"
                          : "border-border/70 bg-background hover:bg-surface",
                      )}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
                        style={{ backgroundColor: department.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {getScheduleDepartmentLabel(department, locale)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{t("utilities.schedules.departmentManagement.membersCount", { count: department.members.length })}</span>
                          <span>•</span>
                          <span>{t("utilities.schedules.departmentManagement.peoplePerDaySummary", { count: department.peoplePerDay })}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <div className="flex min-h-0 flex-col bg-background">
            <ScrollArea className="min-h-0 flex-1 px-5 py-5">
              {draft ? (
                <DepartmentForm
                  draft={draft}
                  locale={locale}
                  disabled={isPending}
                  onChange={setDraft}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                  {t("utilities.schedules.departmentManagement.empty")}
                </div>
              )}
            </ScrollArea>

            <div className="shrink-0 border-t border-border/80 bg-surface/95 px-5 py-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {draft && !draft.isSystem ? (
                    <Button type="button" variant="destructive" disabled={isPending} onClick={handleDeleteClick}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("actions.delete")}
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || !draft}
                    onClick={() => void handleSave()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {t("actions.save")}
                  </Button>
                  <Button
                    type="button"
                    disabled={isPending || !draft || !canGenerateSchedule}
                    onClick={() => void handleSave({ generateAfterSave: true })}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {t("utilities.schedules.departmentManagement.saveAndGenerate")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        title={t("utilities.schedules.departmentManagement.deleteDialogTitle")}
        description={t("utilities.schedules.departmentManagement.deleteConfirm")}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isPending={isPending}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />
    </Dialog>
  );
}
