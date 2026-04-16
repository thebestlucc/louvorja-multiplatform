import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, ChevronRight, ChevronLeft, Monitor, ListPlus } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";
import { HighlightedSnippet } from "@/components/ui/highlighted-snippet";

type SearchTab = "hymns" | "bible" | "services";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Raw snippet HTML (contains <mark> tags). When set, rendered via HighlightedSnippet. */
  snippetHtml?: string;
  /** Only set for bible results — forwarded to desktop for projection without a DB round-trip. */
  bibleRef?: {
    book: string;
    chapter: number;
    verse: number;
    text: string;
    bookName: string;
  };
}

// Raw shapes returned by the Rust dispatcher for each op:
interface RawHymn {
  id: number;
  title: string;
  author?: string | null;
  album?: string | null;
  number?: number | null;
}

interface RawBibleSearchResult {
  verse: { id: number; book: string; chapter: number; verse: number; text: string };
  bookName: string;
  snippet: string;
  versionAbbreviation: string;
}

interface RawLiturgy {
  id: number;
  title: string;
  date?: string | null;
}

// Bible browse raw shapes — match Rust BibleVersion / Book / Verse (camelCase via serde)
interface RawBibleVersion {
  id: number;
  abbreviation: string;
  name: string;
  language: string;
  isBuiltin: boolean;
}

// Rust Book has only name + chapterCount (no id)
interface RawBibleBook {
  name: string;
  chapterCount: number;
}

// Chapters are returned as a plain number array
type RawBibleChapterList = number[];

