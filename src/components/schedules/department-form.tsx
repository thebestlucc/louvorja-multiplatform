import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { scheduleIconOptions, getScheduleDepartmentIcon } from "./department-meta";
import { MemberListEditor, type EditableMember } from "./member-list-editor";
import { getScheduleDepartmentLabel } from "./department-meta";
import type { ScheduleDepartmentInput } from "../../lib/bindings";
import { useTranslation } from "react-i18next";

export interface ScheduleDepartmentDraft {
  id: number | null;
  code: string | null;
  namePt: string;
  nameEn: string;
  nameEs: string;
  icon: string;
  color: string;
  peoplePerDay: number;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  members: EditableMember[];
}

interface DepartmentFormProps {
  draft: ScheduleDepartmentDraft;
  locale: string;
  disabled?: boolean;
  onChange: (draft: ScheduleDepartmentDraft) => void;
  onSave: () => void;
  onDelete?: () => void;
}

export function DepartmentForm({
  draft,
  locale,
  disabled,
  onChange,
  onSave,
  onDelete,
}: DepartmentFormProps) {
  const { t } = useTranslation();
  const Icon = getScheduleDepartmentIcon(draft.icon);
  const localizedPreview = getScheduleDepartmentLabel(draft, locale);

  const updateField = <K extends keyof ScheduleDepartmentDraft>(field: K, value: ScheduleDepartmentDraft[K]) => {
    onChange({ ...draft, [field]: value });
  };

  const updateMembers = (members: EditableMember[]) => {
    onChange({ ...draft, members });
  };

  const addMember = () => {
    updateMembers([
      ...draft.members,
      { id: `member-${Date.now()}-${draft.members.length}`, name: "" },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/80 bg-gradient-to-br from-surface to-surface/80 p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: draft.color || "#1d4ed8" }}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{localizedPreview}</h3>
              <Badge variant={draft.isSystem ? "secondary" : "outline"}>
                {draft.isSystem
                  ? t("utilities.schedules.departmentManagement.system")
                  : t("utilities.schedules.departmentManagement.custom")}
              </Badge>
              {!draft.isActive ? (
                <Badge variant="outline">{t("utilities.schedules.departmentManagement.inactive")}</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("utilities.schedules.departmentManagement.formDescription")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDelete ? (
            <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>
              {t("actions.delete")}
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={disabled} onClick={onSave}>
            {t("actions.save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4 rounded-xl border border-border/80 bg-background p-4 shadow-sm">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("utilities.schedules.departmentManagement.localizedNames")}
            </h4>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                id="schedule-name-pt"
                label={t("utilities.schedules.departmentManagement.namePt")}
                value={draft.namePt}
                disabled={disabled}
                onChange={(event) => updateField("namePt", event.target.value)}
              />
              <Input
                id="schedule-name-en"
                label={t("utilities.schedules.departmentManagement.nameEn")}
                value={draft.nameEn}
                disabled={disabled}
                onChange={(event) => updateField("nameEn", event.target.value)}
              />
              <Input
                id="schedule-name-es"
                label={t("utilities.schedules.departmentManagement.nameEs")}
                value={draft.nameEs}
                disabled={disabled}
                onChange={(event) => updateField("nameEs", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {t("utilities.schedules.departmentManagement.membersTitle")}
              </h4>
              <span className="text-xs text-muted-foreground">
                {t("utilities.schedules.departmentManagement.membersCount", { count: draft.members.length })}
              </span>
            </div>
            <MemberListEditor
              members={draft.members}
              disabled={disabled}
              onChange={updateMembers}
              onAdd={addMember}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border/80 bg-background p-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("utilities.schedules.departmentManagement.icon")}
            </label>
            <Select value={draft.icon} onValueChange={(value) => updateField("icon", value)} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder={t("utilities.schedules.departmentManagement.icon")} />
              </SelectTrigger>
              <SelectContent>
                {scheduleIconOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <OptionIcon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="schedule-department-color" className="text-sm font-medium text-foreground">
              {t("utilities.schedules.departmentManagement.color")}
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <input
                id="schedule-department-color"
                type="color"
                value={draft.color}
                disabled={disabled}
                onChange={(event) => updateField("color", event.target.value)}
                className="h-9 w-12 rounded border border-border bg-transparent p-1"
              />
              <span className="text-sm text-muted-foreground">{draft.color}</span>
            </div>
          </div>

          <Input
            id="schedule-people-per-day"
            type="number"
            min={1}
            label={t("utilities.schedules.departmentManagement.peoplePerDay")}
            value={String(draft.peoplePerDay)}
            disabled={disabled}
            onChange={(event) => updateField("peoplePerDay", Math.max(1, Number(event.target.value) || 1))}
          />

          <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.isActive}
              disabled={disabled}
              onChange={(event) => updateField("isActive", event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{t("utilities.schedules.departmentManagement.active")}</span>
          </label>

          <div className="rounded-lg border border-dashed border-border/80 px-3 py-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              {t("utilities.schedules.departmentManagement.activeLocaleTitle")}
            </div>
            <div className="mt-1">
              {t("utilities.schedules.departmentManagement.activeLocaleHint", {
                locale: locale.split("-")[0].toUpperCase(),
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function toScheduleDepartmentInput(draft: ScheduleDepartmentDraft): ScheduleDepartmentInput {
  return {
    id: draft.id,
    code: draft.code,
    namePt: draft.namePt.trim() || null,
    nameEn: draft.nameEn.trim() || null,
    nameEs: draft.nameEs.trim() || null,
    icon: draft.icon,
    color: draft.color,
    peoplePerDay: draft.peoplePerDay,
    sortOrder: draft.sortOrder,
    isActive: draft.isActive,
  };
}

export function buildEmptyDepartmentDraft(sortOrder: number): ScheduleDepartmentDraft {
  return {
    id: null,
    code: null,
    namePt: "",
    nameEn: "",
    nameEs: "",
    icon: "users",
    color: "#1d4ed8",
    peoplePerDay: 1,
    sortOrder,
    isActive: true,
    isSystem: false,
    members: [],
  };
}

export function getRequiredLocalizedName(
  draft: ScheduleDepartmentDraft,
  locale: string,
) {
  const language = locale.split("-")[0];
  if (language === "pt") {
    return draft.namePt.trim();
  }
  if (language === "es") {
    return draft.nameEs.trim();
  }
  return draft.nameEn.trim();
}

export function departmentDraftFromEntity(
  department: {
    id: number;
    code: string | null;
    namePt: string | null;
    nameEn: string | null;
    nameEs: string | null;
    icon: string;
    color: string;
    peoplePerDay: number;
    sortOrder: number;
    isSystem: boolean;
    isActive: boolean;
    members: Array<{ id: number; name: string }>;
  },
): ScheduleDepartmentDraft {
  return {
    id: department.id,
    code: department.code,
    namePt: department.namePt ?? "",
    nameEn: department.nameEn ?? "",
    nameEs: department.nameEs ?? "",
    icon: department.icon,
    color: department.color,
    peoplePerDay: department.peoplePerDay,
    sortOrder: department.sortOrder,
    isActive: department.isActive,
    isSystem: department.isSystem,
    members: department.members.map((member) => ({ id: String(member.id), name: member.name })),
  };
}
