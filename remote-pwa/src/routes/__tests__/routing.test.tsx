import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock qr-scanner to avoid Worker not defined in jsdom
vi.mock("@/components/system/qr-scanner", () => ({
  QrScanner: () => <div data-testid="qr-scanner" />,
}));

// Mock i18next so translations resolve to keys (avoids i18n init in jsdom)
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

// Mock the connection store
vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: vi.fn(),
}));
// Mock storage to avoid IndexedDB
vi.mock("@/lib/storage", () => ({
  getDevice: vi.fn().mockResolvedValue(null),
  setDevice: vi.fn(),
  clearDevice: vi.fn(),
}));

import { useConnectionStore } from "@/stores/connection-store";
import App from "../../App";

const mockUseConnectionStore = vi.mocked(useConnectionStore);

function makeStore(isPaired: boolean) {
  const init = vi.fn().mockResolvedValue(undefined);
  return {
    isPaired,
    wsState: "disconnected" as const,
    device: null,
    ws: null,
    latencyMs: null,
    init,
    completePairing: vi.fn(),
    forgetDevice: vi.fn(),
    _setWsState: vi.fn(),
    _setLatency: vi.fn(),
  };
}

describe("Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows pair screen for unauthenticated user", async () => {
    mockUseConnectionStore.mockReturnValue(makeStore(false));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("remote.pair.headline")).toBeInTheDocument();
    });
  });

  it("shows live tab for authenticated user", async () => {
    mockUseConnectionStore.mockReturnValue(makeStore(true));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: "Main navigation" })).toBeInTheDocument();
    });
  });

  it("tab bar has 5 destinations", async () => {
    mockUseConnectionStore.mockReturnValue(makeStore(true));

    render(<App />);
    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(5);
    });
  });

  it("live tab is active by default", async () => {
    mockUseConnectionStore.mockReturnValue(makeStore(true));

    render(<App />);
    await waitFor(() => {
      const liveTab = screen.getByRole("tab", { name: "remote.nav.live" });
      expect(liveTab).toHaveAttribute("aria-selected", "true");
    });
  });
});
