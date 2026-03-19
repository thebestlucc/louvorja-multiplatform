import { useTranslation } from "react-i18next";
import { Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { useMediaLibraryCategories, useUpsertMediaLibraryCategory, useDeleteMediaLibraryCategory } from "../../lib/queries";
import { MediaLibraryCategory } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";

interface CategorySidebarProps {
  selectedCategoryId: number | null;
  onSelectCategory: (id: number) => void;
}

export function CategorySidebar({ selectedCategoryId, onSelectCategory }: CategorySidebarProps) {
  const { t, i18n } = useTranslation();
  const { data: categories = [] } = useMediaLibraryCategories(i18n.language);
  const upsertMutation = useUpsertMediaLibraryCategory();
  const deleteMutation = useDeleteMediaLibraryCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MediaLibraryCategory | null>(null);
  const [name, setName] = useState("");

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: MediaLibraryCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({
      id: editingCategory?.id ?? null,
      name,
      sortOrder: editingCategory?.sortOrder ?? 0,
      idLanguage: i18n.language,
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
    <div className="flex w-64 flex-col gap-2 border-r pr-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("categories.title", "Categories")}
        </h3>
        <Button variant="ghost" size="icon" onClick={handleOpenAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {categories.map((category) => (
          <div
            key={category.id}
            className={cn(
              "group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
              selectedCategoryId === category.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <button
              className="flex-1 text-left"
              onClick={() => onSelectCategory(category.id)}
            >
              {category.name}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenEdit(category)}>
                  <Edit2 className="mr-2 h-3 w-3" />
                  {t("actions.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDelete(category.id)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t("categories.edit", "Edit Category") : t("categories.add", "Add Category")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("categories.namePlaceholder", "Category name")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
