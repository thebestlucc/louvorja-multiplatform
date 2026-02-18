import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Play,
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
import { audioPlay, getSlides } from "../../lib/tauri";
import type { AudioStatusPayload } from "../../types/audio";
import { parseSlideRow, type SlideRow } from "../../types/presentation";
import { useSlides as useSlidesControl } from "../../hooks/use-slides";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { ensureProjectionScreensStarted } from "../../lib/projection-playback";
import { normalizeMediaPath } from "../../lib/media-path";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

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
  const { goToSlide } = useSlidesControl();
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const setPresentationSlides = usePresentationStore((state) => state.setSlides);
  const setAudioSyncPoints = useAudioStore((state) => state.setSyncPoints);
  const startAudioStatusSubscription = useAudioStore((state) => state.startStatusSubscription);
  const stopAudioStatusSubscription = useAudioStore((state) => state.stopStatusSubscription);
  const { data: autoCheckSetting } = useSetting("collections.autoCheckSourceOnOpen");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const promptedSongIdsRef = useRef<Set<number>>(new Set());
  const autoCheck = autoCheckSetting?.value !== "false";
  const currentYear = new Date().getFullYear() + 1;

  useEffect(() => {
    if (!data) return;
    setName(data.collection.name);
    setDescription(data.collection.description ?? "");
    setYear(data.collection.year != null ? String(data.collection.year) : "");
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

  const normalizedYear = year.trim();
  const parsedYear = normalizedYear.length > 0 ? Number(normalizedYear) : null;
  const yearInvalid =
    normalizedYear.length > 0 &&
    (!Number.isInteger(parsedYear) || (parsedYear != null && (parsedYear < 1900 || parsedYear > currentYear)));

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id,
        name: name.trim(),
        description: description.trim() || null,
        year: parsedYear,
        coverPath,
      });
      setEditOpen(false);
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

  const handlePlaySong = async (song: CollectionSong) => {
    if (!song.cache_presentation_id) {
      return;
    }

    try {
      stopAudioStatusSubscription();
      setAudioSyncPoints([]);
      await ensureProjectionScreensStarted();
      const slideRows = await getSlides(song.cache_presentation_id);
      const slideContents = slideRows.map((row) => parseSlideRow(row).content);
      if (slideContents.length === 0) {
        toast.error(t("collections.playEmpty"));
        return;
      }

      setCurrentPresentation(song.cache_presentation_id);
      setPresentationSlides(slideContents);
      await goToSlide(0);

      const { audioPath, syncPoints } = extractLegacyPlaybackMetadata(slideRows);
      if (audioPath) {
        startAudioStatusSubscription();
        await audioPlay(audioPath);
        setAudioSyncPoints(syncPoints);

        void (async () => {
          const durationMs = await resolveAudioDurationMs();
          const calibrated = calibrateSyncPointsToDuration(
            syncPoints,
            durationMs,
            slideContents.length,
          );
          if (calibrated !== syncPoints) {
            setAudioSyncPoints(calibrated);
          }
        })();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("collections.playFailed", { error: message }));
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
          <div className="flex items-center gap-3">
            <CoverImage
              path={effectiveCover}
              title={name || data.collection.name}
              className="h-10 w-10 rounded-md"
            />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold">{name || data.collection.name}</p>
              <p className="text-xs text-muted-foreground">
                {data.collection.year ?? t("collections.yearUnknown")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("collections.songCount", { count: data.collection.song_count })}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {data.collection.description || t("collections.noDescription")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("actions.edit")}
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
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePlaySong(song)}
                  disabled={!song.cache_presentation_id}
                  aria-label={t("collections.playSong")}
                  title={t("collections.playSong")}
                >
                  <Play className="mr-1 h-4 w-4" />
                  {t("collections.playSong")}
                </Button>
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
                  <ExternalLink className="h-4 w-4" />
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("collections.editTitle")}</DialogTitle>
            <DialogDescription>{t("collections.editHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                label={t("collections.nameLabel")}
                placeholder={t("collections.namePlaceholder")}
              />
              <Input
                type="number"
                min={1900}
                max={currentYear}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                label={t("collections.yearLabel")}
                error={yearInvalid ? t("collections.yearInvalid", { min: 1900, max: currentYear }) : undefined}
                placeholder={t("collections.yearPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="collection-description" className="text-sm font-medium text-foreground">
                {t("collections.descriptionLabel")}
              </label>
              <textarea
                id="collection-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder={t("collections.descriptionPlaceholder")}
              />
            </div>
            <CoverPicker
              value={coverPath}
              onChange={setCoverPath}
              title={name || data.collection.name}
            />
            <p className="text-xs text-muted-foreground">{t("collections.coverHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || yearInvalid || updateMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type LegacySyncPoint = {
  slideIndex: number;
  timestampMs: number;
};

type LegacySyncPointSource = "tempo_ms" | "tempo_hms";

function extractLegacyPlaybackMetadata(rows: SlideRow[]): {
  audioPath: string | null;
  syncPoints: LegacySyncPoint[];
} {
  let audioPath: string | null = null;
  const syncPoints: Array<LegacySyncPoint & { source: LegacySyncPointSource }> = [];

  rows.forEach((row, index) => {
    try {
      const parsed = JSON.parse(row.content) as {
        audioPath?: unknown;
        audio_path?: unknown;
      };
      if (audioPath == null && typeof parsed.audioPath === "string" && parsed.audioPath.trim().length > 0) {
        audioPath = normalizeMediaPath(parsed.audioPath);
      } else if (audioPath == null && typeof parsed.audio_path === "string" && parsed.audio_path.trim().length > 0) {
        audioPath = normalizeMediaPath(parsed.audio_path);
      }
    } catch {
      // Keep parsing notes fallback.
    }

    const notes = row.notes ?? "";
    for (const line of notes.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("legacy.tempo_ms=")) {
        const raw = trimmed.slice("legacy.tempo_ms=".length);
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) {
          syncPoints.push({
            slideIndex: index,
            timestampMs: Math.floor(parsed),
            source: "tempo_ms",
          });
        }
      } else if (trimmed.startsWith("legacy.tempo_hms=")) {
        const raw = trimmed.slice("legacy.tempo_hms=".length);
        const parsed = parseLegacyHmsToMs(raw);
        if (parsed != null && parsed >= 0) {
          syncPoints.push({
            slideIndex: index,
            timestampMs: parsed,
            source: "tempo_hms",
          });
        }
      }
      if (audioPath == null && trimmed.startsWith("legacy.audio_path=")) {
        const raw = trimmed.slice("legacy.audio_path=".length);
        audioPath = normalizeMediaPath(raw);
      }
    }
  });

  const tempoMsLikelyMicroseconds = syncPoints.some(
    (point) => point.source === "tempo_ms" && point.timestampMs > 3_600_000,
  );
  if (tempoMsLikelyMicroseconds) {
    for (const point of syncPoints) {
      if (point.source === "tempo_ms") {
        point.timestampMs = Math.floor(point.timestampMs / 1000);
      }
    }
  }

  syncPoints.sort((a, b) => a.timestampMs - b.timestampMs);
  if (syncPoints.length === 0 || syncPoints[0].timestampMs > 0 || syncPoints[0].slideIndex !== 0) {
    syncPoints.unshift({ slideIndex: 0, timestampMs: 0, source: "tempo_ms" });
  }

  return {
    audioPath,
    syncPoints: syncPoints.map((point) => ({
      slideIndex: point.slideIndex,
      timestampMs: point.timestampMs,
    })),
  };
}

async function resolveAudioDurationMs(timeoutMs = 2_000): Promise<number | null> {
  const currentDuration = useAudioStore.getState().durationMs;
  if (currentDuration > 0) {
    return currentDuration;
  }

  return new Promise((resolve) => {
    let settled = false;
    let unlisten: UnlistenFn | null = null;

    const finish = (value: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (unlisten) {
        unlisten();
      }
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, timeoutMs);

    void listen<AudioStatusPayload>("audio-status", (event) => {
      const durationMs = event.payload.durationMs;
      if (typeof durationMs === "number" && durationMs > 0) {
        finish(durationMs);
      }
    })
      .then((dispose) => {
        unlisten = dispose;
        const latestDuration = useAudioStore.getState().durationMs;
        if (latestDuration > 0) {
          finish(latestDuration);
        }
      })
      .catch(() => {
        finish(null);
      });
  });
}

function calibrateSyncPointsToDuration(
  points: LegacySyncPoint[],
  durationMs: number | null,
  totalSlides: number,
): LegacySyncPoint[] {
  if (!durationMs || durationMs <= 0 || points.length === 0) {
    return points;
  }

  const maxSlideIndex = points.reduce((max, point) => Math.max(max, point.slideIndex), -1);
  if (totalSlides > 1 && maxSlideIndex < totalSlides - 2) {
    return points;
  }

  const maxTimestamp = points.reduce((max, point) => Math.max(max, point.timestampMs), 0);
  if (maxTimestamp <= 0) {
    return points;
  }

  const factor = durationMs / maxTimestamp;
  const currentErrorRatio = Math.abs(maxTimestamp - durationMs) / durationMs;
  const factorIsReasonable = factor > 0.05 && factor < 20;
  const shouldRescale = factorIsReasonable && currentErrorRatio > 0.25;

  if (!shouldRescale) {
    return points;
  }

  return points.map((point) => ({
    slideIndex: point.slideIndex,
    timestampMs: Math.max(0, Math.floor(point.timestampMs * factor)),
  }));
}

function parseLegacyHmsToMs(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let secondsPart = "";
  if (parts.length === 3) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    secondsPart = parts[2] ?? "";
  } else {
    minutes = Number(parts[0]);
    secondsPart = parts[1] ?? "";
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) {
    return null;
  }

  const secondParts = secondsPart.split(".");
  const seconds = Number(secondParts[0] ?? "");
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const millisRaw = (secondParts[1] ?? "").replace(/[^0-9]/g, "");
  const millis = millisRaw.length > 0
    ? Number(millisRaw.slice(0, 3).padEnd(3, "0"))
    : 0;
  if (!Number.isFinite(millis) || millis < 0) {
    return null;
  }

  const total = (((hours * 60) + minutes) * 60 + seconds) * 1000 + millis;
  return Number.isFinite(total) ? Math.floor(total) : null;
}
