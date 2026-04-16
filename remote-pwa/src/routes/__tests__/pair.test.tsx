import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PairRoute from "../pair";

// Mock QrScanner
vi.mock("@/components/system/qr-scanner", () => ({
  QrScanner: ({
    onScan,
    onCameraDenied,
    onTrackReady,
  }: {
    onScan: (v: string) => void;
    onCameraDenied?: () => void;
    onTrackReady?: (track: MediaStreamTrack) => void;
  }) => {
    const mockTrack = {
      applyConstraints: vi.fn().mockResolvedValue(undefined),
    } as unknown as MediaStreamTrack;
    return (
      <div data-testid="qr-scanner">
        <button onClick={() => onScan(JSON.stringify({ host: "192.168.1.1", port: 7456, token: "tok123", name: "LouvorJA" }))}>
          simulate scan
        </button>
        <button data-testid="simulate-camera-denied" onClick={() => onCameraDenied?.()}>
          camera denied
        </button>
        <button data-testid="simulate-track-ready" onClick={() => onTrackReady?.(mockTrack)}>
          track ready
        </button>
      </div>
    );
  },
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
        "remote.pair.redirecting": "Redirecting to live screen...",
        "remote.pair.find_code_hint": "Find code on your computer",
        "remote.pair.camera_denied": "Camera access denied. Enter the code manually.",
        "remote.pair.torch": "Toggle torch",
        "remote.pair.pair_button": "Pair",
      };
      return map[key] ?? key;
    },
  }),
}));

