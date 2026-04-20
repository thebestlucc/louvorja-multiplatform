import React from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FolderOpen, Trash2, MonitorPlay, Play, Music, MoreVertical } from "lucide-react";
import { catcher } from "../../lib/catcher";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { Collection } from "../../lib/bindings";
import { CoverImage } from "../media/cover-image";
import { FavoriteButton } from "./favorite-button";

function getCreationYear(createdAt: string): number | null {
  const match = createdAt.match(/^(\d{4})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

interface CollectionCardProps {
  collection: Collection;
  view: "list" | "grid";
  favoriteIds?: Set<number>;
  onProject: (collection: Collection) => Promise<void>;
  onPlaySongs: (collection: Collection) => Promise<void>;
  onPlayPlayback: (collection: Collection) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  deleteFallbackMessage: string;
}

export const CollectionCard = React.memo(function CollectionCard({
  collection,
  view,
  favoriteIds,
  onProject,
  onPlaySongs,
  onPlayPlayback,
  onDelete,
  deleteFallbackMessage,
}: CollectionCardProps) {
  const { t } = useTranslation();
  const cover = collection.coverPath ?? collection.autoCoverPath;
  const creationYear = collection.year ?? getCreationYear(collection.createdAt);
  const isFav = favoriteIds?.has(collection.id) ?? false;

  if (view === "list") {
    return (
      <div className="group relative border-b border-border bg-card transition-colors hover:bg-muted/50 h-full">
        <Link to="/collections/$collectionId" params={{ collectionId: String(collection.id) }} className="absolute inset-0 z-0" />
        <div className="flex flex-col sm:grid sm:grid-cols-[2fr_1fr_100px_160px] items-start sm:items-center gap-2 sm:gap-4 px-4 py-3 text-sm relative z-10 pointer-events-none h-full">
          <div className="flex items-center gap-3 min-w-0 w-full pl-0 sm:pl-2">
            {cover ? (
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border">
                <CoverImage path={cover} title={collection.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-8 w-8 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center">
                <FolderOpen className="h-4 w-4 text-muted-foreground/50" />
              </div>
            )}
            <span className="font-medium truncate">{collection.name}</span>
          </div>

          <div className="text-muted-foreground truncate hidden sm:block">
            {creationYear ?? <span className="text-muted-foreground/50">-</span>}
          </div>

          <div className="text-muted-foreground hidden sm:block">
            {collection.songCount}
          </div>

          <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pr-0 sm:pr-2 pointer-events-auto w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 pt-2 sm:pt-0">
            <FavoriteButton itemType="collection" itemId={collection.id} isFavoriteOverride={isFav} size="icon" className="h-8 w-8" />
            {/* TODO(review): title attributes should use t() for i18n — reviewer, 2026-04-06, Severity: Low */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Project All"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onProject(collection); }}
            >
              <MonitorPlay className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Play All Songs"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlaySongs(collection); }}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Play All Playback"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlayPlayback(collection); }}
            >
              <Music className="h-4 w-4" />
            </Button>
            {collection.sourceType !== "api" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={async (e) => {
                  e.preventDefault();
                  await catcher(onDelete(collection.id), {
                    notify: true,
                    fallbackMessage: deleteFallbackMessage,
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link key={collection.id} to="/collections/$collectionId" params={{ collectionId: String(collection.id) }} className="flex flex-col gap-3 group cursor-pointer h-full">
      <div className="relative aspect-square w-full rounded-md overflow-hidden bg-muted/30 shadow-sm">
        <CoverImage
          path={cover}
          title={collection.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 right-2 z-20">
          <FavoriteButton
            itemType="collection"
            itemId={collection.id}
            isFavoriteOverride={isFav}
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full shadow-md bg-background/80 hover:bg-background backdrop-blur-md border-white/10"
          />
        </div>
        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-3">
          <div className="flex items-center justify-center gap-1.5 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onProject(collection); }}
              title="Project All"
            >
              <MonitorPlay className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlaySongs(collection); }}
              title="Play All Songs"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlayPlayback(collection); }}
              title="Play All Playback"
            >
              <Music className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-300">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <Button size="icon" variant="outline" className="h-7 w-7 rounded-full shadow-md bg-background/80 hover:bg-background backdrop-blur-md">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onProject(collection)}>
                <MonitorPlay className="mr-2 h-4 w-4" />
                Project All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPlaySongs(collection)}>
                <Play className="mr-2 h-4 w-4" />
                Play All Songs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPlayPlayback(collection)}>
                <Music className="mr-2 h-4 w-4" />
                Play All Playback
              </DropdownMenuItem>
              {collection.sourceType !== "api" && (
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={async (e) => {
                    e.preventDefault();
                    await catcher(onDelete(collection.id), {
                      notify: true,
                      fallbackMessage: deleteFallbackMessage,
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-1 flex-1 flex flex-col">
        <p className="line-clamp-2 font-medium text-sm leading-tight text-foreground" title={collection.name}>
          {collection.name}
        </p>
        <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground gap-2">
          <span className="truncate">{creationYear ?? t("collections.yearUnknown")}</span>
          <span className="shrink-0">{t("collections.songCount", { count: collection.songCount })}</span>
        </div>
      </div>
    </Link>
  );
});
