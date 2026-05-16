/**
 * QrScanner component — wraps `qr-scanner` lib with:
 * - Camera permission request on mount
 * - Fallback PIN input when camera is denied
 * - Lazy-loaded library (dynamic import) to stay under bundle budget on non-pair routes
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QrScannerProps {
  /** Called when a QR code is detected with its decoded string. */
  onScan: (token: string) => void;
  /** Called on unrecoverable camera error. */
  onError?: (err: Error) => void;
  /** Called when camera permission is denied (parent handles fallback). */
  onCameraDenied?: () => void;
  /** Called with the video track when camera starts successfully (for torch control). */
  onTrackReady?: (track: MediaStreamTrack) => void;
}

type ScannerState = "idle" | "requesting" | "scanning" | "denied" | "error";

export function QrScanner({ onScan, onError, onCameraDenied, onTrackReady }: QrScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any | null>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [pinValue, setPinValue] = useState("");
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const startScanning = useCallback(async () => {
    setState("requesting");
    try {
      // Lazy-load to keep the bundle slim on non-pair routes
      const { default: QrScannerLib } = await import("qr-scanner");
      if (!videoRef.current) return;

      const scanner = new QrScannerLib(
        videoRef.current,
        (result: { data: string }) => {
          onScanRef.current(result.data);
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
        },
      );
      scannerRef.current = scanner;
      await scanner.start();

      // Extract the video track for torch control
      const stream = videoRef.current.srcObject as MediaStream | null;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        if (track) onTrackReady?.(track);
      }

      setState("scanning");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (
        error.name === "NotAllowedError" ||
        error.message.includes("NotAllowed") ||
        error.message.includes("Permission")
      ) {
        setState("denied");
        onCameraDenied?.();
      } else {
        setState("error");
        onError?.(error);
      }
    }
  }, [onError, onCameraDenied, onTrackReady]);

  useEffect(() => {
    startScanning();
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [startScanning]);

  const handlePinSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (pinValue.trim().length >= 4) {
        onScan(pinValue.trim());
      }
    },
    [pinValue, onScan],
  );

  if (state === "denied" || state === "error") {
    // If parent handles camera denied, don't show fallback UI
    if (state === "denied" && onCameraDenied) {
      return null;
    }

    return (
      <div
        className="flex flex-col items-center gap-4 p-6 text-center"
        data-testid="qr-fallback"
      >
        <CameraOff className="h-10 w-10 text-fg-muted" aria-hidden="true" />
        <p className="text-fg-muted text-sm">
          {state === "denied"
            ? t("remote.pair.camera_denied")
            : t("remote.pair.camera_error")}
        </p>
        <form onSubmit={handlePinSubmit} className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value)}
            placeholder={t("remote.pair.manual_code_placeholder")}
            aria-label="Pairing code"
            className="h-11 px-4 rounded-lg bg-surface-2 text-fg text-center text-lg tracking-widest border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="submit" disabled={pinValue.trim().length < 4}>
            {t("remote.pair.pair_button")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4" data-testid="qr-scanner">
      {state === "requesting" && (
        <div className="flex items-center gap-2 text-fg-muted text-sm">
          <Camera className="h-4 w-4 animate-pulse" aria-hidden="true" />
          <span>{t("remote.pair.requesting_camera")}</span>
        </div>
      )}
      <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-surface-2">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          aria-label="Camera viewfinder for QR scanning"
        />
      </div>
      {state === "scanning" && (
        <p className="text-fg-muted text-xs">{t("remote.pair.scan_hint")}</p>
      )}
    </div>
  );
}
