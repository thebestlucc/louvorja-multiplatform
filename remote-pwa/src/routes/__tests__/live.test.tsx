import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LiveRoute from "../live";

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("../../__tests__/mocks/i18n");
  return i18nMockFactory();
});

const mockSend = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn().mockReturnValue(() => {});

let mockWsState = "connected";
let mockCurrentSlide: Record<string, unknown> | null = null;

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      wsState: mockWsState,
      ws: { send: mockSend, on: mockOn },
      device: { name: "LouvorJA" },
      peers: [],
      currentSlide: mockCurrentSlide,
      _setWsState: (s: string) => { mockWsState = s; },
    }),
}));

describe("LiveRoute — G2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockCurrentSlide = null;
    mockWsState = "connected";
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders connection pill with connected state", () => {
    render(<LiveRoute />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders prev and next buttons when slides exist", () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 3 };
    render(<LiveRoute />);
    expect(screen.getByRole("button", { name: /prev/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("hides prev and next buttons when no slides", () => {
    render(<LiveRoute />);
    expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("renders overlay buttons (black, logo, clear)", () => {
    render(<LiveRoute />);
    expect(screen.getByRole("button", { name: /black screen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logo screen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear overlay/i })).toBeInTheDocument();
  });

  it("clicking Next sends slide.next command", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 3 };
    render(<LiveRoute />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    });
    expect(mockSend).toHaveBeenCalledWith("slide.next", {});
  });

  it("clicking Prev sends slide.prev command", async () => {
    mockCurrentSlide = { text: "Test", index: 1, total: 3 };
    render(<LiveRoute />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    });
    expect(mockSend).toHaveBeenCalledWith("slide.prev", {});
  });

  it("clicking Black sends display.overlay with black payload", async () => {
    render(<LiveRoute />);
    const blackBtn = screen.getByRole("button", { name: /black screen/i });

    await act(async () => {
      fireEvent.click(blackBtn);
    });

    expect(mockSend).toHaveBeenCalledWith("display.overlay", { overlay: "black" });
  });

  it("shows 'Waiting for content' when no slide received yet", () => {
    render(<LiveRoute />);
    expect(screen.getByText("Waiting for content")).toBeInTheDocument();
  });

  it("shows slide content when currentSlide is set in store", async () => {
    mockCurrentSlide = { text: "Amazing Grace", type: "lyrics" };

    render(<LiveRoute />);

    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
  });

  it("clicking Logo sends display.overlay with logo payload", async () => {
    render(<LiveRoute />);
    const logoBtn = screen.getByRole("button", { name: /logo screen/i });

    await act(async () => {
      fireEvent.click(logoBtn);
    });

    expect(mockSend).toHaveBeenCalledWith("display.overlay", { overlay: "logo" });
  });

  it("clicking Clear sends display.overlay with clear payload", async () => {
    render(<LiveRoute />);
    const clearBtn = screen.getByRole("button", { name: /clear overlay/i });

    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(mockSend).toHaveBeenCalledWith("display.overlay", { overlay: "clear" });
  });

  it("shows 'Reconnecting' state with amber color", async () => {
    mockWsState = "reconnecting";
    render(<LiveRoute />);
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });

  it("shows 'Disconnected' state with red color", async () => {
    mockWsState = "disconnected";
    render(<LiveRoute />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows All Slides button when there are slides", () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    expect(screen.getByRole("button", { name: /all slides/i })).toBeInTheDocument();
  });

  it("hides All Slides button when there are no slides", () => {
    render(<LiveRoute />);
    expect(screen.queryByRole("button", { name: /all slides/i })).not.toBeInTheDocument();
  });

  it("clicking All Slides opens the slide grid", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /all slides/i }));
    });

    expect(screen.getByRole("dialog", { name: /all slides/i })).toBeInTheDocument();
  });

  it("selecting a slide in the grid sends slide.goto command", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /all slides/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /slide 2 of 5/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("slide.goto", { index: 1 });
  });

  it("closes the grid when pressing Escape", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /all slides/i }));
    });

    expect(screen.getByRole("dialog", { name: /all slides/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog", { name: /all slides/i })).not.toBeInTheDocument();
  });

  it("closes the grid when clicking on the backdrop", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /all slides/i }));
    });

    // The backdrop is the outermost div with the bg-black/60 class
    const backdrop = document.querySelector("div.fixed.inset-0.z-50.bg-black\\/60");
    expect(backdrop).not.toBeNull();

    // Click on the backdrop area (outside the panel)
    await act(async () => {
      fireEvent.click(backdrop!);
    });

    expect(screen.queryByRole("dialog", { name: /all slides/i })).not.toBeInTheDocument();
  });

  it("highlights current slide in the grid", async () => {
    mockCurrentSlide = { text: "Test", index: 2, total: 5 };

    render(<LiveRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /all slides/i }));
    });

    const currentSlide = screen.getByRole("button", { name: /slide 3 of 5/i });
    expect(currentSlide).toHaveAttribute("aria-pressed", "true");
  });

  it("opens slide grid on swipe-up from bottom zone", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    // Swipe up from bottom 25% of screen (80% height) by more than 80px threshold
    const container = screen.getByText("Test").closest(".flex.flex-col.h-full")!;
    const viewportHeight = window.innerHeight;
    const startY = Math.floor(viewportHeight * 0.8); // 80% of viewport
    const endY = startY - 100; // swiped up 100px

    fireEvent.touchStart(container, {
      touches: [{ clientY: startY, clientX: 0 }],
    });
    await act(async () => {
      fireEvent.touchEnd(container, {
        changedTouches: [{ clientY: endY, clientX: 0 }],
      });
    });

    expect(screen.getByRole("dialog", { name: /all slides/i })).toBeInTheDocument();
  });

  it("does not open grid on short swipe", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    const container = screen.getByText("Test").closest(".flex.flex-col.h-full")!;
    const viewportHeight = window.innerHeight;
    const startY = Math.floor(viewportHeight * 0.8);
    const endY = startY - 40; // only 40px — below 80px threshold

    fireEvent.touchStart(container, {
      touches: [{ clientY: startY, clientX: 0 }],
    });
    await act(async () => {
      fireEvent.touchEnd(container, {
        changedTouches: [{ clientY: endY, clientX: 0 }],
      });
    });

    expect(screen.queryByRole("dialog", { name: /all slides/i })).not.toBeInTheDocument();
  });

  it("does not open grid when swipe starts outside bottom zone", async () => {
    mockCurrentSlide = { text: "Test", index: 0, total: 5 };

    render(<LiveRoute />);

    const container = screen.getByText("Test").closest(".flex.flex-col.h-full")!;
    const viewportHeight = window.innerHeight;
    const startY = Math.floor(viewportHeight * 0.3); // 30% — top area, not bottom 25%
    const endY = startY - 100;

    fireEvent.touchStart(container, {
      touches: [{ clientY: startY, clientX: 0 }],
    });
    await act(async () => {
      fireEvent.touchEnd(container, {
        changedTouches: [{ clientY: endY, clientX: 0 }],
      });
    });

    expect(screen.queryByRole("dialog", { name: /all slides/i })).not.toBeInTheDocument();
  });
});
