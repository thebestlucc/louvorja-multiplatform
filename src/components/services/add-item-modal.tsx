import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLiturgy } from "../../lib/queries/services";
import {
  Music,
  BookOpen,
  Presentation,
  StickyNote,
  Link2,
  FileIcon,
  Layers,
  CalendarClock,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";
import type { LiturgyItemType, LiturgyItem } from "../../types/liturgy";
import { downloadOnlineVideo } from "../../lib/tauri/youtube";
import {
  HymnForm,
  BibleForm,
  PresentationForm,
  AnnotationForm,
  UrlForm,
  FileForm,
  ScheduledCategoryForm,
  CategoryForm,
} from "./add-item-forms";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  onAdd: (itemType: string, title: string, itemId: number | null, notes: string | null) => Promise<unknown> | void;
  editItem?: LiturgyItem;
  onEdit?: (id: number, title: string, notes: string | null) => void;
  onRemoveItem?: (id: number) => void;
}

const TYPES: { type: LiturgyItemType; icon: typeof Music }[] = [
  { type: "hymn", icon: Music },
  { type: "bible", icon: BookOpen },
  { type: "presentation", icon: Presentation },
  { type: "category", icon: Layers },
  { type: "annotation", icon: StickyNote },
  { type: "url", icon: Link2 },
  { type: "file", icon: FileIcon },
  { type: "scheduled_category", icon: CalendarClock },
];

const DEFAULT_TYPE: LiturgyItemType = "hymn";

export function AddItemModal({ open, onOpenChange, serviceId, onAdd, editItem, onEdit, onRemoveItem: _onRemoveItem }: AddItemModalProps) {
  const { t } = useTranslation();
  const isEditMode = !!editItem;
  const [activeType, setActiveType] = useState<LiturgyItemType>(DEFAULT_TYPE);
  const { data: liturgyData } = useLiturgy(serviceId);
  const liturgyItems = liturgyData?.items ?? [];

  useEffect(() => {
    if (open && editItem) {
      // Map online_video back to "url" tab since that's where the URL form lives
      setActiveType(editItem.itemType === "online_video" ? "url" : editItem.itemType as LiturgyItemType);
    } else if (!open) {
      setActiveType(DEFAULT_TYPE);
    }
  }, [open, editItem]);

  const handleAdd = async (itemType: string, title: string, itemId: number | null, notes: string | null) => {
    if (isEditMode && editItem && onEdit) {
      onEdit(editItem.id, title, notes);
      onOpenChange(false);
      return;
    }

    await onAdd(itemType, title, itemId, notes);
    onOpenChange(false);

    // Trigger background download if requested
    if (itemType === "online_video" && notes) {
      try {
        const parsed = JSON.parse(notes) as { videoId?: string; downloadForOffline?: boolean };
        if (parsed.downloadForOffline && parsed.videoId) {
          void downloadOnlineVideo(parsed.videoId, "standalone", "720").catch(() => {});
        }
      } catch {
        /* invalid JSON, ignore */
      }
    }
  };

  // Extract initial values for forms in edit mode
  const editInitialUrl = (() => {
    if (!editItem?.notes) return undefined;
    if (editItem.itemType === "online_video") {
      try {
        const parsed = JSON.parse(editItem.notes) as { videoUrl?: string };
        return parsed.videoUrl ?? undefined;
      } catch { return undefined; }
    }
    if (editItem.itemType === "url") return editItem.notes;
    return undefined;
  })();

  const editInitialFilePath = editItem?.itemType === "file" ? (editItem.notes ?? undefined) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[900px] flex-col gap-0 overflow-hidden bg-surface p-0">
        {/* Header */}
        <DialogTitle className="border-b border-border px-6 py-4 text-base font-semibold text-foreground">
          {isEditMode ? t("services.editItem") : t("services.addItem")}
        </DialogTitle>

        {/* Body: sidebar + content */}
        <div className="flex min-h-0 flex-1">
          {/* Left: type list */}
          <nav className="flex w-52 flex-shrink-0 flex-col gap-0.5 border-r border-border p-3 overflow-y-auto">
            {TYPES.map(({ type, icon: Icon }) => {
              // In edit mode, map online_video to url tab for matching
              const editMappedType = editItem?.itemType === "online_video" ? "url" : editItem?.itemType;
              const isDisabled = isEditMode && type !== editMappedType;
              return (
              <button
                key={type}
                type="button"
                onClick={() => !isDisabled && setActiveType(type)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "cursor-pointer",
                  activeType === type
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">
                  {t(`services.itemTypes.${type}`)}
                </span>
              </button>
              );
            })}
          </nav>

          {/* Right: form */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeType === "hymn" && <HymnForm onAdd={handleAdd} initialTitle={isEditMode ? editItem?.title : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} />}
            {activeType === "bible" && <BibleForm onAdd={handleAdd} initialTitle={isEditMode ? editItem?.title : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} />}
            {activeType === "presentation" && <PresentationForm onAdd={handleAdd} initialTitle={isEditMode ? editItem?.title : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} />}
            {activeType === "annotation" && <AnnotationForm onAdd={handleAdd} initialTitle={isEditMode ? editItem?.title : undefined} initialNotes={isEditMode ? editItem?.notes : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} />}
            {activeType === "url" && <UrlForm onAdd={handleAdd} items={liturgyItems} initialUrl={editInitialUrl} initialTitle={isEditMode ? editItem?.title : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} />}
            {activeType === "file" && <FileForm onAdd={handleAdd} initialFilePath={editInitialFilePath} initialTitle={isEditMode ? editItem?.title : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} />}
            {activeType === "scheduled_category" && <ScheduledCategoryForm onAdd={handleAdd} />}
            {activeType === "category" && <CategoryForm onAdd={handleAdd} initialTitle={isEditMode ? editItem?.title : undefined} submitLabel={isEditMode ? t("actions.save") : undefined} existingCategories={!isEditMode ? liturgyItems.filter(i => i.itemType === "category").map(i => ({ id: i.id, title: i.title })) : undefined} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
