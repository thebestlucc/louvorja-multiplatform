import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import type { AddItemOnAdd } from "./types";

export function AnnotationForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("services.title")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="rounded-md border border-border bg-transparent p-2.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
        rows={3}
        placeholder={t("services.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button size="sm" disabled={title.trim().length === 0} onClick={() => onAdd("annotation", title.trim(), null, notes.trim() || null)}>
        {t("actions.add")}
      </Button>
    </div>
  );
}
