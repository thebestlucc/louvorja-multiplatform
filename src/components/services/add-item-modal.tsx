import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHymns, usePresentations } from "../../lib/queries";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  onAdd: (itemType: string, title: string, itemId: number | null, notes: string | null) => void;
}

export function AddItemModal({ open, onOpenChange, onAdd }: AddItemModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("services.addItem")}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="hymn" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="hymn" className="flex-1">{t("services.itemTypes.hymn")}</TabsTrigger>
            <TabsTrigger value="bible" className="flex-1">{t("services.itemTypes.bible")}</TabsTrigger>
            <TabsTrigger value="presentation" className="flex-1">{t("services.itemTypes.presentation")}</TabsTrigger>
            <TabsTrigger value="annotation" className="flex-1">{t("services.itemTypes.annotation")}</TabsTrigger>
          </TabsList>

          <TabsContent value="hymn">
            <HymnTab onAdd={(title, itemId) => { onAdd("hymn", title, itemId, null); onOpenChange(false); }} />
          </TabsContent>

          <TabsContent value="bible">
            <BibleTab onAdd={(title) => { onAdd("bible", title, null, null); onOpenChange(false); }} />
          </TabsContent>

          <TabsContent value="presentation">
            <PresentationTab onAdd={(title, itemId) => { onAdd("presentation", title, itemId, null); onOpenChange(false); }} />
          </TabsContent>

          <TabsContent value="annotation">
            <AnnotationTab onAdd={(title, notes) => { onAdd("annotation", title, null, notes); onOpenChange(false); }} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function HymnTab({ onAdd }: { onAdd: (title: string, itemId: number) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: hymns } = useHymns(query);

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder={t("hymnal.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ScrollArea className="h-48">
        <div className="flex flex-col gap-1">
          {(hymns ?? []).map((hymn) => (
            <button
              key={hymn.id}
              className="flex items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-surface-hover"
              onClick={() => onAdd(hymn.title, hymn.id)}
            >
              {hymn.number != null && (
                <span className="shrink-0 text-xs text-muted-foreground">{hymn.number}</span>
              )}
              <span className="truncate">{hymn.title}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function BibleTab({ onAdd }: { onAdd: (title: string) => void }) {
  const { t } = useTranslation();
  const [reference, setReference] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder={t("bible.searchPlaceholder")}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <Button
        size="sm"
        disabled={reference.trim().length === 0}
        onClick={() => onAdd(reference.trim())}
      >
        {t("actions.add")}
      </Button>
    </div>
  );
}

function PresentationTab({ onAdd }: { onAdd: (title: string, itemId: number) => void }) {
  const { data: presentations } = usePresentations();

  return (
    <ScrollArea className="h-48">
      <div className="flex flex-col gap-1">
        {(presentations ?? []).map((pres) => (
          <button
            key={pres.id}
            className="rounded-md p-2 text-left text-sm hover:bg-surface-hover"
            onClick={() => onAdd(pres.title, pres.id)}
          >
            <span className="truncate">{pres.title}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function AnnotationTab({ onAdd }: { onAdd: (title: string, notes: string | null) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder={t("services.title")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="rounded-md border border-border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        rows={3}
        placeholder={t("services.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button
        size="sm"
        disabled={title.trim().length === 0}
        onClick={() => onAdd(title.trim(), notes.trim() || null)}
      >
        {t("actions.add")}
      </Button>
    </div>
  );
}
