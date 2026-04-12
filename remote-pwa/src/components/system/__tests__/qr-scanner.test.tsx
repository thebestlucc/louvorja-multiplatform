import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QrScanner } from "../qr-scanner";

// Mock qr-scanner library (dynamic import)
vi.mock("qr-scanner", () => ({
  default: vi.fn().mockImplementation((_video: unknown, callback: (result: { data: string }) => void) => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    destroy: vi.fn(),
    _triggerScan: (data: string) => callback({ data }),
  })),
}));

describe("QrScanner", () => {
  it("calls onScan when a QR is detected", async () => {
    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} />);

    // The scanner starts — wait for it to mount
    await vi.waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });
  });

  it("shows fallback PIN input when camera is denied", async () => {
    // Force the scanner to fail with NotAllowedError
    const { default: QrScannerLib } = await import("qr-scanner");
    vi.mocked(QrScannerLib).mockImplementationOnce(() => ({
      start: vi.fn().mockRejectedValue(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" })),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));

    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} />);

    await vi.waitFor(() => {
      expect(screen.getByTestId("qr-fallback")).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("6-digit code")).toBeInTheDocument();
  });

  it("submits PIN when form is submitted", async () => {
    const { default: QrScannerLib } = await import("qr-scanner");
    vi.mocked(QrScannerLib).mockImplementationOnce(() => ({
      start: vi.fn().mockRejectedValue(Object.assign(new Error("NotAllowed"), { name: "NotAllowedError" })),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));

    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} />);

    await vi.waitFor(() => {
      expect(screen.getByTestId("qr-fallback")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("6-digit code");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.submit(input.closest("form")!);

    expect(onScan).toHaveBeenCalledWith("123456");
  });
});
