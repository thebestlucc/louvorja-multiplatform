import { memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, MonitorPlay, Play, Music } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAddLiturgyItem, useFavoriteIds } from "../../lib/queries";
import type { Hymn } from "../../lib/bindings";
import { CoverImage } from "../media/cover-image";
import { LyricsModal } from "./lyrics-modal";
import { useHymnPlayback } from "../../hooks/use-hymn-playback";
import { FavoriteButton } from "./favorite-button";

interface HymnCardProps {
  hymn: Hymn;
  view?: "grid" | "list";
}

export const HymnCard = memo(function HymnCard({ hymn, view = "grid" }: HymnCardProps) {
  const { t } = useTranslation();
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const addItemMutation = useAddLiturgyItem();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const { handleStartCantado, handleStartPlayback, handleStartSlidesOnly } = useHymnPlayback();
  const { data: favoriteIds } = useFavoriteIds("hymn");
  const isFav = favoriteIds?.has(hymn.id);

  const hasAudio = Boolean(hymn.audioPath);
  const hasPlayback = Boolean(hymn.playbackPath);
  const hasLyrics = Boolean(hymn.lyrics);

  const handleAddToService = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeLiturgyId) {
      addItemMutation.mutate({
        serviceId: activeLiturgyId,
        itemType: "hymn",
        title: hymn.title,
        itemId: hymn.id,
        notes: null,
      });
    }
  };

  const handleShowLyrics = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLyricsOpen(true);
  };

  if (view === "list") {
    return (
      <>
        <div className="group relative border-b border-border bg-card transition-colors hover:bg-muted/50">
          <Link to="/hymnal/$hymnId" params={{ hymnId: String(hymn.id) }} className="absolute inset-0 z-0" />
          <div className="grid grid-cols-[80px_2fr_1fr_120px] items-center gap-4 px-4 py-3 text-sm relative z-10 pointer-events-none">
            <div className="text-muted-foreground font-medium tabular-nums pl-2">
              {hymn.number != null ? (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium ring-1 ring-inset ring-border">
                  #{hymn.number}
                </span>
              ) : (
                <span className="text-muted-foreground/50">-</span>
              )}
            </div>
            <div className="font-medium text-foreground truncate flex items-center gap-3">
              {hymn.coverPath ? (
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border">
                  <CoverImage path={hymn.coverPath} title={hymn.title} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-muted-foreground/50" />
                </div>
              )}
              <span className="truncate">{hymn.title}</span>
            </div>
            <div className="text-muted-foreground truncate">
              {hymn.album || <span className="text-muted-foreground/50">-</span>}
            </div>
            
            <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pr-2 pointer-events-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartSlidesOnly(hymn); }}
                title={t("hymn.actionSlidesOnly")}
              >
                <MonitorPlay className="h-4 w-4" />
              </Button>
              {hasAudio && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartCantado(hymn); }}
                  title={t("hymn.actionSung")}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {hasPlayback && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartPlayback(hymn); }}
                  title={t("hymn.actionPlayback")}
                >
                  <Music className="h-4 w-4" />
                </Button>
              )}
              {hasLyrics && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={handleShowLyrics}
                  title={t("hymn.actionShowLyrics")}
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              )}
              {activeLiturgyId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={handleAddToService}
                  title={t("services.addToService")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <FavoriteButton itemType="hymn" itemId={hymn.id} size="icon" className="h-8 w-8" isFavoriteOverride={isFav} />
            </div>
          </div>
        </div>
        <LyricsModal hymn={hymn} open={lyricsOpen} onOpenChange={setLyricsOpen} />
      </>
    );
  }

  // Grid view
  return (
    <div className="flex flex-col gap-3 group h-full relative">
      <div className="relative aspect-square w-full rounded-md overflow-hidden bg-muted/30 shadow-sm border border-transparent transition-colors group-hover:border-primary/20">
        <CoverImage
          path={hymn.coverPath}
          title={hymn.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Main Click Area */}
        <Link to="/hymnal/$hymnId" params={{ hymnId: String(hymn.id) }} className="absolute inset-0 z-0" />

        {/* Favorite Button (Top Right) */}
        <div className="absolute top-2 right-2 z-20">
          <FavoriteButton
            itemType="hymn"
            itemId={hymn.id}
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full shadow-md bg-background/80 hover:bg-background backdrop-blur-md border-white/10"
            isFavoriteOverride={isFav}
          />
        </div>

        {/* Action Overlay (Bottom) */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-3 z-10">
          <div className="flex items-center justify-center gap-1.5 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background border-transparent"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartSlidesOnly(hymn); }}
              title={t("hymn.actionSlidesOnly")}
            >
              <MonitorPlay className="h-4 w-4" />
            </Button>
            {hasAudio && (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background border-transparent"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartCantado(hymn); }}
                title={t("hymn.actionSung")}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {hasPlayback && (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background border-transparent"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartPlayback(hymn); }}
                title={t("hymn.actionPlayback")}
              >
                <Music className="h-4 w-4" />
              </Button>
            )}
            {hasLyrics && (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background border-transparent"
                onClick={handleShowLyrics}
                title={t("hymn.actionShowLyrics")}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            )}
            {activeLiturgyId && (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background text-primary border-transparent"
                onClick={handleAddToService}
                title={t("services.addToService")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {hymn.number != null && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <Badge variant="outline" className="shadow-sm backdrop-blur-md bg-black/40 text-white border-white/20">
              {hymn.number}
            </Badge>
          </div>
        )}
      </div>
      
      <Link to="/hymnal/$hymnId" params={{ hymnId: String(hymn.id) }} className="px-1 flex-1 flex flex-col group/text">
        <p className="line-clamp-2 font-medium text-sm leading-tight text-foreground group-hover/text:text-primary transition-colors" title={hymn.title}>
          {hymn.title}
        </p>
        {hymn.album && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hymn.album}</p>
        )}
      </Link>
      <LyricsModal hymn={hymn} open={lyricsOpen} onOpenChange={setLyricsOpen} />
    </div>
  );
});
