/**
 * Connection store — tracks pairing state, WS connection, and device info.
 *
 * Single source of truth for:
 * - Whether this device is paired
 * - Current WS connection state
 * - The device info (id, token, host, port)
 */

import { create } from "zustand";
import { RemoteWS, type ConnectionState } from "@/lib/ws-client";
import { getDevice, setDevice, clearDevice, type DeviceInfo } from "@/lib/storage";

/** One entry in the multi-operator presence list (H1). */
export interface PeerInfo {
  deviceId: string;
  name: string;
  connectedAt: number;
}

/** Persistent server-pushed state slices — survive route navigation. */
export interface SlidePayload {
  text?: string;
  type?: string;
  title?: string;
  /** Current 0-based index */
  index?: number;
  /** Total number of slides */
  total?: number;
}

export interface ServiceItem {
  id: string;
  title: string;
  type: string;
}

export interface ServiceState {
  title: string;
  activeIndex: number;
  items: ServiceItem[];
}

export interface QueueItem {
  id: string;
  kind?: "hymn" | "bible" | "video" | "presentation";
  title: string;
  artist?: string;
  // Video metadata (only when kind === "video")
  duration?: number;
  videoId?: string;
  thumbnail?: string;
}

export interface QueueState {
  nowPlaying: QueueItem | null;
  upNext: QueueItem[];
  history: QueueItem[];
}

export interface AudioStatus {
  /** Position in seconds */
  position: number;
  /** Duration in seconds */
  duration: number;
  /** Volume 0..1 */
  volume: number;
  /** Whether audio is currently playing */
  playing: boolean;
}

export interface ConnectionState_ {
  /** True once a device token has been stored. */
  isPaired: boolean;
  /** Current WS connection status. */
  wsState: ConnectionState;
  /** The current device info (null until paired). */
  device: DeviceInfo | null;
  /** The WS client instance. */
  ws: RemoteWS | null;
  /** Round-trip latency in ms (updated by pong responses). */
  latencyMs: number | null;
  /** H1: currently connected operator peers (from presence.changed broadcasts). */
  peers: PeerInfo[];
  /** Last received slide.changed payload — persists across route navigation. */
  currentSlide: SlidePayload | null;
  /** Last received service.state payload — persists across route navigation. */
  currentService: ServiceState | null;
  /** Last received queue.state payload — persists across route navigation. */
  currentQueue: QueueState | null;
  /** Last received audio.status payload — persists across route navigation. */
  currentAudioStatus: AudioStatus | null;
}

interface ConnectionActions {
  /** Initialize from IndexedDB — call on app mount. */
  init: () => Promise<void>;
  /** Called after a successful pairing flow. */
  completePairing: (info: DeviceInfo) => Promise<void>;
  /** Forget the device and disconnect. */
  forgetDevice: () => Promise<void>;
  /** Internal — called by WS connection state changes. */
  // TODO(review): _setWsState / _setLatency are public despite "Internal" JSDoc.
  // Zustand has no built-in access control; the _ prefix is idiomatic convention.
  // Consider separating into a private slice in Phase H if external misuse occurs.
  // (ring:code-reviewer, 2026-04-12, Low)
  _setWsState: (s: ConnectionState) => void;
  /** Internal — update latency. */
  _setLatency: (ms: number) => void;
  /** Internal — update presence peer list (H1). */
  _setPeers: (peers: PeerInfo[]) => void;
  /** Internal — update current slide. */
  _setCurrentSlide: (slide: SlidePayload) => void;
  /** Internal — update current service state. Pass null to clear (no active service). */
  _setCurrentService: (service: ServiceState | null) => void;
  /** Internal — update current queue state. */
  _setCurrentQueue: (queue: QueueState) => void;
  /** Internal — update current audio status. */
  _setAudioStatus: (status: AudioStatus) => void;
}

// ─── Payload validators (used inside store handlers) ─────────────────────────

function isValidQueueItem(val: unknown): val is QueueItem {
  return (
    typeof val === "object" &&
    val !== null &&
    "id" in val &&
    typeof (val as Record<string, unknown>).id === "string" &&
    "title" in val &&
    typeof (val as Record<string, unknown>).title === "string"
  );
}

function isValidQueueState(payload: unknown): payload is QueueState {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if ("nowPlaying" in p && p.nowPlaying !== null && !isValidQueueItem(p.nowPlaying)) return false;
  if (!Array.isArray(p.upNext) || !p.upNext.every(isValidQueueItem)) return false;
  if (!Array.isArray(p.history) || !p.history.every(isValidQueueItem)) return false;
  return true;
}

