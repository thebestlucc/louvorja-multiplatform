import { useTranslation } from "react-i18next";
import { FileIcon, MoreVertical, Trash2, Edit2, Play, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { useMediaLibraryItems, useUpsertMediaLibraryItem, useDeleteMediaLibraryItem } from "../../lib/queries";
import { MediaLibraryItem } from "../../lib/bindings";
import { Card, CardContent, CardFooter } from "../ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { open } from "@tauri-apps/plugin-dialog";

interface ItemGridProps {
  categoryId: number | null;
}

export function ItemGrid({ categoryId }: ItemGridProps) {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = useMediaLibraryItems(categoryId ?? 0);
  const upsertMutation = useUpsertMediaLibraryItem();
  const deleteMutation = useDeleteMediaLibraryItem(categoryId ?? 0);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaLibraryItem | null>(null);
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");

  if (!categoryId) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed p-12">
        <p className="text-muted-foreground">{t("mediaLibrary.selectCategoryHint", "Select a category to view items")}</p>
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

  const handleSave = () => {
    upsertMutation.mutate({
      id: editingItem?.id ?? null,
      categoryId: categoryId,
      name,
      filePath,
      fileType: filePath.split(".").pop()?.toLowerCase() ?? "unknown",
      thumbnailPath: null,
      sortOrder: editingItem?.sortOrder ?? 0,
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm(t("hymn.deleteConfirm"))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t("mediaLibrary.items", "Items")}</h3>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">{t("mediaLibrary.noItems", "No items in this category")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <Card key={item.id} className="group relative overflow-hidden border-border bg-surface shadow-none transition-colors hover:border-primary/50">
              <CardContent className="flex aspect-video items-center justify-center bg-accent/5 p-0">
                {item.thumbnailPath ? (
                  <img src={item.thumbnailPath} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <FileIcon className="h-10 w-10 text-muted-foreground/30" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="secondary" className="rounded-full">
                    <Play className="h-5 w-5 text-foreground" />
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="p-2">
                <div className="flex w-full items-center justify-between gap-1 overflow-hidden">
                  <span className="truncate text-xs font-medium text-foreground" title={item.name}>
                    {item.name}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(item)}>
                        <Edit2 className="mr-2 h-3 w-3" />
                        {t("actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        {t("actions.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t("mediaLibrary.editItem", "Edit Item") : t("mediaLibrary.addItem", "Add Item")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t("mediaLibrary.nameLabel", "Name")}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("mediaLibrary.namePlaceholder", "Item name")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t("mediaLibrary.filePathLabel", "File Path")}</label>
              <div className="flex gap-2">
                <Input
                  value={filePath}
                  readOnly
                  placeholder={t("mediaLibrary.filePathPlaceholder", "Select a file...")}
                />
                <Button variant="secondary" onClick={handlePickFile}>
                  {t("actions.open")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || !filePath}>
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
