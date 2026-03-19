import { useTranslation } from "react-i18next";
import { FileIcon, MoreVertical, Trash2, Edit2, Plus, Calendar } from "lucide-react";
import { Button } from "../ui/button";
import { useMediaLibraryItemsByDate, useUpsertMediaLibraryItem, useDeleteMediaLibraryItem } from "../../lib/queries";
import { MediaLibraryItem } from "../../lib/bindings";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { open } from "@tauri-apps/plugin-dialog";
import { catcher } from "../../lib/catcher";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

interface ItemGridProps {
  categoryId: number | null;
  selectedDate: string | null;
}

export function ItemGrid({ categoryId, selectedDate }: ItemGridProps) {
  const { t, i18n } = useTranslation();
  const { data: items = [], isLoading } = useMediaLibraryItemsByDate(categoryId ?? 0, selectedDate);
  const upsertMutation = useUpsertMediaLibraryItem();
  const deleteMutation = useDeleteMediaLibraryItem(categoryId ?? 0);

  const isCategorySelected = categoryId !== null && categoryId > 0;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaLibraryItem | null>(null);
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");

  const dateFormater = new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "2-digit", year: "numeric" });

  if (!categoryId) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed p-12">
        <p className="text-muted-foreground">{t("utilities.mediaLibrary.selectCategoryHint")}</p>
      </div>
    );
  }

  const handlePickFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: "Media",
        extensions: ["mp4", "mkv", "avi", "pdf", "jpg", "png", "webp", "gif"]
      }]
    });
    if (selected && typeof selected === "string") {
      setFilePath(selected);
      if (!name) {
        const filename = selected.split(/[\\/]/).pop()?.split(".").shift();
        if (filename) setName(filename);
      }
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName("");
    setFilePath("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: MediaLibraryItem) => {
    setEditingItem(item);
    setName(item.name);
    setFilePath(item.filePath);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const [_, error] = await catcher(
      upsertMutation.mutateAsync({
        id: editingItem?.id ?? null,
        categoryId: categoryId,
        name,
        filePath,
        fileType: filePath.split(".").pop()?.toLowerCase() ?? "unknown",
        thumbnailPath: null,
        scheduledDate: selectedDate,
        sortOrder: editingItem?.sortOrder ?? 0,
      }),
      { notify: true }
    );

    if (!error) {
      setIsDialogOpen(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(t("hymn.deleteConfirm"))) {
      await catcher(deleteMutation.mutateAsync(id), { notify: true });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{t("utilities.mediaLibrary.items")}</h3>
          {selectedDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-accent/50 px-2 py-0.5 rounded-full border border-accent">
              <Calendar className="h-3 w-3" />
              {dateFormater.format(new Date(selectedDate + "T12:00:00Z"))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleOpenAdd} disabled={!isCategorySelected}>
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.add")}
        </Button>
      </div>

      <div className={cn("rounded-md border border-border bg-surface overflow-hidden", !isCategorySelected && "opacity-50 pointer-events-none")}>
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border bg-accent/5 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div>{t("utilities.mediaLibrary.nameLabel")}</div>
          <div className="flex items-center gap-10 pr-8">
            <div className="w-[100px]">{t("utilities.mediaLibrary.schedule")}</div>
            <div className="w-4"></div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-22rem)]">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-32 items-center justify-center p-8 text-center">
              <p className="text-sm text-muted-foreground">{t("utilities.mediaLibrary.noItems")}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((item: MediaLibraryItem) => (
                <div 
                  key={item.id} 
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-2 text-sm transition-colors hover:bg-surface-hover border-b border-border last:border-0 cursor-pointer"
                  onClick={() => console.log("Play item:", item.id)}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent/5 text-muted-foreground">
                      <FileIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <span className="truncate font-medium text-foreground" title={item.name}>
                        {item.name}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground opacity-70" title={item.filePath}>
                        {item.filePath}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pr-2" onClick={(e) => e.stopPropagation()}>
                    <div className="w-[100px] text-xs text-muted-foreground shrink-0">
                      {item.scheduledDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dateFormater.format(new Date(item.scheduledDate + "T12:00:00Z"))}
                        </div>
                      ) : (
                        <span className="italic opacity-50">{t("utilities.mediaLibrary.notScheduled")}</span>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleOpenEdit(item)}>
                          <Edit2 className="mr-2 h-3.5 w-3.5" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {t("actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t("utilities.mediaLibrary.editItem") : t("utilities.mediaLibrary.addItem")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t("utilities.mediaLibrary.nameLabel")}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("utilities.mediaLibrary.namePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t("utilities.mediaLibrary.filePathLabel")}</label>
              <div className="flex gap-2">
                <Input
                  value={filePath}
                  readOnly
                  placeholder={t("utilities.mediaLibrary.filePathPlaceholder")}
                />
                <Button variant="outline" onClick={handlePickFile} type="button">
                  {t("actions.open")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} type="button">
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || !filePath} type="button">
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
