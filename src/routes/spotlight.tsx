import { createFileRoute } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useEffect, useRef, useState, useMemo } from "react";
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
  Timer,
  Clock3,
  Shuffle,
  CaseSensitive,
  CalendarDays,
  CircleHelp,
  Monitor,
  MonitorSmartphone,
  MonitorOff,
  Image,
  Library,
  Eraser,
  Keyboard,
  Loader2,
  MonitorPlay,
  Search,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { catcher } from "../lib/catcher";
import { THEMES, type Theme } from "../lib/constants";
import {
  spotlightSelect,
  spotlightHide,
  searchAllHymns,
  searchBible,
  searchCollections,
  searchCollectionsContent,
  searchMediaLibraryItems,
  getHymn,
  setCurrentSlide,
} from "../lib/tauri";
import type { Hymn, BibleSearchResult, CollectionSearchResult, MediaLibraryItem } from "../lib/bindings";
import { CoverImage } from "../components/media/cover-image";
import { useThemeStore } from "../stores/theme-store";
import { HighlightedSnippet } from "../components/ui/highlighted-snippet";
import { findBookIndexByQuery, getLocalizedBookNameByIndex } from "../components/bible/book-catalog";

export const Route = createFileRoute("/spotlight")({
  component: SpotlightWindow,
});

export { SpotlightWindow };

type SettingChangedPayload = {
  key: string;
  value: string;
};

function isTheme(value: string | null | undefined): value is Theme {
  if (!value) return false;
  return THEMES.includes(value as Theme);
}

function parseFirstStanza(lyrics: string | null): string {
  if (!lyrics) return "";
  const stanzas = lyrics
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return stanzas[0] ?? "";
}

const EMPTY_SLIDE_PROPS = {
  text: null,
  title: null,
  subtitle: null,
  label: null,
  videoPath: null,
  backgroundImage: null,
  backgroundColor: null,
  audioPath: null,
  autoPlay: null,
  loop: null,
  muted: null,
  mode: null,
  textColor: null,
  textSize: null,
  videoUrl: null,
  videoId: null,
  videoSource: null,
  videoTitle: null,
};

async function projectBibleVerse(result: BibleSearchResult) {
  const { verse, bookName } = result;
  await setCurrentSlide({
    ...EMPTY_SLIDE_PROPS,
    slideType: "bible",
    text: verse.text,
    title: `${bookName} ${verse.chapter}:${verse.verse}`,
  });
}

async function projectHymnFirstStanza(hymn: Hymn) {
  const fullHymn = await getHymn(hymn.id);
  const stanzaText = parseFirstStanza(fullHymn.lyrics);
  await setCurrentSlide({
    ...EMPTY_SLIDE_PROPS,
    slideType: "lyrics",
    text: stanzaText || hymn.title,
    title: hymn.title,
  });
}

