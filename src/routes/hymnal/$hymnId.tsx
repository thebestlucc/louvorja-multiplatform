import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Music } from "lucide-react";
import { useHymn, useSyncPoints } from "../../lib/queries";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAudioStore } from "../../stores/audio-store";
import { useSlides } from "../../hooks/use-slides";
import { LyricsDisplay } from "../../components/music/lyrics-display";
import { AudioControls } from "../../components/music/audio-controls";
import { AudioSyncEditor } from "../../components/music/audio-sync-editor";
import { SlideList } from "../../components/slides/slide-list";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import type { SlideContent } from "../../types/presentation";
import { useEffect, useMemo, useState } from "react";

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
  const id = Number(hymnId);
  const { data: hymn, isLoading } = useHymn(id);
  const { setSlides } = usePresentationStore();
  const { slides, activeSlideIndex, goToSlide } = useSlides();
  const [showSyncEditor, setShowSyncEditor] = useState(false);

  const { data: syncPointsData } = useSyncPoints(id);
  const setSyncPoints = useAudioStore((s) => s.setSyncPoints);

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

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>;
  }

  if (!hymn) {
    return <p className="text-sm text-muted-foreground">{t("hymnal.notFound")}</p>;
  }

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
        </div>

        {hymn.author && (
          <p className="text-sm text-muted-foreground">
            {t("hymnal.author")}: {hymn.author}
          </p>
        )}

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
            activeStanza={Math.max(0, activeSlideIndex - 1)}
            onStanzaClick={(i) => goToSlide(i + 1)}
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
            activeIndex={activeSlideIndex}
            onSelect={goToSlide}
          />
        </div>
      )}
    </div>
  );
}
