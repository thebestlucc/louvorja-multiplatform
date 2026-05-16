/**
 * Unit tests for useWakeLock hook.
 *
 * Mocks navigator.wakeLock and navigator.getBattery to verify:
 * 1. Acquires lock when shouldAcquire is true.
 * 2. Re-acquires on visibilitychange (visible).
 * 3. Releases on cleanup.
 * 4. Does not acquire when wakeLock API is absent.
 * 5. Auto-releases when battery level drops below 15%.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks (set up before module imports) ─────────────────────────────────────

// Mock zustand stores so we can control shouldAcquire.
let mockWakeLockEnabled = true;
let mockWsState = "connected";

vi.mock("@/stores/preferences-store", () => ({
  usePreferencesStore: (selector: (s: { wakeLock: boolean }) => unknown) =>
    selector({ wakeLock: mockWakeLockEnabled }),
}));

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: { wsState: string }) => unknown) =>
    selector({ wsState: mockWsState }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockSentinel() {
  const sentinel = {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    released: false,
  };
  return sentinel;
}

function makeMockWakeLock(sentinel: ReturnType<typeof makeMockSentinel>) {
  return {
    request: vi.fn().mockResolvedValue(sentinel),
  };
}

function makeMockBattery(level = 1.0) {
  const listeners: Array<() => void> = [];
  return {
    level,
    addEventListener: vi.fn((_type: string, cb: () => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    _triggerLevelChange(newLevel: number) {
      this.level = newLevel;
      listeners.forEach((cb) => cb());
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useWakeLock", () => {
  let sentinel: ReturnType<typeof makeMockSentinel>;
  let mockWakeLock: ReturnType<typeof makeMockWakeLock>;

  beforeEach(() => {
    mockWakeLockEnabled = true;
    mockWsState = "connected";
    sentinel = makeMockSentinel();
    mockWakeLock = makeMockWakeLock(sentinel);
    Object.defineProperty(navigator, "wakeLock", {
      value: mockWakeLock,
      writable: true,
      configurable: true,
    });
    // Default: no battery API.
    Object.defineProperty(navigator, "getBattery", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("acquires wake lock when enabled and connected", async () => {
    const { useWakeLock } = await import("../use-wake-lock");
    const { unmount } = renderHook(() => useWakeLock());

    // Wait for async acquire.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLock.request).toHaveBeenCalledWith("screen");
    unmount();
  });

  it("does NOT acquire when wakeLock pref is disabled", async () => {
    mockWakeLockEnabled = false;
    const { useWakeLock } = await import("../use-wake-lock");
    const { unmount } = renderHook(() => useWakeLock());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLock.request).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT acquire when WS is not connected", async () => {
    mockWsState = "disconnected";
    const { useWakeLock } = await import("../use-wake-lock");
    const { unmount } = renderHook(() => useWakeLock());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLock.request).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT acquire when wakeLock API is absent", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { useWakeLock } = await import("../use-wake-lock");
    const { unmount } = renderHook(() => useWakeLock());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLock.request).not.toHaveBeenCalled();
    unmount();
  });

  it("re-acquires on visibilitychange to visible", async () => {
    const { useWakeLock } = await import("../use-wake-lock");
    renderHook(() => useWakeLock());

    await act(async () => {
      await Promise.resolve();
    });

    const callsBefore = mockWakeLock.request.mock.calls.length;

    // Simulate tab becoming visible again.
    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(mockWakeLock.request.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("releases lock on unmount", async () => {
    const { useWakeLock } = await import("../use-wake-lock");
    const { unmount } = renderHook(() => useWakeLock());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("auto-releases when battery drops below 15%", async () => {
    const battery = makeMockBattery(1.0);
    Object.defineProperty(navigator, "getBattery", {
      value: vi.fn().mockResolvedValue(battery),
      writable: true,
      configurable: true,
    });

    const { useWakeLock } = await import("../use-wake-lock");
    renderHook(() => useWakeLock());

    await act(async () => {
      // Allow setupBattery + acquire to settle.
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockWakeLock.request).toHaveBeenCalledTimes(1);

    // Battery drops below 15%.
    await act(async () => {
      battery._triggerLevelChange(0.10);
      await Promise.resolve();
    });

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("skips acquire if battery is already below 15% on setup", async () => {
    const battery = makeMockBattery(0.10);
    Object.defineProperty(navigator, "getBattery", {
      value: vi.fn().mockResolvedValue(battery),
      writable: true,
      configurable: true,
    });

    const { useWakeLock } = await import("../use-wake-lock");
    renderHook(() => useWakeLock());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockWakeLock.request).not.toHaveBeenCalled();
  });
});
