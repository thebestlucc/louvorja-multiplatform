import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SearchRoute from "../search";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "remote.search.tab_hymns": "Hymns",
        "remote.search.tab_bible": "Bible",
        "remote.search.tab_services": "Services",
        "remote.search.placeholder_hymns": "Search hymns…",
        "remote.search.placeholder_bible": "Book, chapter, verse…",
        "remote.search.placeholder_service": "Search services…",
        "remote.search.results_count": `${opts?.n ?? 0} results`,
        "remote.search.no_results": "No results",
        "remote.search.add_to_service": "Add to service",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockSend = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn().mockReturnValue(() => {});

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      wsState: "connected",
      ws: { send: mockSend, on: mockOn },
    }),
}));

describe("SearchRoute — G3 (debounce 120 ms)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders three tab buttons (Hymns, Bible, Services)", () => {
    render(<SearchRoute />);
    expect(screen.getByRole("tab", { name: "Hymns" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bible" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Services" })).toBeInTheDocument();
  });

  it("Hymns tab is active by default", () => {
    render(<SearchRoute />);
    expect(screen.getByRole("tab", { name: "Hymns" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows hymns search placeholder", () => {
    render(<SearchRoute />);
    expect(screen.getByPlaceholderText("Search hymns…")).toBeInTheDocument();
  });

  it("switching to Bible tab changes placeholder", () => {
    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));
    expect(screen.getByPlaceholderText("Book, chapter, verse…")).toBeInTheDocument();
  });

  // Regression test: previously sent "search.query" with { query, category } which
  // does not exist in the dispatcher. Must now send "hymn.search" with { query }.
  it("typing in hymns tab sends hymn.search op after debounce", async () => {
    mockOn.mockReturnValue(() => {});
    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "amazing" } });

    expect(mockSend).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    expect(mockSend).toHaveBeenCalledWith("hymn.search", { query: "amazing" });
  });

  // Regression test: previously sent "search.query" with { query, category: "bible" }.
  it("typing in bible tab sends bible.search op after debounce", async () => {
    mockOn.mockReturnValue(() => {});
    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));
    const input = screen.getByPlaceholderText("Book, chapter, verse…");
    fireEvent.change(input, { target: { value: "john" } });

    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    expect(mockSend).toHaveBeenCalledWith("bible.search", { query: "john" });
  });

  // Regression test: services tab hides the search input entirely since
  // service.list_today takes no query. Tab switch alone fetches the list.
  it("services tab has no search input (list fetched on tab switch)", async () => {
    mockOn.mockReturnValue(() => {});
    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));
    expect(screen.queryByPlaceholderText("Search services…")).not.toBeInTheDocument();
    expect(mockSend).toHaveBeenCalledWith("service.list_today", {});
  });

  // Regression test: previously listened for "search.results" event which is never emitted.
  // Must now listen on "hymn.search" response op and map raw Hymn shape to SearchResultItem.
  it("shows hymn results when hymn.search response fires", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      hymnHandler?.([
        { id: 1, title: "Amazing Grace", author: "John Newton", album: null, number: 42 },
        { id: 2, title: "How Great Thou Art", author: null, album: "Classic Hymns", number: 7 },
      ]);
    });

    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    expect(screen.getByText("John Newton")).toBeInTheDocument();
    expect(screen.getByText("How Great Thou Art")).toBeInTheDocument();
    expect(screen.getByText("Classic Hymns")).toBeInTheDocument();
  });

  // Regression test: bible.search response maps BibleSearchResult shape.
  it("shows bible results when bible.search response fires", async () => {
    let bibleHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "bible.search") bibleHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));

    await act(async () => {
      bibleHandler?.([
        {
          verse: { id: 100, book: "JN", chapter: 3, verse: 16, text: "For God so loved..." },
          bookName: "John",
          snippet: "For God so loved the world...",
          versionAbbreviation: "NIV",
        },
      ]);
    });

    expect(screen.getByText("John 3:16")).toBeInTheDocument();
    expect(screen.getByText("For God so loved the world...")).toBeInTheDocument();
  });

  // Regression test: service.list_today response maps Liturgy shape.
  it("shows service results when service.list_today response fires", async () => {
    let serviceHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "service.list_today") serviceHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));

    await act(async () => {
      serviceHandler?.([
        { id: 5, title: "Sunday Morning Service", date: "2026-04-12" },
      ]);
    });

    expect(screen.getByText("Sunday Morning Service")).toBeInTheDocument();
    expect(screen.getByText("2026-04-12")).toBeInTheDocument();
  });

  it("clicking result item sends search.select command", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      hymnHandler?.([{ id: 99, title: "Amazing Grace", author: "John Newton", album: null }]);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Amazing Grace"));
    });

    expect(mockSend).toHaveBeenCalledWith("search.select", { id: "99", type: "hymns" });
  });

  // Fix A: default hymn list fetched on tab mount (empty query → hymn.search { query: "" })
  it("sends hymn.search with empty query on initial mount", async () => {
    mockOn.mockReturnValue(() => {});
    render(<SearchRoute />);
    // No timer advance needed — fires synchronously on mount
    expect(mockSend).toHaveBeenCalledWith("hymn.search", { query: "" });
  });

  // Fix A: services tab sends service.list_today immediately on select (no user input needed)
  it("sends service.list_today immediately when Services tab is selected", async () => {
    mockOn.mockReturnValue(() => {});
    render(<SearchRoute />);
    mockSend.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));
    // No timer advance — fires immediately on tab change
    expect(mockSend).toHaveBeenCalledWith("service.list_today", {});
    // Should NOT wait for debounce
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  // Fix A: bible tab shows recent searches chips from localStorage when no query typed
  it("shows recent search chips from localStorage for bible tab", async () => {
    mockOn.mockReturnValue(() => {});
    // Pre-populate localStorage with recent bible searches
    localStorage.setItem(
      "remote-search-recent-bible",
      JSON.stringify(["john 3:16", "psalms 23"]),
    );

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));

    expect(screen.getByText("john 3:16")).toBeInTheDocument();
    expect(screen.getByText("psalms 23")).toBeInTheDocument();

    // Clean up
    localStorage.removeItem("remote-search-recent-bible");
  });

  it("results from a previous tab are ignored when tab changes", async () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      handlers.set(op, handler);
      return () => handlers.delete(op);
    });

    render(<SearchRoute />);
    // Switch to Bible tab — hymn.search handler is now active but tab is "bible"
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));

    // Fire hymn.search response while on Bible tab — should be ignored
    await act(async () => {
      handlers.get("hymn.search")?.([
        { id: 1, title: "Should Not Appear", author: null, album: null },
      ]);
    });

    expect(screen.queryByText("Should Not Appear")).not.toBeInTheDocument();
  });

  it("saves query to localStorage when result is tapped", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "amazing" } });

    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    await act(async () => {
      hymnHandler?.([{ id: 99, title: "Amazing Grace", author: "John Newton", album: null }]);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Amazing Grace"));
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      "remote-search-recent-hymns",
      expect.stringContaining("amazing"),
    );
    setItemSpy.mockRestore();
  });

  it("keeps only 10 most recent searches", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    // Pre-populate localStorage with 10 recent searches
    const existing = Array.from({ length: 10 }, (_, i) => `search ${i + 1}`);
    localStorage.setItem("remote-search-recent-hymns", JSON.stringify(existing));

    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "new query" } });

    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    await act(async () => {
      hymnHandler?.([{ id: 1, title: "Result", author: null, album: null }]);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Result"));
    });

    // Read what was saved
    const saved = JSON.parse(localStorage.getItem("remote-search-recent-hymns")!);
    expect(saved.length).toBe(10);
    expect(saved[0]).toBe("new query");
    // The oldest item (search 10) should have been dropped
    expect(saved).not.toContain("search 10");

    // Clean up
    localStorage.removeItem("remote-search-recent-hymns");
  });

  it("passes bibleRef when bible result is tapped", async () => {
    let bibleHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "bible.search") bibleHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));

    await act(async () => {
      bibleHandler?.([
        {
          verse: { id: 200, book: "GEN", chapter: 1, verse: 1, text: "In the beginning..." },
          bookName: "Genesis",
          snippet: "In the beginning God created...",
          versionAbbreviation: "NIV",
        },
      ]);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Genesis 1:1"));
    });

    expect(mockSend).toHaveBeenCalledWith(
      "search.select",
      expect.objectContaining({
        id: "200",
        type: "bible",
        book: "GEN",
        chapter: 1,
        verse: 1,
      }),
    );
  });

  it("clears query and resets results on X button click", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");

    // Get results
    await act(async () => {
      hymnHandler?.([{ id: 1, title: "Amazing Grace", author: "John Newton", album: null }]);
    });
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();

    // Type a query to show the clear button
    fireEvent.change(input, { target: { value: "amazing" } });
    expect(screen.getByLabelText("Clear search results")).toBeInTheDocument();

    // Click clear button
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Clear search results"));
    });

    // Input should be empty
    expect(input).toHaveValue("");
    // Default list should be shown again (hymn.search with empty query was sent)
    expect(mockSend).toHaveBeenCalledWith("hymn.search", { query: "" });
  });
});
