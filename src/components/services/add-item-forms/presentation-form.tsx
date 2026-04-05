import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { usePresentations } from "../../../lib/queries";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import type { Presentation as PresentationType } from "../../../lib/bindings";
import type { AddItemOnAdd } from "./types";

export function PresentationForm({ onAdd, initialTitle, submitLabel: _submitLabel }: { onAdd: AddItemOnAdd; initialTitle?: string; submitLabel?: string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialTitle ?? "");
  const { data: presentations } = usePresentations();

  const filtered = (presentations ?? []).filter((p: PresentationType) =>
    p.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("presentations.searchPlaceholder", "Buscar apresentação...")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <ScrollArea className="h-85">
        <div className="flex flex-col gap-0.5">
          {filtered.map((pres: PresentationType) => (
            <button
              key={pres.id}
              className="cursor-pointer rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              onClick={() => onAdd("presentation", pres.title, pres.id, null)}
            >
              <span className="truncate">{pres.title}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("presentations.noResults", "Nenhuma apresentação encontrada.")}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
