import { DragEvent, FormEvent, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAlbums, useCreateHymn, useHymnsByAlbum, useImportSlja } from "../../lib/queries";
import { HymnSearch } from "../../components/music/hymn-search";
import { AlbumCard } from "../../components/music/album-card";
import { HymnCard } from "../../components/music/hymn-card";
import { Button } from "../../components/ui/button";
import { ArrowLeft, Loader2, Plus, Upload } from "lucide-react";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/hymnal/")({
  component: HymnalIndex,
});

function HymnalIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [uploadPaths, setUploadPaths] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const { data: albums, isLoading: albumsLoading } = useAlbums();
  const { data: albumHymns } = useHymnsByAlbum(selectedAlbum ?? "");
  const createMutation = useCreateHymn();
  const importSljaMutation = useImportSlja();
  const normalizedTitle = newTitle.trim();
  const normalizedNumber = newNumber.trim();
  const parsedNumber = normalizedNumber.length > 0 ? Number(normalizedNumber) : null;
  const numberInvalid =
    normalizedNumber.length > 0 &&
    (!Number.isInteger(parsedNumber) || (parsedNumber != null && parsedNumber < 0));

  const titleError = useMemo(() => {
    if (newTitle.length === 0) return undefined;
    if (normalizedTitle.length === 0) return t("hymnal.titleRequired");
    return undefined;
  }, [newTitle, normalizedTitle, t]);

  const numberError = numberInvalid ? t("hymnal.numberInvalid") : undefined;
  const canSubmit =
    normalizedTitle.length > 0 &&
    !numberInvalid &&
    !createMutation.isPending;

  const resetCreateForm = () => {
    setNewTitle("");
    setNewNumber("");
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
      toast.error(t("hymnal.uploadDropUnsupported"));
      return;
    }
    addUploadPaths(paths);
  };

  const handleCreate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!normalizedTitle || numberInvalid) return;
    try {
      const result = await createMutation.mutateAsync({
        number: Number.isFinite(parsedNumber) ? parsedNumber : null,
        title: normalizedTitle,
        author: null,
        album: null,
        lyrics: null,
        chords: null,
        audio_path: null,
        playback_path: null,
        category: null,
        notes: null,
        cover_path: null,
        lyrics_sync: null,
      });
      let importedCount = 0;
      for (const path of uploadPaths) {
        await importSljaMutation.mutateAsync(path);
        importedCount += 1;
      }
      if (importedCount > 0) {
        toast.success(t("hymnal.uploadImported", { count: importedCount }));
      }
      resetCreateForm();
      setCreateOpen(false);
      navigate({ to: "/hymnal/$hymnId", params: { hymnId: String(result.id) } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("hymnal.createFailed", { error: message }));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.hymnal")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("hymnal.create")}
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("hymnal.createCardTitle")}</DialogTitle>
            <DialogDescription>{t("hymnal.createHint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="new-hymn-number"
                label={t("hymnal.numberLabel")}
                type="number"
                min={0}
                inputMode="numeric"
                value={newNumber}
                error={numberError}
                onChange={(event) => setNewNumber(event.target.value)}
                onBlur={(event) => setNewNumber(event.target.value.trim())}
                placeholder={t("hymnal.numberPlaceholder")}
              />
              <Input
                id="new-hymn-title"
                label={t("hymnal.titleLabel")}
                value={newTitle}
                error={titleError}
                onChange={(event) => setNewTitle(event.target.value)}
                onBlur={(event) => setNewTitle(event.target.value.trimStart())}
                placeholder={t("hymnal.createPlaceholder")}
                autoComplete="off"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("hymnal.uploadLabel")}</p>
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
                  {t("hymnal.uploadBrowse")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("hymnal.uploadHint")}</p>
              </button>
              {uploadPaths.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("hymnal.uploadEmpty")}</p>
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

            <p className="text-xs text-muted-foreground">{t("hymnal.numberHelp")}</p>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={resetCreateForm}
                disabled={createMutation.isPending}
              >
                {t("hymnal.resetForm")}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("hymnal.creating")}
                  </>
                ) : (
                  t("hymnal.createAndOpen")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <HymnSearch />

      {selectedAlbum ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedAlbum(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-medium">{selectedAlbum}</h2>
          </div>
          {albumHymns && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {albumHymns.map((hymn) => (
                <HymnCard key={hymn.id} hymn={hymn} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">{t("hymnal.albums")}</h2>
          {albumsLoading && (
            <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
          )}
          {albums && albums.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <AlbumCard
                  key={album.name}
                  album={album}
                  onClick={setSelectedAlbum}
                />
              ))}
            </div>
          )}
          {albums && albums.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("hymnal.noAlbums")}</p>
          )}
        </div>
      )}
    </div>
  );
}