interface RawBibleVerse {
  id: number;
  versionId: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

/** Map each tab to the WS op sent and the response op listened on. */
const TAB_OP: Record<SearchTab, string> = {
  hymns: "hymn.search",
  bible: "bible.search",
  services: "service.list_today",
};

const DEBOUNCE_MS = 120;
const MAX_RECENT = 10;
const RECENT_KEY_PREFIX = "remote-search-recent-";

function getRecentSearches(tab: SearchTab): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY_PREFIX + tab);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(tab: SearchTab, query: string): void {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;
    const existing = getRecentSearches(tab).filter((q) => q !== trimmed);
    const updated = [trimmed, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY_PREFIX + tab, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ─── Action confirmation ──────────────────────────────────────────────────────
// Tapping a result stages a PendingAction; the user confirms "project now" or
// "add to queue" in a bottom sheet before anything is sent to the desktop.
interface PendingAction {
  kind: "hymn" | "bible" | "service";
  title: string;
  subtitle?: string;
  // Payload fields passed to the desktop:
  hymnId?: number;     // kind = "hymn"
  serviceId?: number;  // kind = "service"
  bibleRef?: {         // kind = "bible"
    id: number;
    book: string;
    chapter: number;
    verse: number;
    text: string;
    bookName: string;
  };
}

// ─── Bible browse state machine ──────────────────────────────────────────────
// Steps: version → book → chapter → verses (project on tap)
type BibleBrowseStep = "version" | "book" | "chapter" | "verse";

interface BibleBrowseState {
  step: BibleBrowseStep;
  versions: RawBibleVersion[];
  selectedVersion: RawBibleVersion | null;
  books: RawBibleBook[];
  selectedBook: RawBibleBook | null;
  chapters: number[];
  selectedChapter: number | null;
  verses: RawBibleVerse[];
  loading: boolean;
}

const INITIAL_BIBLE_STATE: BibleBrowseState = {
  step: "version",
  versions: [],
  selectedVersion: null,
  books: [],
  selectedBook: null,
  chapters: [],
  selectedChapter: null,
  verses: [],
  loading: false,
};

export default function SearchRoute() {
  const { t } = useTranslation();
  const ws = useConnectionStore((s) => s.ws);
  const wsState = useConnectionStore((s) => s.wsState);

  const [tab, setTab] = useState<SearchTab>("hymns");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Confirmation sheet — avoids mis-click projection. Tapping any result stages an
  // action here; the sheet then presents "Project now" / "Add to queue" / "Cancel".
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Bible browse state
  const [bibleState, setBibleState] = useState<BibleBrowseState>(INITIAL_BIBLE_STATE);
  // Ref mirrors bibleState so async callbacks always read latest selectedVersion/selectedBook
  // without needing them in useCallback deps (which caused stale-closure edge cases).
  const bibleStateRef = useRef(bibleState);
  bibleStateRef.current = bibleState;
  // Tracks whether we've already fetched versions for the CURRENT bible tab entry.
  // Reset on every tab change so re-entering the bible tab triggers a fresh fetch,
  // but wsState flaps (mid-browse reconnects) do NOT re-fire list_versions.
  const bibleVersionsFetchedRef = useRef(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);
    };
  }, []);

  // Subscribe to per-tab response ops.
  // The server returns results as a response envelope with the same op name
  // that was sent (e.g. "hymn.search"), not as a separate "search.results" event.
  useEffect(() => {
    if (!ws || typeof ws.on !== "function") return;

    const hymnUnsub = ws.on("hymn.search", (payload) => {
      if (tab !== "hymns") return;
      const items = Array.isArray(payload) ? (payload as RawHymn[]) : [];
      setResults(
        items.map((h) => ({
          id: String(h.id),
          title: h.title,
          subtitle: h.author ?? h.album ?? undefined,
        })),
      );
    });

    const bibleUnsub = ws.on("bible.search", (payload) => {
      if (tab !== "bible") return;
      const items = Array.isArray(payload) ? (payload as RawBibleSearchResult[]) : [];
      setResults(
        items.map((r) => ({
          id: String(r.verse.id),
          title: `${r.bookName} ${r.verse.chapter}:${r.verse.verse}`,
          snippetHtml: r.snippet,
          bibleRef: {
            book: r.verse.book,
            chapter: r.verse.chapter,
            verse: r.verse.verse,
            text: r.verse.text,
            bookName: r.bookName,
          },
        })),
      );
    });

    const serviceUnsub = ws.on("service.list_today", (payload) => {
      if (tab !== "services") return;
      const items = Array.isArray(payload) ? (payload as RawLiturgy[]) : [];
      setResults(
        items.map((s) => ({
          id: String(s.id),
          title: s.title,
          subtitle: s.date ?? undefined,
        })),
      );
    });

    // Bible browse handlers — op name matches the request op (WS echoes request op in response)
    const bibleVersionsUnsub = ws.on("bible.list_versions", (payload) => {
      if (tab !== "bible") return;
      const versions = Array.isArray(payload) ? (payload as RawBibleVersion[]) : [];
      setBibleState((prev) => ({ ...prev, versions, loading: false }));
    });

    // Response handlers populate the list for the CURRENT step but never mutate `step`
    // itself — step advancement is driven client-side by user clicks (optimistic).
    const bibleBooksUnsub = ws.on("bible.list_books", (payload) => {
      if (tab !== "bible") return;
      const books = Array.isArray(payload) ? (payload as RawBibleBook[]) : [];
      setBibleState((prev) => ({ ...prev, books, loading: false }));
    });

    const bibleChaptersUnsub = ws.on("bible.list_chapters", (payload) => {
      if (tab !== "bible") return;
      const chapters = Array.isArray(payload) ? (payload as RawBibleChapterList) : [];
      setBibleState((prev) => ({ ...prev, chapters, loading: false }));
    });

    const bibleVersesUnsub = ws.on("bible.list_verses", (payload) => {
      if (tab !== "bible") return;
      const verses = Array.isArray(payload) ? (payload as RawBibleVerse[]) : [];
      setBibleState((prev) => ({ ...prev, verses, loading: false }));
    });

    return () => {
      hymnUnsub();
      bibleUnsub();
      serviceUnsub();
      bibleVersionsUnsub();
      bibleBooksUnsub();
      bibleChaptersUnsub();
      bibleVersesUnsub();
    };
  }, [ws, tab]);

  // On tab change ONLY: reset query, recent searches, and bible browse state.
  // IMPORTANT: do NOT depend on ws/wsState here — a transient reconnect would otherwise
  // reset a mid-flow bible browse back to the version picker.
  useEffect(() => {
    setQuery("");
    setResults([]);
    setRecentSearches(getRecentSearches(tab));
    if (tab === "bible") {
      setBibleState({ ...INITIAL_BIBLE_STATE, loading: true });
      bibleVersionsFetchedRef.current = false; // arm fetch for this tab entry
    }
  }, [tab]);

  // Fetch default list for the active tab when connected.
  // Re-runs on wsState transitions so a dropped send (during CONNECTING) retries on reconnect.
  // The `bibleVersionsFetchedRef` guard ensures we fetch versions exactly ONCE per bible
  // tab entry — preventing wsState flaps from wiping a mid-browse state.
  useEffect(() => {
    if (!ws || wsState !== "connected") return;
    if (tab === "hymns") {
      ws.send("hymn.search", { query: "" });
    } else if (tab === "services") {
      ws.send("service.list_today", {});
    } else if (tab === "bible" && !bibleVersionsFetchedRef.current) {
      bibleVersionsFetchedRef.current = true;
      ws.send("bible.list_versions", {});
    }
  }, [tab, ws, wsState]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        // Re-show default list when query is cleared
        const freshWs = useConnectionStore.getState().ws;
        if (tab === "hymns") {
          freshWs?.send("hymn.search", { query: "" });
        } else if (tab === "services") {
          freshWs?.send("service.list_today", {});
        } else {
          // bible: show empty results — user sees browse UI / recent searches
          setResults([]);
        }
        return;
      }

      debounceRef.current = setTimeout(() => {
        const op = TAB_OP[tab];
        const freshWs = useConnectionStore.getState().ws;
        if (op === "service.list_today") {
          freshWs?.send(op, {});
        } else if (op === "bible.search") {
          // Scope search to selected version when one is chosen in the browse UI
          const versionId = bibleStateRef.current.selectedVersion?.id;
          freshWs?.send(op, versionId != null ? { query: value, versionId } : { query: value });
        } else {
          freshWs?.send(op, { query: value });
        }
      }, DEBOUNCE_MS);
    },
    [ws, tab],
  );

  // Stage a selection. Actual projection/queue-add happens only after the user
  // confirms in the bottom sheet — avoids mis-click projection from fat fingers.
  const handleSelect = useCallback(
    (id: string) => {
      const item = results.find((r) => r.id === id);
      if (!item) return;
      let pending: PendingAction;
      if (tab === "hymns") {
        pending = { kind: "hymn", title: item.title, subtitle: item.subtitle, hymnId: Number(item.id) };
      } else if (tab === "bible" && item.bibleRef) {
        pending = {
          kind: "bible",
          title: item.title,
          subtitle: item.subtitle,
          bibleRef: { ...item.bibleRef, id: Number(item.id) },
        };
      } else if (tab === "services") {
        pending = { kind: "service", title: item.title, subtitle: item.subtitle, serviceId: Number(item.id) };
      } else {
        return;
      }
      setPendingAction(pending);
      // Record the current query as a recent search when a result is tapped
      if (query.trim()) {
        saveRecentSearch(tab, query);
        setRecentSearches(getRecentSearches(tab));
      }
    },
    [tab, results, query],
  );

  const handleActionProjectNow = useCallback(() => {
    if (!pendingAction) return;
    const freshWs = useConnectionStore.getState().ws;
    if (pendingAction.kind === "hymn" && pendingAction.hymnId != null) {
      freshWs?.send("search.select", { id: String(pendingAction.hymnId), type: "hymns" });
    } else if (pendingAction.kind === "bible" && pendingAction.bibleRef) {
      const r = pendingAction.bibleRef;
      freshWs?.send("search.select", {
        id: String(r.id),
        type: "bible",
        book: r.book,
        chapter: r.chapter,
        verse: r.verse,
        text: r.text,
        bookName: r.bookName,
      });
    } else if (pendingAction.kind === "service" && pendingAction.serviceId != null) {
      freshWs?.send("search.select", { id: String(pendingAction.serviceId), type: "services" });
    }
    setPendingAction(null);
  }, [pendingAction]);

  const handleActionAddToQueue = useCallback(() => {
    if (!pendingAction || pendingAction.kind !== "hymn" || pendingAction.hymnId == null) return;
    const freshWs = useConnectionStore.getState().ws;
    freshWs?.send("queue.add", { id: String(pendingAction.hymnId), type: "hymns" });
    setPendingAction(null);
  }, [pendingAction]);

  const handleActionCancel = useCallback(() => setPendingAction(null), []);

  const handleRecentChipClick = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
      if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);
      const op = TAB_OP[tab];
      if (op === "service.list_today") {
        ws?.send(op, {});
      } else if (op === "bible.search") {
        const versionId = bibleStateRef.current.selectedVersion?.id;
        ws?.send(op, versionId != null ? { query: recentQuery, versionId } : { query: recentQuery });
      } else {
        ws?.send(op, { query: recentQuery });
      }
    },
    [ws, tab],
  );

  const handleClearQuery = useCallback(() => {
    handleQueryChange("");
  }, [handleQueryChange]);

  // ─── Bible browse handlers ──────────────────────────────────────────────────

  // Step advancement is OPTIMISTIC (client-side on click), not driven by server response.
  // This isolates the step machine from WS round-trip races, response envelope signing,
  // error paths, and re-mounts — the user's navigation is always reflected immediately.
  // The server response only populates the list for the already-advanced step.

  const handleBibleVersionSelect = useCallback(
    (version: RawBibleVersion) => {
      const freshWs = useConnectionStore.getState().ws;
      setBibleState((prev) => ({
        ...prev,
        step: "book",
        selectedVersion: version,
        books: [],
        selectedBook: null,
        chapters: [],
        selectedChapter: null,
        verses: [],
        loading: true,
      }));
      freshWs?.send("bible.list_books", { versionId: version.id });
    },
    [],
  );

  const handleBibleBookSelect = useCallback((book: RawBibleBook) => {
    const freshWs = useConnectionStore.getState().ws;
    const versionId = bibleStateRef.current.selectedVersion?.id;
    setBibleState((prev) => ({
      ...prev,
      step: "chapter",
      selectedBook: book,
      chapters: [],
      selectedChapter: null,
      verses: [],
      loading: true,
    }));
    if (!versionId) {
      console.warn("[search] bible.list_chapters skipped: no selectedVersion");
      return;
    }
    freshWs?.send("bible.list_chapters", { versionId, book: book.name });
  }, []);

  const handleBibleChapterSelect = useCallback((chapter: number) => {
    const freshWs = useConnectionStore.getState().ws;
    const versionId = bibleStateRef.current.selectedVersion?.id;
    const bookName = bibleStateRef.current.selectedBook?.name;
    setBibleState((prev) => ({
      ...prev,
      step: "verse",
      selectedChapter: chapter,
      verses: [],
      loading: true,
    }));
    if (!versionId || !bookName) {
      console.warn("[search] bible.list_verses skipped: missing version or book");
      return;
    }
    freshWs?.send("bible.list_verses", { versionId, book: bookName, chapter });
  }, []);

  const handleBibleVerseSelect = useCallback((verse: RawBibleVerse) => {
    const bookName = bibleStateRef.current.selectedBook?.name ?? verse.book;
    setPendingAction({
      kind: "bible",
      title: `${bookName} ${verse.chapter}:${verse.verse}`,
      subtitle: verse.text,
      bibleRef: {
        id: verse.id,
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        text: verse.text,
        bookName,
      },
    });
  }, []);

  const handleBibleBack = useCallback(() => {
    setBibleState((prev) => {
      switch (prev.step) {
        case "book":
          return { ...prev, step: "version", books: [], selectedBook: null, loading: false };
        case "chapter":
          return { ...prev, step: "book", chapters: [], selectedChapter: null, loading: false };
        case "verse":
          return { ...prev, step: "chapter", verses: [], selectedChapter: null, loading: false };
        default:
          return prev;
      }
    });
  }, []);

  const placeholder =
    tab === "hymns"
      ? t("remote.search.placeholder_hymns")
      : tab === "bible"
        ? t("remote.search.placeholder_bible")
        : t("remote.search.placeholder_service");

  const tabs: { id: SearchTab; label: string }[] = [
    { id: "hymns", label: t("remote.search.tab_hymns") },
    { id: "bible", label: t("remote.search.tab_bible") },
    { id: "services", label: t("remote.search.tab_services") },
  ];

  const showRecentChips = tab !== "bible" && !query.trim() && recentSearches.length > 0;

  // Bible browse: only show browse UI when no active text search
  const showBibleBrowse = tab === "bible" && !query.trim();

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div role="tablist" aria-label="Search categories" className="flex border-b border-border">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-b-2 border-primary text-primary"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search input — hidden on services tab (no query support) */}
      {tab !== "services" && (
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className={cn(
              "w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-surface-1 text-sm text-fg placeholder:text-fg-subtle",
              "focus:outline-none focus:ring-2 focus:ring-primary",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label={t("remote.search.clear")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      )}

      {/* Recent searches chips (hymns only — services has no search, bible has browse UI) */}
      {showRecentChips && (
        <div className="px-4 pb-2">
          <p className="text-xs text-fg-muted mb-1.5">{t("remote.search.recent")}</p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label={t("remote.search.recent")}>
            {recentSearches.map((rq) => (
              <button
                key={rq}
                type="button"
                role="listitem"
                onClick={() => handleRecentChipClick(rq)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border border-border",
                  "bg-surface-1 text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors",
                )}
              >
                {rq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bible browse UI */}
      {showBibleBrowse && (
        <BibleBrowse
          state={bibleState}
          onVersionSelect={handleBibleVersionSelect}
          onBookSelect={handleBibleBookSelect}
          onChapterSelect={handleBibleChapterSelect}
          onVerseSelect={handleBibleVerseSelect}
          onBack={handleBibleBack}
        />
      )}

      {/* Results list (hymns, services, and bible text-search results) */}
      {!showBibleBrowse && (
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && query.trim() !== "" && (
            <p className="text-center text-sm text-fg-muted py-8">{t("remote.search.no_results")}</p>
          )}
          <ul>
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-0",
                    "hover:bg-surface-2 active:bg-surface-2 transition-colors",
                  )}
                >
                  <p className="text-sm font-medium text-fg">{item.title}</p>
                  {item.snippetHtml ? (
                    <p className="text-xs text-fg-muted mt-0.5 leading-snug">
                      <HighlightedSnippet html={item.snippetHtml} />
                    </p>
                  ) : item.subtitle ? (
                    <p className="text-xs text-fg-muted mt-0.5">{item.subtitle}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action confirmation sheet */}
      {pendingAction && (
        <ActionSheet
          action={pendingAction}
          onProjectNow={handleActionProjectNow}
          onAddToQueue={handleActionAddToQueue}
          onCancel={handleActionCancel}
        />
      )}
    </div>
  );
}

// ─── Action Sheet ─────────────────────────────────────────────────────────────

interface ActionSheetProps {
  action: PendingAction;
  onProjectNow: () => void;
  onAddToQueue: () => void;
  onCancel: () => void;
}

function ActionSheet({ action, onProjectNow, onAddToQueue, onCancel }: ActionSheetProps) {
  const { t } = useTranslation();

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const showAddToQueue = action.kind === "hymn";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t("remote.search.action_sheet_title")}
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-t-2xl pb-safe flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-fg truncate">{action.title}</p>
          {action.subtitle && (
            <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">{action.subtitle}</p>
          )}
        </div>

        <div className="flex flex-col p-3 gap-2">
          <button
            type="button"
            onClick={onProjectNow}
            className={cn(
              "flex items-center gap-3 w-full h-14 rounded-lg px-4",
              "bg-primary text-white font-semibold text-sm",
              "active:scale-[0.98] transition-transform",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            )}
          >
            <Monitor className="h-5 w-5" aria-hidden="true" />
            <span className="flex-1 text-left">{t("remote.search.action_project_now")}</span>
          </button>

          {showAddToQueue && (
            <button
              type="button"
              onClick={onAddToQueue}
              className={cn(
                "flex items-center gap-3 w-full h-14 rounded-lg px-4",
                "bg-surface-1 border border-border text-fg font-medium text-sm",
                "active:scale-[0.98] transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <ListPlus className="h-5 w-5" aria-hidden="true" />
              <span className="flex-1 text-left">{t("remote.search.action_add_to_queue")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className={cn(
              "w-full h-12 rounded-lg text-sm font-medium text-fg-muted",
              "hover:text-fg hover:bg-surface-2 active:bg-surface-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            {t("remote.search.action_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bible Browse sub-component ───────────────────────────────────────────────

interface BibleBrowseProps {
  state: BibleBrowseState;
  onVersionSelect: (v: RawBibleVersion) => void;
  onBookSelect: (b: RawBibleBook) => void;
  onChapterSelect: (ch: number) => void;
  onVerseSelect: (v: RawBibleVerse) => void;
  onBack: () => void;
}

function BibleBrowse({
  state,
  onVersionSelect,
  onBookSelect,
  onChapterSelect,
  onVerseSelect,
  onBack,
}: BibleBrowseProps) {
  const { t } = useTranslation();
  const { step, versions, selectedVersion, books, selectedBook, chapters, verses, loading } = state;
  const selectedChapter = state.selectedChapter;

  const breadcrumb = [
    selectedVersion?.abbreviation,
    selectedBook?.name,
    selectedChapter !== null ? `${t("remote.search.bible_pick_chapter")} ${selectedChapter}` : undefined,
  ]
    .filter(Boolean)
    .join(" › ");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Breadcrumb + back button */}
      {step !== "version" && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("remote.search.bible_back")}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("remote.search.bible_back")}
          </button>
          {breadcrumb ? (
            <span className="text-xs text-fg-muted truncate">{breadcrumb}</span>
          ) : null}
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-fg-muted py-8">{t("remote.search.bible_loading")}</p>
      )}

      {!loading && step === "version" && (
        <div className="flex-1 overflow-y-auto">
          {versions.length === 0 && (
            <p className="text-center text-sm text-fg-muted py-8">{t("remote.search.bible_pick_version")}</p>
          )}
          <ul>
            {versions.map((v) => (
              <li key={v.abbreviation}>
                <button
                  type="button"
                  onClick={() => onVersionSelect(v)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-0",
                    "flex items-center justify-between",
                    "hover:bg-surface-2 active:bg-surface-2 transition-colors",
                  )}
                >
                  <span>
                    <p className="text-sm font-medium text-fg">{v.abbreviation}</p>
                    <p className="text-xs text-fg-muted mt-0.5">{v.name}</p>
                  </span>
                  <ChevronRight className="h-4 w-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && step === "book" && (
        <div className="flex-1 overflow-y-auto">
          {books.length === 0 && (
            <p className="text-center text-sm text-fg-muted py-8">{t("remote.search.bible_pick_book")}</p>
          )}
          <ul>
            {books.map((b) => (
              <li key={b.name}>
                <button
                  type="button"
                  onClick={() => onBookSelect(b)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-0",
                    "flex items-center justify-between",
                    "hover:bg-surface-2 active:bg-surface-2 transition-colors",
                  )}
                >
                  <p className="text-sm font-medium text-fg">{b.name}</p>
                  <ChevronRight className="h-4 w-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && step === "chapter" && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-xs text-fg-muted mb-2">{t("remote.search.bible_pick_chapter")}</p>
          {chapters.length === 0 ? (
            <p className="text-center text-sm text-fg-muted py-8">
              {t("remote.search.bible_no_chapters")}
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {chapters.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => onChapterSelect(ch)}
                  className={cn(
                    "h-10 rounded-lg text-sm font-medium border border-border",
                    "bg-surface-1 text-fg hover:bg-surface-2 active:bg-surface-2 transition-colors",
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && step === "verse" && (
        <div className="flex-1 overflow-y-auto">
          <p className="text-xs text-fg-muted px-4 pt-2 pb-1">{t("remote.search.bible_pick_verse")}</p>
          {verses.length === 0 && (
            <p className="text-center text-sm text-fg-muted py-8">
              {t("remote.search.bible_no_verses")}
            </p>
          )}
          <ul>
            {verses.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onVerseSelect(v)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-0",
                    "hover:bg-surface-2 active:bg-surface-2 transition-colors",
                  )}
                >
                  <p className="text-xs text-primary font-semibold mb-0.5">
                    {selectedBook?.name} {selectedChapter}:{v.verse}
                  </p>
                  <p className="text-sm text-fg leading-snug">{v.text}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
