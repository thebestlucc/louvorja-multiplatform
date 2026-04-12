import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LiveRoute from "../live";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "remote.live.prev": "Prev",
        "remote.live.next": "Next",
        "remote.live.black": "Black screen",
        "remote.live.logo": "Logo screen",
        "remote.live.clear": "Clear overlay",
        "remote.live.no_slide": "Waiting for content",
        "remote.live.connected": "Connected",
        "remote.live.disconnected": "Disconnected",
        "remote.live.reconnecting": "Reconnecting",
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
      device: { name: "LouvorJA" },
    }),
}));

describe("LiveRoute — G2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders connection pill with connected state", () => {
    render(<LiveRoute />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders prev and next buttons", () => {
    render(<LiveRoute />);
    expect(screen.getByRole("button", { name: /prev/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("renders overlay buttons (black, logo, clear)", () => {
    render(<LiveRoute />);
    expect(screen.getByRole("button", { name: /black screen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logo screen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear overlay/i })).toBeInTheDocument();
  });

  it("clicking Next sends slide.next command", async () => {
    render(<LiveRoute />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    });
    expect(mockSend).toHaveBeenCalledWith("slide.next", {});
  });

  it("clicking Prev sends slide.prev command", async () => {
    render(<LiveRoute />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    });
    expect(mockSend).toHaveBeenCalledWith("slide.prev", {});
  });

  it("long-press on Black (600ms) sends display.overlay with black payload", async () => {
    render(<LiveRoute />);
    const blackBtn = screen.getByRole("button", { name: /black screen/i });

    fireEvent.pointerDown(blackBtn);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerUp(blackBtn);

    expect(mockSend).toHaveBeenCalledWith("display.overlay", { overlay: "black" });
  });

  it("short-press on Black (<600ms) does NOT send command", async () => {
    render(<LiveRoute />);
    const blackBtn = screen.getByRole("button", { name: /black screen/i });

    fireEvent.pointerDown(blackBtn);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerUp(blackBtn);

    expect(mockSend).not.toHaveBeenCalledWith("display.overlay", expect.anything());
  });

  it("shows 'Waiting for content' when no slide received yet", () => {
    render(<LiveRoute />);
    expect(screen.getByText("Waiting for content")).toBeInTheDocument();
  });

  it("shows slide content when slide.changed event fires", async () => {
    // Capture the handler registered for slide.changed
    let slideChangedHandler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, handler: (payload: unknown) => void) => {
      if (op === "slide.changed") slideChangedHandler = handler;
      return () => {};
    });

    render(<LiveRoute />);

    await act(async () => {
      slideChangedHandler?.({ text: "Amazing Grace", type: "lyrics" });
    });

    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
  });
});
