import { usePresentations } from "../../../lib/queries";
import { ScrollArea } from "../../ui/scroll-area";
import type { Presentation as PresentationType } from "../../../lib/bindings";
import type { AddItemOnAdd } from "./types";

export function PresentationForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { data: presentations } = usePresentations();

  return (
    <ScrollArea className="h-56">
      <div className="flex flex-col gap-0.5">
        {(presentations ?? []).map((pres: PresentationType) => (
          <button
            key={pres.id}
            className="cursor-pointer rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
            onClick={() => onAdd("presentation", pres.title, pres.id, null)}
          >
            <span className="truncate">{pres.title}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
