import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, Copy, Monitor, Music, Pencil, RefreshCw, Square, Trash2 } from "lucide-react";
import { useDeleteHymn, useHymn, useRestoreHymnFromApi, useSyncPoints, useUpdateHymn } from "../../lib/queries";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { useHymnPlayback, hymnToSlides } from "../../hooks/use-hymn-playback";
import { useSlides } from "../../hooks/use-slides";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { copyToClipboard } from "../../lib/clipboard";
import { LyricsDisplay } from "../../components/music/lyrics-display";
import { LyricsModal } from "../../components/music/lyrics-modal";
import { AudioControls } from "../../components/music/audio-controls";
import { AudioSyncEditor } from "../../components/music/audio-sync-editor";
import { SlideList } from "../../components/slides/slide-list";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoverPicker } from "../../components/media/cover-picker";

import { notify } from "../../lib/notifications";
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const id = Number(hymnId);
  const { data: hymn, isLoading } = useHymn(id);
  const activeProjectedIndex = usePresentationStore((state) => state.activeSlideIndex);
  const { goToSlide } = useSlides();
  const { bindHymnToPlaybackQueue: bindHymnToQueue, handleStartCantado, handleStartPlayback, handleStartSlidesOnly } = useHymnPlayback();
  const [showSyncEditor, setShowSyncEditor] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
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
  const restoreMutation = useRestoreHymnFromApi();

  const generatedSlides = useMemo(() => {
    if (!hymn) return [];
    return hymnToSlides(hymn.title, hymn.lyrics, hymn.album, hymn.coverPath);
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
    // Sync localActiveIndex from presentation store when:
    // 1. isProjecting is true (slide changes from projection)
    // 2. isQueueBoundToHymn is true (audio is playing, sync points update activeSlideIndex)
    if (!isProjecting && !isQueueBoundToHymn) {
      return;
    }
    setLocalActiveIndex(activeProjectedIndex);
  }, [activeProjectedIndex, isProjecting, isQueueBoundToHymn]);

  useEffect(() => {
    if (!isQueueBoundToHymn || syncPointsData === undefined) {
      return;
    }
    setAudioSyncPoints(syncPointsData);
  }, [isQueueBoundToHymn, setAudioSyncPoints, syncPointsData]);

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
    try {
      await updateMutation.mutateAsync({
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
      });
      setEditOpen(false);
    } catch (error) {
      notify.tauriError(error, t("hymnal.saveFailed", { error: "" }));
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

  return (
    <div className="flex h-full gap-4">
      {/* Main content */}
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
          </div>
          {hymn.album && (
            <span className="text-sm text-muted-foreground">{hymn.album}</span>
          )}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("actions.edit")}
            </Button>
            {hymn.apiMusicId != null && (
              <Button
                variant="outline"
                size="sm"
                disabled={restoreMutation.isPending}
                onClick={async () => {
                  try {
                    const lang = (i18n.language as "pt" | "en" | "es") || "pt";
                    await restoreMutation.mutateAsync({ hymnId: id, language: lang });
                    notify.success(t("hymn.restoreSuccess"));
                  } catch (error) {
                    notify.tauriError(error, t("hymn.restoreFailed", { error: "" }));
                  }
                }}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${restoreMutation.isPending ? "animate-spin" : ""}`} />
                {t("hymn.restoreFromApi")}
              </Button>
            )}
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
                <Button size="sm" variant="ghost" onClick={() => setLyricsModalOpen(true)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("hymn.actionShowLyrics")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
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
                <Button size="sm" variant="ghost" onClick={() => setLyricsModalOpen(true)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("hymn.actionShowLyrics")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
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
              </>
            )}
          </div>
        </div>
        
        <div className="flex flex-1 gap-4 min-h-0">
          <div className="w-64 shrink-0 overflow-auto rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">{t("hymn.slides")}</h3>
            <SlideList
              slides={generatedSlides}
              activeIndex={localActiveIndex}
              onSelect={(i) => void projectHymnSlide(i)}
            />
          </div>

          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card p-4">
            {hymn.lyrics ? (
              <LyricsDisplay
                lyrics={hymn.lyrics}
                activeStanza={isProjecting ? Math.max(0, localActiveIndex - 1) : localActiveIndex}
                onStanzaClick={(i) => {
                  if (isProjecting) {
                    void projectHymnSlide(i + 1);
                  } else {
                    setLocalActiveIndex(i + 1);
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {t("hymn.noLyrics")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-80 shrink-0 space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">{t("hymn.info")}</h3>
          <div className="space-y-2 text-sm">
            {hymn.author && (
              <div>
                <span className="text-muted-foreground">{t("hymn.author")}: </span>
                {hymn.author}
              </div>
            )}
            {hymn.album && (
              <div>
                <span className="text-muted-foreground">{t("hymn.album")}: </span>
                {hymn.album}
              </div>
            )}
            {hymn.category && (
              <div>
                <span className="text-muted-foreground">{t("hymn.category")}: </span>
                <Badge variant="outline">{hymn.category}</Badge>
              </div>
            )}
          </div>
        </div>

        {hymn.audioPath && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium">{t("hymn.audio")}</h3>
            <AudioControls
              filePath={hymn.audioPath}
              playbackPath={hymn.playbackPath}
              onBeforePlay={() => void bindHymnToPlaybackQueue(localActiveIndex)}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setShowSyncEditor(!showSyncEditor)}
            >
              <Music className="mr-2 h-4 w-4" />
              {t("audio.syncEditor")}
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">{t("hymn.actions")}</h3>
          <div className="space-y-2">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={async () => {
                if (confirm(t("hymn.deleteConfirm"))) {
                  try {
                    await deleteMutation.mutateAsync(id);
                    void navigate({ to: "/hymnal" });
                  } catch (error) {
                    notify.tauriError(error, t("hymnal.deleteFailed", { error: "" }));
                  }
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("actions.delete")}
            </Button>
          </div>
        </div>
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

      {showSyncEditor && hymn.audioPath && (
        <AudioSyncEditor
          hymnId={id}
          initialPoints={syncPointsData ?? []}
          totalSlides={generatedSlides.length}
          onClose={() => setShowSyncEditor(false)}
        />
      )}

      <LyricsModal hymn={hymn} open={lyricsModalOpen} onOpenChange={setLyricsModalOpen} />
    </div>
  );
}
