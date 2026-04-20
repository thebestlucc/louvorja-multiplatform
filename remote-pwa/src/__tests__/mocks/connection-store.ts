// Shared connection-store mock factory for remote-pwa tests.
// Usage (at the top of each test file):
//   import { connectionStoreMockFactory, applyConnectionStoreState }
//     from "../../__tests__/mocks/connection-store";
//   vi.mock("@/stores/connection-store", connectionStoreMockFactory);
//   // Inside beforeEach (or per-test):
//   applyConnectionStoreState("paired-live");
//
// Vitest hoisting constraint: vi.mock() only hoists at file top-level, NOT
// when nested in a helper body. So each test file writes its own top-level
// vi.mock(path, factory) referencing this exported factory. The factory object
// is shared; the mock registration stays in each file.
//
// Alternate usage for single-mode files (all tests need the same state):
//   vi.mock("@/stores/connection-store", async () => {
//     const { connectionStoreMockFactory, applyConnectionStoreState }
//       = await import("../../__tests__/mocks/connection-store");
//     applyConnectionStoreState("paired-live");
//     return connectionStoreMockFactory();
//   });
//
// When using this pattern, add afterAll(() => applyConnectionStoreState("unpaired"))
// to reset module-level state for subsequent test files in the same worker.
import { vi } from "vitest";

// Stable ws mock — tests that spy on send/on can import ws from getState().
export const mockWs = {
  send: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnValue(() => {}),
};

export type ConnectionStoreMode =
  | "unpaired"
  | "paired-disconnected"
  | "paired-live";

/** Current state cell — shared across the factory and applyConnectionStoreState. */
const current: { value: ReturnType<typeof buildState> } = {
  value: buildState("unpaired"),
};

export const connectionStoreMockFactory = () => {
  const useConnectionStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(current.value)),
    { getState: () => current.value },
  );
  return { useConnectionStore };
};

export function applyConnectionStoreState(mode: ConnectionStoreMode) {
  current.value = buildState(mode);
  return current.value;
}

function buildState(mode: ConnectionStoreMode) {
  // All fields from ConnectionState_ + ConnectionActions in connection-store.ts
  const base = {
    // state fields
    isPaired: false,
    wsState: "disconnected" as "disconnected" | "connecting" | "connected",
    device: null as { name: string; host: string; port: number; token?: string } | null,
    ws: null as typeof mockWs | null,
    latencyMs: null as number | null,
    peers: [] as { deviceId: string; name: string; connectedAt: number }[],
    currentSlide: null as Record<string, unknown> | null,
    currentService: null as {
      title: string;
      activeIndex: number;
      items: { id: string; title: string; type: string }[];
    } | null,
    currentQueue: null as {
      nowPlaying: { id: string; title: string; artist?: string } | null;
      upNext: { id: string; title: string; artist?: string }[];
      history: { id: string; title: string; artist?: string }[];
    } | null,
    currentAudioStatus: null as {
      position: number;
      duration: number;
      volume: number;
      playing: boolean;
    } | null,
    // action stubs
    init: vi.fn().mockResolvedValue(undefined),
    completePairing: vi.fn().mockResolvedValue(undefined),
    forgetDevice: vi.fn().mockResolvedValue(undefined),
    _setWsState: vi.fn(),
    _setLatency: vi.fn(),
    _setPeers: vi.fn(),
    _setCurrentSlide: vi.fn(),
    _setCurrentService: vi.fn(),
    _setCurrentQueue: vi.fn(),
    _setAudioStatus: vi.fn(),
  };

  if (mode === "paired-disconnected") {
    return {
      ...base,
      isPaired: true,
      wsState: "disconnected" as const,
      device: { name: "LouvorJA", host: "192.168.1.10", port: 7456 },
    };
  }

  if (mode === "paired-live") {
    return {
      ...base,
      isPaired: true,
      wsState: "connected" as const,
      device: { name: "LouvorJA", host: "192.168.1.10", port: 7456 },
      ws: mockWs,
    };
  }

  // "unpaired"
  return base;
}
