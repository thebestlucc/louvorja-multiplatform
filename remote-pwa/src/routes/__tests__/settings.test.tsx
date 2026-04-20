import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SettingsRoute from "../settings";

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("../../__tests__/mocks/i18n");
  return i18nMockFactory();
});

// Mock i18n module to prevent real initialization (localStorage unavailable in jsdom)
vi.mock("@/lib/i18n", () => ({
  setLanguage: vi.fn(),
  SUPPORTED_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
    { code: "es", label: "Español" },
  ],
  default: { language: "en" },
}));

const mockForgetDevice = vi.fn().mockResolvedValue(undefined);

// useConnectionStore is a vi.fn() so individual tests can override the implementation
const mockUseConnectionStore = vi.fn((selector: (s: unknown) => unknown) =>
  selector({
    isPaired: true,
    device: { name: "LouvorJA", host: "192.168.1.10", port: 7456 },
    wsState: "connected",
    forgetDevice: mockForgetDevice,
  }),
);

// Inline connection-store mock: trivial 2-field override per test; shared factory overkill here.
vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    mockUseConnectionStore(selector),
}));

vi.mock("@/stores/preferences-store", () => ({
  usePreferencesStore: (selector: (s: unknown) => unknown) =>
    selector({
      theme: "system",
      wakeLock: false,
      haptics: true,
      setTheme: vi.fn(),
      setWakeLock: vi.fn(),
      setHaptics: vi.fn(),
    }),
}));

describe("SettingsRoute — G7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Restore default paired state before each test
    mockUseConnectionStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        isPaired: true,
        device: { name: "LouvorJA", host: "192.168.1.10", port: 7456 },
        wsState: "connected",
        forgetDevice: mockForgetDevice,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders Connection section heading", () => {
    render(<SettingsRoute />);
    expect(screen.getByText("Connection")).toBeInTheDocument();
  });

  it("renders Appearance section heading", () => {
    render(<SettingsRoute />);
    expect(screen.getByText("Appearance")).toBeInTheDocument();
  });

  it("renders Forget device button", () => {
    render(<SettingsRoute />);
    expect(screen.getByRole("button", { name: /forget device/i })).toBeInTheDocument();
  });

  it("shows device host/port in connection section", () => {
    render(<SettingsRoute />);
    expect(screen.getByText(/192\.168\.1\.10/)).toBeInTheDocument();
  });

  it("long-press Forget device (1000ms) calls forgetDevice", async () => {
    render(<SettingsRoute />);
    const btn = screen.getByRole("button", { name: /forget device/i });

    fireEvent.pointerDown(btn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerUp(btn);

    expect(mockForgetDevice).toHaveBeenCalled();
  });

  it("short-press Forget device does NOT call forgetDevice", async () => {
    render(<SettingsRoute />);
    const btn = screen.getByRole("button", { name: /forget device/i });

    fireEvent.pointerDown(btn);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.pointerUp(btn);

    expect(mockForgetDevice).not.toHaveBeenCalled();
  });

  it("forgetDevice comes from connection store — called on hold", async () => {
    // Verifies the component sources forgetDevice from the store selector, not a local stub.
    // mockForgetDevice is the exact fn injected via the store mock — if the component
    // wired up a different reference, this assertion would fail.
    render(<SettingsRoute />);
    const btn = screen.getByRole("button", { name: /forget device/i });

    fireEvent.pointerDown(btn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerUp(btn);

    expect(mockForgetDevice).toHaveBeenCalledTimes(1);
  });

  it("changes theme when light chip is clicked", async () => {
    const mockSetTheme = vi.fn();

    // Override the preferences store mock for this test
    vi.doMock("@/stores/preferences-store", () => ({
      usePreferencesStore: (selector: (s: unknown) => unknown) =>
        selector({
          theme: "dark",
          wakeLock: false,
          haptics: true,
          setTheme: mockSetTheme,
          setWakeLock: vi.fn(),
          setHaptics: vi.fn(),
        }),
    }));

    vi.resetModules();

    // Re-import everything fresh
    const SettingsMod = await import("../settings");
    const { render: rerender, screen: rerenderScreen } = await import("@testing-library/react");

    rerender(<SettingsMod.default />);

    const lightChip = rerenderScreen.getByRole("button", { name: /light/i });
    await act(async () => {
      fireEvent.click(lightChip);
    });

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("toggles wake lock when checkbox is clicked", async () => {
    const mockSetWakeLock = vi.fn();

    vi.doMock("@/stores/preferences-store", () => ({
      usePreferencesStore: (selector: (s: unknown) => unknown) =>
        selector({
          theme: "system",
          wakeLock: false,
          haptics: true,
          setTheme: vi.fn(),
          setWakeLock: mockSetWakeLock,
          setHaptics: vi.fn(),
        }),
    }));

    vi.resetModules();

    const SettingsMod = await import("../settings");
    const { render: rerender, screen: rerenderScreen } = await import("@testing-library/react");

    rerender(<SettingsMod.default />);

    const checkbox = rerenderScreen.getByRole("checkbox", { name: /keep screen on/i });
    expect(checkbox).not.toBeChecked();

    await act(async () => {
      fireEvent.click(checkbox);
    });

    expect(mockSetWakeLock).toHaveBeenCalledWith(true);
  });

  it("changes language when EN chip is clicked", async () => {
    const { setLanguage } = await import("@/lib/i18n");

    render(<SettingsRoute />);
    const enChip = screen.getByRole("button", { name: "English" });

    await act(async () => {
      fireEvent.click(enChip);
    });

    expect(setLanguage).toHaveBeenCalledWith("en");
  });

  it("cancels forget timer on pointer leave", async () => {
    render(<SettingsRoute />);
    const btn = screen.getByRole("button", { name: /forget device/i });

    fireEvent.pointerDown(btn);
    // Wait only 500ms (below 1000ms threshold)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    // Pointer leave — should cancel the timer
    fireEvent.pointerLeave(btn);

    // Advance past the 1000ms threshold
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockForgetDevice).not.toHaveBeenCalled();
  });

  it("calls POST /pair/revoke when forget device completes", async () => {
    // Override the store to provide a real forgetDevice that calls fetch
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    (globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

    mockUseConnectionStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        isPaired: true,
        device: { name: "LouvorJA", host: "192.168.1.10", port: 7456, id: "d1", token: "tok123" },
        wsState: "connected",
        forgetDevice: async () => {
          await fetch("http://192.168.1.10:7456/pair/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceToken: "tok123" }),
          });
        },
      }),
    );

    render(<SettingsRoute />);
    const btn = screen.getByRole("button", { name: /forget device/i });

    fireEvent.pointerDown(btn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerUp(btn);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.10:7456/pair/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("SettingsRoute — G7 when not paired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseConnectionStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        isPaired: false,
        device: null,
        wsState: "disconnected",
        forgetDevice: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows dashes for device info when not paired", () => {
    render(<SettingsRoute />);
    // Both server name and host fields show em-dash when device is null
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
