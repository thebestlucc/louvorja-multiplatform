import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, MoreVertical, MonitorPlay, Play, Music } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAddServiceItem } from "../../lib/queries";
import type { Hymn } from "../../lib/bindings";
import { CoverImage } from "../media/cover-image";
import { LyricsModal } from "./lyrics-modal";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useHymnPlayback } from "../../hooks/use-hymn-playback";

interface HymnCardProps {
  hymn: Hymn;
  view?: "grid" | "list";
}

export function HymnCard({ hymn, view = "grid" }: HymnCardProps) {
  const { t } = useTranslation();
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);
  const addItemMutation = useAddServiceItem();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const { handleStartCantado, handleStartPlayback, handleStartSlidesOnly } = useHymnPlayback();

  const handleAddToService = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeServiceId) {
      addItemMutation.mutate({
        serviceId: activeServiceId,
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartCantado(hymn); }}
                title={t("hymn.actionSung")}
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartPlayback(hymn); }}
                title={t("hymn.actionPlayback")}
              >
                <Music className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleShowLyrics}
                title={t("hymn.actionShowLyrics")}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
              {activeServiceId && (
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartSlidesOnly(hymn); }}>
                    <MonitorPlay className="mr-2 h-4 w-4" />
                    {t("hymn.actionSlidesOnly")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartCantado(hymn); }}>
                    <Play className="mr-2 h-4 w-4" />
                    {t("hymn.actionSung")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartPlayback(hymn); }}>
                    <Music className="mr-2 h-4 w-4" />
                    {t("hymn.actionPlayback")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShowLyrics}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    {t("hymn.actionShowLyrics")}
                  </DropdownMenuItem>
                  {activeServiceId && (
                    <DropdownMenuItem onClick={handleAddToService}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("services.addToService")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <LyricsModal hymn={hymn} open={lyricsOpen} onOpenChange={setLyricsOpen} />
      </>
    );
  }

  // Grid view
  return (
    <Link to="/hymnal/$hymnId" params={{ hymnId: String(hymn.id) }}>
      <Card className="group h-full overflow-hidden cursor-pointer transition-colors hover:bg-surface-hover">
        <div className="aspect-square w-full relative bg-muted/30">
          <CoverImage
            path={hymn.coverPath}
            title={hymn.title}
            className="h-full w-full object-cover rounded-none"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartSlidesOnly(hymn); }}
              title={t("hymn.actionSlidesOnly")}
            >
              <MonitorPlay className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartCantado(hymn); }}
              title={t("hymn.actionSung")}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleStartPlayback(hymn); }}
              title={t("hymn.actionPlayback")}
            >
              <Music className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={handleShowLyrics}
              title={t("hymn.actionShowLyrics")}
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            {activeServiceId && (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full"
                onClick={handleAddToService}
                title={t("services.addToService")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          {hymn.number != null && (
            <div className="absolute top-2 left-2">
              <Badge variant="outline" className="shadow-sm backdrop-blur-md bg-background/80">
                {hymn.number}
              </Badge>
            </div>
          )}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-md">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={handleShowLyrics}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("hymn.actionShowLyrics")}
                </DropdownMenuItem>
                {activeServiceId && (
                  <DropdownMenuItem onClick={handleAddToService}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("services.addToService")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="p-3">
          <p className="line-clamp-2 font-medium text-sm leading-tight" title={hymn.title}>
            {hymn.title}
          </p>
          {hymn.album && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hymn.album}</p>
          )}
        </div>
      </Card>
      <LyricsModal hymn={hymn} open={lyricsOpen} onOpenChange={setLyricsOpen} />
    </Link>
  );
}
