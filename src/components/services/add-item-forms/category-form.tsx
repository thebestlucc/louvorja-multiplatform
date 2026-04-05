import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { cn } from "../../../lib/utils";
import { getPreference, setPreference } from "../../../lib/store";
import { countCategoryUsages, deleteCategoriesByTitle } from "../../../lib/tauri/services";
import { catcher } from "../../../lib/catcher";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queries/keys";
import type { AddItemOnAdd } from "./types";

const STORE_KEY = "section_library";

interface CategoryFormProps {
  onAdd: AddItemOnAdd;
  initialTitle?: string;
  submitLabel?: string;
  existingCategories?: { id: number; title: string }[];
}

export function CategoryForm({ onAdd, initialTitle, submitLabel, existingCategories }: CategoryFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState(initialTitle ?? "");
  const [library, setLibrary] = useState<string[]>([]);
  const [warning, setWarning] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ name: string; count: number } | null>(null);
  const isEditMode = !!initialTitle || !!submitLabel;

  useEffect(() => {
    void getPreference<string[]>(STORE_KEY, []).then((stored) => {
      // Merge existing liturgy sections into the library so previously-created
      // sections (before the library feature existed) are not lost.
      const extra = (existingCategories ?? [])
        .map((c) => c.title)
        .filter((title) => !stored.some((s) => s.toLowerCase() === title.toLowerCase()));
      const merged = [...stored, ...extra];
      if (extra.length > 0) void setPreference(STORE_KEY, merged);
      setLibrary(merged);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInLiturgy = (name: string) =>
    existingCategories?.some(c => c.title.toLowerCase() === name.toLowerCase()) ?? false;

  const isInLibrary = (name: string) =>
    library.some(l => l.toLowerCase() === name.toLowerCase());

  const persistLibrary = (next: string[]) => {
    setLibrary(next);
    void setPreference(STORE_KEY, next);
  };

  const handleAddFromLibrary = (name: string) => {
    if (isInLiturgy(name)) {
      setWarning(t("services.categories.alreadyExists"));
      return;
    }
    setWarning("");
    onAdd("category", name, null, null);
  };

  const doRemoveFromLibrary = (name: string) => {
    persistLibrary(library.filter(l => l !== name));
  };

  const handleRemoveFromLibrary = async (name: string) => {
    const [count] = await catcher(countCategoryUsages(name));
    if (count && count > 0) {
      setConfirmDelete({ name, count });
    } else {
      doRemoveFromLibrary(name);
    }
  };

  const handleCustom = () => {
    const trimmed = custom.trim();
    if (trimmed.length === 0) return;

    if (isInLiturgy(trimmed)) {
      setWarning(t("services.categories.alreadyExists"));
      return;
    }

    setWarning("");

    // Add to library if not already there
    if (!isInLibrary(trimmed)) {
      persistLibrary([...library, trimmed]);
    }

    onAdd("category", trimmed, null, null);
    setCustom("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section library (add mode only) */}
      {!isEditMode && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("services.categories.existingLabel")}
          </label>
          {library.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground/70">
              {t("services.categories.emptyLibrary", "Nenhuma seção criada ainda")}
            </p>
          ) : (
            <ScrollArea className="max-h-50">
              <div className="flex flex-col gap-0.5">
                {library.map((name) => (
                  <div
                    key={name}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                      "text-foreground transition-colors hover:bg-surface-hover cursor-pointer"
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAddFromLibrary(name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleAddFromLibrary(name);
                    }}
                  >
                    <span className="truncate">{name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemoveFromLibrary(name);
                      }}
                      className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Add new section */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("services.categories.customLabel")}
        </label>
        <div className="flex gap-2">
          <Input
            placeholder={t("services.categories.customPlaceholder")}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setWarning("");
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustom();
            }}
          />
          <Button
            disabled={custom.trim().length === 0}
            onClick={handleCustom}
          >
            {submitLabel ?? t("actions.add")}
          </Button>
        </div>
        {warning && (
          <p className="text-xs text-amber-600">{warning}</p>
        )}
      </div>

      {/* Confirmation dialog for removing section from library */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("services.categories.deleteFromLibrary")}</DialogTitle>
            <DialogDescription>
              {confirmDelete && t("services.categories.deleteFromLibraryConfirm", { count: confirmDelete.count })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              className="flex flex-col items-center gap-1 rounded-lg border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
              onClick={() => {
                if (confirmDelete) doRemoveFromLibrary(confirmDelete.name);
                setConfirmDelete(null);
              }}
            >
              {t("services.categories.deleteLibraryOnly")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("services.categories.deleteLibraryOnlyDesc")}
              </span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1 rounded-lg border border-amber-500/50 px-3 py-3 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/10"
              onClick={async () => {
                if (confirmDelete) {
                  await catcher(deleteCategoriesByTitle(confirmDelete.name, true), { notify: true });
                  doRemoveFromLibrary(confirmDelete.name);
                  void queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
                }
                setConfirmDelete(null);
              }}
            >
              {t("services.categories.deleteUngroupLiturgies")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("services.categories.deleteUngroupLiturgiesDesc")}
              </span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1 rounded-lg bg-destructive px-3 py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 [&>span]:text-destructive-foreground/70"
              onClick={async () => {
                if (confirmDelete) {
                  await catcher(deleteCategoriesByTitle(confirmDelete.name, false), { notify: true });
                  doRemoveFromLibrary(confirmDelete.name);
                  void queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
                }
                setConfirmDelete(null);
              }}
            >
              {t("services.categories.deleteWithItemsLiturgies")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("services.categories.deleteWithItemsLiturgiesDesc")}
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("actions.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
