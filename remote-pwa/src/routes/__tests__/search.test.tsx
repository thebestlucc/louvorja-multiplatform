import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SearchRoute from "../search";

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("../../__tests__/mocks/i18n");
  return i18nMockFactory();
});

vi.mock("@/stores/connection-store", async () => {
  const { connectionStoreMockFactory, applyConnectionStoreState } =
    await import("../../__tests__/mocks/connection-store");
  applyConnectionStoreState("paired-live");
  return connectionStoreMockFactory();
});

// Import the stable mockWs so tests can spy on send/on without reaching into getState().
import { mockWs, applyConnectionStoreState } from "../../__tests__/mocks/connection-store";

// mockSendable aliases mockWs for readability at call sites.
const mockSendable = mockWs;

describe("SearchRoute — G3 (debounce 120 ms)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Re-add default .on behavior after clearAllMocks
    mockSendable.on.mockReturnValue(() => {});
    mockSendable.send.mockResolvedValue(undefined);
    // Ensure paired-live state is in effect for every test
    applyConnectionStoreState("paired-live");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders five tab buttons (Hymns, Bible, Videos, Presentations, Services)", () => {
    render(<SearchRoute />);
    expect(screen.getByRole("tab", { name: "Hymns" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bible" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Videos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Presentations" })).toBeInTheDocument();
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

  it("typing in hymns tab sends hymn.search op after debounce", async () => {
    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "amazing" } });

    await act(async () => { vi.advanceTimersByTime(120); });
    expect(mockSendable.send).toHaveBeenCalledWith("hymn.search", { query: "amazing" });
  });

  it("typing in bible tab sends bible.search op after debounce", async () => {
    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));
    const input = screen.getByPlaceholderText("Book, chapter, verse…");
    fireEvent.change(input, { target: { value: "john" } });

    await act(async () => { vi.advanceTimersByTime(120); });
    expect(mockSendable.send).toHaveBeenCalledWith("bible.search", { query: "john" });
  });

  it("services tab has no search input (list fetched on tab switch)", async () => {
    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));
    expect(screen.queryByPlaceholderText("Search services…")).not.toBeInTheDocument();
    expect(mockSendable.send).toHaveBeenCalledWith("service.list_today", {});
  });

  it("shows hymn results when hymn.search response fires", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
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

  it("shows bible results when bible.search response fires", async () => {
    let bibleHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "bible.search") bibleHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));
    // Type a query to switch from browse UI to results list
    const input = screen.getByPlaceholderText("Book, chapter, verse…");
    fireEvent.change(input, { target: { value: "john" } });

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

  it("shows service results when service.list_today response fires", async () => {
    let serviceHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
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

  // Multi-select: tapping a hymn result toggles checkbox
  it("tapping a hymn result toggles its checkbox (multi-select)", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      hymnHandler?.([{ id: 1, title: "Amazing Grace", author: "John Newton", album: null }]);
    });

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes[0]).toHaveAttribute("aria-checked", "false");

    await act(async () => { fireEvent.click(checkboxes[0]); });

    expect(checkboxes[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  // Multi-select: add 2 items to queue sends single queue.add with both
  it("add-to-queue with 2 items sends one queue.add with 2 payloads", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      hymnHandler?.([
        { id: 1, title: "Amazing Grace", author: null, album: null },
        { id: 2, title: "How Great Thou Art", author: null, album: null },
      ]);
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => { fireEvent.click(checkboxes[0]); });
    await act(async () => { fireEvent.click(checkboxes[1]); });

    mockSendable.send.mockClear();
    await act(async () => { fireEvent.click(screen.getByText("Add to queue")); });

    expect(mockSendable.send).toHaveBeenCalledTimes(1);
    expect(mockSendable.send).toHaveBeenCalledWith("queue.add", {
      items: expect.arrayContaining([
        { kind: "hymn", hymnId: 1 },
        { kind: "hymn", hymnId: 2 },
      ]),
    });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  // Multi-select: play-now with 2 items sends search.select + queue.add(1)
  it("play-now with 2 items sends search.select for first + queue.add for rest", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      hymnHandler?.([
        { id: 10, title: "Hymn A", author: null, album: null },
        { id: 20, title: "Hymn B", author: null, album: null },
      ]);
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => { fireEvent.click(checkboxes[0]); });
    await act(async () => { fireEvent.click(checkboxes[1]); });

    mockSendable.send.mockClear();
    await act(async () => { fireEvent.click(screen.getByText("Play now")); });

    const searchSelectCalls = mockSendable.send.mock.calls.filter(([op]: [string]) => op === "search.select");
    const queueAddCalls = mockSendable.send.mock.calls.filter(([op]: [string]) => op === "queue.add");
    expect(searchSelectCalls).toHaveLength(1);
    expect(queueAddCalls).toHaveLength(1);
    expect(queueAddCalls[0][1].items).toHaveLength(1);
  });

  // Tab switch clears selection
  it("switching tabs clears the multi-select", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      hymnHandler?.([{ id: 1, title: "Amazing Grace", author: null, album: null }]);
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => { fireEvent.click(checkboxes[0]); });

    expect(screen.getByRole("toolbar")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Bible" }));
    });

    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  // Services tab opens old ActionSheet (no selection)
  it("services tab opens action sheet on tap (no multi-select)", async () => {
    let serviceHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "service.list_today") serviceHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));

    await act(async () => {
      serviceHandler?.([{ id: 5, title: "Sunday Service", date: "2026-04-12" }]);
    });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByText("Sunday Service"));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("sends hymn.search with empty query on initial mount", async () => {
    render(<SearchRoute />);
    expect(mockSendable.send).toHaveBeenCalledWith("hymn.search", { query: "" });
  });

  it("sends service.list_today immediately when Services tab is selected", async () => {
    render(<SearchRoute />);
    mockSendable.send.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Services" }));
    expect(mockSendable.send).toHaveBeenCalledWith("service.list_today", {});
    expect(mockSendable.send).toHaveBeenCalledTimes(1);
  });

  it("shows recent search chips from localStorage for hymns tab", async () => {
    localStorage.setItem(
      "remote-search-recent-hymns",
      JSON.stringify(["amazing grace", "holy holy"]),
    );

    render(<SearchRoute />);
    // Hymns tab is active by default, chips should show right away (no query)
    expect(screen.getByText("amazing grace")).toBeInTheDocument();
    expect(screen.getByText("holy holy")).toBeInTheDocument();

    localStorage.removeItem("remote-search-recent-hymns");
  });

  it("results from a previous tab are ignored when tab changes", async () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      handlers.set(op, handler);
      return () => handlers.delete(op);
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));

    await act(async () => {
      handlers.get("hymn.search")?.([
        { id: 1, title: "Should Not Appear", author: null, album: null },
      ]);
    });

    expect(screen.queryByText("Should Not Appear")).not.toBeInTheDocument();
  });

  it("saves query to localStorage when result is tapped", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "amazing" } });

    await act(async () => { vi.advanceTimersByTime(120); });

    await act(async () => {
      hymnHandler?.([{ id: 99, title: "Amazing Grace", author: "John Newton", album: null }]);
    });

    await act(async () => {
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      "remote-search-recent-hymns",
      expect.stringContaining("amazing"),
    );
    setItemSpy.mockRestore();
  });

  it("keeps only 10 most recent searches", async () => {
    let hymnHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    const existing = Array.from({ length: 10 }, (_, i) => `search ${i + 1}`);
    localStorage.setItem("remote-search-recent-hymns", JSON.stringify(existing));

    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "new query" } });

    await act(async () => { vi.advanceTimersByTime(120); });

    await act(async () => {
      hymnHandler?.([{ id: 1, title: "Result", author: null, album: null }]);
    });

    await act(async () => {
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
    });

    const saved = JSON.parse(localStorage.getItem("remote-search-recent-hymns")!);
    expect(saved.length).toBe(10);
    expect(saved[0]).toBe("new query");
    expect(saved).not.toContain("search 10");

    localStorage.removeItem("remote-search-recent-hymns");
  });

  it("passes bibleRef when bible result is tapped — adds to selection + play-now sends correct search.select", async () => {
    let bibleHandler: ((payload: unknown) => void) | null = null;
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "bible.search") bibleHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    fireEvent.click(screen.getByRole("tab", { name: "Bible" }));
    // Type a query to switch from browse UI to results list
    const input = screen.getByPlaceholderText("Book, chapter, verse…");
    fireEvent.change(input, { target: { value: "genesis" } });

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
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
    });

    expect(screen.getByRole("toolbar")).toBeInTheDocument();

    mockSendable.send.mockClear();
    await act(async () => { fireEvent.click(screen.getByText("Play now")); });

    expect(mockSendable.send).toHaveBeenCalledWith(
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
    mockSendable.on.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "hymn.search") hymnHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");

    await act(async () => {
      hymnHandler?.([{ id: 1, title: "Amazing Grace", author: "John Newton", album: null }]);
    });
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "amazing" } });
    expect(screen.getByLabelText("Clear search results")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Clear search results"));
    });

    expect(input).toHaveValue("");
    expect(mockSendable.send).toHaveBeenCalledWith("hymn.search", { query: "" });
  });
});
