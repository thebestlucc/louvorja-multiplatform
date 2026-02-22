import { DragEvent, FormEvent, useDeferredValue, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FolderOpen, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useImportCollectionSong,
} from "../../lib/queries";
import { CoverImage } from "../../components/media/cover-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/collections/")({
  component: CollectionsIndex,
});

function getCreationYear(createdAt: string): number | null {
  const match = createdAt.match(/^(\d{4})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function CollectionsIndex() {
  const { t } = useTranslation();
  const { data, isLoading } = useCollections();
  const createMutation = useCreateCollection();
  const deleteMutation = useDeleteCollection();
  const importSongMutation = useImportCollectionSong();

  const [tab, setTab] = useState<"albums" | "custom">("albums");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [uploadPaths, setUploadPaths] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const descriptionLimit = 280;
  const currentYear = new Date().getFullYear() + 1;
  const normalizedName = name.trim();
  const normalizedDescription = description.trim();
  const normalizedYear = year.trim();
  const parsedYear = normalizedYear.length > 0 ? Number(normalizedYear) : null;
  const yearInvalid =
    normalizedYear.length > 0 &&
    (!Number.isInteger(parsedYear) || (parsedYear != null && (parsedYear < 1900 || parsedYear > currentYear)));
  const nameError =
    name.length > 0 && normalizedName.length === 0 ? t("collections.nameRequired") : undefined;
  const descriptionTooLong = normalizedDescription.length > descriptionLimit;
  const canSubmit =
    normalizedName.length > 0 &&
    !descriptionTooLong &&
    !yearInvalid &&
    !createMutation.isPending;

  const filtered = useMemo(() => {
    const value = deferredSearch.trim().toLowerCase();
    const all = data ?? [];
    // Filter by tab: albums = api-sourced, custom = file-sourced
    const byTab = all.filter((entry) =>
      tab === "albums" ? entry.source_type === "api" : entry.source_type !== "api"
    );
    if (!value) return byTab;
    return byTab.filter((entry) => {
      return (
        entry.name.toLowerCase().includes(value) ||
        (entry.description ?? "").toLowerCase().includes(value)
      );
    });
  }, [data, deferredSearch, tab]);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setYear("");
    setUploadPaths([]);
  };

  const addUploadPaths = (paths: string[]) => {
    setUploadPaths((prev) => {
      const merged = new Set(prev);
      paths.forEach((path) => {
        if (path && path.trim()) {
          merged.add(path.trim());
        }
      });
      return [...merged];
    });
  };

  const pickUploadFiles = async () => {
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: "Slides", extensions: ["slja", "pptx"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    addUploadPaths(paths);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (paths.length === 0) {
      toast.error(t("collections.uploadDropUnsupported"));
      return;
    }
    addUploadPaths(paths);
  };

  const handleCreate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) return;
    try {
      const collection = await createMutation.mutateAsync({
        name: normalizedName,
        description: normalizedDescription || null,
        year: parsedYear,
        coverPath: null,
      });

      let importedCount = 0;
      for (const path of uploadPaths) {
        await importSongMutation.mutateAsync({ collectionId: collection.id, path });
        importedCount += 1;
      }

      if (importedCount > 0) {
        toast.success(t("collections.uploadImported", { count: importedCount }));
      }

      resetCreateForm();
      setCreateOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("collections.saveFailed", { error: message }));
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.collections")}</h1>
          <p className="text-sm text-muted-foreground">{t("collections.subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className={tab !== "custom" ? "invisible" : ""}>
          <Plus className="mr-2 h-4 w-4" />
          {t("collections.create")}
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("collections.createTitle")}</DialogTitle>
            <DialogDescription>{t("collections.createHint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="new-collection-name"
                label={t("collections.nameLabel")}
                value={name}
                error={nameError}
                onChange={(event) => setName(event.target.value)}
                onBlur={(event) => setName(event.target.value.trimStart())}
                placeholder={t("collections.namePlaceholder")}
                autoComplete="off"
                autoFocus
              />
              <Input
                id="new-collection-year"
                label={t("collections.yearLabel")}
                type="number"
                min={1900}
                max={currentYear}
                value={year}
                error={yearInvalid ? t("collections.yearInvalid", { min: 1900, max: currentYear }) : undefined}
                onChange={(event) => setYear(event.target.value)}
                onBlur={(event) => setYear(event.target.value.trim())}
                placeholder={t("collections.yearPlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="new-collection-description" className="text-sm font-medium text-foreground">
                {t("collections.descriptionLabel")}
              </label>
              <textarea
                id="new-collection-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleCreate();
                  }
                }}
                placeholder={t("collections.descriptionPlaceholder")}
                rows={3}
                className={cn(
                  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                  descriptionTooLong && "border-destructive",
                )}
                maxLength={descriptionLimit + 40}
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("collections.descriptionHelp")}</span>
                <span className={descriptionTooLong ? "text-destructive" : "text-muted-foreground"}>
                  {normalizedDescription.length}/{descriptionLimit}
                </span>
              </div>
              {descriptionTooLong && (
                <p className="text-xs text-destructive">
                  {t("collections.descriptionTooLong", { max: descriptionLimit })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("collections.uploadLabel")}</p>
              <button
                type="button"
                onClick={pickUploadFiles}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  "w-full rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-left transition-colors",
                  "hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isDragOver && "border-primary bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Upload className="h-4 w-4" />
                  {t("collections.uploadBrowse")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("collections.uploadHint")}</p>
              </button>
              {uploadPaths.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("collections.uploadEmpty")}</p>
              ) : (
                <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
                  {uploadPaths.map((path) => (
                    <div key={path} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-muted-foreground">{path}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setUploadPaths((prev) => prev.filter((entry) => entry !== path))
                        }
                      >
                        {t("actions.remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={resetCreateForm}
                disabled={createMutation.isPending}
              >
                {t("collections.resetForm")}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("collections.creating")}
                  </>
                ) : (
                  t("collections.create")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("albums")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            tab === "albums"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("collections.tabAlbums")}
        </button>
        <button
          type="button"
          onClick={() => setTab("custom")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            tab === "custom"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("collections.tabCustom")}
        </button>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("collections.searchPlaceholder")}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10">
          <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("collections.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((collection) => {
            const cover = collection.cover_path ?? collection.auto_cover_path;
            const creationYear = collection.year ?? getCreationYear(collection.created_at);
            return (
              <Card key={collection.id} className="overflow-hidden">
                <CardHeader className="gap-3 p-3">
                  <div className="relative">
                    <Link
                      to="/collections/$collectionId"
                      params={{ collectionId: String(collection.id) }}
                      className="block"
                    >
                      <CoverImage path={cover} title={collection.name} className="h-auto w-full aspect-square rounded-md" />
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10",
                        collection.source_type === "api" && "hidden"
                      )}
                      onClick={async () => {
                        try {
                          await deleteMutation.mutateAsync(collection.id);
                        } catch (error) {
                          const message = error instanceof Error ? error.message : String(error);
                          toast.error(t("collections.deleteFailed", { error: message }));
                        }
                      }}
                      title={t("actions.delete")}
                      aria-label={t("actions.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <Link
                    to="/collections/$collectionId"
                    params={{ collectionId: String(collection.id) }}
                    className="space-y-1"
                  >
                    <CardTitle className="line-clamp-2 text-sm leading-snug">{collection.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {creationYear ?? t("collections.yearUnknown")}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground">
                      {t("collections.songCount", { count: collection.song_count })}
                    </p>
                  </Link>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
