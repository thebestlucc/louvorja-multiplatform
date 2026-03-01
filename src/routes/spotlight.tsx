import { createFileRoute } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useEffect, useRef, useState } from "react";
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
  CircleHelp,
  Monitor,
  MonitorSmartphone,
  MonitorOff,
  Image,
  Eraser,
  Keyboard,
  Loader2,
  MonitorPlay,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  spotlightSelect,
  spotlightHide,
  searchHymns,
  searchBible,
  searchCollections,
  getHymn,
  setCurrentSlide,
} from "../lib/tauri";
import type { Hymn } from "../types/hymn";
import type { BibleSearchResult } from "../types/bible";
import type { CollectionSearchResult } from "../types/collection";

export const Route = createFileRoute("/spotlight")({
  component: SpotlightWindow,
});

// Parse raw lyrics into stanzas (same logic as in the main app)
function parseFirstStanza(lyrics: string | null): string {
  if (!lyrics) return "";
  // Split on blank lines, take first non-empty block
  const stanzas = lyrics
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return stanzas[0] ?? "";
}

// Project a bible verse directly from the spotlight window
async function projectBibleVerse(result: BibleSearchResult) {
  const { verse, bookName } = result;
  await setCurrentSlide({
    slide_type: "bible",
    text: verse.text,
    title: `${bookName} ${verse.chapter}:${verse.verse}`,
  });
}

// Project the first stanza of a hymn directly from the spotlight window
async function projectHymnFirstStanza(hymn: Hymn) {
  const fullHymn = await getHymn(hymn.id);
  const stanzaText = parseFirstStanza(fullHymn.lyrics);
  await setCurrentSlide({
    slide_type: "lyrics",
    text: stanzaText || hymn.title,
    title: hymn.title,
  });
}

