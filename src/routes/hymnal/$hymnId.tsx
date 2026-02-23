import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, Monitor, Music, Pencil, RefreshCw, Save, Square, Trash2 } from "lucide-react";
import { useDeleteHymn, useHymn, useRestoreHymnFromApi, useSyncPoints, useUpdateHymn } from "../../lib/queries";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { useSlides } from "../../hooks/use-slides";
import { useAudio } from "../../hooks/use-audio";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { LyricsDisplay } from "../../components/music/lyrics-display";
import { LyricsModal } from "../../components/music/lyrics-modal";
import { AudioControls } from "../../components/music/audio-controls";
import { AudioSyncEditor } from "../../components/music/audio-sync-editor";
import { SlideList } from "../../components/slides/slide-list";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import type { SlideContent } from "../../types/presentation";
import type { SyncPoint } from "../../types/audio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoverPicker } from "../../components/media/cover-picker";

import { getSyncPoints as fetchSyncPoints } from "../../lib/tauri";
import { toast } from "sonner";
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

function hymnToSlides(title: string, lyrics: string | null, album: string | null, coverPath?: string | null): SlideContent[] {
  const slides: SlideContent[] = [];

  // Cover slide
  slides.push({
    type: "cover",
    title,
    subtitle: album ?? undefined,
    backgroundImage: coverPath ?? undefined,
  });

  if (lyrics) {
    const stanzas = lyrics.split("\n\n").filter((s) => s.trim().length > 0);
    stanzas.forEach((stanza, i) => {
      slides.push({
        type: "lyrics",
        text: stanza.trim(),
        label: `${i + 1}/${stanzas.length}`,
        backgroundImage: coverPath ?? undefined,
      });
    });
  }

  // End pause slide
  slides.push({ type: "pause" });

  return slides;
}

