import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Flashlight, FlashlightOff } from "lucide-react";
import { QrScanner } from "@/components/system/qr-scanner";
import { PinInput } from "@/components/system/PinInput";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";
import type { DeviceInfo } from "@/lib/storage";

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECS = 60;
const SUCCESS_REDIRECT_MS = 1500;

type PairMode = "qr" | "pin";

interface PairCompleteResponse {
  deviceId: string;
  deviceToken: string;
  serverName: string;
}

/**
 * Parse the QR payload.
 * Expected format: JSON `{ host, port, token, name }` or a raw URL with query params.
 */
function parseQrPayload(data: string): { host: string; port: number; token: string; name: string } | null {
  try {
    const parsed = JSON.parse(data) as { host: string; port: number; token: string; name: string };
    if (parsed.host && parsed.port && parsed.token) return parsed;
  } catch {
    // Try URL format: louvorja://pair?host=...&port=...&token=...
    try {
      const url = new URL(data);
      const host = url.searchParams.get("host");
      const port = url.searchParams.get("port");
      const token = url.searchParams.get("token");
      const name = url.searchParams.get("name") ?? "LouvorJA";
      if (host && port && token) return { host, port: parseInt(port, 10), token, name };
    } catch {
      // not a URL either
    }
  }
  return null;
}

