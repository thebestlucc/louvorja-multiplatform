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
  Search,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
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

  // Make the webview fully transparent so only the panel renders visually.
  // Without this, the html/body default background fills the entire window
  // and shows below/around the frosted glass panel.
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.overflow = "hidden";
  }, []);

  // Reset state and focus input when spotlight becomes visible.
  // Driven by a Rust "spotlight-shown" event for reliable timing.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("spotlight-shown", () => {
      setQuery("");
      setHymns([]);
      setBibleResults([]);
      setCollectionResults([]);
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
      try {
        const [h, b, c] = await Promise.all([
          searchHymns(query),
          query.trim().length >= 2 ? searchBible(query, null) : Promise.resolve([]),
          query.trim().length >= 2 ? searchCollections(query) : Promise.resolve([]),
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

  // Close when the spotlight window loses focus (e.g. user clicks main app).
  // Debounced 150ms so a drag that briefly blurs the window doesn't close it.
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    win.onFocusChanged(({ payload: focused }) => {
      clearTimeout(hideTimer);
      if (!focused) {
        hideTimer = setTimeout(() => void spotlightHide(), 150);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); clearTimeout(hideTimer); };
  }, []);

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
    { id: "utilities", icon: Wrench, label: t("nav.utilities"), to: "/utilities" },
    { id: "settings", icon: Settings, label: t("nav.settings"), to: "/settings" },
    { id: "help", icon: CircleHelp, label: t("nav.help"), to: "/help" },
    { id: "timer", icon: Timer, label: t("utilities.nav.timer"), to: "/utilities/timer" },
    { id: "clock", icon: Clock3, label: t("utilities.nav.clock"), to: "/utilities/clock" },
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
    ? navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  const filteredActions = hasQuery
    ? actionItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : actionItems;

  const hasResults =
    filteredNav.length > 0 ||
    filteredActions.length > 0 ||
    hymns.length > 0 ||
    bibleResults.length > 0 ||
    collectionResults.length > 0;

  return (
    // No h-screen — the panel sizes to its content.
    // The Tauri window is already centered on screen (Rust), so the panel
    // appears centered. Transparent space below = shows desktop through.
    <div className="flex w-screen justify-center bg-transparent p-0">
      <div className="w-full overflow-hidden rounded-2xl border border-black/8 bg-white/85 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Command shouldFilter={false}>

          {/* ── Search bar ── */}
          <div
            onMouseDown={handleSearchBarMouseDown}
            className="flex cursor-grab items-center gap-2.5 px-4 py-3.5 active:cursor-grabbing"
          >
            {searching ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-gray-400" />
            )}
            <Command.Input
              ref={inputRef}
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t("commandPalette.placeholder")}
              className="flex-1 cursor-text bg-transparent text-[17px] text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Divider — only shown when there are results */}
          {hasResults && <div className="h-px bg-black/8 mx-0" />}

          <Command.List className="max-h-[420px] overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
            <Command.Empty className="py-10 text-center text-sm text-gray-400">
              {t("commandPalette.noResults")}
            </Command.Empty>

            {/* ── Navigation ── */}
            {filteredNav.length > 0 && (
              <Command.Group
                heading={t("commandPalette.navigation")}
                className="*:[[cmdk-group-heading]]:px-4 *:[[cmdk-group-heading]]:pt-3 *:[[cmdk-group-heading]]:pb-1.5 *:[[cmdk-group-heading]]:text-xs *:[[cmdk-group-heading]]:font-medium *:[[cmdk-group-heading]]:text-gray-400 *:[[cmdk-group-heading]]:select-none"
              >
                {filteredNav.map(({ id, icon: Icon, label, to }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("navigate", to)}
                    className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Actions ── */}
            {filteredActions.length > 0 && (
              <Command.Group
                heading={t("commandPalette.globalActions")}
                className="*:[[cmdk-group-heading]]:px-4 *:[[cmdk-group-heading]]:pt-3 *:[[cmdk-group-heading]]:pb-1.5 *:[[cmdk-group-heading]]:text-xs *:[[cmdk-group-heading]]:font-medium *:[[cmdk-group-heading]]:text-gray-400 *:[[cmdk-group-heading]]:select-none"
              >
                {filteredActions.map(({ id, icon: Icon, label, action }) => (
                  <Command.Item
                    key={id}
                    value={id}
                    onSelect={() => void spotlightSelect("action", action)}
                    className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Hymns ── */}
            {hymns.length > 0 && (
              <Command.Group
                heading={t("commandPalette.hymns")}
                className="*:[[cmdk-group-heading]]:px-4 *:[[cmdk-group-heading]]:pt-3 *:[[cmdk-group-heading]]:pb-1.5 *:[[cmdk-group-heading]]:text-xs *:[[cmdk-group-heading]]:font-medium *:[[cmdk-group-heading]]:text-gray-400 *:[[cmdk-group-heading]]:select-none"
              >
                {hymns.map((hymn) => (
                  <Command.Item
                    key={hymn.id}
                    value={`hymn-${hymn.id}`}
                    onSelect={() => void spotlightSelect("navigate", `/hymnal/${hymn.id}`)}
                    className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
                  >
                    <Music className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
                    <span className="flex-1 truncate">{hymn.title}</span>
                    {hymn.number && (
                      <span className="text-xs text-gray-400">#{hymn.number}</span>
                    )}
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectHymnFirstStanza(hymn);
                      }}
                      className="ml-1 hidden rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:block group-aria-selected:block"
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
                className="*:[[cmdk-group-heading]]:px-4 *:[[cmdk-group-heading]]:pt-3 *:[[cmdk-group-heading]]:pb-1.5 *:[[cmdk-group-heading]]:text-xs *:[[cmdk-group-heading]]:font-medium *:[[cmdk-group-heading]]:text-gray-400 *:[[cmdk-group-heading]]:select-none"
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
                    className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[11px] text-gray-400">
                        {result.bookName} {result.verse.chapter}:{result.verse.verse}
                      </span>
                      <span className="truncate">{result.snippet}</span>
                    </div>
                    <button
                      title={t("spotlight.projectToScreen")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void projectBibleVerse(result);
                      }}
                      className="ml-1 hidden rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:block group-aria-selected:block"
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ── Collections ── */}
            {collectionResults.length > 0 && (
              <Command.Group
                heading={t("commandPalette.collections")}
                className="*:[[cmdk-group-heading]]:px-4 *:[[cmdk-group-heading]]:pt-3 *:[[cmdk-group-heading]]:pb-1.5 *:[[cmdk-group-heading]]:text-xs *:[[cmdk-group-heading]]:font-medium *:[[cmdk-group-heading]]:text-gray-400 *:[[cmdk-group-heading]]:select-none"
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
                    className="group mx-1.5 my-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] text-gray-800 hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:text-blue-600"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-gray-400 group-aria-selected:text-blue-500" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[11px] text-gray-400">{col.collection_name}</span>
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
          <div className="flex items-center gap-4 border-t border-black/8 px-4 py-2.5 text-[11px] text-gray-400">
            <span>{t("spotlight.hintNavigate")}</span>
            <span>{t("spotlight.hintOpen")}</span>
            <span>{t("spotlight.hintClose")}</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
