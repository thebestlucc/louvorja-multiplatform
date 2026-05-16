/**
 * PresenceSheet — H1 multi-operator presence bottom sheet.
 *
 * Shows all connected operators (peers) received via `presence.changed` WS events.
 * Also renders an animated attribution chip when another operator executes a command
 * (received via `command.attributed` WS events).
 *
 * Usage: mount once in the Live route and pass the `ws` instance.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RemoteWS } from "@/lib/ws-client";
import { useConnectionStore, type PeerInfo } from "@/stores/connection-store";

export interface PresenceSheetProps {
  ws: RemoteWS | null;
  peers: PeerInfo[];
  className?: string;
}

interface Attribution {
  op: string;
  fromDeviceName: string;
}

/** Chip that fades in, stays for 2 s, then fades out. */
function AttributionChip({ attribution }: { attribution: Attribution | null }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!attribution) return;

    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2000);

    return () => clearTimeout(timerRef.current);
  }, [attribution]);

  if (!attribution) return null;

  const label = t("remote.multi_op.next_by", { name: attribution.fromDeviceName });

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "absolute top-0 left-1/2 -translate-x-1/2 z-10",
        "mt-2 px-3 py-1 rounded-full bg-primary text-white text-xs font-medium",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      {label}
    </div>
  );
}

/** Bottom sheet listing all connected operators. */
function PeerList({
  peers,
  onClose,
}: {
  peers: PeerInfo[];
  onClose: () => void;
}) {
  const { t } = useTranslation();

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t("remote.presence.title")}
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl flex flex-col overflow-hidden max-h-[60vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-sm font-semibold text-fg">{t("remote.presence.title")}</span>
          <button
            type="button"
            aria-label={t("remote.presence.close")}
            onClick={onClose}
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-full text-fg-muted",
              "hover:bg-surface-2 active:scale-90 transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-4 space-y-2">
          {peers.length === 0 ? (
            <p className="text-sm text-fg-muted text-center py-4">
              {t("remote.presence.empty")}
            </p>
          ) : (
            peers.map((peer) => (
              <div
                key={peer.deviceId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-1"
              >
                <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-fg truncate">{peer.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PresenceSheet — combines the operator list button, peer count badge,
 * animated attribution chip, and the bottom-sheet modal.
 */
export function PresenceSheet({ ws, peers, className }: PresenceSheetProps) {
  const { t } = useTranslation();
  const ourDeviceId = useConnectionStore((s) => s.device?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const attributionKeyRef = useRef(0);

  // H1: listen for command.attributed events from OTHER operators only.
  // The server broadcasts to every connected client (including the originator),
  // so we filter out our own commands here — there's no value in telling the
  // user "you just did X".
  useEffect(() => {
    if (!ws) return;
    const unsub = ws.on("command.attributed", (payload) => {
      const p = payload as { op?: string; fromDeviceId?: string; fromDeviceName?: string };
      if (!p || typeof p.op !== "string" || typeof p.fromDeviceName !== "string") return;
      if (ourDeviceId && p.fromDeviceId === ourDeviceId) return;
      attributionKeyRef.current += 1;
      setAttribution({ op: p.op, fromDeviceName: p.fromDeviceName });
    });
    return unsub;
  }, [ws, ourDeviceId]);

  const peerCount = peers.length;

  return (
    <div className={cn("relative", className)}>
      {/* Attribution chip — appears above the button */}
      <AttributionChip attribution={attribution} />

      {/* Operator count button */}
      <button
        type="button"
        aria-label={t("remote.connection.devices_count", { n: peerCount })}
        onClick={() => setSheetOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
          "border border-border bg-surface-1 text-xs text-fg-muted",
          "hover:bg-surface-2 active:scale-95 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        {peerCount}
      </button>

      {/* Bottom sheet */}
      {sheetOpen && (
        <PeerList peers={peers} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  );
}
