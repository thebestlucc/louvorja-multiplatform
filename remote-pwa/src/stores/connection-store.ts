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

  _setWsState: (wsState) => set({ wsState }),
  _setLatency: (latencyMs) => set({ latencyMs }),

  init: async () => {
    const device = await getDevice();
    if (!device) return;

    const ws = new RemoteWS();
    ws.onStateChange((s) => get()._setWsState(s));

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
    ws.onStateChange((s) => get()._setWsState(s));

    const wsUrl = `ws://${info.host}:${info.port}/ws`;
    ws.connect(wsUrl, info.token);

    set({ isPaired: true, device: info, ws, wsState: "connecting" });
  },

  forgetDevice: async () => {
    await clearDevice();
    const ws = get().ws;
    ws?.disconnect();
    set({ isPaired: false, device: null, ws: null, wsState: "disconnected", latencyMs: null });
  },
}));
