import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import type { AddItemOnAdd } from "./types";

export function AnnotationForm({ onAdd, initialTitle, initialNotes, submitLabel }: { onAdd: AddItemOnAdd; initialTitle?: string; initialNotes?: string | null; submitLabel?: string }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("services.title")}</label>
        <Input
          placeholder={t("services.titlePlaceholder", "Ex: Oração de abertura")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("services.notes")}</label>
        <textarea
          className="rounded-md border border-border bg-surface text-foreground placeholder:text-muted-foreground p-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          rows={6}
          placeholder={t("services.notesPlaceholder", "Anotações, instruções ou lembretes...")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button disabled={title.trim().length === 0} onClick={() => onAdd("annotation", title.trim(), null, notes.trim() || null)}>
        {submitLabel ?? t("actions.add")}
      </Button>
    </div>
  );
}
