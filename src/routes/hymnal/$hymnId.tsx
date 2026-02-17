import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Monitor, Music, Save, Square, Trash2 } from "lucide-react";
import { useDeleteHymn, useHymn, useSyncPoints, useUpdateHymn } from "../../lib/queries";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { useSlides } from "../../hooks/use-slides";
import { clearCurrentSlide } from "../../lib/tauri";
import { LyricsDisplay } from "../../components/music/lyrics-display";
import { AudioControls } from "../../components/music/audio-controls";
import { AudioSyncEditor } from "../../components/music/audio-sync-editor";
import { SlideList } from "../../components/slides/slide-list";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import type { SlideContent } from "../../types/presentation";
import { useEffect, useMemo, useState } from "react";
import { CoverPicker } from "../../components/media/cover-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/hymnal/$hymnId")({
  component: HymnDetail,
});

function hymnToSlides(title: string, lyrics: string | null, album: string | null): SlideContent[] {
  const slides: SlideContent[] = [];

  // Cover slide
  slides.push({
    type: "cover",
    title,
    subtitle: album ?? undefined,
  });

  if (lyrics) {
    const stanzas = lyrics.split("\n\n").filter((s) => s.trim().length > 0);
    stanzas.forEach((stanza, i) => {
      slides.push({
        type: "lyrics",
        text: stanza.trim(),
        label: `${i + 1}/${stanzas.length}`,
      });
    });
  }

  // End pause slide
  slides.push({ type: "pause" });

  return slides;
}

function HymnDetail() {
  const { hymnId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = Number(hymnId);
  const { data: hymn, isLoading } = useHymn(id);
  const { setSlides } = usePresentationStore();
  const { slides, activeSlideIndex, goToSlide } = useSlides();
  const [showSyncEditor, setShowSyncEditor] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
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
  const setSyncPoints = useAudioStore((s) => s.setSyncPoints);
  const updateMutation = useUpdateHymn();
  const deleteMutation = useDeleteHymn();

  const generatedSlides = useMemo(() => {
    if (!hymn) return [];
    return hymnToSlides(hymn.title, hymn.lyrics, hymn.album);
  }, [hymn]);

  useEffect(() => {
    if (generatedSlides.length > 0) {
      setSlides(generatedSlides);
    }
  }, [generatedSlides, setSlides]);

  useEffect(() => {
    if (syncPointsData) {
      setSyncPoints(syncPointsData);
    }
  }, [syncPointsData, setSyncPoints]);

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
          category: form.category.trim() || null,
          notes: form.notes.trim() || null,
          cover_path: form.coverPath,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("hymnal.saveFailed", { error: message }));
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
          <div className="ml-auto">
            {isProjecting ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await clearCurrentSlide();
                  setIsProjecting(false);
                }}
              >
                <Square className="mr-2 h-4 w-4" />
                {t("hymnal.stopProjection")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsProjecting(true);
                  goToSlide(localActiveIndex);
                }}
              >
                <Monitor className="mr-2 h-4 w-4" />
                {t("hymnal.project")}
              </Button>
            )}
          </div>
        </div>

        {hymn.author && (
          <p className="text-sm text-muted-foreground">
            {t("hymnal.author")}: {hymn.author}
          </p>
        )}

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">{t("hymnal.editTitle")}</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!form.title.trim() || updateMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {t("actions.save")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  try {
                    await deleteMutation.mutateAsync(id);
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
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
              placeholder={t("hymnal.numberPlaceholder")}
            />
            <Input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
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
          <div className="mt-3">
            <CoverPicker
              value={form.coverPath}
              onChange={(value) => setForm((prev) => ({ ...prev, coverPath: value }))}
              title={form.title || hymn.title}
            />
          </div>
          <div className="mt-3">
            <textarea
              value={form.lyrics}
              onChange={(event) => setForm((prev) => ({ ...prev, lyrics: event.target.value }))}
              rows={6}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder={t("hymnal.lyricsPlaceholder")}
            />
          </div>
        </div>

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
        {hymn.audio_path && <AudioControls filePath={hymn.audio_path} />}

        {/* Sync editor */}
        {showSyncEditor && hymn.audio_path && (
          <AudioSyncEditor
            hymnId={id}
            initialPoints={syncPointsData ?? []}
            totalSlides={slides.length}
            onClose={() => setShowSyncEditor(false)}
          />
        )}

        {hymn.lyrics ? (
          <LyricsDisplay
            lyrics={hymn.lyrics}
            activeStanza={isProjecting ? Math.max(0, activeSlideIndex - 1) : localActiveIndex}
            onStanzaClick={(i) => {
              if (isProjecting) {
                goToSlide(i + 1);
              } else {
                setLocalActiveIndex(i);
              }
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("hymnal.noLyrics")}</p>
        )}
      </div>

      {/* Slide panel */}
      {slides.length > 0 && (
        <div className="hidden w-48 shrink-0 border-l border-border lg:block">
          <SlideList
            slides={slides}
            activeIndex={isProjecting ? activeSlideIndex : localActiveIndex}
            onSelect={(i) => {
              if (isProjecting) {
                goToSlide(i);
              } else {
                setLocalActiveIndex(i);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
