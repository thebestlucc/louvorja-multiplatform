import { DragEvent, FormEvent, useDeferredValue, useMemo, useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, useRouter, getRouteApi } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OnlineVideosTab } from "../../components/online-videos/online-videos-tab";
import { PlaylistDetail } from "../../components/online-videos/playlist-detail";
import { FolderOpen, Loader2, Plus, Upload } from "lucide-react";
import { CollectionCard } from "../../components/music/collection-card";
import { ViewToggle } from "../../components/music/view-toggle";
import { useResponsiveColumns, GRID_COLS_CLASS } from "../../hooks/use-responsive-columns";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useFavoriteIds,
  useImportCollectionSong,
} from "../../lib/queries";
import type { Collection } from "../../lib/bindings";
import { getCollection, getCollectionHymns, getSlides } from "../../lib/tauri";
import { getPreference, setPreference } from "../../lib/store";
import { parseSlideRow } from "../../types/presentation";
import { usePresentationStore } from "../../stores/presentation-store";
import { useQueueStore, type QueueItem } from "../../stores/queue-store";
import { useHymnPlayback } from "../../hooks/use-hymn-playback";
import { clearActivePlayback } from "../../lib/projection-playback";
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
import { useRouteTour } from "../../hooks/use-route-tour";
import { SpotlightTour } from "../../components/tour/spotlight-tour";

export const Route = createFileRoute("/collections/")({
  component: CollectionsIndex,
});

const parentRoute = getRouteApi("/collections");

