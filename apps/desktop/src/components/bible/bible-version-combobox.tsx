import { useState } from "react";
import { Command } from "cmdk";
import { ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent } from "../ui/popover";
import { cn } from "../../lib/utils";
import type { BibleVersion } from "../../lib/bindings";

interface BibleVersionComboboxProps {
  versions: BibleVersion[];
  value: number;
  onValueChange: (id: number) => void;
  className?: string;
  triggerClassName?: string;
}

export function BibleVersionCombobox({
  versions,
  value,
  onValueChange,
  className,
  triggerClassName,
}: BibleVersionComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = versions.find((v) => v.id === value);

  const handleSelect = (id: number) => {
    onValueChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className={cn(
          "flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          "hover:bg-surface-hover",
          "min-w-0",
          triggerClassName,
        )}
      >
        <span className="truncate">
          {selected ? `${selected.abbreviation}${selected.name ? ` — ${selected.name}` : ""}` : "—"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && <PopoverContent onClose={() => setOpen(false)} className={cn("w-72 p-0 overflow-hidden", className)}>
        <Command>
          <div className="border-b border-border px-3 py-2">
            <Command.Input
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="NAA, Almeida..."
            />
          </div>
          <Command.List className="max-h-56 overflow-y-auto p-1 [scrollbar-width:thin]">
            <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma versão encontrada.
            </Command.Empty>
            {versions.map((v) => (
              <Command.Item
                key={v.id}
                value={`${v.abbreviation} ${v.name ?? ""}`}
                onSelect={() => handleSelect(v.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none",
                  "aria-selected:bg-surface-hover",
                  "data-[selected=true]:bg-surface-hover",
                )}
              >
                <span className="w-12 shrink-0 font-semibold text-primary text-xs">
                  {v.abbreviation}
                </span>
                <span className="flex-1 truncate text-foreground">{v.name ?? v.abbreviation}</span>
                {v.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>}
    </Popover>
  );
}
