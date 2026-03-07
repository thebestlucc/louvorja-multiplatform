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
import { GripVertical, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleDayDepartment } from "../../lib/bindings";
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
import { getScheduleDepartmentIcon, getScheduleDepartmentLabel } from "./department-meta";
import { cn } from "../../lib/utils";

interface DayDepartmentCardProps {
  locale: string;
  dayDepartment: ScheduleDayDepartment;
  disabled?: boolean;
  onSaveManual: (params: {
    scheduleDayDepartmentId: number;
    peoplePerDay: number;
    memberIds: number[];
  }) => Promise<void>;
  onResetGenerated: (params: {
    scheduleDayDepartmentId: number;
    peoplePerDay: number;
  }) => Promise<void>;
}

export function DayDepartmentCard({
  locale,
  dayDepartment,
  disabled,
  onSaveManual,
  onResetGenerated,
}: DayDepartmentCardProps) {
  const { t } = useTranslation();
  const [peoplePerDay, setPeoplePerDay] = useState(dayDepartment.peoplePerDay);
  const [memberIds, setMemberIds] = useState<number[]>(
    dayDepartment.assignments.map((assignment) => assignment.memberId),
  );
  const [candidateMemberId, setCandidateMemberId] = useState<string>("");

  useEffect(() => {
    setPeoplePerDay(dayDepartment.peoplePerDay);
    setMemberIds(dayDepartment.assignments.map((assignment) => assignment.memberId));
    setCandidateMemberId("");
  }, [dayDepartment]);

  const availableMembers = useMemo(
    () => (dayDepartment.department?.members ?? []).filter((member) => member.isActive),
    [dayDepartment.department?.members],
  );
  const assignedMembers = useMemo(
    () => memberIds
      .map((memberId) => availableMembers.find((member) => member.id === memberId))
      .filter((member): member is NonNullable<typeof member> => Boolean(member)),
    [availableMembers, memberIds],
  );
  const unassignedMembers = useMemo(
    () => availableMembers.filter((member) => !memberIds.includes(member.id)),
    [availableMembers, memberIds],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const department = dayDepartment.department;
  const Icon = getScheduleDepartmentIcon(department?.icon);
  const canAddAssignee = candidateMemberId.length > 0 && memberIds.length < peoplePerDay;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const ids = assignedMembers.map((member) => member.id);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    setMemberIds(arrayMove(memberIds, oldIndex, newIndex));
  };

  const handleAddAssignee = () => {
    if (!canAddAssignee) {
      return;
    }

    setMemberIds([...memberIds, Number(candidateMemberId)]);
    setCandidateMemberId("");
  };

  const handleRemoveAssignee = (memberId: number) => {
    setMemberIds(memberIds.filter((value) => value !== memberId));
  };

  const handlePeoplePerDayChange = (value: string) => {
    const nextValue = Math.max(1, Number(value) || 1);
    setPeoplePerDay(nextValue);
    if (memberIds.length > nextValue) {
      setMemberIds(memberIds.slice(0, nextValue));
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: department?.color ?? "#334155" }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {getScheduleDepartmentLabel(department, locale)}
              </h4>
              <Badge variant={dayDepartment.manualOverride ? "default" : "outline"}>
                {dayDepartment.manualOverride
                  ? t("utilities.schedules.dayDetails.manualOverride")
                  : t("utilities.schedules.dayDetails.generated")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("utilities.schedules.dayDetails.assignmentCount", {
                selected: memberIds.length,
                count: peoplePerDay,
              })}
            </p>
          </div>
        </div>

        <div className="w-full max-w-32">
          <Input
            id={`people-per-day-${dayDepartment.id}`}
            type="number"
            min={1}
            label={t("utilities.schedules.dayDetails.peoplePerDay")}
            value={String(peoplePerDay)}
            disabled={disabled}
            onChange={(event) => handlePeoplePerDayChange(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Select value={candidateMemberId} onValueChange={setCandidateMemberId} disabled={disabled || unassignedMembers.length === 0 || memberIds.length >= peoplePerDay}>
          <SelectTrigger>
            <SelectValue placeholder={t("utilities.schedules.dayDetails.addAssigneePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {unassignedMembers.map((member) => (
              <SelectItem key={member.id} value={String(member.id)}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" onClick={handleAddAssignee} disabled={disabled || !canAddAssignee}>
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.add")}
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-surface/40 p-3">
        {assignedMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
            {availableMembers.length === 0
              ? t("utilities.schedules.dayDetails.noDepartmentMembers")
              : t("utilities.schedules.dayDetails.noAssignedPeople")}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={assignedMembers.map((member) => member.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {assignedMembers.map((member, index) => (
                  <SortableAssigneeRow
                    key={member.id}
                    memberId={member.id}
                    index={index}
                    name={member.name}
                    disabled={disabled}
                    onRemove={() => handleRemoveAssignee(member.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void onResetGenerated({ scheduleDayDepartmentId: dayDepartment.id, peoplePerDay })}
          disabled={disabled}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {t("utilities.schedules.dayDetails.resetToGenerated")}
        </Button>
        <Button
          type="button"
          onClick={() => void onSaveManual({ scheduleDayDepartmentId: dayDepartment.id, peoplePerDay, memberIds })}
          disabled={disabled}
        >
          <Save className="mr-2 h-4 w-4" />
          {t("utilities.schedules.dayDetails.saveAssignments")}
        </Button>
      </div>
    </div>
  );
}

function SortableAssigneeRow({
  memberId,
  index,
  name,
  disabled,
  onRemove,
}: {
  memberId: number;
  index: number;
  name: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: memberId, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-2 shadow-sm",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        disabled={disabled}
        aria-label={`Reorder assignee ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
        {index + 1}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>

      <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
