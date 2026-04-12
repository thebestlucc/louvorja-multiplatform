import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { QrScanner } from "@/components/system/qr-scanner";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";
import type { DeviceInfo } from "@/lib/storage";

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECS = 60;

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

  // Store last known host/port from QR scan so PIN fallback can reach the same server
  const connectionRef = useRef<{ host: string; port: number; name: string } | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const remainingSecs = isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0;

  const callPairComplete = useCallback(
    async (host: string, port: number, serverName: string, body: { token?: string; pin?: string }) => {
      const resp = await fetch(`http://${host}:${port}/pair/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, deviceName: navigator.userAgent.slice(0, 50) }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      return (await resp.json()) as PairCompleteResponse;
    },
    [],
  );

  const handleScan = useCallback(
    async (data: string) => {
      if (pairing || success) return;
      setPairing(true);
      setError(null);
      try {
        const qr = parseQrPayload(data);
        if (!qr) {
          // Treat raw data as PIN
          connectionRef.current = connectionRef.current ?? { host: window.location.hostname, port: 7456, name: "LouvorJA" };
          const { host, port, name } = connectionRef.current;
          const result = await callPairComplete(host, port, name, { pin: data });
          const info: DeviceInfo = { id: result.deviceId, token: result.deviceToken, host, port, name: result.serverName };
          await completePairing(info);
        } else {
          connectionRef.current = { host: qr.host, port: qr.port, name: qr.name };
          const result = await callPairComplete(qr.host, qr.port, qr.name, { token: qr.token });
          const info: DeviceInfo = { id: result.deviceId, token: result.deviceToken, host: qr.host, port: qr.port, name: result.serverName };
          await completePairing(info);
        }
        setSuccess(true);
      } catch {
        handlePairError();
      } finally {
        setPairing(false);
      }
    },
    [pairing, success, callPairComplete, completePairing],
  );

  const handlePinSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isLocked || pairing || success || !pin) return;
      setPairing(true);
      setError(null);
      try {
        const { host, port, name } = connectionRef.current ?? {
          host: window.location.hostname,
          port: 7456,
          name: "LouvorJA",
        };
        const result = await callPairComplete(host, port, name, { pin });
        const info: DeviceInfo = { id: result.deviceId, token: result.deviceToken, host, port, name: result.serverName };
        await completePairing(info);
        setSuccess(true);
      } catch {
        handlePairError();
      } finally {
        setPairing(false);
      }
    },
    [isLocked, pairing, success, pin, callPairComplete, completePairing],
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

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <Smartphone className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">{t("remote.pair.success")}</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">{t("remote.pair.headline")}</h1>
          <p className="text-sm text-fg-muted">{t("remote.pair.find_code_hint")}</p>
        </div>

        {/* QR / PIN toggle */}
        {mode === "qr" ? (
          <div className="space-y-4">
            <QrScanner onScan={handleScan} />
            <button
              type="button"
              className="w-full text-sm text-primary underline underline-offset-2 py-2"
              onClick={() => setMode("pin")}
            >
              {t("remote.pair.pin_link")}
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder={t("remote.pair.pin_placeholder")}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={isLocked || pairing}
              className={cn(
                "w-full h-14 px-4 text-center text-2xl tracking-widest rounded-lg border",
                "bg-surface-1 border-border text-fg placeholder:text-fg-subtle",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                "disabled:opacity-50",
                error ? "border-destructive" : "",
              )}
              aria-label={t("remote.pair.pin_placeholder")}
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
              {pairing ? "…" : t("remote.pair.scan")}
            </button>

            <button
              type="button"
              className="w-full text-sm text-primary underline underline-offset-2 py-2"
              onClick={() => { setMode("qr"); setError(null); setPin(""); }}
            >
              {t("remote.pair.scan")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
