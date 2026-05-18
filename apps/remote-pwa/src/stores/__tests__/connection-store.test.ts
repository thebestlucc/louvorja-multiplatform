/**
 * Unit tests for remote-pwa/src/stores/connection-store.ts
 *
 * Mocks:
 * - @/lib/ws-client (RemoteWS)
 * - @/lib/storage (getDevice, setDevice, clearDevice)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockWsConnect = vi.fn();
const mockWsDisconnect = vi.fn();
const mockWsOnStateChange = vi.fn().mockReturnValue(() => {});
const mockWsSend = vi.fn().mockResolvedValue(undefined);

// Track registered op→callback pairs so tests can simulate incoming events.
const wsOnHandlers: Record<string, ((payload: unknown) => void)[]> = {};
const mockWsOn = vi.fn().mockImplementation((op: string, cb: (payload: unknown) => void) => {
  if (!wsOnHandlers[op]) wsOnHandlers[op] = [];
  wsOnHandlers[op].push(cb);
  return () => {};
});

/** Fire all registered handlers for an op with the given payload. */
function simulateWsEvent(op: string, payload: unknown) {
  (wsOnHandlers[op] ?? []).forEach((cb) => cb(payload));
}

class MockRemoteWS {
  connect = mockWsConnect;
  disconnect = mockWsDisconnect;
  onStateChange = mockWsOnStateChange;
  on = mockWsOn;
  send = mockWsSend;
}

vi.mock("@/lib/ws-client", () => ({
  RemoteWS: MockRemoteWS,
  ConnectionState: undefined as never,
}));

const mockGetDevice = vi.fn();
const mockSetDevice = vi.fn().mockResolvedValue(undefined);
const mockClearDevice = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/storage", () => ({
  getDevice: () => mockGetDevice(),
  setDevice: (info: unknown) => mockSetDevice(info),
  clearDevice: () => mockClearDevice(),
}));

// Mock fetch for forgetDevice revoke call
const mockFetch = vi.fn().mockResolvedValue({ ok: true });

// ─── Store import (after mocks) ──────────────────────────────────────────────

let useConnectionStore: typeof import("../connection-store").useConnectionStore;

