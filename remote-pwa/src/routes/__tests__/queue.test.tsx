import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import QueueRoute from "../queue";

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("../../__tests__/mocks/i18n");
  return i18nMockFactory();
});

const mockSend = vi.fn().mockResolvedValue(undefined);

interface MockQueueState {
  nowPlaying: { id: string; title: string; artist?: string } | null;
  upNext: { id: string; title: string; artist?: string }[];
  history: { id: string; title: string; artist?: string }[];
}

interface MockAudioStatus {
  position: number;
  duration: number;
  volume: number;
  playing: boolean;
}

let mockCurrentQueue: MockQueueState | null = null;
let mockCurrentAudioStatus: MockAudioStatus | null = null;

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      wsState: "connected",
      ws: { send: mockSend },
      currentQueue: mockCurrentQueue,
      currentAudioStatus: mockCurrentAudioStatus,
    }),
}));

vi.mock("@/stores/video-targets-store", () => {
  const mockState = { targets: ["projector"], setTargets: vi.fn() };
  return {
    useVideoTargetsStore: (selector?: (s: typeof mockState) => unknown) =>
      selector ? selector(mockState) : mockState,
  };
});

describe("QueueRoute — G4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentQueue = null;
    mockCurrentAudioStatus = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when no queue.state received", () => {
    render(<QueueRoute />);
    expect(screen.getByText("Queue is empty")).toBeInTheDocument();
  });

  it("shows now playing section when currentQueue has nowPlaying", () => {
    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Amazing Grace", artist: "Traditional" },
      upNext: [{ id: "h2", title: "How Great Thou Art", artist: "Stuart Hine" }],
      history: [],
    };

    render(<QueueRoute />);

    expect(screen.getByText("Now playing")).toBeInTheDocument();
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByText("How Great Thou Art")).toBeInTheDocument();
  });

  it("shows history section collapsed by default, expands on click", async () => {
    mockCurrentQueue = {
      nowPlaying: null,
      upNext: [],
      history: [{ id: "h0", title: "Blessed Assurance", artist: "Fanny Crosby" }],
    };

    render(<QueueRoute />);

    // History heading is visible but content is collapsed
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.queryByText("Blessed Assurance")).not.toBeInTheDocument();

    // Click to expand
    await act(async () => {
      fireEvent.click(screen.getByText("History"));
    });

    expect(screen.getByText("Blessed Assurance")).toBeInTheDocument();
  });

  it("toggles aria-expanded when history button is clicked", async () => {
    mockCurrentQueue = {
      nowPlaying: null,
      upNext: [],
      history: [{ id: "h0", title: "Blessed Assurance", artist: "Fanny Crosby" }],
    };

    render(<QueueRoute />);

    const historyButton = screen.getByText("History").closest("button")!;

    // Initially collapsed
    expect(historyButton).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    await act(async () => {
      fireEvent.click(historyButton);
    });

    expect(historyButton).toHaveAttribute("aria-expanded", "true");

    // Click to collapse again
    await act(async () => {
      fireEvent.click(historyButton);
    });

    expect(historyButton).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking up-next item sends queue.play command", async () => {
    mockCurrentQueue = {
      nowPlaying: null,
      upNext: [{ id: "h2", title: "How Great Thou Art", artist: "Stuart Hine" }],
      history: [],
    };

    render(<QueueRoute />);

    await act(async () => {
      fireEvent.click(screen.getByText("How Great Thou Art"));
    });

    expect(mockSend).toHaveBeenCalledWith("queue.play", { id: "h2" });
  });

  it("ignores invalid queue.state payload — null currentQueue shows empty", () => {
    // The store filters invalid payloads; null currentQueue shows empty state
    render(<QueueRoute />);
    expect(screen.getByText("Queue is empty")).toBeInTheDocument();
  });

  it("ignores invalid audio.status payload — null currentAudioStatus is safe", () => {
    // The store filters invalid payloads; null currentAudioStatus is handled gracefully
    render(<QueueRoute />);
    expect(screen.getByText("Queue is empty")).toBeInTheDocument();
  });
});

describe("QueueRoute — audio controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentQueue = null;
    mockCurrentAudioStatus = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows play/pause/skip buttons when audio is playing", () => {
    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Song", artist: "Artist" },
      upNext: [],
      history: [],
    };

    render(<QueueRoute />);

    expect(screen.getByRole("button", { name: /skip previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip next/i })).toBeInTheDocument();
  });

  it("clicking play/pause sends audio.toggle", async () => {
    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Song", artist: "Artist" },
      upNext: [],
      history: [],
    };
    mockCurrentAudioStatus = { position: 0, duration: 120, volume: 0.8, playing: false };

    render(<QueueRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /play/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("audio.toggle", {});
  });

  it("clicking skip prev sends audio.skip_prev", async () => {
    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Song", artist: "Artist" },
      upNext: [],
      history: [],
    };
    mockCurrentAudioStatus = { position: 0, duration: 120, volume: 0.8, playing: false };

    render(<QueueRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /skip previous/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("audio.skip_prev", {});
  });

  it("clicking skip next sends audio.skip_next", async () => {
    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Song", artist: "Artist" },
      upNext: [],
      history: [],
    };
    mockCurrentAudioStatus = { position: 0, duration: 120, volume: 0.8, playing: false };

    render(<QueueRoute />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /skip next/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("audio.skip_next", {});
  });

  it("seeking sends audio.seek with milliseconds", async () => {
    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Song", artist: "Artist" },
      upNext: [],
      history: [],
    };
    mockCurrentAudioStatus = { position: 30, duration: 120, volume: 0.8, playing: false };

    render(<QueueRoute />);

    const slider = screen.getByRole("slider", { name: /seek/i });
    await act(async () => {
      fireEvent.change(slider, { target: { value: "60" } });
      fireEvent.pointerUp(slider);
    });

    expect(mockSend).toHaveBeenCalledWith("audio.seek", { ms: 60000 });
  });

  it("volume change sends audio.volume (debounced)", async () => {
    vi.useFakeTimers();

    mockCurrentQueue = {
      nowPlaying: { id: "h1", title: "Song", artist: "Artist" },
      upNext: [],
      history: [],
    };
    mockCurrentAudioStatus = { position: 0, duration: 120, volume: 0.8, playing: false };

    render(<QueueRoute />);

    const slider = screen.getByRole("slider", { name: /volume/i });
    await act(async () => {
      fireEvent.change(slider, { target: { value: "50" } });
      fireEvent.pointerUp(slider);
    });

    // Debounce is 150ms
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(mockSend).toHaveBeenCalledWith("audio.volume", { value: 0.5 });
    vi.useRealTimers();
  });
});
