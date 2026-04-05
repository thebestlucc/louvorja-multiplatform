import { useEffect, useRef } from "react";
import { List, ListOrdered, Bold, Italic } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Badge } from "../ui/badge";
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
  shuffleOnGenerate: boolean;
  groupDatesInPrint: boolean;
  repeatMembersInGroupedDates: boolean;
  description: string;
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
}

export function DepartmentForm({
  draft,
  locale,
  disabled,
  onChange,
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

          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.shuffleOnGenerate}
              disabled={disabled}
              onChange={(event) => updateField("shuffleOnGenerate", event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="space-y-1">
              <span className="block font-medium">
                {t("utilities.schedules.departmentManagement.shuffleOnGenerate")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("utilities.schedules.departmentManagement.shuffleOnGenerateHint")}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.groupDatesInPrint}
              disabled={disabled}
              onChange={(event) => updateField("groupDatesInPrint", event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="space-y-1">
              <span className="block font-medium">
                {t("utilities.schedules.departmentManagement.groupDatesInPrint")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("utilities.schedules.departmentManagement.groupDatesInPrintHint")}
              </span>
            </span>
          </label>

          <label
            className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-foreground"
          >
            <input
              type="checkbox"
              checked={draft.repeatMembersInGroupedDates}
              disabled={disabled || !draft.groupDatesInPrint}
              onChange={(event) => updateField("repeatMembersInGroupedDates", event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="space-y-1">
              <span className="block font-medium">
                {t("utilities.schedules.departmentManagement.repeatMembersInGroupedDates")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("utilities.schedules.departmentManagement.repeatMembersInGroupedDatesHint")}
              </span>
            </span>
          </label>

          <DescriptionEditor
            value={draft.description}
            disabled={disabled}
            onChange={(value) => updateField("description", value)}
            label={t("utilities.schedules.departmentManagement.description")}
            hint={t("utilities.schedules.departmentManagement.descriptionHint")}
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
    shuffleOnGenerate: draft.shuffleOnGenerate,
    groupDatesInPrint: draft.groupDatesInPrint,
    repeatMembersInGroupedDates: draft.repeatMembersInGroupedDates,
    description: draft.description.trim() || null,
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
    shuffleOnGenerate: false,
    groupDatesInPrint: false,
    repeatMembersInGroupedDates: true,
    description: "",
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

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-50 ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DescriptionEditor({
  value,
  disabled,
  onChange,
  label,
  hint,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  label: string;
  hint: string;
}) {
  const isInternalUpdate = useRef(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: false,
        strike: false,
      }),
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      isInternalUpdate.current = true;
      const html = e.getHTML();
      onChange(html === "<p></p>" ? "" : html);
      isInternalUpdate.current = false;
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2 min-h-[5rem] text-sm text-foreground focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1",
      },
    },
  });

  useEffect(() => {
    if (editor && !isInternalUpdate.current && editor.getHTML() !== (value || "<p></p>")) {
      editor.commands.setContent(value || "");
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="overflow-hidden rounded-lg border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <div className="flex items-center gap-0.5 border-b border-border/60 bg-surface/50 px-1.5 py-1">
          <ToolbarButton
            active={editor.isActive("bold")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border/60" />
          <ToolbarButton
            active={editor.isActive("bulletList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
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
    shuffleOnGenerate: boolean;
    groupDatesInPrint: boolean;
    repeatMembersInGroupedDates: boolean;
    description: string | null;
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
    shuffleOnGenerate: department.shuffleOnGenerate,
    groupDatesInPrint: department.groupDatesInPrint,
    repeatMembersInGroupedDates: department.repeatMembersInGroupedDates,
    description: department.description ?? "",
    sortOrder: department.sortOrder,
    isActive: department.isActive,
    isSystem: department.isSystem,
    members: department.members.map((member) => ({ id: String(member.id), name: member.name })),
  };
}
