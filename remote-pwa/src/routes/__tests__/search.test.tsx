import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("SearchRoute — G3", () => {
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

  it("typing in search input sends search.query after debounce", async () => {
    // Capture the handler for search.results
    mockOn.mockReturnValue(() => {});
    render(<SearchRoute />);
    const input = screen.getByPlaceholderText("Search hymns…");
    fireEvent.change(input, { target: { value: "amazing" } });

    // Should not send immediately
    expect(mockSend).not.toHaveBeenCalled();

    // After 400ms debounce
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mockSend).toHaveBeenCalledWith("search.query", { query: "amazing", category: "hymns" });
  });

  it("shows results when search.results event fires", async () => {
    let resultsHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "search.results") resultsHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      resultsHandler?.({
        items: [
          { id: "1", title: "Amazing Grace", subtitle: "Hymn 42" },
          { id: "2", title: "How Great Thou Art", subtitle: "Hymn 7" },
        ],
      });
    });

    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    expect(screen.getByText("How Great Thou Art")).toBeInTheDocument();
  });

  it("clicking result item sends search.select command", async () => {
    let resultsHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "search.results") resultsHandler = handler;
      return () => {};
    });

    render(<SearchRoute />);

    await act(async () => {
      resultsHandler?.({
        items: [{ id: "abc123", title: "Amazing Grace", subtitle: "Hymn 42" }],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Amazing Grace"));
    });

    expect(mockSend).toHaveBeenCalledWith("search.select", { id: "abc123" });
  });
});