/**
 * Normalize an inbound `audio.status` payload into our `AudioStatus` shape.
 *
 * The backend emits `{ positionMs, durationMs, isPlaying, isPaused, volume, currentFile }`
 * (see `src-tauri/src/remote/handlers/sync.rs`); older codepaths may send
 * `{ position, duration, playing, volume }` directly. Accept both.
 *
 * Returns null if the payload is unrecognizable.
 */
function parseAudioStatus(payload: unknown): AudioStatus | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;

  // Duration: required as a number on the frontend. Backend may send null
  // (before any track is loaded) — treat as 0 so gates depending on it
  // evaluate cleanly.
  const rawDurationMs = p.durationMs;
  const rawPositionMs = p.positionMs;
  const hasBackendShape =
    typeof rawPositionMs === "number" ||
    typeof rawDurationMs === "number" ||
    rawDurationMs === null ||
    typeof p.isPlaying === "boolean";

  if (hasBackendShape) {
    const position = typeof rawPositionMs === "number" ? rawPositionMs / 1000 : 0;
    const duration = typeof rawDurationMs === "number" ? rawDurationMs / 1000 : 0;
    const playing = typeof p.isPlaying === "boolean" ? p.isPlaying : false;
    const volume = typeof p.volume === "number" ? p.volume : 1;
    return { position, duration, playing, volume };
  }

  // Legacy shape fallback.
  if (
    typeof p.position === "number" &&
    typeof p.duration === "number" &&
    typeof p.volume === "number" &&
    typeof p.playing === "boolean"
  ) {
    return {
      position: p.position,
      duration: p.duration,
      volume: p.volume,
      playing: p.playing,
    };
  }

  return null;
}

