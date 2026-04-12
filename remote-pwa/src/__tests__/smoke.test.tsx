import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock store and storage to avoid IndexedDB in jsdom
vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: vi.fn(() => ({
    isPaired: false,
    wsState: "disconnected",
    device: null,
    ws: null,
    latencyMs: null,
    init: vi.fn().mockResolvedValue(undefined),
    completePairing: vi.fn(),
    forgetDevice: vi.fn(),
    _setWsState: vi.fn(),
    _setLatency: vi.fn(),
  })),
}));

import App from "../App";

test("renders pair screen on cold load", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/LouvorJA Remote/i)).toBeInTheDocument();
  });
});
