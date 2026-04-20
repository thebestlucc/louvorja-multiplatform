import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock qr-scanner to avoid Worker not defined in jsdom
vi.mock("@/components/system/qr-scanner", () => ({
  QrScanner: () => <div data-testid="qr-scanner" />,
}));

// vi.mock is hoisted — factories must use inline async imports, not top-level imports.
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

vi.mock("@/stores/connection-store", async () => {
  const { connectionStoreMockFactory } = await import("../../__tests__/mocks/connection-store");
  return connectionStoreMockFactory();
});

// Mock storage to avoid IndexedDB
vi.mock("@/lib/storage", () => ({
  getDevice: vi.fn().mockResolvedValue(null),
  setDevice: vi.fn(),
  clearDevice: vi.fn(),
}));

import { applyConnectionStoreState } from "../../__tests__/mocks/connection-store";
import App from "../../App";

describe("Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows pair screen for unauthenticated user", async () => {
    applyConnectionStoreState("unpaired");

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Pair this device")).toBeInTheDocument();
    });
  });

  it("shows live tab for authenticated user", async () => {
    applyConnectionStoreState("paired-disconnected");

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: "Main navigation" })).toBeInTheDocument();
    });
  });

  it("tab bar has 5 destinations", async () => {
    applyConnectionStoreState("paired-disconnected");

    render(<App />);
    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(5);
    });
  });

  it("live tab is active by default", async () => {
    applyConnectionStoreState("paired-disconnected");

    render(<App />);
    await waitFor(() => {
      const liveTab = screen.getByRole("tab", { name: "remote.nav.live" });
      expect(liveTab).toHaveAttribute("aria-selected", "true");
    });
  });
});
