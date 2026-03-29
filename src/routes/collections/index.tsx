import { DragEvent, FormEvent, useDeferredValue, useMemo, useState, useRef } from "react";
import { createFileRoute, Link, useRouter, getRouteApi } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OnlineVideosTab } from "../../components/online-videos/online-videos-tab";
import { PlaylistDetail } from "../../components/online-videos/playlist-detail";
import { FolderOpen, Loader2, Plus, Trash2, LayoutGrid, List as ListIcon, MoreVertical, Play, MonitorPlay, Music, Upload } from "lucide-react";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useFavoriteCollections,
  useImportCollectionSong,
} from "../../lib/queries";
import type { Collection } from "../../lib/bindings";
import { getCollection, getCollectionHymns, getSlides } from "../../lib/tauri";
import { parseSlideRow } from "../../types/presentation";
import { usePresentationStore } from "../../stores/presentation-store";
import { useQueueStore, type QueueItem } from "../../stores/queue-store";
import { useHymnPlayback } from "../../hooks/use-hymn-playback";
import { CoverImage } from "../../components/media/cover-image";
import { FavoriteButton } from "../../components/music/favorite-button";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMedia } from "react-use";

export const Route = createFileRoute("/collections/")({
  component: CollectionsIndex,
});

function getCreationYear(createdAt: string): number | null {
  const match = createdAt.match(/^(\d{4})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

const parentRoute = getRouteApi("/collections");

function CollectionsIndex() {
  const { t } = useTranslation();
  const router = useRouter();
  const routeSearch = parentRoute.useSearch();

  // All hooks must be unconditional — no early returns before this block
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data, isLoading: isAllLoading } = useCollections(deferredSearch, { enabled: !showFavoritesOnly });
  const { data: favoriteCollections, isLoading: isFavoritesLoading } = useFavoriteCollections(deferredSearch, { enabled: showFavoritesOnly });
  const createMutation = useCreateCollection();
  const deleteMutation = useDeleteCollection();
  const importSongMutation = useImportCollectionSong();

  const setPresentationSlides = usePresentationStore((state) => state.setSlides);
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const { bindHymnToPlaybackQueue } = useHymnPlayback();
  const addToQueue = useQueueStore((state) => state.addToQueue);

  const [tab, setTab] = useState<"albums" | "custom">("albums");
  const [view, setView] = useState<"list" | "grid">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState("");
  const [uploadPaths, setUploadPaths] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const descriptionLimit = 280;
  const currentYear = new Date().getFullYear() + 1;
  const normalizedName = name.trim();
  const normalizedDescription = description.trim();
  const normalizedYear = year.trim();
  const parsedYear = normalizedYear.length > 0 ? Number(normalizedYear) : null;
  const yearInvalid =
    normalizedYear.length > 0 &&
    (!Number.isInteger(parsedYear) || (parsedYear != null && (parsedYear < 1900 || parsedYear > currentYear)));
  const nameError =
    name.length > 0 && normalizedName.length === 0 ? t("collections.nameRequired") : undefined;
  const descriptionTooLong = normalizedDescription.length > descriptionLimit;
  const canSubmit =
    normalizedName.length > 0 &&
    !descriptionTooLong &&
    !yearInvalid &&
    !createMutation.isPending;

  const isLoading = showFavoritesOnly ? isFavoritesLoading : isAllLoading;

  const filtered = useMemo(() => {
    const source = showFavoritesOnly ? (favoriteCollections || []) : (data || []);
    
    return source.filter((entry) =>
      tab === "albums" ? entry.sourceType === "api" : entry.sourceType !== "api"
    );
  }, [data, favoriteCollections, tab, showFavoritesOnly]);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setYear("");
    setUploadPaths([]);
  };

  const addUploadPaths = (paths: string[]) => {
    setUploadPaths((prev) => {
      const merged = new Set(prev);
      paths.forEach((path) => {
        if (path && path.trim()) {
          merged.add(path.trim());
        }
      });
      return [...merged];
    });
  };

  const pickUploadFiles = async () => {
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: "Slides", extensions: ["slja", "pptx"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    addUploadPaths(paths);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (paths.length === 0) {
      notify.error(t("collections.uploadDropUnsupported"));
      return;
    }
    addUploadPaths(paths);
  };

  const handleProjectCollection = async (collection: Collection) => {
    await catcher(async () => {
      const allSlides: any[] = [];
      if (collection.sourceType === "api") {
        const hymns = await getCollectionHymns(collection.id);
        for (const hymn of hymns) {
          const slides = (await bindHymnToPlaybackQueue(hymn, 0))?.generatedSlides || [];
          allSlides.push(...slides);
        }
      } else {
        const detail = await getCollection(collection.id);
        for (const song of detail.songs) {
          if (song.cachePresentationId) {
            const rows = await getSlides(song.cachePresentationId);
            const contents = rows.map((r) => parseSlideRow(r).content);
            allSlides.push(...contents);
          }
        }
      }
      
      if (allSlides.length > 0) {
        setCurrentPresentation(null);
        setPresentationSlides(allSlides);
        notify.success(t("collections.projectedAll", { count: allSlides.length }));
      }
    }, { notify: true, fallbackMessage: t("collections.projectFailed") });
  };

  const handlePlayCollectionSongs = async (collection: Collection) => {
    await catcher(async () => {
      if (collection.sourceType === "api") {
        const hymns = await getCollectionHymns(collection.id);
        if (hymns.length > 0) {
          const queueItems: QueueItem[] = hymns.map((hymn) => ({
            id: crypto.randomUUID(),
            hymn,
            type: "audio",
          }));
          addToQueue(queueItems, true);
          notify.success(t("collections.playingHymn", { title: hymns[0].title }));
          void router.navigate({ to: "/playing-now" });
        }
      } else {
        const detail = await getCollection(collection.id);
        if (detail.songs.length > 0) {
          notify.info("Custom collection playlist not yet fully implemented. Playing first item...");
        }
      }
    }, { notify: true, fallbackMessage: t("collections.playFailed") });
  };

  const handlePlayCollectionPlayback = async (collection: Collection) => {
    await catcher(async () => {
      if (collection.sourceType === "api") {
        const hymns = await getCollectionHymns(collection.id);
        if (hymns.length > 0) {
          const queueItems: QueueItem[] = hymns.map((hymn) => ({
            id: crypto.randomUUID(),
            hymn,
            type: "playback",
          }));
          addToQueue(queueItems, true);
          notify.success(t("collections.playingHymn", { title: hymns[0].title }));
          void router.navigate({ to: "/playing-now" });
        }
      }
    }, { notify: true, fallbackMessage: t("collections.playFailed") });
  };

  const handleCreate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) return;
    
    await catcher(async () => {
      const collection = await createMutation.mutateAsync({
        name: normalizedName,
        description: normalizedDescription || null,
        year: parsedYear,
        coverPath: null,
      });

      let importedCount = 0;
      for (const path of uploadPaths) {
        await importSongMutation.mutateAsync({ collectionId: collection.id, path });
        importedCount += 1;
      }

      if (importedCount > 0) {
        notify.success(t("collections.uploadImported", { count: importedCount }));
      }

      resetCreateForm();
      setCreateOpen(false);
    }, { notify: true, fallbackMessage: t("collections.saveFailed", { error: "" }) });
  };

  const isXl = useMedia("(min-width: 1280px)", false);
  const isLg = useMedia("(min-width: 1024px)", false);
  const isMd = useMedia("(min-width: 768px)", false);
  const isSm = useMedia("(min-width: 640px)", false);

  const columns = view === "list" ? 1 : isXl ? 6 : isLg ? 5 : isMd ? 4 : isSm ? 3 : 2;
  const rowCount = Math.ceil(filtered.length / columns);
  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.getElementById("main-scroll-area"),
    estimateSize: () => (view === "list" ? 64 : 280),
    overscan: 5,
    gap: 16,
  });

  const isOnlineVideos = routeSearch.tab === "online-videos";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" ref={listRef}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.collections")}</h1>
          <p className="text-sm text-muted-foreground">{t("collections.subtitle")}</p>
        </div>
        {!isOnlineVideos && (
          <Button onClick={() => setCreateOpen(true)} className={tab !== "custom" ? "invisible" : ""}>
            <Plus className="mr-2 h-4 w-4" />
            {t("collections.create")}
          </Button>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("collections.createTitle")}</DialogTitle>
            <DialogDescription>{t("collections.createHint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="new-collection-name"
                label={t("collections.nameLabel")}
                value={name}
                error={nameError}
                onChange={(event) => setName(event.target.value)}
                onBlur={(event) => setName(event.target.value.trimStart())}
                placeholder={t("collections.namePlaceholder")}
                autoComplete="off"
                autoFocus
              />
              <Input
                id="new-collection-year"
                label={t("collections.yearLabel")}
                type="number"
                min={1900}
                max={currentYear}
                value={year}
                error={yearInvalid ? t("collections.yearInvalid", { min: 1900, max: currentYear }) : undefined}
                onChange={(event) => setYear(event.target.value)}
                onBlur={(event) => setYear(event.target.value.trim())}
                placeholder={t("collections.yearPlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="new-collection-description" className="text-sm font-medium text-foreground">
                {t("collections.descriptionLabel")}
              </label>
              <textarea
                id="new-collection-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleCreate();
                  }
                }}
                placeholder={t("collections.descriptionPlaceholder")}
                rows={3}
                className={cn(
                  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                  descriptionTooLong && "border-destructive",
                )}
                maxLength={descriptionLimit + 40}
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("collections.descriptionHelp")}</span>
                <span className={descriptionTooLong ? "text-destructive" : "text-muted-foreground"}>
                  {normalizedDescription.length}/{descriptionLimit}
                </span>
              </div>
              {descriptionTooLong && (
                <p className="text-xs text-destructive">
                  {t("collections.descriptionTooLong", { max: descriptionLimit })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("collections.uploadLabel")}</p>
              <button
                type="button"
                onClick={pickUploadFiles}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  "w-full rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-left transition-colors",
                  "hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isDragOver && "border-primary bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Upload className="h-4 w-4" />
                  {t("collections.uploadBrowse")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("collections.uploadHint")}</p>
              </button>
              {uploadPaths.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("collections.uploadEmpty")}</p>
              ) : (
                <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
                  {uploadPaths.map((path) => (
                    <div key={path} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-muted-foreground">{path}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setUploadPaths((prev) => prev.filter((entry) => entry !== path))
                        }
                      >
                        {t("actions.remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={resetCreateForm} disabled={createMutation.isPending}>
                {t("collections.resetForm")}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("collections.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { void router.navigate({ to: "/collections" }); setTab("albums"); }}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              !isOnlineVideos && tab === "albums" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("collections.tabAlbums")}
          </button>
          <button
            type="button"
            onClick={() => { void router.navigate({ to: "/collections" }); setTab("custom"); }}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              !isOnlineVideos && tab === "custom" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("collections.tabCustom")}
          </button>
          <button
            type="button"
            onClick={() => router.navigate({ to: "/collections", search: { tab: "online-videos" } })}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              isOnlineVideos ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("nav.onlineVideos")}
          </button>
        </div>
        {!isOnlineVideos && (
          <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 transition-all",
                showFavoritesOnly ? "text-yellow-500 shadow-sm bg-yellow-500/5" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              title={t("favorites.title")}
            >
              <Star className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="icon" className={cn(
              "h-8 w-8 transition-all",
              view === "list" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )} onClick={() => setView("list")} title="List view">
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className={cn(
              "h-8 w-8 transition-all",
              view === "grid" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )} onClick={() => setView("grid")} title="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Online Videos tab content */}
      {isOnlineVideos && (
        routeSearch.playlist
          ? <PlaylistDetail playlistId={routeSearch.playlist} />
          : <OnlineVideosTab />
      )}

      {/* Collections tab content (albums / custom) */}
      {!isOnlineVideos && <>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("collections.searchPlaceholder")}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10">
          <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("collections.empty")}</p>
        </div>
      ) : (
        <div className={view === "list" ? "rounded-lg border border-border bg-card overflow-hidden" : ""}>
          {view === "list" && (
            <div className="grid grid-cols-[2fr_1fr_100px_160px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:grid">
              <div className="pl-2">{t("collections.name", "Name")}</div>
              <div>{t("collections.year", "Year")}</div>
              <div>{t("collections.songs", "Songs")}</div>
              <div className="text-right pr-2">{t("table.actions", "Actions")}</div>
            </div>
          )}
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * columns;
              const rowItems = filtered.slice(startIndex, startIndex + columns);

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className={cn(
                      view === "grid" 
                        ? "grid gap-4 h-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
                        : "flex flex-col"
                    )}
                  >
                    {rowItems.map((collection) => {
                      const cover = collection.coverPath ?? collection.autoCoverPath;
                      const creationYear = collection.year ?? getCreationYear(collection.createdAt);

                      if (view === "list") {
                        return (
                          <div key={collection.id} className="group relative border-b border-border bg-card transition-colors hover:bg-muted/50 h-full">
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
                                <FavoriteButton itemType="collection" itemId={collection.id} size="icon" className="h-8 w-8" />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground" 
                                  title="Project All"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleProjectCollection(collection); }}
                                >
                                  <MonitorPlay className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground" 
                                  title="Play All Songs"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handlePlayCollectionSongs(collection); }}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground" 
                                  title="Play All Playback"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handlePlayCollectionPlayback(collection); }}
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
                                      await catcher(deleteMutation.mutateAsync(collection.id), {
                                        notify: true,
                                        fallbackMessage: t("collections.deleteFailed", { error: "" }),
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
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleProjectCollection(collection); }}
                                title="Project All"
                              >
                                <MonitorPlay className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handlePlayCollectionSongs(collection); }}
                                title="Play All Songs"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 rounded-full shadow-md bg-background/90 hover:bg-background"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handlePlayCollectionPlayback(collection); }}
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
                                <DropdownMenuItem onClick={() => void handleProjectCollection(collection)}>
                                  <MonitorPlay className="mr-2 h-4 w-4" />
                                  Project All
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handlePlayCollectionSongs(collection)}>
                                  <Play className="mr-2 h-4 w-4" />
                                  Play All Songs
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handlePlayCollectionPlayback(collection)}>
                                  <Music className="mr-2 h-4 w-4" />
                                  Play All Playback
                                </DropdownMenuItem>
                                {collection.sourceType !== "api" && (
                                  <DropdownMenuItem 
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      await catcher(deleteMutation.mutateAsync(collection.id), {
                                        notify: true,
                                        fallbackMessage: t("collections.deleteFailed", { error: "" }),
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
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
      </>}
    </div>
  );
}
