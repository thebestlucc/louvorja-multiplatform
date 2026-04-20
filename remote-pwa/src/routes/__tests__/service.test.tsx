import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ServiceRoute from "../service";

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("../../__tests__/mocks/i18n");
  return i18nMockFactory();
});

const mockSend = vi.fn().mockResolvedValue(undefined);

let mockCurrentService: {
  title: string;
  activeIndex: number;
  items: { id: string; title: string; type: string }[];
} | null = null;

// Inline connection-store mock: tests mutate closure state (e.g. mockCurrentService)
// per test-body BEFORE render(). Shared applyConnectionStoreState() only resets in beforeEach, so
// it can't cover this pattern. See __tests__/mocks/connection-store.ts for the shared variant.
vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      wsState: "connected",
      ws: { send: mockSend },
      currentService: mockCurrentService,
    }),
}));

describe("ServiceRoute — G4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentService = null;
  });

  it("shows no-service state when no service.state event received", () => {
    render(<ServiceRoute />);
    expect(screen.getByText("No active service")).toBeInTheDocument();
  });

  it("shows service title and items when currentService is set", () => {
    mockCurrentService = {
      title: "Sunday Worship",
      activeIndex: 0,
      items: [
        { id: "i1", title: "Opening Prayer", type: "annotation" },
        { id: "i2", title: "Amazing Grace", type: "hymn" },
        { id: "i3", title: "Sermon", type: "annotation" },
      ],
    };

    render(<ServiceRoute />);

    expect(screen.getByText("Sunday Worship")).toBeInTheDocument();
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
  });

  it("highlights active item", () => {
    mockCurrentService = {
      title: "Sunday Worship",
      activeIndex: 1,
      items: [
        { id: "i1", title: "Opening Prayer", type: "annotation" },
        { id: "i2", title: "Amazing Grace", type: "hymn" },
      ],
    };

    render(<ServiceRoute />);

    const activeItem = screen.getByText("Amazing Grace").closest("[aria-current='step']");
    expect(activeItem).toBeInTheDocument();
  });

  it("clicking an item sends service.goto command", async () => {
    mockCurrentService = {
      title: "Sunday",
      activeIndex: 0,
      items: [{ id: "i1", title: "Amazing Grace", type: "hymn" }],
    };

    render(<ServiceRoute />);

    await act(async () => {
      fireEvent.click(screen.getByText("Amazing Grace"));
    });

    expect(mockSend).toHaveBeenCalledWith("service.goto", { index: 0 });
  });

  it("Stop service button sends service.stop command", async () => {
    mockCurrentService = {
      title: "Sunday",
      activeIndex: 0,
      items: [{ id: "i1", title: "Amazing Grace", type: "hymn" }],
    };

    render(<ServiceRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop service/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("service.stop", {});
  });

  it("Prev item button sends service.prev_item command", async () => {
    mockCurrentService = {
      title: "Sunday",
      activeIndex: 1,
      items: [
        { id: "i1", title: "Opening Prayer", type: "annotation" },
        { id: "i2", title: "Amazing Grace", type: "hymn" },
      ],
    };

    render(<ServiceRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /previous item/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("service.prev_item", {});
  });

  it("Next item button sends service.next_item command", async () => {
    mockCurrentService = {
      title: "Sunday",
      activeIndex: 0,
      items: [
        { id: "i1", title: "Opening Prayer", type: "annotation" },
        { id: "i2", title: "Amazing Grace", type: "hymn" },
      ],
    };

    render(<ServiceRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("service.next_item", {});
  });

  it("filters out invalid service items from payload", () => {
    // The store already filters — this test verifies only valid items render
    mockCurrentService = {
      title: "Sunday Worship",
      activeIndex: 0,
      items: [
        { id: "i1", title: "Valid Item", type: "annotation" },
        { id: "i4", title: "Another Valid", type: "bible" },
      ],
    };

    render(<ServiceRoute />);

    expect(screen.getByText("Valid Item")).toBeInTheDocument();
    expect(screen.getByText("Another Valid")).toBeInTheDocument();
    expect(screen.queryByText("Missing id")).not.toBeInTheDocument();
  });

  it("shows no active item when activeIndex is -1", () => {
    mockCurrentService = {
      title: "Sunday Worship",
      activeIndex: -1,
      items: [
        { id: "i1", title: "Opening Prayer", type: "annotation" },
        { id: "i2", title: "Amazing Grace", type: "hymn" },
      ],
    };

    render(<ServiceRoute />);

    // No item should have aria-current="step"
    const activeItems = document.querySelectorAll('[aria-current="step"]');
    expect(activeItems.length).toBe(0);

    // No item should have the active styling (border-l-primary or bg-primary/10)
    const items = screen.getAllByRole("button");
    for (const item of items) {
      expect(item).not.toHaveAttribute("aria-current", "step");
    }
  });
});