function HymnDetail() {
  const { hymnId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const id = Number(hymnId);
  const { data: hymn, isLoading } = useHymn(id);
  const setPresentationSlides = usePresentationStore((state) => state.setSlides);
  const setPresentationActiveSlideIndex = usePresentationStore((state) => state.setActiveSlideIndex);
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const activeProjectedIndex = usePresentationStore((state) => state.activeSlideIndex);
  const { goToSlide, seekAudioToSlideSyncPoint } = useSlides();
  const { play, setPlaybackMode } = useAudio();
  const [showSyncEditor, setShowSyncEditor] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [isQueueBoundToHymn, setIsQueueBoundToHymn] = useState(false);
  const [resolvedSyncPoints, setResolvedSyncPoints] = useState<SyncPoint[] | null>(null);
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
    return hymnToSlides(hymn.title, hymn.lyrics, hymn.album, hymn.cover_path);
  }, [hymn]);

  useEffect(() => {
    if (syncPointsData !== undefined) {
      setResolvedSyncPoints(syncPointsData);
    }
  }, [syncPointsData]);

  const resolveHymnSyncPoints = useCallback(async (): Promise<SyncPoint[]> => {
    if (resolvedSyncPoints != null) {
      return resolvedSyncPoints;
    }
    try {
      const loaded = await fetchSyncPoints(id);
      setResolvedSyncPoints(loaded);
      return loaded;
    } catch (error) {
      console.warn("Failed to resolve hymn sync points before playback binding:", error);
      return [];
    }
  }, [id, resolvedSyncPoints]);

  const bindHymnToPlaybackQueue = useCallback(async (startIndex: number) => {
    if (generatedSlides.length === 0) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(startIndex, generatedSlides.length - 1));
    const points = await resolveHymnSyncPoints();
    console.log("[hymnId] bindHymnToPlaybackQueue: resolved", points.length, "sync points:", points);
    setCurrentPresentation(null);
    setPresentationSlides(generatedSlides);
    setPresentationActiveSlideIndex(clampedIndex);
    setAudioSyncPoints(points);
    setIsQueueBoundToHymn(true);
  }, [
    generatedSlides,
    resolveHymnSyncPoints,
    setAudioSyncPoints,
    setCurrentPresentation,
    setPresentationActiveSlideIndex,
    setPresentationSlides,
  ]);

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
    console.log("[hymnId] useEffect: isProjecting=", isProjecting, "isQueueBoundToHymn=", isQueueBoundToHymn, "activeProjectedIndex=", activeProjectedIndex);
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
    setResolvedSyncPoints(syncPointsData);
  }, [isQueueBoundToHymn, setAudioSyncPoints, syncPointsData]);

  useEffect(() => {
    setIsQueueBoundToHymn(false);
    setResolvedSyncPoints(null);
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
      audioPath: hymn.audio_path ?? "",
      notes: hymn.notes ?? "",
      coverPath: hymn.cover_path ?? null,
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
          audio_path: form.audioPath.trim() || null,
          playback_path: hymn.playback_path,
          category: form.category.trim() || null,
          notes: form.notes.trim() || null,
          cover_path: form.coverPath,
          lyrics_sync: hymn.lyrics_sync,
        },
      });
      setEditOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("hymnal.saveFailed", { error: message }));
    }
  };

  const handleStartCantado = async () => {
    try {
      setPlaybackMode("sung");
      await bindHymnToPlaybackQueue(0);
      setIsProjecting(true);
      await goToSlide(0);
      if (hymn.audio_path) await play(hymn.audio_path);
    } catch (e) {
      console.error("[hymn] Failed to start cantado projection:", e);
      setIsProjecting(false);
    }
  };

  const handleStartPlayback = async () => {
    try {
      setPlaybackMode("karaoke");
      await bindHymnToPlaybackQueue(0);
      setIsProjecting(true);
      await goToSlide(0);
      const audioPath = hymn.playback_path || hymn.audio_path;
      if (audioPath) await play(audioPath);
    } catch (e) {
      console.error("[hymn] Failed to start playback projection:", e);
      setIsProjecting(false);
    }
  };

  const handleStartSlidesOnly = async () => {
    try {
      setPlaybackMode("silent");
      await bindHymnToPlaybackQueue(0);
      setIsProjecting(true);
      await goToSlide(0);
    } catch (e) {
      console.error("[hymn] Failed to start slides-only projection:", e);
      setIsProjecting(false);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Main content */}
      <div className="flex flex-1 flex-col gap-4 overflow-auto">
        <div className="flex items-center gap-3">
          <Link to="/hymnal">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
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
            {hymn.api_music_id != null && (
              <Button
                variant="outline"
                size="sm"
                disabled={restoreMutation.isPending}
                onClick={async () => {
                  try {
                    const lang = (i18n.language as "pt" | "en" | "es") || "pt";
                    await restoreMutation.mutateAsync({ hymnId: id, language: lang });
                    toast.success(t("hymn.restoreSuccess"));
                  } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    toast.error(t("hymn.restoreFailed", { error: message }));
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
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => void handleStartCantado()}>
                  <Monitor className="mr-2 h-4 w-4" />
                  {t("hymn.actionSung")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleStartPlayback()}>
                  {t("hymn.actionPlayback")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleStartSlidesOnly()}>
                  {t("hymn.actionSlidesOnly")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLyricsModalOpen(true)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("hymn.actionShowLyrics")}
                </Button>
              </>
            )}
          </div>
        </div>

        {hymn.author && (
          <p className="text-sm text-muted-foreground">
            {t("hymnal.author")}: {hymn.author}
          </p>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("hymnal.editTitle")}</DialogTitle>
              <DialogDescription>{t("hymnal.editHint")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  value={form.number}
                  onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
                  label={t("hymnal.numberLabel")}
                  placeholder={t("hymnal.numberPlaceholder")}
                />
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  label={t("hymnal.titleLabel")}
                  placeholder={t("hymnal.createPlaceholder")}
                />
                <Input
                  value={form.author}
                  onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
                  placeholder={t("hymnal.authorPlaceholder")}
                />
                <Input
                  value={form.album}
                  onChange={(event) => setForm((prev) => ({ ...prev, album: event.target.value }))}
                  placeholder={t("hymnal.albumPlaceholder")}
                />
                <Input
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder={t("hymnal.categoryPlaceholder")}
                />
                <Input
                  value={form.audioPath}
                  onChange={(event) => setForm((prev) => ({ ...prev, audioPath: event.target.value }))}
                  placeholder={t("hymnal.audioPathPlaceholder")}
                />
                <textarea
                  value={form.chords}
                  onChange={(event) => setForm((prev) => ({ ...prev, chords: event.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder={t("hymnal.chordsPlaceholder")}
                />
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder={t("hymnal.notesPlaceholder")}
                />
              </div>
              <CoverPicker
                value={form.coverPath}
                onChange={(value) => setForm((prev) => ({ ...prev, coverPath: value }))}
                title={form.title || hymn.title}
              />
              <textarea
                value={form.lyrics}
                onChange={(event) => setForm((prev) => ({ ...prev, lyrics: event.target.value }))}
                rows={6}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder={t("hymnal.lyricsPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  try {
                    await deleteMutation.mutateAsync(id);
                    setEditOpen(false);
                    navigate({ to: "/hymnal" });
                  } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    toast.error(t("hymnal.deleteFailed", { error: message }));
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("actions.delete")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.title.trim() || updateMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {t("actions.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {hymn.audio_path && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncEditor(!showSyncEditor)}
            >
              <Music className="mr-2 h-4 w-4" />
              {t("audio.syncEditor")}
            </Button>
          </div>
        )}

        {/* Audio controls */}
        {hymn.audio_path && (
          <AudioControls
            filePath={hymn.audio_path}
            playbackPath={hymn.playback_path}
            onBeforePlay={() => bindHymnToPlaybackQueue(localActiveIndex)}
          />
        )}

        {/* Sync editor */}
        {showSyncEditor && hymn.audio_path && (
          <AudioSyncEditor
            hymnId={id}
            initialPoints={syncPointsData ?? []}
            totalSlides={generatedSlides.length}
            onClose={() => setShowSyncEditor(false)}
          />
        )}

        {hymn.lyrics ? (
          <LyricsDisplay
            lyrics={hymn.lyrics}
            activeStanza={isProjecting ? Math.max(0, localActiveIndex - 1) : localActiveIndex}
            onStanzaClick={(i) => {
              if (isProjecting) {
                void projectHymnSlide(i + 1);
              } else {
                setLocalActiveIndex(i);
                // Seek audio to the stanza sync point when audio is playing
                if (isQueueBoundToHymn) {
                  void seekAudioToSlideSyncPoint(i + 1);
                }
              }
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("hymnal.noLyrics")}</p>
        )}
      </div>

      {/* Slide panel */}
      {generatedSlides.length > 0 && (
        <div className="hidden w-48 shrink-0 border-l border-border lg:block">
          <SlideList
            slides={generatedSlides}
            activeIndex={localActiveIndex}
            enableGlobalKeyboardNav={false}
            onSelect={(i) => {
              if (isProjecting) {
                void projectHymnSlide(i);
              } else {
                setLocalActiveIndex(i);
                // Seek audio to the slide sync point when audio is playing
                if (isQueueBoundToHymn) {
                  void seekAudioToSlideSyncPoint(i);
                }
              }
            }}
          />
        </div>
      )}

      <LyricsModal hymn={hymn} open={lyricsModalOpen} onOpenChange={setLyricsModalOpen} />
    </div>
  );
}
