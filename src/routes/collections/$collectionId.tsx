import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  Download,
  RefreshCcw,
  Save,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCheckCollectionSongSync,
  useCollection,
  useImportCollectionSong,
  useRemoveCollectionSong,
  useReorderCollectionSongs,
  useResyncCollectionSong,
  useSetting,
  useUpdateCollection,
} from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { CoverPicker } from "../../components/media/cover-picker";
import { CoverImage } from "../../components/media/cover-image";
import type { CollectionSong, CollectionSongSyncStatus } from "../../types/collection";

export const Route = createFileRoute("/collections/$collectionId")({
  component: CollectionDetail,
});

function statusVariant(status: CollectionSongSyncStatus): "default" | "secondary" | "destructive" {
  switch (status) {
    case "in_sync":
      return "secondary";
    case "stale":
      return "default";
    case "missing_source":
      return "destructive";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
}

function CollectionDetail() {
  const { collectionId } = Route.useParams();
  const id = Number(collectionId);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useCollection(id);
  const updateMutation = useUpdateCollection();
  const importMutation = useImportCollectionSong();
  const checkMutation = useCheckCollectionSongSync();
  const resyncMutation = useResyncCollectionSong();
  const removeMutation = useRemoveCollectionSong();
  const reorderMutation = useReorderCollectionSongs();
  const checkSongSync = checkMutation.mutateAsync;
  const resyncSong = resyncMutation.mutateAsync;
  const removeSong = removeMutation.mutateAsync;
  const reorderSongs = reorderMutation.mutateAsync;
  const { data: autoCheckSetting } = useSetting("collections.autoCheckSourceOnOpen");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const promptedSongIdsRef = useRef<Set<number>>(new Set());
  const autoCheck = autoCheckSetting?.value !== "false";

  useEffect(() => {
    if (!data) return;
    setName(data.collection.name);
    setDescription(data.collection.description ?? "");
    setCoverPath(data.collection.cover_path ?? null);
  }, [data]);

  const effectiveCover = coverPath ?? data?.collection.auto_cover_path ?? null;

  const syncKey = useMemo(() => {
    if (!data) return "";
    return data.songs
      .map((song) => `${song.id}:${song.source_hash}:${song.source_mtime_ms}:${song.sync_status}`)
      .join("|");
  }, [data]);

  useEffect(() => {
    if (!data || !autoCheck || data.songs.length === 0) return;
    let cancelled = false;

    const runSyncChecks = async () => {
      for (const song of data.songs) {
        if (cancelled || song.sync_status === "error") {
          continue;
        }

        try {
          const status = await checkSongSync(song.id);
          if (cancelled || status !== "stale" || promptedSongIdsRef.current.has(song.id)) {
            continue;
          }

          promptedSongIdsRef.current.add(song.id);
          const shouldResync = await confirmDialog(t("collections.syncPromptMessage"), {
            title: t("collections.syncPromptTitle"),
            okLabel: t("collections.syncPromptConfirm"),
            cancelLabel: t("collections.syncPromptCancel"),
          });

          if (shouldResync) {
            await resyncSong(song.id);
          }
        } catch (error) {
          if (cancelled) {
            continue;
          }
          const message = error instanceof Error ? error.message : String(error);
          toast.error(t("collections.syncCheckFailed", { error: message }));
        }
      }
    };

    void runSyncChecks();
    return () => {
      cancelled = true;
    };
  }, [autoCheck, checkSongSync, data, resyncSong, syncKey, t]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>;
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">{t("collections.notFound")}</p>;
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id,
        name: name.trim(),
        description: description.trim() || null,
        coverPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("collections.saveFailed", { error: message }));
    }
  };

  const handleImport = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Song Files", extensions: ["slja", "pptx"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      await importMutation.mutateAsync({ collectionId: id, path: selected });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("collections.importFailed", { error: message }));
    }
  };

  const moveSong = async (songs: CollectionSong[], index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= songs.length) return;
    const ordered = songs.map((song) => song.id);
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    try {
      await reorderSongs({ collectionId: id, songIds: ordered });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("collections.reorderFailed", { error: message }));
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/collections">
          <Button variant="ghost" size="icon" aria-label={t("actions.close")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">{t("collections.detailTitle")}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-3">
            <CoverImage path={effectiveCover} title={name || data.collection.name} className="h-20 w-20" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name || data.collection.name}</p>
              <p className="text-xs text-muted-foreground">{t("collections.coverHint")}</p>
            </div>
          </div>
          <CoverPicker
            value={coverPath}
            onChange={setCoverPath}
            title={name || data.collection.name}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("collections.namePlaceholder")}
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder={t("collections.descriptionPlaceholder")}
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={!name.trim() || updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {t("actions.save")}
            </Button>
            <Button variant="outline" onClick={handleImport} disabled={importMutation.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {t("collections.importSong")}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">{t("collections.songs")}</h2>
          <span className="text-xs text-muted-foreground">
            {t("collections.autoCheckSetting", {
              value: autoCheck ? t("collections.on") : t("collections.off"),
            })}
          </span>
        </div>

        {data.songs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("collections.emptySongs")}</p>
        ) : (
          <div className="space-y-2">
            {data.songs.map((song, index) => (
              <div
                key={song.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {song.cache_presentation_title || song.source_path.split(/[\\/]/).pop()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{song.source_path}</p>
                </div>
                <Badge variant={statusVariant(song.sync_status)}>
                  {t(`collections.sync.${song.sync_status}`)}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (song.cache_presentation_id) {
                      navigate({
                        to: "/presentations/$presentationId",
                        params: { presentationId: String(song.cache_presentation_id) },
                      });
                    }
                  }}
                  disabled={!song.cache_presentation_id}
                  aria-label={t("collections.openPresentation")}
                  title={t("collections.openPresentation")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await resyncSong(song.id);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : String(error);
                      toast.error(t("collections.resyncFailed", { error: message }));
                    }
                  }}
                  aria-label={t("collections.resync")}
                  title={t("collections.resync")}
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void moveSong(data.songs, index, -1)}
                  disabled={index === 0}
                  aria-label={t("collections.moveUp")}
                  title={t("collections.moveUp")}
                >
                  ^
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void moveSong(data.songs, index, 1)}
                  disabled={index === data.songs.length - 1}
                  aria-label={t("collections.moveDown")}
                  title={t("collections.moveDown")}
                >
                  v
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    try {
                      await removeSong({ songId: song.id, collectionId: id });
                    } catch (error) {
                      const message = error instanceof Error ? error.message : String(error);
                      toast.error(t("collections.removeFailed", { error: message }));
                    }
                  }}
                  aria-label={t("collections.removeSong")}
                  title={t("collections.removeSong")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!autoCheck && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            <TriangleAlert className="h-4 w-4" />
            {t("collections.autoCheckDisabledHint")}
          </div>
        )}
      </div>
    </div>
  );
}
