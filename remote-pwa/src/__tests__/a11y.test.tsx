/**
 * H6 — Accessibility tests (axe-core) for all PWA screens.
 * Each test renders the route component and asserts 0 axe violations.
 *
 * color-contrast rule is disabled: jsdom does not implement HTMLCanvasElement.getContext,
 * which axe-core requires for contrast checks. All other WCAG 2.x rules run.
 */
import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        // pair
        "remote.pair.headline": "Pair this device",
        "remote.pair.pin_link": "Enter code manually",
        "remote.pair.pin_placeholder": "6-digit code",
        "remote.pair.scan": "Scan QR",
        "remote.pair.success": "Paired!",
        "remote.pair.redirecting": "Redirecting...",
        "remote.pair.find_code_hint": "Find code on your computer",
        "remote.pair.camera_denied": "Camera access denied",
        "remote.pair.torch": "Toggle torch",
        "remote.pair.pair_button": "Pair",
        "remote.pair.pin_invalid": `Invalid. ${opts?.attempts ?? 0} left.`,
        "remote.pair.pin_locked": `Locked ${opts?.seconds ?? 0}s.`,
        // live
        "remote.live.prev": "Prev",
        "remote.live.next": "Next",
        "remote.live.black": "Black screen",
        "remote.live.logo": "Logo screen",
        "remote.live.clear": "Clear overlay",
        "remote.live.all_slides": "All slides",
        "remote.live.no_slide": "Waiting for content",
        "remote.live.connected": "Connected",
        "remote.live.disconnected": "Disconnected",
        "remote.live.reconnecting": "Reconnecting",
        "remote.live.swipe_up_hint": "Swipe up for all slides",
        "remote.live.close_grid": "Close grid",
        "remote.live.slide_counter": "Slide {{n}} of {{total}}",
        "remote.live.peers": `${opts?.count ?? 0} connected`,
        // search
        "remote.search.tab_hymns": "Hymns",
        "remote.search.tab_bible": "Bible",
        "remote.search.tab_services": "Services",
        "remote.search.placeholder_hymns": "Search hymns…",
        "remote.search.placeholder_bible": "Book, chapter, verse…",
        "remote.search.placeholder_service": "Search services…",
        "remote.search.results_count": `${opts?.n ?? 0} results`,
        "remote.search.no_results": "No results",
        "remote.search.add_to_service": "Add to service",
        // queue
        "remote.queue.now_playing": "Now playing",
        "remote.queue.up_next": "Up next",
        "remote.queue.history": "History",
        "remote.queue.empty": "Queue is empty",
        "remote.queue.play_next": "Play next",
        "remote.queue.remove": "Remove",
        "remote.queue.play": "Play",
        "remote.queue.pause": "Pause",
        "remote.queue.skip_prev": "Skip previous",
        "remote.queue.skip_next": "Skip next",
        "remote.queue.seek": "Seek",
        "remote.queue.volume": "Volume",
        "remote.queue.video_targets": "Video targets",
        "remote.queue.target_projector": "Projector",
        "remote.queue.target_return": "Return",
        // service
        "remote.service.start": "Start service",
        "remote.service.stop": "Stop service",
        "remote.service.next_item": "Next item",
        "remote.service.prev_item": "Previous item",
        "remote.service.no_service": "No active service",
        "remote.service.item_count": "items",
        // settings
        "remote.settings.connection_section": "Connection",
        "remote.settings.appearance": "Appearance",
        "remote.settings.behavior_section": "Behavior",
        "remote.settings.forget_device": "Forget device (hold)",
        "remote.settings.forget_device_hint": "Hold for 1 second to confirm",
        "remote.settings.about_section": "About",
        "remote.settings.version": "Version",
        "remote.settings.device_name": "Device",
        "remote.settings.server_name": "Server",
        "remote.settings.host": "Host",
        "remote.settings.status": "Status",
        "remote.settings.theme": "Theme",
        "remote.settings.theme_light": "Light",
        "remote.settings.theme_dark": "Dark",
        "remote.settings.theme_auto": "System",
        "remote.settings.wake_lock": "Keep screen on",
        "remote.settings.wake_lock_hint": "Prevents sleep while connected",
        "remote.settings.haptics": "Haptic feedback",
        "remote.settings.haptics_hint": "Vibrate on button press",
        "remote.settings.app_name": "LouvorJA Remote",
        "remote.settings.desktop_link": "Get the desktop app",
        "remote.settings.language_section": "Language",
        "remote.settings.language": "Language",
        "remote.title": "LouvorJA Remote",
      };
      return map[key] ?? key;
    },
    i18n: { language: "en" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/i18n", () => ({
  setLanguage: vi.fn(),
  SUPPORTED_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
    { code: "es", label: "Español" },
  ],
  default: { language: "en" },
}));

// Single connection-store mock that includes all fields used across screens.
const mockSend = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn().mockReturnValue(() => {});

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      isPaired: true,
      wsState: "connected",
      ws: { send: mockSend, on: mockOn },
      device: { name: "LouvorJA", host: "192.168.1.10", port: 7456 },
      peers: [],
      latencyMs: null,
      completePairing: vi.fn(),
      forgetDevice: vi.fn().mockResolvedValue(undefined),
      _setWsState: vi.fn(),
      _setLatency: vi.fn(),
    }),
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
