import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PairRoute from "../pair";

// Mock QrScanner
vi.mock("@/components/system/qr-scanner", () => ({
  QrScanner: ({ onScan }: { onScan: (v: string) => void }) => (
    <div data-testid="qr-scanner">
      <button onClick={() => onScan(JSON.stringify({ host: "192.168.1.1", port: 7456, token: "tok123", name: "LouvorJA" }))}>
        simulate scan
      </button>
    </div>
  ),
}));

const mockCompletePairing = vi.fn();
vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({ completePairing: mockCompletePairing }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "remote.pair.pin_invalid": `Invalid. ${opts?.attempts ?? 0} left.`,
        "remote.pair.pin_locked": `Locked ${opts?.seconds ?? 0}s.`,
        "remote.pair.headline": "Pair this device",
        "remote.pair.pin_link": "Enter code manually",
        "remote.pair.pin_placeholder": "6-digit code",
        "remote.pair.scan": "Scan QR",
        "remote.pair.success": "Paired!",
        "remote.pair.find_code_hint": "Find code on your computer",
      };
      return map[key] ?? key;
    },
  }),
}));

// Stub fetch
const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

function successResponse(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }));
}
function errorResponse() {
  return Promise.resolve(new Response("Forbidden", { status: 403 }));
}

describe("PairRoute — G1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders headline and QR scanner", () => {
    render(<PairRoute />);
    expect(screen.getByText("Pair this device")).toBeInTheDocument();
    expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
  });

  it("shows PIN input when switching to manual mode", () => {
    render(<PairRoute />);
    fireEvent.click(screen.getByText("Enter code manually"));
    expect(screen.getByPlaceholderText("6-digit code")).toBeInTheDocument();
  });

  it("calls completePairing on valid QR scan", async () => {
    mockFetch.mockReturnValue(
      successResponse({ deviceId: "d1", deviceToken: "tok", serverName: "LouvorJA" }),
    );
    mockCompletePairing.mockResolvedValue(undefined);
    render(<PairRoute />);
    await act(async () => {
      fireEvent.click(screen.getByText("simulate scan"));
    });
    expect(mockCompletePairing).toHaveBeenCalled();
  });

  it("shows error message when PIN is wrong", async () => {
    mockFetch.mockReturnValue(errorResponse());
    render(<PairRoute />);
    fireEvent.click(screen.getByText("Enter code manually"));
    const input = screen.getByPlaceholderText("6-digit code");
    fireEvent.change(input, { target: { value: "000000" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(screen.getByText(/Invalid/)).toBeInTheDocument();
  });

  it("triggers lockout after 3 failed attempts", async () => {
    mockFetch.mockReturnValue(errorResponse());
    render(<PairRoute />);
    fireEvent.click(screen.getByText("Enter code manually"));
    const input = screen.getByPlaceholderText("6-digit code");

    for (let i = 0; i < 3; i++) {
      fireEvent.change(input, { target: { value: "000000" } });
      await act(async () => {
        fireEvent.submit(input.closest("form")!);
      });
    }

    expect(screen.getByText(/Locked/)).toBeInTheDocument();
  });
});