export default function PairRoute() {
  const { t } = useTranslation();
  const completePairing = useConnectionStore((s) => s.completePairing);

  const [mode, setMode] = useState<PairMode>("qr");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [pairing, setPairing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);

  // Torch state
  const [torchOn, setTorchOn] = useState(false);
  const [trackReady, setTrackReady] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // Store last known host/port from QR scan so PIN fallback can reach the same server
  const connectionRef = useRef<{ host: string; port: number; name: string } | null>(null);
  const inFlightRef = useRef(false);

  // Countdown timer for lockout
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lockedUntil === null) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const remainingSecs = isLocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  const toggleTorch = useCallback(async () => {
    if (!trackRef.current) return;
    try {
      const next = !torchOn;
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // torch not supported on this device
    }
  }, [torchOn]);

  // Expose track to parent via a ref-like pattern from QrScanner
  // We intercept by wrapping the scanner's video stream access
  const handleScannerReady = useCallback((track: MediaStreamTrack) => {
    trackRef.current = track;
    setTrackReady(true);
  }, []);

  const callPairComplete = useCallback(
    async (host: string, port: number, _serverName: string, body: { token?: string; pin?: string }) => {
      const resp = await fetch(`http://${host}:${port}/pair/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, deviceName: navigator.userAgent.slice(0, 50) }),
      });
      if (!resp.ok) throw new Error(String(resp.status));
      return (await resp.json()) as PairCompleteResponse;
    },
    [],
  );

  const finalizePairing = useCallback(
    async (host: string, port: number, _name: string, result: PairCompleteResponse) => {
      const info: DeviceInfo = { id: result.deviceId, token: result.deviceToken, host, port, name: result.serverName };
      setSuccess(true);
      // After showing the success screen, complete pairing to trigger redirect to live
      setTimeout(() => {
        completePairing(info).catch(() => {
          // If pairing fails, the user can still retry from settings
        });
      }, SUCCESS_REDIRECT_MS);
    },
    [completePairing],
  );

  const handleScan = useCallback(
    async (data: string) => {
      if (inFlightRef.current || success) return;
      inFlightRef.current = true;
      setPairing(true);
      setError(null);
      try {
        const qr = parseQrPayload(data);
        if (!qr) {
          // Treat raw data as PIN
          const { host, port, name } = connectionRef.current ?? { host: window.location.hostname, port: 7456, name: "LouvorJA" };
          const result = await callPairComplete(host, port, name, { pin: data });
          await finalizePairing(host, port, name, result);
        } else {
          connectionRef.current = { host: qr.host, port: qr.port, name: qr.name };
          const result = await callPairComplete(qr.host, qr.port, qr.name, { token: qr.token });
          await finalizePairing(qr.host, qr.port, qr.name, result);
        }
      } catch {
        handlePairError();
      } finally {
        setPairing(false);
        inFlightRef.current = false;
      }
    },
    [success, callPairComplete, finalizePairing],
  );

  const handlePinSubmit = useCallback(
    async (value: string) => {
      if (isLocked || pairing || success || !value) return;
      setPairing(true);
      setError(null);
      try {
        const { host, port, name } = connectionRef.current ?? {
          host: window.location.hostname,
          port: 7456,
          name: "LouvorJA",
        };
        const result = await callPairComplete(host, port, name, { pin: value });
        await finalizePairing(host, port, name, result);
      } catch {
        handlePairError();
      } finally {
        setPairing(false);
      }
    },
    [isLocked, pairing, success, callPairComplete, finalizePairing],
  );

  function handlePairError() {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_SECS * 1000);
      setError("locked");
    } else {
      setError("invalid");
    }
  }

  const handleCameraDenied = useCallback(() => {
    setCameraDenied(true);
    setMode("pin");
  }, []);

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <Smartphone className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("remote.pair.success")}</h1>
        <p className="text-sm text-fg-muted">{t("remote.pair.redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">{t("remote.pair.headline")}</h1>
          <p className="text-sm text-fg-muted whitespace-pre-line">{t("remote.pair.find_code_hint")}</p>
        </div>

        {mode === "qr" ? (
          <div className="space-y-4 relative">
            <QrScanner onScan={handleScan} onCameraDenied={handleCameraDenied} onTrackReady={handleScannerReady} />

            {/* Torch button — top-right corner of scanner area */}
            {trackReady && (
              <button
                type="button"
                aria-label={t("remote.pair.torch")}
                onClick={toggleTorch}
                className={cn(
                  "absolute top-2 right-2 h-10 w-10 rounded-full",
                  "bg-black/50 text-white flex items-center justify-center",
                  "hover:bg-black/70 active:scale-95 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                )}
              >
                {torchOn ? (
                  <FlashlightOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Flashlight className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            )}

            {/* Manual PIN link */}
            <button
              type="button"
              className="w-full text-sm text-primary underline underline-offset-2 py-2"
              onClick={() => setMode("pin")}
            >
              {t("remote.pair.pin_link")}
            </button>
          </div>
        ) : (
          /* Mobile PIN-only mode */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length === 6) handlePinSubmit(pin);
            }}
            className="space-y-4"
          >
            {cameraDenied && (
              <p className="text-sm text-destructive text-center">
                {t("remote.pair.camera_denied")}
              </p>
            )}

            <PinInput
              length={6}
              value={pin}
              onChange={(v) => setPin(v)}
              onSubmit={handlePinSubmit}
              disabled={isLocked || pairing}
            />

            {/* Error messages */}
            {error === "invalid" && (
              <p role="alert" className="text-sm text-destructive text-center">
                {t("remote.pair.pin_invalid", { attempts: MAX_ATTEMPTS - attempts })}
              </p>
            )}
            {error === "locked" && (
              <p role="alert" className="text-sm text-destructive text-center">
                {t("remote.pair.pin_locked", { seconds: remainingSecs })}
              </p>
            )}

            <button
              type="submit"
              disabled={pin.length !== 6 || isLocked || pairing}
              className={cn(
                "w-full h-14 rounded-lg font-semibold text-white",
                "bg-primary hover:bg-primary/90 transition-colors",
                "disabled:opacity-50 disabled:pointer-events-none",
              )}
            >
              {pairing ? t("remote.pair.pairing") : t("remote.pair.pair_button")}
            </button>

            <button
              type="button"
              className="w-full text-sm text-primary underline underline-offset-2 py-2"
              onClick={() => { setMode("qr"); setError(null); setPin(""); setCameraDenied(false); }}
            >
              {t("remote.pair.scan")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