beforeEach(async () => {
  vi.clearAllMocks();
  mockWsSend.mockResolvedValue(undefined);
  // Clear captured handlers between tests.
  for (const key of Object.keys(wsOnHandlers)) {
    delete wsOnHandlers[key];
  }
  mockFetch.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", mockFetch);
  vi.resetModules();
  const mod = await import("../connection-store");
  useConnectionStore = mod.useConnectionStore;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ConnectionStore", () => {
  describe("init", () => {
    it("loads saved device and sets isPaired true", async () => {
      const device = {
        id: "dev-1",
        token: "tok123",
        host: "192.168.1.10",
        port: 7456,
        name: "LouvorJA",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      expect(mockGetDevice).toHaveBeenCalled();
      expect(mockSetDevice).not.toHaveBeenCalled();
      expect(mockWsConnect).toHaveBeenCalledWith(
        "ws://192.168.1.10:7456/ws",
        "tok123",
      );

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(true);
      expect(state.device).toEqual(device);
      expect(state.ws).not.toBeNull();
    });

    it("with no saved device leaves isPaired false", async () => {
      mockGetDevice.mockResolvedValue(null);

      const store = useConnectionStore.getState();
      await store.init();

      expect(mockGetDevice).toHaveBeenCalled();
      expect(mockWsConnect).not.toHaveBeenCalled();

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(false);
      expect(state.device).toBeNull();
      expect(state.ws).toBeNull();
    });
  });

  describe("connect", () => {
    it("updates host/port and calls wsClient.connect", async () => {
      // First init with no device so we have a clean state
      mockGetDevice.mockResolvedValue(null);
      const store = useConnectionStore.getState();
      await store.init();

      // Now manually set host/port — the store doesn't have a `connect` action,
      // so we verify the flow through completePairing which creates the WS connection
      const device = {
        id: "dev-2",
        token: "tok456",
        host: "10.0.0.5",
        port: 8080,
        name: "TestDevice",
      };

      await store.completePairing(device);

      expect(mockSetDevice).toHaveBeenCalledWith(device);
      expect(mockWsConnect).toHaveBeenCalledWith("ws://10.0.0.5:8080/ws", "tok456");

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(true);
      expect(state.device).toEqual(device);
      expect(state.wsState).toBe("connecting");
    });
  });

  describe("disconnect", () => {
    it("disconnects existing WS when forgetDevice is called", async () => {
      // Set up a paired device
      const device = {
        id: "dev-3",
        token: "tok789",
        host: "192.168.1.20",
        port: 7456,
        name: "Device3",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      expect(mockWsDisconnect).not.toHaveBeenCalled();

      await store.forgetDevice();

      expect(mockWsDisconnect).toHaveBeenCalled();
      expect(mockClearDevice).toHaveBeenCalled();

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(false);
      expect(state.device).toBeNull();
      expect(state.ws).toBeNull();
      expect(state.wsState).toBe("disconnected");
      expect(state.latencyMs).toBeNull();
    });
  });

  describe("completePairing", () => {
    it("saves device and updates state", async () => {
      mockGetDevice.mockResolvedValue(null);
      const store = useConnectionStore.getState();
      await store.init();

      const device = {
        id: "dev-4",
        token: "newtok",
        host: "172.16.0.1",
        port: 9000,
        name: "NewDevice",
      };

      await store.completePairing(device);

      expect(mockSetDevice).toHaveBeenCalledWith(device);
      expect(mockWsConnect).toHaveBeenCalledWith("ws://172.16.0.1:9000/ws", "newtok");

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(true);
      expect(state.device).toEqual(device);
      expect(state.ws).not.toBeNull();
      expect(state.wsState).toBe("connecting");
    });

    it("disconnects existing WS before creating new one", async () => {
      // Start with a paired device
      const oldDevice = {
        id: "dev-old",
        token: "oldtok",
        host: "10.0.0.1",
        port: 7456,
        name: "OldDevice",
      };
      mockGetDevice.mockResolvedValue(oldDevice);

      const store = useConnectionStore.getState();
      await store.init();

      const newDevice = {
        id: "dev-new",
        token: "newtok",
        host: "10.0.0.2",
        port: 8080,
        name: "NewDevice",
      };

      await store.completePairing(newDevice);

      expect(mockWsDisconnect).toHaveBeenCalledTimes(1);
      expect(mockSetDevice).toHaveBeenCalledWith(newDevice);
    });
  });

  describe("forgetDevice", () => {
    it("revokes via fetch and clears state", async () => {
      const device = {
        id: "dev-5",
        token: "revoke-tok",
        host: "192.168.1.50",
        port: 7456,
        name: "ToRevoke",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      await store.forgetDevice();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://192.168.1.50:7456/pair/revoke",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceToken: "revoke-tok" }),
          signal: expect.any(AbortSignal),
        },
      );
      expect(mockClearDevice).toHaveBeenCalled();

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(false);
      expect(state.device).toBeNull();
      expect(state.wsState).toBe("disconnected");
    });

    it("clears state even if fetch fails", async () => {
      const device = {
        id: "dev-6",
        token: "fail-tok",
        host: "192.168.1.60",
        port: 7456,
        name: "FailDevice",
      };
      mockGetDevice.mockResolvedValue(device);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const store = useConnectionStore.getState();
      await store.init();

      await store.forgetDevice();

      expect(mockFetch).toHaveBeenCalled();
      expect(mockClearDevice).toHaveBeenCalled();

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(false);
      expect(state.device).toBeNull();
    });

    it("works when no device is stored (no-op revoke)", async () => {
      mockGetDevice.mockResolvedValue(null);

      const store = useConnectionStore.getState();
      await store.init();

      await store.forgetDevice();

      // No fetch should be called when there's no device
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockClearDevice).toHaveBeenCalled();

      const state = useConnectionStore.getState();
      expect(state.isPaired).toBe(false);
    });
  });

  describe("wsState updates", () => {
    it("_setWsState updates wsState in store", async () => {
      mockGetDevice.mockResolvedValue(null);

      const store = useConnectionStore.getState();
      await store.init();

      expect(useConnectionStore.getState().wsState).toBe("disconnected");

      store._setWsState("connecting");
      expect(useConnectionStore.getState().wsState).toBe("connecting");

      store._setWsState("connected");
      expect(useConnectionStore.getState().wsState).toBe("connected");

      store._setWsState("reconnecting");
      expect(useConnectionStore.getState().wsState).toBe("reconnecting");
    });

    it("_setLatency updates latencyMs in store", async () => {
      mockGetDevice.mockResolvedValue(null);

      const store = useConnectionStore.getState();
      await store.init();

      expect(useConnectionStore.getState().latencyMs).toBeNull();

      store._setLatency(42);
      expect(useConnectionStore.getState().latencyMs).toBe(42);

      store._setLatency(15);
      expect(useConnectionStore.getState().latencyMs).toBe(15);
    });
  });

  describe("H1 presence", () => {
    it("starts with empty peers list", async () => {
      mockGetDevice.mockResolvedValue(null);
      const store = useConnectionStore.getState();
      await store.init();

      expect(useConnectionStore.getState().peers).toEqual([]);
    });

    it("_setPeers updates operators list", async () => {
      mockGetDevice.mockResolvedValue(null);
      const store = useConnectionStore.getState();
      await store.init();

      const operators = [
        { deviceId: "d1", name: "Ana", connectedAt: 1700000000 },
        { deviceId: "d2", name: "Pedro", connectedAt: 1700000010 },
      ];
      store._setPeers(operators);

      expect(useConnectionStore.getState().peers).toEqual(operators);
    });

    it("presence.changed WS event updates peers via init()", async () => {
      const device = {
        id: "dev-presence",
        token: "tok-presence",
        host: "192.168.1.100",
        port: 7456,
        name: "PresenceDevice",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      expect(mockWsOn).toHaveBeenCalledWith("presence.changed", expect.any(Function));

      const incoming = [
        { deviceId: "d3", name: "Maria", connectedAt: 1700000020 },
      ];
      simulateWsEvent("presence.changed", { connections: incoming });

      expect(useConnectionStore.getState().peers).toEqual(incoming);
    });

    it("presence.changed WS event updates peers via completePairing()", async () => {
      mockGetDevice.mockResolvedValue(null);
      const store = useConnectionStore.getState();
      await store.init();

      const device = {
        id: "dev-cp",
        token: "tok-cp",
        host: "10.0.0.1",
        port: 7456,
        name: "CPDevice",
      };
      await store.completePairing(device);

      const incoming = [{ deviceId: "d4", name: "Lucas", connectedAt: 1700000030 }];
      simulateWsEvent("presence.changed", { connections: incoming });

      expect(useConnectionStore.getState().peers).toEqual(incoming);
    });

    it("presence.changed with non-array connections payload is ignored", async () => {
      const device = {
        id: "dev-bad",
        token: "tok-bad",
        host: "192.168.1.200",
        port: 7456,
        name: "BadPayload",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      // Seed some peers first.
      store._setPeers([{ deviceId: "existing", name: "Existing", connectedAt: 1 }]);

      // Simulate malformed payload — should not wipe peers.
      simulateWsEvent("presence.changed", { connections: "not-an-array" });

      expect(useConnectionStore.getState().peers).toEqual([
        { deviceId: "existing", name: "Existing", connectedAt: 1 },
      ]);
    });

    it("alert.changed WS event updates currentAlert", async () => {
      const device = {
        id: "dev-alert",
        token: "tok-alert",
        host: "192.168.1.111",
        port: 7456,
        name: "AlertDevice",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      expect(mockWsOn).toHaveBeenCalledWith("alert.changed", expect.any(Function));

      simulateWsEvent("alert.changed", {
        text: "Service starts in 5 minutes",
        isVisible: true,
        isTicker: true,
      });

      expect(useConnectionStore.getState().currentAlert).toEqual({
        text: "Service starts in 5 minutes",
        isVisible: true,
        isTicker: true,
      });
    });

    it("freeze.changed WS event updates frozen", async () => {
      const device = {
        id: "dev-freeze",
        token: "tok-freeze",
        host: "192.168.1.112",
        port: 7456,
        name: "FreezeDevice",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      expect(mockWsOn).toHaveBeenCalledWith("freeze.changed", expect.any(Function));

      simulateWsEvent("freeze.changed", { frozen: true });
      expect(useConnectionStore.getState().frozen).toBe(true);

      simulateWsEvent("freeze.changed", { frozen: false });
      expect(useConnectionStore.getState().frozen).toBe(false);
    });

    it("forgetDevice clears peers", async () => {
      const device = {
        id: "dev-forget",
        token: "tok-forget",
        host: "192.168.1.77",
        port: 7456,
        name: "ForgetDevice",
      };
      mockGetDevice.mockResolvedValue(device);

      const store = useConnectionStore.getState();
      await store.init();

      store._setPeers([{ deviceId: "d5", name: "Beatriz", connectedAt: 1700000040 }]);
      expect(useConnectionStore.getState().peers.length).toBe(1);

      await store.forgetDevice();

      expect(useConnectionStore.getState().peers).toEqual([]);
    });
  });
});