function SpotlightWindow() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [bibleResults, setBibleResults] = useState<BibleSearchResult[]>([]);
  const [collectionResults, setCollectionResults] = useState<
    CollectionSearchResult[]
  >([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide on blur — when the spotlight window loses OS focus
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    win
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          void spotlightHide();
        } else {
          // Reset state when window regains focus (re-shown by shortcut)
          setQuery("");
          setHymns([]);
          setBibleResults([]);
          setCollectionResults([]);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, []);

  // Escape key hides the window
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

  // Debounced search
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
      try {
        const [h, b, c] = await Promise.all([
          searchHymns(query),
          query.trim().length >= 2
            ? searchBible(query, null)
            : Promise.resolve([]),
          query.trim().length >= 2
            ? searchCollections(query)
            : Promise.resolve([]),
        ]);
        setHymns(h.slice(0, 5));
        setBibleResults(b.slice(0, 5));
        setCollectionResults(c.slice(0, 5));
      } catch {
        // silently fail
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasQuery = query.trim().length > 0;

  const navItems = [
    { id: "home", icon: Home, label: t("nav.home"), to: "/" },
    { id: "hymnal", icon: Music, label: t("nav.hymnal"), to: "/hymnal" },
    {
      id: "collections",
      icon: FolderOpen,
      label: t("nav.collections"),
      to: "/collections",
    },
    { id: "bible", icon: BookOpen, label: t("nav.bible"), to: "/bible" },
    {
      id: "presentations",
      icon: Presentation,
      label: t("nav.presentations"),
      to: "/presentations",
    },
    {
      id: "services",
      icon: ListChecks,
      label: t("nav.services"),
      to: "/services",
    },
    {
      id: "utilities",
      icon: Wrench,
      label: t("nav.utilities"),
      to: "/utilities",
    },
    {
      id: "settings",
      icon: Settings,
      label: t("nav.settings"),
      to: "/settings",
    },
    { id: "help", icon: CircleHelp, label: t("nav.help"), to: "/help" },
    {
      id: "timer",
      icon: Timer,
      label: t("utilities.nav.timer"),
      to: "/utilities/timer",
    },
    {
      id: "clock",
      icon: Clock3,
      label: t("utilities.nav.clock"),
      to: "/utilities/clock",
    },
    {
      id: "lottery",
      icon: Shuffle,
      label: t("utilities.nav.lottery"),
      to: "/utilities/lottery",
    },
    {
      id: "text",
      icon: CaseSensitive,
      label: t("utilities.nav.text"),
      to: "/utilities/text",
    },
  ];

  const actionItems = [
    {
      id: "toggle-projector",
      icon: Monitor,
      label: t("commandPalette.actions.toggleProjector"),
      action: "toggle-projector",
    },
    {
      id: "toggle-return",
      icon: MonitorSmartphone,
      label: t("commandPalette.actions.toggleReturn"),
      action: "toggle-return",
    },
    {
      id: "toggle-black",
      icon: MonitorOff,
      label: t("commandPalette.actions.toggleBlack"),
      action: "toggle-black",
    },
    {
      id: "toggle-logo",
      icon: Image,
      label: t("commandPalette.actions.toggleLogo"),
      action: "toggle-logo",
    },
    {
      id: "clear-projection",
      icon: Eraser,
      label: t("commandPalette.actions.clearProjection"),
      action: "clear-projection",
    },
    {
      id: "open-shortcuts",
      icon: Keyboard,
      label: t("commandPalette.actions.openShortcuts"),
      action: "open-shortcuts",
    },
  ];

  const filteredNav = hasQuery
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      )
    : navItems;

  const filteredActions = hasQuery
    ? actionItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      )
    : actionItems;

  return (
    <div className="flex h-screen w-screen items-start justify-center bg-transparent">
      <div className="w-full rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        <Command shouldFilter={false} loop>
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            {searching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <svg
                className="h-4 w-4 shrink-0 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
            <Command.Input
              ref={inputRef}
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t("commandPalette.placeholder")}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-[375px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t("commandPalette.noResults")}
            </Command.Empty>

            {/* Navigation */}
            {filteredNav.length > 0 && (
              <Command.Group
                heading={t("commandPalette.navigation")}
                className="mb-2"
              >
                {filteredNav.map(({ id, icon: Icon, label, to }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("navigate", to)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            {filteredActions.length > 0 && (
              <Command.Group
                heading={t("commandPalette.globalActions")}
                className="mb-2"
              >
                {filteredActions.map(({ id, icon: Icon, label, action }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("action", action)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Hymn search results */}
            {hymns.length > 0 && (
              <Command.Group
                heading={t("commandPalette.hymns")}
                className="mb-2"
              >
                {hymns.map((hymn) => (
                  <Command.Item
                    key={hymn.id}
                    value={`hymn-${hymn.id}`}
                    onSelect={() =>
                      void spotlightSelect("navigate", `/hymnal/${hymn.id}`)
                    }
                    className="group flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{hymn.title}</span>
                    {hymn.number && (
                      <span className="text-xs text-muted-foreground">
                        #{hymn.number}
                      </span>
                    )}
                    {/* Inline project button */}
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectHymnFirstStanza(hymn);
                      }}
                      className="ml-1 hidden rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary group-hover:flex group-aria-selected:flex"
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Bible search results */}
            {bibleResults.length > 0 && (
              <Command.Group
                heading={t("commandPalette.bible")}
                className="mb-2"
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
                    className="group flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs text-muted-foreground">
                        {result.bookName} {result.verse.chapter}:
                        {result.verse.verse}
                      </span>
                      <span className="truncate">{result.snippet}</span>
                    </div>
                    {/* Inline project button */}
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectBibleVerse(result);
                      }}
                      className="ml-1 hidden rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary group-hover:flex group-aria-selected:flex"
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Collection search results */}
            {collectionResults.length > 0 && (
              <Command.Group heading={t("commandPalette.navigation")}>
                {collectionResults.map((col) => (
                  <Command.Item
                    key={`${col.kind}-${col.collection_id}-${col.song_id ?? ""}`}
                    value={`collection-${col.collection_id}-${col.song_id ?? ""}`}
                    onSelect={() =>
                      void spotlightSelect(
                        "navigate",
                        col.song_id
                          ? `/collections/${col.collection_id}/songs/${col.song_id}`
                          : `/collections/${col.collection_id}`,
                      )
                    }
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-background aria-selected:bg-background"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs text-muted-foreground">
                        {col.collection_name}
                      </span>
                      <span className="truncate">{col.title}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