function CollectionsIndex() {
  const { t } = useTranslation();
  const router = useRouter();
  const routeSearch = parentRoute.useSearch();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data, isLoading: isAllLoading } = useCollections(deferredSearch);
  const { data: rawFavoriteIds } = useFavoriteIds("collection");
  const favoriteIds = useMemo(() => new Set(rawFavoriteIds ?? []), [rawFavoriteIds]);
  const createMutation = useCreateCollection();
  const deleteMutation = useDeleteCollection();
  const importSongMutation = useImportCollectionSong();

  const setPresentationSlides = usePresentationStore((state) => state.setSlides);
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const { bindHymnToPlaybackQueue } = useHymnPlayback();
  const addToQueue = useQueueStore((state) => state.addToQueue);

  const [tab, setTab] = useState<"albums" | "custom">(routeSearch.tab === "custom" ? "custom" : "albums");

  useEffect(() => {
    if (routeSearch.tab === "custom") setTab("custom");
    else if (!routeSearch.tab) setTab("albums");
  }, [routeSearch.tab]);
  const [view, setView] = useState<"list" | "grid">("grid");
  const renderView = useDeferredValue(view);

  useEffect(() => {
    void getPreference<"list" | "grid">("collections.viewType", "grid").then(setView);
  }, []);

  const handleSetView = (v: "list" | "grid") => {
    setView(v);
    void setPreference("collections.viewType", v);
  };
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

  const isLoading = isAllLoading;

  const filtered = useMemo(() => {
    if (!data) return [];
    const source = showFavoritesOnly ? data.filter((c) => favoriteIds.has(c.id)) : data;
    return source.filter((entry) =>
      tab === "albums" ? entry.sourceType === "api" : entry.sourceType !== "api"
    );
  }, [data, favoriteIds, tab, showFavoritesOnly]);

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

  const handleDeleteCollection = useCallback(async (id: number) => {
    await deleteMutation.mutateAsync(id);
  // TODO(review): dep array should be [deleteMutation.mutateAsync] for correct granularity — reviewer, 2026-04-06, Severity: Low
  }, [deleteMutation]);

  const handleProjectCollection = useCallback(async (collection: Collection) => {
    await catcher(async () => {
      const allSlides: any[] = [];
      if (collection.sourceType === "api") {
        const hymns = await getCollectionHymns(collection.id);
        const results = await Promise.all(
          hymns.map((hymn) => catcher(bindHymnToPlaybackQueue(hymn, 0)))
        );
        for (const [result] of results) {
          allSlides.push(...(result?.generatedSlides ?? []));
        }
      } else {
        const detail = await getCollection(collection.id);
        const songsWithCache = detail.songs.filter((s) => s.cachePresentationId);
        const slideArrays = await Promise.all(
          songsWithCache.map(async (song) => {
            const [rows] = await catcher(getSlides(song.cachePresentationId!));
            return (rows ?? []).map((r) => parseSlideRow(r).content);
          })
        );
        for (const contents of slideArrays) allSlides.push(...contents);
      }

      if (allSlides.length > 0) {
        setCurrentPresentation(null);
        setPresentationSlides(allSlides);
        notify.success(t("collections.projectedAll", { count: allSlides.length }));
      }
    }, { notify: true, fallbackMessage: t("collections.projectFailed") });
  }, [bindHymnToPlaybackQueue, setCurrentPresentation, setPresentationSlides, t]);

  const handlePlayCollectionSongs = useCallback(async (collection: Collection) => {
    await catcher(async () => {
      await clearActivePlayback();
      if (collection.sourceType === "api") {
        const hymns = await getCollectionHymns(collection.id);
        if (hymns.length > 0) {
          const queueItems: QueueItem[] = hymns.map((hymn) => ({
            id: crypto.randomUUID(),
            kind: "hymn" as const,
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
  }, [addToQueue, router, t]);

  const handlePlayCollectionPlayback = useCallback(async (collection: Collection) => {
    await catcher(async () => {
      await clearActivePlayback();
      if (collection.sourceType === "api") {
        const hymns = await getCollectionHymns(collection.id);
        if (hymns.length > 0) {
          const queueItems: QueueItem[] = hymns.map((hymn) => ({
            id: crypto.randomUUID(),
            kind: "hymn" as const,
            hymn,
            type: "playback",
          }));
          addToQueue(queueItems, true);
          notify.success(t("collections.playingHymn", { title: hymns[0].title }));
          void router.navigate({ to: "/playing-now" });
        }
      }
    }, { notify: true, fallbackMessage: t("collections.playFailed") });
  }, [addToQueue, router, t]);

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

  const columns = useResponsiveColumns(renderView);
  const rowCount = Math.ceil(filtered.length / columns);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const estimateSize = useCallback(
    () => (renderView === "list" ? 64 : 280),
    [renderView],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize,
    overscan: 5,
    gap: 16,
  });

  const isOnlineVideos = routeSearch.tab === "online-videos";
  const { showTour, steps, handleComplete, handleSkip } = useRouteTour("/collections");

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-4">
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

      <div className="flex shrink-0 items-center justify-between border-b border-border pb-2" data-tour="collections-tabs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { void router.navigate({ to: "/collections", search: {} }); }}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              !isOnlineVideos && tab === "albums" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("collections.tabAlbums")}
          </button>
          <button
            type="button"
            onClick={() => { void router.navigate({ to: "/collections", search: { tab: "custom" } }); }}
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
          <ViewToggle
            view={view}
            onSetView={handleSetView}
            showFavoritesOnly={showFavoritesOnly}
            onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
          />
        )}
      </div>

      {/* Online Videos tab content */}
      {isOnlineVideos && (
        routeSearch.playlist
          ? <PlaylistDetail playlistId={routeSearch.playlist} />
          : <OnlineVideosTab />
      )}

      {/* Collections tab content (albums / custom) */}
      {!isOnlineVideos && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <Input
            className="shrink-0"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("collections.searchPlaceholder")}
          />

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10">
                <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("collections.empty")}</p>
              </div>
            ) : (
              <>
                {renderView === "list" && (
                  <div className="sticky top-0 z-10 hidden sm:grid grid-cols-[2fr_1fr_100px_160px] gap-4 rounded-t-lg border border-b-0 border-border bg-muted px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="pl-2">{t("collections.name", "Name")}</div>
                    <div>{t("collections.year", "Year")}</div>
                    <div>{t("collections.songs", "Songs")}</div>
                    <div className="text-right pr-2">{t("table.actions", "Actions")}</div>
                  </div>
                )}

                <div className={cn(
                  renderView === "list" ? "rounded-b-lg border border-t-0 border-border bg-card" : "",
                )}>
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
                              renderView === "grid"
                                ? cn(GRID_COLS_CLASS, "h-full")
                                : "flex flex-col"
                            )}
                          >
                            {rowItems.map((collection) => (
                              <CollectionCard
                                key={collection.id}
                                collection={collection}
                                view={renderView}
                                favoriteIds={favoriteIds}
                                onProject={handleProjectCollection}
                                onPlaySongs={handlePlayCollectionSongs}
                                onPlayPlayback={handlePlayCollectionPlayback}
                                onDelete={handleDeleteCollection}
                                deleteFallbackMessage={t("collections.deleteFailed", { error: "" })}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showTour && steps.length > 0 && (
        <SpotlightTour steps={steps} onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </div>
  );
}
