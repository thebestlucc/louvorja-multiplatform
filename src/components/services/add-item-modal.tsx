import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Music,
  BookOpen,
  Presentation,
  StickyNote,
  Link2,
  FileIcon,
  Video,
  Layers,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";
import type { LiturgyItemType } from "../../types/liturgy";
import {
  HymnForm,
  BibleForm,
  PresentationForm,
  AnnotationForm,
  UrlForm,
  FileForm,
  ScheduledCategoryForm,
  OnlineVideoForm,
  CategoryForm,
} from "./add-item-forms";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  onAdd: (itemType: string, title: string, itemId: number | null, notes: string | null) => void;
}

const TYPES: { type: LiturgyItemType; icon: typeof Music }[] = [
  { type: "hymn", icon: Music },
  { type: "bible", icon: BookOpen },
  { type: "presentation", icon: Presentation },
  { type: "category", icon: Layers },
  { type: "annotation", icon: StickyNote },
  { type: "url", icon: Link2 },
  { type: "file", icon: FileIcon },
  { type: "online_video", icon: Video },
];

const DEFAULT_TYPE: LiturgyItemType = "hymn";

export function AddItemModal({ open, onOpenChange, onAdd }: AddItemModalProps) {
  const { t } = useTranslation();
  const [activeType, setActiveType] = useState<LiturgyItemType>(DEFAULT_TYPE);

  useEffect(() => {
    if (!open) setActiveType(DEFAULT_TYPE);
  }, [open]);

  const handleAdd = (itemType: string, title: string, itemId: number | null, notes: string | null) => {
    onAdd(itemType, title, itemId, notes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] max-w-2xl flex-col gap-0 overflow-hidden bg-card p-0">
        {/* Header */}
        <DialogTitle className="border-b border-border px-5 py-3.5 text-sm font-semibold text-foreground">
          {t("services.addItem")}
        </DialogTitle>

        {/* Body: sidebar + content */}
        <div className="flex min-h-0 flex-1">
          {/* Left: type list */}
          <nav className="flex w-40 flex-shrink-0 flex-col gap-0.5 border-r border-border p-2 overflow-y-auto">
            {TYPES.map(({ type, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  activeType === type
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-xs">
                  {t(`services.itemTypes.${type}`)}
                </span>
              </button>
            ))}
          </nav>

          {/* Right: form */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {activeType === "hymn" && <HymnForm onAdd={handleAdd} />}
            {activeType === "bible" && <BibleForm onAdd={handleAdd} />}
            {activeType === "presentation" && <PresentationForm onAdd={handleAdd} />}
            {activeType === "annotation" && <AnnotationForm onAdd={handleAdd} />}
            {activeType === "url" && <UrlForm onAdd={handleAdd} />}
            {activeType === "file" && <FileForm onAdd={handleAdd} />}
            {activeType === "scheduled_category" && <ScheduledCategoryForm onAdd={handleAdd} />}
            {activeType === "online_video" && <OnlineVideoForm onAdd={handleAdd} />}
            {activeType === "category" && <CategoryForm onAdd={handleAdd} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
