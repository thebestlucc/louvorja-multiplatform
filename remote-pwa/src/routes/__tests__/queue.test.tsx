import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QueueRoute from "../queue";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "remote.queue.now_playing": "Now playing",
        "remote.queue.up_next": "Up next",
        "remote.queue.history": "History",
        "remote.queue.empty": "Queue is empty",
        "remote.queue.play_next": "Play next",
        "remote.queue.remove": "Remove",
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

describe("QueueRoute — G5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no queue.state received", () => {
    render(<QueueRoute />);
    expect(screen.getByText("Queue is empty")).toBeInTheDocument();
  });

  it("shows now playing section when queue.state fires with nowPlaying", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "queue.state") handler = h;
      return () => {};
    });

    render(<QueueRoute />);

    await act(async () => {
      handler?.({
        nowPlaying: { id: "h1", title: "Amazing Grace", artist: "Traditional" },
        upNext: [{ id: "h2", title: "How Great Thou Art", artist: "Stuart Hine" }],
        history: [],
      });
    });

    expect(screen.getByText("Now playing")).toBeInTheDocument();
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByText("How Great Thou Art")).toBeInTheDocument();
  });

  it("shows history section", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "queue.state") handler = h;
      return () => {};
    });

    render(<QueueRoute />);

    await act(async () => {
      handler?.({
        nowPlaying: null,
        upNext: [],
        history: [{ id: "h0", title: "Blessed Assurance", artist: "Fanny Crosby" }],
      });
    });

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Blessed Assurance")).toBeInTheDocument();
  });

  it("clicking up-next item sends queue.play command", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "queue.state") handler = h;
      return () => {};
    });

    render(<QueueRoute />);

    await act(async () => {
      handler?.({
        nowPlaying: null,
        upNext: [{ id: "h2", title: "How Great Thou Art", artist: "Stuart Hine" }],
        history: [],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText("How Great Thou Art"));
    });

    expect(mockSend).toHaveBeenCalledWith("queue.play", { id: "h2" });
  });
});
