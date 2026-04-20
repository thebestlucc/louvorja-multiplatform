import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock qr-scanner to avoid Worker not defined in jsdom
vi.mock("@/components/system/qr-scanner", () => ({
  QrScanner: () => <div data-testid="qr-scanner" />,
}));

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("./mocks/i18n");
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
  const { connectionStoreMockFactory, applyConnectionStoreState } =
    await import("./mocks/connection-store");
  applyConnectionStoreState("unpaired");
  return connectionStoreMockFactory();
});

import App from "../App";

test("renders pair screen on cold load", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText("Pair this device")).toBeInTheDocument();
  });
});
