import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Music,
  BookOpen,
  Presentation,
  StickyNote,
  Link2,
  FileIcon,
  ChevronLeft,
  Video,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";
import type { ServiceItemType } from "../../types/service";
import {
  HymnForm,
  BibleForm,
  PresentationForm,
  AnnotationForm,
  UrlForm,
  FileForm,
  ScheduledCategoryForm,
  OnlineVideoForm,
} from "./add-item-forms";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  onAdd: (itemType: string, title: string, itemId: number | null, notes: string | null) => void;
}

const ITEM_TYPES: { type: ServiceItemType; icon: typeof Music; color: string; hoverBorder: string }[] = [
  { type: "hymn", icon: Music, color: "bg-blue-500/15 text-blue-500 dark:text-blue-400", hoverBorder: "hover:border-blue-500/30" },
  { type: "bible", icon: BookOpen, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", hoverBorder: "hover:border-amber-500/30" },
  { type: "presentation", icon: Presentation, color: "bg-purple-500/15 text-purple-500 dark:text-purple-400", hoverBorder: "hover:border-purple-500/30" },
  { type: "annotation", icon: StickyNote, color: "bg-green-500/15 text-green-500 dark:text-green-400", hoverBorder: "hover:border-green-500/30" },
  { type: "url", icon: Link2, color: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400", hoverBorder: "hover:border-cyan-500/30" },
  { type: "file", icon: FileIcon, color: "bg-slate-500/15 text-slate-500 dark:text-slate-400", hoverBorder: "hover:border-slate-500/30" },
  { type: "online_video", icon: Video, color: "bg-red-500/15 text-red-500 dark:text-red-400", hoverBorder: "hover:border-red-500/30" },
];

export function AddItemModal({ open, onOpenChange, onAdd }: AddItemModalProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ServiceItemType | null>(null);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) setSelectedType(null);
  }, [open]);

  const handleAdd = (itemType: string, title: string, itemId: number | null, notes: string | null) => {
    onAdd(itemType, title, itemId, notes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card p-0">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-5 pt-5 pb-3 mb-6">
          {selectedType && (
            <button
              onClick={() => setSelectedType(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <DialogTitle className="text-base text-foreground">
            {selectedType
              ? t(`services.itemTypes.${selectedType}`)
              : t("services.addItem")}
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          {!selectedType ? (
            /* Step 1: Type picker grid */
            <div className="grid grid-cols-3 gap-2">
              {ITEM_TYPES.map(({ type, icon: Icon, color, hoverBorder }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-transparent p-4 transition-all duration-150",
                    color,
                    hoverBorder,
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">
                    {t(`services.itemTypes.${type}`)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Step 2: Type-specific form */
            <div className="pt-1">
              {selectedType === "hymn" && <HymnForm onAdd={handleAdd} />}
              {selectedType === "bible" && <BibleForm onAdd={handleAdd} />}
              {selectedType === "presentation" && <PresentationForm onAdd={handleAdd} />}
              {selectedType === "annotation" && <AnnotationForm onAdd={handleAdd} />}
              {selectedType === "url" && <UrlForm onAdd={handleAdd} />}
              {selectedType === "file" && <FileForm onAdd={handleAdd} />}
              {selectedType === "scheduled_category" && <ScheduledCategoryForm onAdd={handleAdd} />}
              {selectedType === "online_video" && <OnlineVideoForm onAdd={handleAdd} />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
