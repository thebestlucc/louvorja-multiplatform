import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Home,
  Music,
  BookOpen,
  Presentation,
  ListChecks,
  Wrench,
  Settings,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { searchHymns, searchBible } from "../../lib/tauri";
import type { Hymn } from "../../types/hymn";
import type { BibleSearchResult } from "../../types/bible";

const routes = [
  { path: "/", icon: Home, key: "nav.home" },
  { path: "/hymnal", icon: Music, key: "nav.hymnal" },
  { path: "/bible", icon: BookOpen, key: "nav.bible" },
  { path: "/presentations", icon: Presentation, key: "nav.presentations" },
  { path: "/services", icon: ListChecks, key: "nav.services" },
  { path: "/utilities", icon: Wrench, key: "nav.utilities" },
  { path: "/settings", icon: Settings, key: "nav.settings" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [bibleResults, setBibleResults] = useState<BibleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [h, b] = await Promise.all([
          searchHymns(query),
          query.trim().length >= 2
            ? searchBible(query, null)
            : Promise.resolve([]),
        ]);
        setHymns(h.slice(0, 5));
        setBibleResults(b.slice(0, 5));
      } catch {
        // silently fail — transient UI search
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHymns([]);
      setBibleResults([]);
      setSearching(false);
    }
  }, [open]);

  const hasQuery = query.trim().length > 0;
  const hasResults = hymns.length > 0 || bibleResults.length > 0;

  const filteredRoutes = routes.filter((route) => {
    if (!hasQuery) return true;
    return t(route.key).toLowerCase().includes(query.toLowerCase());
  });

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      shouldFilter={!hasQuery}
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
        {filteredRoutes.length > 0 && (
          <Command.Group
            heading={t("commandPalette.navigation")}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {filteredRoutes.map((route) => (
              <Command.Item
                key={route.path}
                value={t(route.key)}
                onSelect={() => {
                  navigate({ to: route.path });
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
              >
                <route.icon className="h-4 w-4 text-muted-foreground" />
                {t(route.key)}
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
                <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {hymn.number != null ? `#${hymn.number} - ` : ""}
                  {hymn.title}
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
                  </span>
                  {" - "}
                  <span className="text-muted-foreground">{result.snippet}</span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
