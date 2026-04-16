import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock qr-scanner to avoid Worker not defined in jsdom
vi.mock("@/components/system/qr-scanner", () => ({
  QrScanner: () => <div data-testid="qr-scanner" />,
}));

// Mock i18next so translations resolve to readable strings
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

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
    expect(screen.getByText("remote.pair.headline")).toBeInTheDocument();
  });
});
