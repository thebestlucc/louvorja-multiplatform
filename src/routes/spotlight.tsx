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
  X,
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

export { SpotlightWindow };

// Parse raw lyrics into stanzas (same logic as in the main app)
function parseFirstStanza(lyrics: string | null): string {
  if (!lyrics) return "";
  const stanzas = lyrics
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return stanzas[0] ?? "";
}

async function projectBibleVerse(result: BibleSearchResult) {
  const { verse, bookName } = result;
  await setCurrentSlide({
    slide_type: "bible",
    text: verse.text,
    title: `${bookName} ${verse.chapter}:${verse.verse}`,
  });
}

async function projectHymnFirstStanza(hymn: Hymn) {
  const fullHymn = await getHymn(hymn.id);
  const stanzaText = parseFirstStanza(fullHymn.lyrics);
  await setCurrentSlide({
    slide_type: "lyrics",
    text: stanzaText || hymn.title,
    title: hymn.title,
  });
}

// Shared group heading classes targeting cmdk's internal heading element
const groupHeadingCls =
  "mb-1 [&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:pt-3 [&>[cmdk-group-heading]]:pb-1 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-widest [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:text-white/40 [&>[cmdk-group-heading]]:select-none";

// Shared result item classes
const itemCls =
  "mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/90 hover:bg-white/10 aria-selected:bg-white/15 transition-colors";

// Icon badge wrapper
function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
      {children}
    </span>
  );
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

  // Reset and refocus when the spotlight window regains OS focus (re-shown by Alt+K)
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    win
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
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

  const hasResults =
    filteredNav.length > 0 ||
    filteredActions.length > 0 ||
    hymns.length > 0 ||
    bibleResults.length > 0 ||
    collectionResults.length > 0;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/55 shadow-2xl backdrop-blur-3xl">
        <Command shouldFilter={false} loop>
          {/* Search bar */}
          <div className="flex items-center gap-3 px-5 py-4">
            {searching ? (
              <Loader2 className="h-6 w-6 shrink-0 animate-spin text-white/50" />
            ) : (
              <svg
                className="h-6 w-6 shrink-0 text-white/50"
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
              className="flex-1 bg-transparent text-[19px] text-white outline-none placeholder:text-white/35"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-white/40 transition-colors hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Divider only when there are results */}
          {hasResults && <div className="mx-4 h-px bg-white/10" />}

          <Command.List className="max-h-[380px] overflow-y-auto py-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
            <Command.Empty className="py-10 text-center text-sm text-white/40">
              {t("commandPalette.noResults")}
            </Command.Empty>

            {/* Navigation */}
            {filteredNav.length > 0 && (
              <Command.Group
                heading={t("commandPalette.navigation")}
                className={groupHeadingCls}
              >
                {filteredNav.map(({ id, icon: Icon, label, to }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("navigate", to)}
                    className={itemCls}
                  >
                    <IconBadge>
                      <Icon className="h-4 w-4 text-white/70" />
                    </IconBadge>
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            {filteredActions.length > 0 && (
              <Command.Group
                heading={t("commandPalette.globalActions")}
                className={groupHeadingCls}
              >
                {filteredActions.map(({ id, icon: Icon, label, action }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("action", action)}
                    className={itemCls}
                  >
                    <IconBadge>
                      <Icon className="h-4 w-4 text-white/70" />
                    </IconBadge>
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Hymn search results */}
            {hymns.length > 0 && (
              <Command.Group
                heading={t("commandPalette.hymns")}
                className={groupHeadingCls}
              >
                {hymns.map((hymn) => (
                  <Command.Item
                    key={hymn.id}
                    value={`hymn-${hymn.id}`}
                    onSelect={() =>
                      void spotlightSelect("navigate", `/hymnal/${hymn.id}`)
                    }
                    className={`group ${itemCls}`}
                  >
                    <IconBadge>
                      <Music className="h-4 w-4 text-white/70" />
                    </IconBadge>
                    <span className="flex-1 truncate">{hymn.title}</span>
                    {hymn.number && (
                      <span className="text-xs text-white/35">
                        #{hymn.number}
                      </span>
                    )}
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectHymnFirstStanza(hymn);
                      }}
                      className="ml-1 hidden rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/20 hover:text-white group-hover:flex group-aria-selected:flex"
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
                className={groupHeadingCls}
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
                    className={`group ${itemCls}`}
                  >
                    <IconBadge>
                      <BookOpen className="h-4 w-4 text-white/70" />
                    </IconBadge>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[11px] text-white/40">
                        {result.bookName} {result.verse.chapter}:
                        {result.verse.verse}
                      </span>
                      <span className="truncate text-[13px]">
                        {result.snippet}
                      </span>
                    </div>
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectBibleVerse(result);
                      }}
                      className="ml-1 hidden rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/20 hover:text-white group-hover:flex group-aria-selected:flex"
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Collection search results */}
            {collectionResults.length > 0 && (
              <Command.Group
                heading={t("commandPalette.navigation")}
                className={groupHeadingCls}
              >
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
                    className={itemCls}
                  >
                    <IconBadge>
                      <FolderOpen className="h-4 w-4 text-white/70" />
                    </IconBadge>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[11px] text-white/40">
                        {col.collection_name}
                      </span>
                      <span className="truncate text-[13px]">{col.title}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center gap-4 border-t border-white/10 px-5 py-2.5 text-[11px] text-white/30">
            <span>
              <kbd className="font-sans">↩</kbd> to open
            </span>
            <span>
              <kbd className="font-sans">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-sans">⎋</kbd> to close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