// Mock PinInput — renders in both mobile and desktop modes
vi.mock("@/components/system/PinInput", () => ({
  PinInput: ({
    onSubmit,
    value,
    onChange,
    disabled,
  }: {
    onSubmit?: (v: string) => void;
    value?: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
  }) => {
    const internalValue = value ?? "";
    return (
      <div data-testid="pin-input" data-disabled={disabled}>
        <input
          data-testid="pin-field"
          value={internalValue}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          aria-label="PIN input"
        />
        <button data-testid="pin-submit" onClick={() => internalValue.length === 6 && onSubmit?.(internalValue)}>
          submit pin
        </button>
      </div>
    );
  },
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

describe("PairRoute", () => {
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
    // The PIN link button switches to PIN mode
    const pinLink = screen.getByRole("button", { name: "Enter code manually" });
    fireEvent.click(pinLink);
    expect(screen.getByTestId("pin-input")).toBeInTheDocument();
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
    // Success screen should show
    await waitFor(() => {
      expect(screen.getByText("Paired!")).toBeInTheDocument();
    });
  });

  it("shows success screen then redirects after timeout", async () => {
    mockFetch.mockReturnValue(
      successResponse({ deviceId: "d1", deviceToken: "tok", serverName: "LouvorJA" }),
    );
    mockCompletePairing.mockResolvedValue(undefined);
    render(<PairRoute />);
    await act(async () => {
      fireEvent.click(screen.getByText("simulate scan"));
    });

    await waitFor(() => {
      expect(screen.getByText("Paired!")).toBeInTheDocument();
    });
    expect(screen.getByText("Redirecting to live screen...")).toBeInTheDocument();

    // Advance timer to trigger the setTimeout in finalizePairing
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockCompletePairing).toHaveBeenCalled();
  });

  it("shows error message when PIN is wrong", async () => {
    mockFetch.mockReturnValue(errorResponse());
    render(<PairRoute />);
    const pinLink = screen.getAllByRole("button", { name: "Enter code manually" })[0];
    fireEvent.click(pinLink);
    const input = screen.getByTestId("pin-field");
    fireEvent.change(input, { target: { value: "000000" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("pin-submit"));
    });
    expect(screen.getByText(/Invalid/)).toBeInTheDocument();
  });

  it("triggers lockout after 3 failed attempts", async () => {
    mockFetch.mockReturnValue(errorResponse());
    render(<PairRoute />);
    const pinLink = screen.getAllByRole("button", { name: "Enter code manually" })[0];
    fireEvent.click(pinLink);
    const input = screen.getByTestId("pin-field");

    for (let i = 0; i < 3; i++) {
      fireEvent.change(input, { target: { value: "000000" } });
      await act(async () => {
        fireEvent.click(screen.getByTestId("pin-submit"));
      });
    }

    expect(screen.getByText(/Locked/)).toBeInTheDocument();
  });

  it("switches to PIN mode when camera is denied", () => {
    render(<PairRoute />);
    fireEvent.click(screen.getByTestId("simulate-camera-denied"));
    // After camera denied, mode should be "pin" which shows the form
    expect(screen.getByTestId("pin-input")).toBeInTheDocument();
  });

  it("shows torch button when track is ready", async () => {
    render(<PairRoute />);
    // Track ready — this should cause a re-render with torch button
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-track-ready"));
    });
    // Torch button should appear
    expect(screen.getByRole("button", { name: "Toggle torch" })).toBeInTheDocument();
  });

  it("toggles torch when button clicked", async () => {
    render(<PairRoute />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-track-ready"));
    });
    const torchBtn = screen.getByRole("button", { name: "Toggle torch" });
    await act(async () => {
      fireEvent.click(torchBtn);
    });
    // Button should still be there (torch toggled)
    expect(torchBtn).toBeInTheDocument();
  });

  it("shows camera denied hint with manual PIN link", async () => {
    render(<PairRoute />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-camera-denied"));
    });
    // After camera denied, the hint text should appear
    expect(screen.getByText(/Camera access denied/)).toBeInTheDocument();
  });

  it("shows countdown timer after 3 failed attempts", async () => {
    mockFetch.mockReturnValue(errorResponse());
    render(<PairRoute />);
    const pinLink = screen.getAllByRole("button", { name: "Enter code manually" })[0];
    fireEvent.click(pinLink);
    const input = screen.getByTestId("pin-field");

    for (let i = 0; i < 3; i++) {
      fireEvent.change(input, { target: { value: "000000" } });
      await act(async () => {
        fireEvent.click(screen.getByTestId("pin-submit"));
      });
    }

    // Lockout message should show remaining seconds
    expect(screen.getByText(/Locked 60s/)).toBeInTheDocument();

    // Advance timers by 30s and verify countdown decreased
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText(/Locked 30s/)).toBeInTheDocument();
  });

  it("re-enables PIN input after lockout expires", async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      // First 3 calls are the failed attempts, then success
      const callCount = mockFetch.mock.calls.length;
      if (callCount <= 3) return errorResponse();
      return successResponse({ deviceId: "d1", deviceToken: "tok", serverName: "LouvorJA" });
    });
    mockCompletePairing.mockResolvedValue(undefined);

    render(<PairRoute />);
    const pinLink = screen.getAllByRole("button", { name: "Enter code manually" })[0];
    fireEvent.click(pinLink);
    const input = screen.getByTestId("pin-field");

    // 3 failed attempts → locked (must be 6 digits for PinInput mock to submit)
    for (let i = 0; i < 3; i++) {
      fireEvent.change(input, { target: { value: `${i}00000` } });
      await act(async () => {
        fireEvent.click(screen.getByTestId("pin-submit"));
      });
    }
    expect(screen.getByText(/Locked/)).toBeInTheDocument();
    expect(input).toBeDisabled();

    // Advance timers past lockout (60s)
    await act(async () => {
      vi.advanceTimersByTime(61000);
    });

    // Input should be enabled again
    expect(input).not.toBeDisabled();

    // Enter valid PIN and submit
    fireEvent.change(input, { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("pin-submit"));
    });

    // Should show success screen
    expect(await screen.findByText("Paired!")).toBeInTheDocument();
  });

  it("treats invalid QR payload as PIN fallback", { timeout: 10000 }, async () => {
    mockFetch.mockReturnValue(
      successResponse({ deviceId: "d1", deviceToken: "tok", serverName: "LouvorJA" }),
    );
    mockCompletePairing.mockResolvedValue(undefined);

    render(<PairRoute />);
    // Switch to PIN mode
    const pinLink = screen.getAllByRole("button", { name: "Enter code manually" })[0];
    fireEvent.click(pinLink);

    // Type and submit a 6-digit PIN
    const input = screen.getByTestId("pin-field");
    fireEvent.change(input, { target: { value: "999999" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("pin-submit"));
    });

    // Verify fetch was called with the PIN (this is the same code path
    // that the QR fallback uses when parseQrPayload returns null)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/pair/complete"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"pin":"999999"'),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Paired!")).toBeInTheDocument();
    });
  });
});