function SpotlightWindow() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const setTheme = useThemeStore((state) => state.setTheme);
  const [query, setQuery] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [bibleResults, setBibleResults] = useState<BibleSearchResult[]>([]);
  const [collectionResults, setCollectionResults] = useState<CollectionSearchResult[]>([]);
  const [libraryResults, setLibraryResults] = useState<MediaLibraryItem[]>([]);
  const [searching, setSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Make the webview fully transparent so only the panel renders visually.
  // Without this, the html/body default background fills the entire window
  // and shows below/around the frosted glass panel.
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    const applyThemeCandidate = (candidate: string | null | undefined) => {
      if (!isTheme(candidate)) return;
      if (useThemeStore.getState().theme === candidate) return;
      setTheme(candidate);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      applyThemeCandidate(event.newValue);
    };

    window.addEventListener("storage", onStorage);

    let unlisten: (() => void) | undefined;
    listen<SettingChangedPayload>("setting-changed", (event) => {
      if (event.payload.key !== "app.theme") return;
      applyThemeCandidate(event.payload.value);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      window.removeEventListener("storage", onStorage);
      unlisten?.();
    };
  }, [setTheme]);

  // Reset state and focus input when spotlight becomes visible.
  // Driven by a Rust "spotlight-shown" event for reliable timing.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("spotlight-shown", () => {
      setQuery("");
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
      setLibraryResults([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        void spotlightHide();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const long = query.trim().length >= 2;
      // Run searches independently so a broken FTS index for one domain
      // does not suppress results from the other two.
      const [[h], [b], [c], [cc], [l]] = await Promise.all([
        catcher(searchAllHymns(query), { notify: false }),
        long ? catcher(searchBible(query, null), { notify: false }) : Promise.resolve([[], null] as const),
        long ? catcher(searchCollections(query), { notify: false }) : Promise.resolve([[], null] as const),
        long ? catcher(searchCollectionsContent(query), { notify: false }) : Promise.resolve([[], null] as const),
        long ? catcher(searchMediaLibraryItems(query), { notify: false }) : Promise.resolve([[], null] as const),
      ]);

      setHymns((h ?? []).slice(0, 5));
      setBibleResults((b ?? []).slice(0, 5));
      // Merge main DB + content DB collection results
      const allCollections = [...(c ?? []), ...(cc ?? [])];
      setCollectionResults(allCollections.slice(0, 5));
      setLibraryResults((l ?? []).slice(0, 5));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function handleSearchBarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!target.closest("input, button")) {
      void getCurrentWindow().startDragging();
    }
  }

  const hasQuery = query.trim().length > 0;

  const navItems = [
    { id: "home", icon: Home, label: t("nav.home"), to: "/" },
    { id: "hymnal", icon: Music, label: t("nav.hymnal"), to: "/hymnal" },
    { id: "collections", icon: FolderOpen, label: t("nav.collections"), to: "/collections" },
    { id: "bible", icon: BookOpen, label: t("nav.bible"), to: "/bible" },
    { id: "presentations", icon: Presentation, label: t("nav.presentations"), to: "/presentations" },
    { id: "services", icon: ListChecks, label: t("nav.services"), to: "/services" },
    {
      id: "playing-now",
      icon: MonitorPlay,
      label: t("nav.playingNow"),
      to: "/playing-now",
      keywords: ["playing now", "now playing"],
    },
    { id: "utilities", icon: Wrench, label: t("nav.utilities"), to: "/utilities" },
    { id: "settings", icon: Settings, label: t("nav.settings"), to: "/settings" },
    { id: "help", icon: CircleHelp, label: t("nav.help"), to: "/help" },
    { id: "timer", icon: Timer, label: t("utilities.nav.timer"), to: "/utilities/timer" },
    { id: "clock", icon: Clock3, label: t("utilities.nav.clock"), to: "/utilities/clock" },
    { id: "schedules", icon: CalendarDays, label: t("utilities.nav.schedules"), to: "/utilities/schedules" },
    { id: "lottery", icon: Shuffle, label: t("utilities.nav.lottery"), to: "/utilities/lottery" },
    { id: "text", icon: CaseSensitive, label: t("utilities.nav.text"), to: "/utilities/text" },
  ];

  const actionItems = [
    { id: "toggle-projector", icon: Monitor, label: t("commandPalette.actions.toggleProjector"), action: "toggle-projector" },
    { id: "toggle-return", icon: MonitorSmartphone, label: t("commandPalette.actions.toggleReturn"), action: "toggle-return" },
    { id: "toggle-black", icon: MonitorOff, label: t("commandPalette.actions.toggleBlack"), action: "toggle-black" },
    { id: "toggle-logo", icon: Image, label: t("commandPalette.actions.toggleLogo"), action: "toggle-logo" },
    { id: "clear-projection", icon: Eraser, label: t("commandPalette.actions.clearProjection"), action: "clear-projection" },
    { id: "open-shortcuts", icon: Keyboard, label: t("commandPalette.actions.openShortcuts"), action: "open-shortcuts" },
  ];

  const filteredNav = hasQuery
    ? navItems.filter((item) => {
        const searchTerms = [item.label, ...(item.keywords ?? [])];
        const normalizedQuery = query.toLowerCase();
        return searchTerms.some((term) => term.toLowerCase().includes(normalizedQuery));
      })
    : navItems;

  const filteredActions = hasQuery
    ? actionItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : actionItems;

  const parsedRef = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    const match = q.match(
      /^(\d?\s*[a-zA-Z\u00C0-\u017F]+(?:\s+[a-zA-Z\u00C0-\u017F]+)*)\s+(\d+)(?:[:\s]+(\d+))?$/,
    );
    if (!match) return null;
    const bookQuery = match[1].replace(/\s+/g, " ").trim();
    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? parseInt(match[3], 10) : undefined;
    const bookIndex = findBookIndexByQuery(bookQuery, language);
    if (bookIndex === null) return null;
    const bookName = getLocalizedBookNameByIndex(bookIndex, language);
    return { bookName, chapter, verse };
  }, [query, language]);

  const hasResults =
    filteredNav.length > 0 ||
    filteredActions.length > 0 ||
    hymns.length > 0 ||
    bibleResults.length > 0 ||
    collectionResults.length > 0 ||
    libraryResults.length > 0 ||
    parsedRef !== null;

  const groupHeadingClass =
    "*:[[cmdk-group-heading]]:px-4 *:[[cmdk-group-heading]]:pt-3 *:[[cmdk-group-heading]]:pb-1.5 *:[[cmdk-group-heading]]:text-xs *:[[cmdk-group-heading]]:font-medium *:[[cmdk-group-heading]]:text-muted-foreground *:[[cmdk-group-heading]]:select-none";
  const itemClass =
    "group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-foreground transition-colors hover:bg-surface-hover aria-selected:bg-accent aria-selected:text-accent-foreground";
  const itemIconClass =
    "h-4 w-4 shrink-0 text-muted-foreground group-aria-selected:text-accent-foreground";
  const metaTextClass = "text-[11px] text-muted-foreground";
  const projectButtonClass =
    "ml-1 hidden rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground group-hover:block group-aria-selected:block";

  return (
    // No h-screen — the panel sizes to its content.
    // The Tauri window is already centered on screen (Rust), so the panel
    // appears centered. Transparent space below = shows desktop through.
    <div className="flex h-screen w-screen justify-center bg-transparent p-0 text-foreground">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface/90 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Command shouldFilter={false} className="flex h-full flex-col">

          {/* ── Search bar ── */}
          <div
            onMouseDown={handleSearchBarMouseDown}
            className="sticky top-0 z-10 flex shrink-0 cursor-grab items-center gap-2.5 bg-surface/90 px-4 py-3.5 backdrop-blur-2xl active:cursor-grabbing"
          >
            {searching ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <Command.Input
              ref={inputRef}
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t("commandPalette.placeholder")}
              className="flex-1 cursor-text bg-transparent text-[17px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Divider — only shown when there are results */}
          {hasResults && <div className="mx-0 h-px shrink-0 bg-border" />}

          <Command.List className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
              {t("commandPalette.noResults")}
            </Command.Empty>

            {/* ── Bible reference (e.g. "Genesis 1:3" or "Gn 1 3") ── */}
            {parsedRef && (
              <Command.Group
                heading={t("commandPalette.bibleReference", "Referência")}
                className={groupHeadingClass}
              >
                <Command.Item
                  value={`ref-${parsedRef.bookName}-${parsedRef.chapter}-${parsedRef.verse ?? 1}`}
                  onSelect={() =>
                    void spotlightSelect(
                      "navigate",
                      `/bible?book=${encodeURIComponent(parsedRef.bookName)}&chapter=${parsedRef.chapter}&verse=${parsedRef.verse ?? 1}`,
                    )
                  }
                  className={itemClass}
                >
                  <BookOpen className={itemIconClass} />
                  <span>
                    {parsedRef.bookName} {parsedRef.chapter}
                    {parsedRef.verse ? `:${parsedRef.verse}` : ""}
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            {/* ── Navigation ── */}
            {filteredNav.length > 0 && (
              <Command.Group
                heading={t("commandPalette.navigation")}
                className={groupHeadingClass}
              >
                {filteredNav.map(({ id, icon: Icon, label, to }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("navigate", to)}
                    className={itemClass}
                  >
                    <Icon className={itemIconClass} />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Actions ── */}
            {filteredActions.length > 0 && (
              <Command.Group
                heading={t("commandPalette.globalActions")}
                className={groupHeadingClass}
              >
                {filteredActions.map(({ id, icon: Icon, label, action }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("action", action)}
                    className={itemClass}
                  >
                    <Icon className={itemIconClass} />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Hymns ── */}
            {hymns.length > 0 && (
              <Command.Group
                heading={t("commandPalette.hymns")}
                className={groupHeadingClass}
              >
                {hymns.map((hymn) => (
                  <Command.Item
                    key={hymn.id}
                    value={`hymn-${hymn.id}`}
                    onSelect={() => void spotlightSelect("navigate", `/hymnal/${hymn.id}`)}
                    className={itemClass}
                  >
                    <Music className={itemIconClass} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`${metaTextClass} flex-1 truncate`}>
                          {hymn.album || t("hymnal.albumUnknown", "Hinário")}
                        </span>
                        {hymn.number != null && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">#{hymn.number}</span>
                        )}
                      </div>
                      <span className="truncate">{hymn.title}</span>
                    </div>
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectHymnFirstStanza(hymn);
                      }}
                      className={projectButtonClass}
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Bible ── */}
            {bibleResults.length > 0 && (
              <Command.Group
                heading={t("commandPalette.bible")}
                className={groupHeadingClass}
              >
                {bibleResults.map((result) => (
                  <Command.Item
                    key={`${result.verse.versionId}-${result.verse.book}-${result.verse.chapter}-${result.verse.verse}`}
                    value={`bible-${result.verse.versionId}-${result.verse.book}-${result.verse.chapter}-${result.verse.verse}`}
                    onSelect={() =>
                      void spotlightSelect(
                        "navigate",
                        `/bible?book=${result.verse.book}&chapter=${result.verse.chapter}&verse=${result.verse.verse}&version=${result.verse.versionId}`,
                      )
                    }
                    className={itemClass}
                  >
                    <BookOpen className={itemIconClass} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={metaTextClass}>
                        {result.bookName} {result.verse.chapter}:{result.verse.verse}
                        {result.versionAbbreviation ? (
                          <span className="ml-1 font-normal opacity-60">· {result.versionAbbreviation}</span>
                        ) : null}
                      </span>
                      <span className="truncate">
                        <HighlightedSnippet html={result.snippet} />
                      </span>
                    </div>
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectBibleVerse(result);
                      }}
                      className={projectButtonClass}
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Media Library ── */}
            {libraryResults.length > 0 && (
              <Command.Group
                heading={t("commandPalette.mediaLibrary", "Media Library")}
                className={groupHeadingClass}
              >
                {libraryResults.map((item) => (
                  <Command.Item
                    key={`library-item-${item.id}`}
                    value={`library-item-${item.id}`}
                    onSelect={() =>
                      void spotlightSelect(
                        "navigate",
                        `/utilities/media-library?categoryId=${item.categoryId}&itemId=${item.id}`,
                      )
                    }
                    className={itemClass}
                  >
                    <Library className={itemIconClass} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{item.name}</span>
                    </div>
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void spotlightSelect(
                          "navigate",
                          `/utilities/media-library?categoryId=${item.categoryId}&itemId=${item.id}`,
                        );
                      }}
                      className={projectButtonClass}
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Collections (Albums/Folders) ── */}
            {collectionResults.filter(col => col.kind === "collection").length > 0 && (
              <Command.Group
                heading={t("commandPalette.collections")}
                className={groupHeadingClass}
              >
                {collectionResults
                  .filter(col => col.kind === "collection")
                  .map((col) => (
                    <Command.Item
                      key={`collection-${col.collectionId}`}
                      value={`collection-${col.collectionId}`}
                      onSelect={() =>
                        void spotlightSelect("navigate", `/collections/${col.collectionId}`)
                      }
                      className={itemClass}
                    >
                      <CoverImage
                        path={col.coverPath}
                        title={col.title}
                        className="h-4 w-4 rounded shadow-xs"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{col.title}</span>
                      </div>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}

            {/* ── Collection Musics (Individual songs) ── */}
            {collectionResults.filter(col => col.kind !== "collection").length > 0 && (
              <Command.Group
                heading={t("commandPalette.collectionSongs")}
                className={groupHeadingClass}
              >
                {collectionResults
                  .filter(col => col.kind !== "collection")
                  .map((col) => (
                    <Command.Item
                      key={`${col.kind}-${col.collectionId}-${col.songId}`}
                      value={`song-${col.collectionId}-${col.songId}`}
                      onSelect={() => {
                        if (col.kind === "song" && col.songId != null) {
                          return void spotlightSelect(
                            "navigate",
                            `/collections/${col.collectionId}#song-${col.songId}`,
                          );
                        }

                        if (col.songId != null) {
                          return void spotlightSelect("navigate", `/hymnal/${col.songId}`);
                        }
                      }}
                      className={itemClass}
                    >
                      <CoverImage
                        path={col.coverPath}
                        title={col.title}
                        className="h-4 w-4 rounded shadow-xs"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className={metaTextClass}>{col.collectionName}</span>
                        <span className="truncate">{col.title}</span>
                      </div>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}

            {/* Bottom padding inside list */}
            <div className="h-1.5" />
          </Command.List>

          {/* ── Footer ── */}
          <div className="flex shrink-0 items-center gap-4 border-t border-border bg-surface/70 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>{t("spotlight.hintNavigate")}</span>
            <span>{t("spotlight.hintOpen")}</span>
            <span>{t("spotlight.hintClose")}</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
