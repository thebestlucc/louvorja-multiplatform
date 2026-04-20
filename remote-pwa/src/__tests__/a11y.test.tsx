/**
 * H6 — Accessibility tests (axe-core) for all PWA screens.
 * Each test renders the route component and asserts 0 axe violations.
 *
 * color-contrast rule is disabled: jsdom does not implement HTMLCanvasElement.getContext,
 * which axe-core requires for contrast checks. All other WCAG 2.x rules run.
 */
import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import { configureAxe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";

expect.extend({ toHaveNoViolations });

// axe-core run options: disable color-contrast (canvas not in jsdom).
const axe = configureAxe({
  // "rules" here is passed directly to axe.run() as options.rules
  // format: { ruleId: { enabled: boolean } }
  rules: { "color-contrast": { enabled: false } },
} as Parameters<typeof configureAxe>[0]);

// ---------------------------------------------------------------------------
// Static mocks — vi.mock is hoisted, so all mocks must be at module level.
// ---------------------------------------------------------------------------

vi.mock("@/components/system/qr-scanner", () => ({
  // role="img" required so aria-label is valid on a non-semantic element
  QrScanner: () => <div role="img" data-testid="qr-scanner" aria-label="QR scanner" />,
}));

vi.mock("@/components/system/PinInput", () => ({
  PinInput: ({
    value,
    onChange,
    disabled,
  }: {
    onSubmit?: (v: string) => void;
    value?: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
  }) => (
    <div>
      <label htmlFor="a11y-pin">PIN</label>
      <input
        id="a11y-pin"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
      />
    </div>
  ),
}));

vi.mock("react-i18next", async () => {
  const { i18nMockFactory } = await import("./mocks/i18n");
  return i18nMockFactory();
});

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
  const { connectionStoreMockFactory, applyConnectionStoreState } = await import("./mocks/connection-store");
  applyConnectionStoreState("paired-live");
  return connectionStoreMockFactory();
});

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

vi.mock("@/stores/video-targets-store", () => {
  const state = { targets: ["projector"] as string[], setTargets: vi.fn() };
  return {
    useVideoTargetsStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset shared module-level state so subsequent test files in the same
// Vitest worker start from the default "unpaired" baseline.
afterAll(async () => {
  const { applyConnectionStoreState } = await import("./mocks/connection-store");
  applyConnectionStoreState("unpaired");
});

// ---------------------------------------------------------------------------
// Pair screen
// ---------------------------------------------------------------------------
describe("a11y: Pair screen", () => {
  it("has no axe violations", async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const { default: PairRoute } = await import("../routes/pair");
    const { container } = render(<PairRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Live screen
// ---------------------------------------------------------------------------
describe("a11y: Live screen", () => {
  it("has no axe violations", async () => {
    const { default: LiveRoute } = await import("../routes/live");
    const { container } = render(<LiveRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Search screen
// ---------------------------------------------------------------------------
describe("a11y: Search screen", () => {
  it("has no axe violations", async () => {
    const { default: SearchRoute } = await import("../routes/search");
    const { container } = render(<SearchRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Queue screen
// ---------------------------------------------------------------------------
describe("a11y: Queue screen", () => {
  it("has no axe violations (empty state)", async () => {
    const { default: QueueRoute } = await import("../routes/queue");
    const { container } = render(<QueueRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Service screen
// ---------------------------------------------------------------------------
describe("a11y: Service screen", () => {
  it("has no axe violations (no-service state)", async () => {
    const { default: ServiceRoute } = await import("../routes/service");
    const { container } = render(<ServiceRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Settings screen
// ---------------------------------------------------------------------------
describe("a11y: Settings screen", () => {
  it("has no axe violations", async () => {
    const { default: SettingsRoute } = await import("../routes/settings");
    const { container } = render(<SettingsRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
