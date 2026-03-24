import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Home,
  Music,
  FolderOpen,
  BookOpen,
  Presentation,
  ListChecks,
  Wrench,
  Settings,
  Loader2,
  Timer,
  Clock3,
  Shuffle,
  CaseSensitive,
  CalendarDays,
  Monitor,
  MonitorSmartphone,
  MonitorOff,
  Image,
  Eraser,
  Keyboard,
  CircleHelp,
  ListVideo,
} from "lucide-react";
import { catcher } from "../../lib/catcher";
import { cn } from "../../lib/utils";
import { useMonitorsControl } from "../../hooks/use-monitors";
import { openKeyboardShortcutsPanel } from "../utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import {
  searchAllHymns,
  searchBibleGlobal,
  searchCollections,
  searchOnlinePlaylists,
} from "../../lib/tauri";
import type { Hymn, BibleSearchResult, CollectionSearchResult, OnlinePlaylistSearchResult } from "../../lib/bindings";
import { CoverImage } from "../media/cover-image";

type PaletteRouteCommand = {
  id: string;
  icon: typeof Home;
  label: string;
  value: string;
  to: string;
  group: "navigation" | "utilities";
};

type PaletteActionCommand = {
  id: string;
  icon: typeof Home;
  label: string;
  value: string;
  onSelect: () => void | Promise<void>;
};

