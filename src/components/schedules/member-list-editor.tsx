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
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface EditableMember {
  id: string;
  name: string;
}

interface MemberListEditorProps {
  members: EditableMember[];
  disabled?: boolean;
  onChange: (members: EditableMember[]) => void;
  onAdd: () => void;
}

export function MemberListEditor({ members, disabled, onChange, onAdd }: MemberListEditorProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = members.map((member) => member.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onChange(arrayMove(members, oldIndex, newIndex));
  };

  const updateMemberName = (memberId: string, name: string) => {
    onChange(
      members.map((member) => member.id === memberId ? { ...member, name } : member),
    );
  };

  const removeMember = (memberId: string) => {
    onChange(members.filter((member) => member.id !== memberId));
  };

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {members.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                {t("utilities.schedules.departmentManagement.membersEmpty")}
              </div>
            ) : (
              members.map((member, index) => (
                <SortableMemberRow
                  key={member.id}
                  member={member}
                  index={index}
                  disabled={disabled}
                  onChangeName={(name) => updateMemberName(member.id, name)}
                  onRemove={() => removeMember(member.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={disabled}>
        <Plus className="mr-2 h-4 w-4" />
        {t("utilities.schedules.departmentManagement.addMember")}
      </Button>
    </div>
  );
}

function SortableMemberRow({
  member,
  index,
  disabled,
  onChangeName,
  onRemove,
}: {
  member: EditableMember;
  index: number;
  disabled?: boolean;
  onChangeName: (name: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id, disabled });

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
        aria-label={`Reorder member ${index + 1}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
        {index + 1}
      </span>

      <input
        value={member.name}
        disabled={disabled}
        onChange={(event) => onChangeName(event.target.value)}
        className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove member"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
