import { useSortable } from "@dnd-kit/sortable";

/** Droppable gap rendered after each section — gives a clear drop target for "insert after section" */
export function SortableGap({ id, isDragging }: { id: string; isDragging: boolean }) {
  const { setNodeRef, isOver } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="h-2 mx-2">
      {isDragging && isOver && (
        <div className="h-0.5 w-full rounded-full bg-primary/60" />
      )}
    </div>
  );
}
