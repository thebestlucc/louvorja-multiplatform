import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SettingsRoute from "../settings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "remote.settings.connection_section": "Connection",
        "remote.settings.appearance": "Appearance",
        "remote.settings.forget_device": "Forget device (hold)",
        "remote.settings.about_section": "About",
        "remote.settings.version": "Version",
        "remote.settings.device_name": "Device",
        "remote.settings.server_name": "Server",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockForgetDevice = vi.fn().mockResolvedValue(undefined);

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      isPaired: true,
      device: { name: "LouvorJA", host: "192.168.1.10", port: 7456 },
      wsState: "connected",
      forgetDevice: mockForgetDevice,
    }),
}));

describe("SettingsRoute — G7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
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
});
