import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Copy, Monitor, Music, Pencil, Square, Trash2 } from "lucide-react";
import { useDeleteHymn, useHymn, useSyncPoints, useUpdateHymn } from "../../lib/queries";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { useHymnPlayback, hymnToSlides } from "../../hooks/use-hymn-playback";
import { parseLyricsSyncToPoints } from "../../lib/audio-sync";
import { useSlides } from "../../hooks/use-slides";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { copyToClipboard } from "../../lib/clipboard";
import { LyricsDisplay } from "../../components/music/lyrics-display";
import { AudioControls } from "../../components/music/audio-controls";
import { AudioSyncEditor } from "../../components/music/audio-sync-editor";
import { SlideList } from "../../components/slides/slide-list";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoverPicker } from "../../components/media/cover-picker";
import { buildVisibleHymnLyricItems } from "../../lib/hymn-slides";
import { ConfirmationDialog } from "../../components/schedules/confirmation-dialog";
import { FavoriteButton } from "../../components/music/favorite-button";

import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

export const Route = createFileRoute("/hymnal/$hymnId")({
  component: HymnDetail,
});

function HymnDetail() {
  const { hymnId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = Number(hymnId);
  const { data: hymn, isLoading } = useHymn(id);
  const activeProjectedIndex = usePresentationStore((state) => state.activeSlideIndex);
  const { goToSlide } = useSlides();
  const { bindHymnToPlaybackQueue: bindHymnToQueue, handleStartCantado, handleStartPlayback, handleStartSlidesOnly } = useHymnPlayback();
  const [showSyncEditor, setShowSyncEditor] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [isQueueBoundToHymn, setIsQueueBoundToHymn] = useState(false);
  const [localActiveIndex, setLocalActiveIndex] = useState(0);
  const [form, setForm] = useState({
    number: "",
    title: "",
    author: "",
    album: "",
    category: "",
    lyrics: "",
    chords: "",
    audioPath: "",
    notes: "",
    coverPath: null as string | null,
  });

  const { data: syncPointsData } = useSyncPoints(id);
  const setAudioSyncPoints = useAudioStore((state) => state.setSyncPoints);
  const updateMutation = useUpdateHymn();
  const deleteMutation = useDeleteHymn();

  const generatedSlides = useMemo(() => {
    if (!hymn) return [];
    return hymnToSlides(hymn.title, hymn.lyrics, hymn.album, hymn.coverPath, hymn.lyricsSync);
  }, [hymn]);

  const visibleLyricItems = useMemo(() => {
    if (!hymn) return [];
    return buildVisibleHymnLyricItems({
      lyrics: hymn.lyrics,
      lyricsSync: hymn.lyricsSync,
    });
  }, [hymn]);

  const bindHymnToPlaybackQueue = useCallback(async (startIndex: number) => {
    if (!hymn) return;
    await bindHymnToQueue(hymn, startIndex);
    setIsQueueBoundToHymn(true);
  }, [hymn, bindHymnToQueue]);

  const projectHymnSlide = useCallback(async (index: number) => {
    if (generatedSlides.length === 0) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(index, generatedSlides.length - 1));
    await bindHymnToPlaybackQueue(clampedIndex);
    await goToSlide(clampedIndex, { seekAudio: true });
    setLocalActiveIndex(clampedIndex);
  }, [bindHymnToPlaybackQueue, generatedSlides.length, goToSlide]);

  useEffect(() => {
    if (!isProjecting && !isQueueBoundToHymn) {
      return;
    }
    setLocalActiveIndex(activeProjectedIndex);
  }, [activeProjectedIndex, isProjecting, isQueueBoundToHymn]);

  useEffect(() => {
    if (!isQueueBoundToHymn || syncPointsData === undefined) {
      return;
    }
    const effectiveSyncPoints = syncPointsData.length > 0
      ? syncPointsData
      : parseLyricsSyncToPoints(hymn?.lyricsSync);
    setAudioSyncPoints(effectiveSyncPoints);
  }, [isQueueBoundToHymn, setAudioSyncPoints, syncPointsData, hymn?.lyricsSync]);

  useEffect(() => {
    setIsQueueBoundToHymn(false);
    setLocalActiveIndex(0);
  }, [id]);

  useEffect(() => {
    if (!hymn) return;
    setForm({
      number: hymn.number != null ? String(hymn.number) : "",
      title: hymn.title ?? "",
      author: hymn.author ?? "",
      album: hymn.album ?? "",
      category: hymn.category ?? "",
      lyrics: hymn.lyrics ?? "",
      chords: hymn.chords ?? "",
      audioPath: hymn.audioPath ?? "",
      notes: hymn.notes ?? "",
      coverPath: hymn.coverPath ?? null,
    });
  }, [hymn]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>;
  }

  if (!hymn) {
    return <p className="text-sm text-muted-foreground">{t("hymnal.notFound")}</p>;
  }

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) return;
    const number = form.number.trim().length > 0 ? Number(form.number) : null;
    
    const [_, error] = await catcher(updateMutation.mutateAsync({
      id,
      input: {
        number: Number.isFinite(number) ? number : null,
        title,
        author: form.author.trim() || null,
        album: form.album.trim() || null,
        lyrics: form.lyrics.trim() || null,
        chords: form.chords.trim() || null,
        audioPath: form.audioPath.trim() || null,
        playbackPath: hymn.playbackPath,
        category: form.category.trim() || null,
        notes: form.notes.trim() || null,
        coverPath: form.coverPath,
        lyricsSync: hymn.lyricsSync,
      },
    }), { notify: true, fallbackMessage: t("hymnal.saveFailed", { error: "" }) });

    if (!error) {
      setEditOpen(false);
    }
  };

  const onStartCantado = async () => {
    setIsProjecting(true);
    await handleStartCantado(hymn);
  };

  const onStartPlayback = async () => {
    setIsProjecting(true);
    await handleStartPlayback(hymn);
  };

  const onStartSlidesOnly = async () => {
    setIsProjecting(true);
    await handleStartSlidesOnly(hymn);
  };

  const handleDelete = async () => {
    if (deleteMutation.isPending) return;

    const [_, error] = await catcher(deleteMutation.mutateAsync(id), {
      notify: true,
      fallbackMessage: t("hymnal.deleteFailed", { error: "" }),
    });

    if (!error) {
      setDeleteOpen(false);
      void navigate({ to: "/hymnal" });
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left Sidebar: Slides */}
      <div className="w-64 shrink-0 overflow-auto rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">{t("hymn.slides")}</h3>
        <SlideList
          slides={generatedSlides}
          activeIndex={localActiveIndex}
          onSelect={(i) => {
            if (isProjecting) {
              void projectHymnSlide(i);
            } else {
              setLocalActiveIndex(i);
            }
          }}
        />
      </div>

      {/* Middle Container */}
      <div className="flex flex-1 flex-col gap-4 overflow-auto">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate({ to: "/hymnal" });
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            {hymn.number != null && (
              <Badge variant="secondary" className="tabular-nums">
                {hymn.number}
              </Badge>
            )}
            <h1 className="text-xl font-semibold">{hymn.title}</h1>
            <FavoriteButton itemType="hymn" itemId={id} size="sm" variant="outline" className="ml-2" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("actions.edit")}
          </Button>
          {isProjecting ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await stopProjectionAndSongAudio();
                  setIsProjecting(false);
                  setIsQueueBoundToHymn(false);
                }}
              >
                <Square className="mr-2 h-4 w-4" />
                {t("hymn.stopProjection")}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => void onStartCantado()}>
                <Monitor className="mr-2 h-4 w-4" />
                {t("hymn.actionSung")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onStartPlayback()}>
                {t("hymn.actionPlayback")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onStartSlidesOnly()}>
                {t("hymn.actionSlidesOnly")}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={async () => {
              if (hymn?.lyrics) {
                await copyToClipboard(hymn.lyrics);
                notify.success(t("hymn.lyricsCopied"));
              }
            }}
          >
            <Copy className="mr-1 h-4 w-4" />
            {t("hymn.copyLyrics")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleteMutation.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Music Information */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">{t("hymn.info")}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {hymn.author && (
              <div>
                <span className="text-muted-foreground block text-xs">{t("hymn.author")}</span>
                <span className="font-medium">{hymn.author}</span>
              </div>
            )}
            {hymn.album && (
              <div>
                <span className="text-muted-foreground block text-xs">{t("hymn.album")}</span>
                <span className="font-medium">{hymn.album}</span>
              </div>
            )}
            {hymn.category && (
              <div>
                <span className="text-muted-foreground block text-xs">{t("hymn.category")}</span>
                <Badge variant="secondary" className="mt-1">{hymn.category}</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Local Audio Controls */}
        {hymn.audioPath && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("hymn.audio")}</h3>
              <Button
                variant={showSyncEditor ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSyncEditor(!showSyncEditor)}
              >
                <Music className="mr-2 h-4 w-4" />
                {t("audio.syncEditor")}
              </Button>
            </div>
            
            {/* onBeforePlay is omitted so it plays locally without projecting */}
            <AudioControls
              filePath={hymn.audioPath}
              playbackPath={hymn.playbackPath}
            />

            {showSyncEditor && (
              <div className="mt-4 pt-4 border-t border-border">
                <AudioSyncEditor
                  hymnId={id}
                  initialPoints={syncPointsData ?? []}
                  totalSlides={generatedSlides.length}
                  slides={generatedSlides}
                  onClose={() => setShowSyncEditor(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Sidebar: Lyrics */}
      <div className="w-80 shrink-0 overflow-auto rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">{t("hymn.lyrics")}</h3>
        {visibleLyricItems.length > 0 ? (
          <LyricsDisplay
            items={visibleLyricItems}
            activeSlideIndex={isProjecting ? localActiveIndex : localActiveIndex}
            onStanzaClick={(slideIndex) => {
              if (isProjecting) {
                void projectHymnSlide(slideIndex);
              } else {
                setLocalActiveIndex(slideIndex);
              }
            }}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            {t("hymn.noLyrics")}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("hymn.editTitle")}</DialogTitle>
            <DialogDescription>{t("hymn.editHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("hymn.number")}
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
              <Input
                label={t("hymn.title")}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("hymn.author")}
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
              <Input
                label={t("hymn.album")}
                value={form.album}
                onChange={(e) => setForm({ ...form, album: e.target.value })}
              />
            </div>
            <Input
              label={t("hymn.category")}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("hymn.lyrics")}</label>
              <textarea
                className="w-full rounded-md border border-border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                rows={10}
                value={form.lyrics}
                onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
              />
            </div>
            <CoverPicker
              value={form.coverPath}
              onChange={(path) => setForm({ ...form, coverPath: path })}
              title={form.title}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteOpen}
        title={t("actions.delete")}
        description={t("hymn.deleteConfirm")}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isPending={deleteMutation.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