function renderSnippet(snippet: string) {
  return snippet.split(/(<mark>.*?<\/mark>)/g).map((part, i) =>
    part.startsWith("<mark>") ? (
      <mark key={i} className="rounded-sm bg-yellow-300/80 px-0.5 font-semibold text-yellow-900 dark:bg-yellow-600/60 dark:text-yellow-100">
        {part.slice(6, -7)}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [bibleResults, setBibleResults] = useState<BibleSearchResult[]>([]);
  const [collectionResults, setCollectionResults] = useState<CollectionSearchResult[]>([]);
  const [playlistResults, setPlaylistResults] = useState<OnlinePlaylistSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    toggleProjector,
    toggleReturn,
    toggleBlackScreen,
    toggleLogoScreen,
  } = useMonitorsControl();

  // Keyboard shortcut to open/close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
      setPlaylistResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const [results] = await catcher(
        Promise.all([
          searchAllHymns(query),
          query.trim().length >= 2
            ? searchBibleGlobal(query)
            : Promise.resolve([]),
          query.trim().length >= 2
            ? searchCollections(query)
            : Promise.resolve([]),
          query.trim().length >= 2
            ? searchOnlinePlaylists(query)
            : Promise.resolve([]),
        ]),
        { notify: false },
      );
      if (results) {
        const [h, b, c, p] = results;
        setHymns(h.slice(0, 5));
        setBibleResults(b.slice(0, 5));
        setCollectionResults(c.slice(0, 5));
        setPlaylistResults(p.slice(0, 5));
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
      setPlaylistResults([]);
      setSearching(false);
    }
  }, [open]);

  const routes: PaletteRouteCommand[] = [
    {
      id: "route-home",
      icon: Home,
      label: t("nav.home"),
      value: `${t("nav.home")} dashboard`,
      to: "/",
      group: "navigation",
    },
    {
      id: "route-hymnal",
      icon: Music,
      label: t("nav.hymnal"),
      value: `${t("nav.hymnal")} music lyrics`,
      to: "/hymnal",
      group: "navigation",
    },
    {
      id: "route-collections",
      icon: FolderOpen,
      label: t("nav.collections"),
      value: `${t("nav.collections")} ${t("collections.subtitle")}`,
      to: "/collections",
      group: "navigation",
    },
    {
      id: "route-bible",
      icon: BookOpen,
      label: t("nav.bible"),
      value: `${t("nav.bible")} verses`,
      to: "/bible",
      group: "navigation",
    },
    {
      id: "route-presentations",
      icon: Presentation,
      label: t("nav.presentations"),
      value: `${t("nav.presentations")} slides`,
      to: "/presentations",
      group: "navigation",
    },
    {
      id: "route-services",
      icon: ListChecks,
      label: t("nav.services"),
      value: `${t("nav.services")} liturgy`,
      to: "/services",
      group: "navigation",
    },
    {
      id: "route-utilities",
      icon: Wrench,
      label: t("nav.utilities"),
      value: `${t("nav.utilities")} tools`,
      to: "/utilities",
      group: "navigation",
    },
    {
      id: "route-settings",
      icon: Settings,
      label: t("nav.settings"),
      value: `${t("nav.settings")} preferences`,
      to: "/settings",
      group: "navigation",
    },
    {
      id: "route-help",
      icon: CircleHelp,
      label: t("nav.help"),
      value: `${t("nav.help")} support docs tour`,
      to: "/help",
      group: "navigation",
    },
    {
      id: "route-utilities-timer",
      icon: Timer,
      label: t("utilities.nav.timer"),
      value: `${t("utilities.nav.timer")} ${t("nav.utilities")} countdown stopwatch`,
      to: "/utilities/timer",
      group: "utilities",
    },
    {
      id: "route-utilities-clock",
      icon: Clock3,
      label: t("utilities.nav.clock"),
      value: `${t("utilities.nav.clock")} ${t("nav.utilities")} time`,
      to: "/utilities/clock",
      group: "utilities",
    },
    {
      id: "route-utilities-schedules",
      icon: CalendarDays,
      label: t("utilities.nav.schedules"),
      value: `${t("utilities.nav.schedules")} ${t("nav.utilities")} calendar roster departments monthly`,
      to: "/utilities/schedules",
      group: "utilities",
    },
    {
      id: "route-utilities-lottery",
      icon: Shuffle,
      label: t("utilities.nav.lottery"),
      value: `${t("utilities.nav.lottery")} ${t("nav.utilities")} random`,
      to: "/utilities/lottery",
      group: "utilities",
    },
    {
      id: "route-utilities-text",
      icon: CaseSensitive,
      label: t("utilities.nav.text"),
      value: `${t("utilities.nav.text")} ${t("nav.utilities")} format`,
      to: "/utilities/text",
      group: "utilities",
    },
  ];

  const actionCommands: PaletteActionCommand[] = [
    {
      id: "action-toggle-projector",
      icon: Monitor,
      label: t("commandPalette.actions.toggleProjector"),
      value: `${t("commandPalette.actions.toggleProjector")} f5`,
      onSelect: async () => {
        await toggleProjector();
      },
    },
    {
      id: "action-toggle-return",
      icon: MonitorSmartphone,
      label: t("commandPalette.actions.toggleReturn"),
      value: `${t("commandPalette.actions.toggleReturn")} shift f5`,
      onSelect: async () => {
        await toggleReturn();
      },
    },
    {
      id: "action-toggle-black",
      icon: MonitorOff,
      label: t("commandPalette.actions.toggleBlack"),
      value: `${t("commandPalette.actions.toggleBlack")} b`,
      onSelect: async () => {
        await toggleBlackScreen();
      },
    },
    {
      id: "action-toggle-logo",
      icon: Image,
      label: t("commandPalette.actions.toggleLogo"),
      value: `${t("commandPalette.actions.toggleLogo")} l`,
      onSelect: async () => {
        await toggleLogoScreen();
      },
    },
    {
      id: "action-clear-projection",
      icon: Eraser,
      label: t("commandPalette.actions.clearProjection"),
      value: `${t("commandPalette.actions.clearProjection")} escape`,
      onSelect: async () => {
        await stopProjectionAndSongAudio();
      },
    },
    {
      id: "action-open-shortcuts",
      icon: Keyboard,
      label: t("commandPalette.actions.openShortcuts"),
      value: `${t("commandPalette.actions.openShortcuts")} cmd ctrl /`,
      onSelect: () => {
        openKeyboardShortcutsPanel();
      },
    },
  ];

  const hasQuery = query.trim().length > 0;
  const filteredRoutes = routes.filter((route) => {
    if (!hasQuery) return true;
    return route.value.toLowerCase().includes(query.toLowerCase());
  });
  const filteredNavigationRoutes = filteredRoutes.filter((route) => route.group === "navigation");
  const filteredUtilityRoutes = filteredRoutes.filter((route) => route.group === "utilities");
  const filteredActions = actionCommands.filter((entry) => {
    if (!hasQuery) {
      return true;
    }
    return entry.value.toLowerCase().includes(query.toLowerCase());
  });
  const hasResults =
    filteredNavigationRoutes.length > 0 ||
    filteredUtilityRoutes.length > 0 ||
    filteredActions.length > 0 ||
    hymns.length > 0 ||
    bibleResults.length > 0 ||
    collectionResults.length > 0;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      shouldFilter={false}
      label={t("commandPalette.placeholder")}
      className={cn(
        "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-full max-w-lg rounded-lg border border-border bg-surface shadow-2xl",
      )}
    >
      <Command.Input
        placeholder={t("commandPalette.placeholder")}
        value={query}
        onValueChange={setQuery}
        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-72 overflow-y-auto p-2">
        {!hasQuery && !searching && (
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            {t("commandPalette.noResults")}
          </Command.Empty>
        )}

        {hasQuery && !searching && !hasResults && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("commandPalette.noResults")}
          </div>
        )}

        {searching && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("commandPalette.searching")}
          </div>
        )}

        {/* Navigation group */}
        {filteredNavigationRoutes.length > 0 && (
          <Command.Group
            heading={t("commandPalette.navigation")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {filteredNavigationRoutes.map((route) => (
              <Command.Item
                key={route.id}
                value={route.value}
                onSelect={() => {
                  navigate({ to: route.to });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <route.icon className="h-4 w-4 text-muted-foreground" />
                {route.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Utilities routes */}
        {filteredUtilityRoutes.length > 0 && (
          <Command.Group
            heading={t("commandPalette.utilities")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {filteredUtilityRoutes.map((route) => (
              <Command.Item
                key={route.id}
                value={route.value}
                onSelect={() => {
                  navigate({ to: route.to });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <route.icon className="h-4 w-4 text-muted-foreground" />
                {route.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Global actions */}
        {filteredActions.length > 0 && (
          <Command.Group
            heading={t("commandPalette.globalActions")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {filteredActions.map((action) => (
              <Command.Item
                key={action.id}
                value={action.value}
                onSelect={async () => {
                  await catcher(Promise.resolve(action.onSelect()), { notify: true });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <action.icon className="h-4 w-4 text-muted-foreground" />
                {action.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Hymns group */}
        {hymns.length > 0 && (
          <Command.Group
            heading={t("commandPalette.hymns")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {hymns.map((hymn) => (
              <Command.Item
                key={`hymn-${hymn.id}`}
                value={`hymn-${hymn.id}-${hymn.title}`}
                onSelect={() => {
                  navigate({ to: "/hymnal/$hymnId", params: { hymnId: String(hymn.id) } });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <CoverImage
                  path={hymn.coverPath}
                  title={hymn.title}
                  className="h-5 w-5 rounded"
                />
                <span className="truncate">
                  {hymn.number != null ? `#${hymn.number} - ` : ""}
                  {hymn.title}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Collections group (Albums/Folders) */}
        {collectionResults.filter(r => r.kind === "collection").length > 0 && (
          <Command.Group
            heading={t("commandPalette.collections")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {collectionResults.filter(r => r.kind === "collection").map((result, idx) => (
              <Command.Item
                key={`collection-search-coll-${result.collectionId}-${idx}`}
                value={`collection-${result.collectionId}-${result.title}`}
                onSelect={() => {
                  navigate({
                    to: "/collections/$collectionId",
                    params: { collectionId: String(result.collectionId) },
                  });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <CoverImage
                  path={result.coverPath}
                  title={result.title}
                  fallback={<FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  className="h-5 w-5 rounded"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.snippet ? renderSnippet(result.snippet) : result.collectionName}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Collection Songs group (Individual tracks) */}
        {collectionResults.filter(r => r.kind !== "collection").length > 0 && (
          <Command.Group
            heading={t("commandPalette.collectionSongs")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {collectionResults.filter(r => r.kind !== "collection").map((result, idx) => (
              <Command.Item
                key={`collection-search-song-${result.kind}-${result.collectionId}-${result.songId}-${idx}`}
                value={`collection-song-${result.collectionId}-${result.songId}-${result.title}-${result.collectionName}`}
                onSelect={() => {
                  if (result.kind === "song" && result.songId != null) {
                    navigate({
                      to: "/collections/$collectionId",
                      params: { 
                        collectionId: String(result.collectionId),
                      },
                      hash: `song-${result.songId}`,
                    });
                  } else if (result.songId != null) {
                    navigate({
                      to: "/hymnal/$hymnId",
                      params: { hymnId: String(result.songId) },
                    });
                  }
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <CoverImage
                  path={result.coverPath}
                  title={result.title}
                  fallback={<Music className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  className="h-5 w-5 rounded"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.collectionName} · {result.snippet ? renderSnippet(result.snippet) : t("collections.songs")}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Online Playlists group */}
        {playlistResults.length > 0 && (
          <Command.Group
            heading={t("commandPalette.onlinePlaylists")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {playlistResults.map((result) => (
              <Command.Item
                key={`playlist-${result.dbId}`}
                value={`playlist-${result.dbId}-${result.title}`}
                onSelect={() => {
                  navigate({
                    to: "/collections",
                    search: { tab: "online-videos", playlist: result.playlistId },
                  });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <ListVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.channelTitle}{result.snippet ? <> · {renderSnippet(result.snippet)}</> : null}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Bible group */}
        {bibleResults.length > 0 && (
          <Command.Group
            heading={t("commandPalette.bible")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {bibleResults.map((result, idx) => (
              <Command.Item
                key={`bible-${result.verse.id}-${idx}`}
                value={`bible-${result.verse.id}-${result.bookName}-${result.verse.chapter}:${result.verse.verse}`}
                onSelect={() => {
                  navigate({
                    to: "/bible",
                    search: {
                      book: result.bookName,
                      chapter: result.verse.chapter,
                      verse: result.verse.verse,
                    },
                  });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  <span className="font-medium">
                    {result.bookName} {result.verse.chapter}:{result.verse.verse}
                    {result.versionAbbreviation ? <span className="ml-1 font-normal text-muted-foreground">· {result.versionAbbreviation}</span> : null}
                  </span>
                  {" - "}
                  <span className="text-muted-foreground">
                    {renderSnippet(result.snippet)}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