// TODO(review): `completePairing` and `forgetDevice` action flows have no unit tests.
// Add Zustand store action tests in Phase H (mock IndexedDB + fake RemoteWS).
// (ring:test-reviewer, 2026-04-12, Low)
export const useConnectionStore = create<ConnectionState_ & ConnectionActions>((set, get) => ({
  isPaired: false,
  wsState: "disconnected",
  device: null,
  ws: null,
  latencyMs: null,
  peers: [],
  currentSlide: null,
  currentService: null,
  currentQueue: null,
  currentAudioStatus: null,

  _setWsState: (wsState) => set({ wsState }),
  _setLatency: (latencyMs) => set({ latencyMs }),
  _setPeers: (peers) => set({ peers }),
  _setCurrentSlide: (currentSlide) => set({ currentSlide }),
  _setCurrentService: (currentService) => set({ currentService: currentService ?? null }),
  _setCurrentQueue: (currentQueue) => set({ currentQueue }),
  _setAudioStatus: (currentAudioStatus) => set({ currentAudioStatus }),

  init: async () => {
    const device = await getDevice();
    if (!device) return;

    const ws = new RemoteWS();
    ws.onStateChange((s) => {
      get()._setWsState(s);
      // Re-sync state after every (re)connect so routes are populated.
      if (s === "connected") ws.send("state.sync", {});
    });

    // H1: listen for presence.changed to update peer list.
    ws.on("presence.changed", (payload) => {
      const p = payload as { connections?: PeerInfo[] };
      if (p && Array.isArray(p.connections)) {
        get()._setPeers(p.connections);
      }
    });

    // Persistent server-pushed state — survives route navigation.
    ws.on("slide.changed", (payload) => {
      const p = payload as Record<string, unknown>;
      if (!p || typeof p !== "object") return;
      const d =
        p.slide && typeof p.slide === "object"
          ? (p.slide as Record<string, unknown>)
          : p;
      const rawType =
        typeof d.slideType === "string"
          ? d.slideType
          : typeof d.type === "string"
          ? d.type
          : undefined;
      get()._setCurrentSlide({
        text: typeof d.text === "string" ? d.text : undefined,
        type: rawType,
        title: typeof d.title === "string" ? d.title : undefined,
        index: typeof d.index === "number" ? d.index : undefined,
        total: typeof d.total === "number" ? d.total : undefined,
      });
    });
    ws.on("service.state", (payload) => {
      // Server sends null to signal no active service.
      if (payload === null || payload === undefined) {
        get()._setCurrentService(null);
        return;
      }
      const data = payload as Record<string, unknown>;
      if (!Array.isArray(data.items)) return;
      get()._setCurrentService({
        title: typeof data.title === "string" ? data.title : "",
        activeIndex:
          typeof data.activeIndex === "number" &&
          Number.isInteger(data.activeIndex) &&
          data.activeIndex >= 0
            ? data.activeIndex
            : -1,
        items: data.items.filter(
          (item): item is ServiceItem =>
            item !== null &&
            typeof item === "object" &&
            "id" in item &&
            "title" in item &&
            "type" in item,
        ),
      });
    });
    ws.on("queue.state", (payload) => {
      if (!isValidQueueState(payload)) return;
      get()._setCurrentQueue(payload);
    });
    ws.on("audio.status", (payload) => {
      const status = parseAudioStatus(payload);
      if (!status) return;
      get()._setAudioStatus(status);
    });

    // TODO(review): Add basic host/port validation before connecting — malformed data
    // stored in IndexedDB (e.g. empty host) could cause an infinite reconnect storm.
    // (ring:business-logic-reviewer, 2026-04-12, Low)
    const wsUrl = `ws://${device.host}:${device.port}/ws`;
    ws.connect(wsUrl, device.token);

    set({ isPaired: true, device, ws });
  },

  completePairing: async (info) => {
    await setDevice(info);

    // Disconnect any existing connection
    const existing = get().ws;
    existing?.disconnect();

    const ws = new RemoteWS();
    ws.onStateChange((s) => {
      get()._setWsState(s);
      // Re-sync state after every (re)connect so routes are populated.
      if (s === "connected") ws.send("state.sync", {});
    });

    // H1: listen for presence.changed to update peer list.
    ws.on("presence.changed", (payload) => {
      const p = payload as { connections?: PeerInfo[] };
      if (p && Array.isArray(p.connections)) {
        get()._setPeers(p.connections);
      }
    });

    // Persistent server-pushed state — survives route navigation.
    ws.on("slide.changed", (payload) => {
      const p = payload as Record<string, unknown>;
      if (!p || typeof p !== "object") return;
      const d =
        p.slide && typeof p.slide === "object"
          ? (p.slide as Record<string, unknown>)
          : p;
      const rawType =
        typeof d.slideType === "string"
          ? d.slideType
          : typeof d.type === "string"
          ? d.type
          : undefined;
      get()._setCurrentSlide({
        text: typeof d.text === "string" ? d.text : undefined,
        type: rawType,
        title: typeof d.title === "string" ? d.title : undefined,
        index: typeof d.index === "number" ? d.index : undefined,
        total: typeof d.total === "number" ? d.total : undefined,
      });
    });
    ws.on("service.state", (payload) => {
      // Server sends null to signal no active service.
      if (payload === null || payload === undefined) {
        get()._setCurrentService(null);
        return;
      }
      const data = payload as Record<string, unknown>;
      if (!Array.isArray(data.items)) return;
      get()._setCurrentService({
        title: typeof data.title === "string" ? data.title : "",
        activeIndex:
          typeof data.activeIndex === "number" &&
          Number.isInteger(data.activeIndex) &&
          data.activeIndex >= 0
            ? data.activeIndex
            : -1,
        items: data.items.filter(
          (item): item is ServiceItem =>
            item !== null &&
            typeof item === "object" &&
            "id" in item &&
            "title" in item &&
            "type" in item,
        ),
      });
    });
    ws.on("queue.state", (payload) => {
      if (!isValidQueueState(payload)) return;
      get()._setCurrentQueue(payload);
    });
    ws.on("audio.status", (payload) => {
      const status = parseAudioStatus(payload);
      if (!status) return;
      get()._setAudioStatus(status);
    });

    const wsUrl = `ws://${info.host}:${info.port}/ws`;

    ws.connect(wsUrl, info.token);

    set({ isPaired: true, device: info, ws, wsState: "connecting" });
  },

  forgetDevice: async () => {
    // Gracefully revoke the device token on the server side before clearing
    // local state. If the fetch fails we still clear — forget is always local.
    const { device } = get();
    if (device) {
      try {
        await fetch(`http://${device.host}:${device.port}/pair/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceToken: device.token }),
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // Network error or timeout — proceed with local forget anyway.
      }
    }
    await clearDevice();
    const ws = get().ws;
    ws?.disconnect();
    set({
      isPaired: false,
      device: null,
      ws: null,
      wsState: "disconnected",
      latencyMs: null,
      peers: [],
      currentSlide: null,
      currentService: null,
      currentQueue: null,
      currentAudioStatus: null,
    });
  },
}));
