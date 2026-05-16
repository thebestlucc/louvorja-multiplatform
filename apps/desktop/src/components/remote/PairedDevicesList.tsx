import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { usePairedDevices, useRevokePairedDevice } from "../../lib/queries/remote";
import type { RemoteDevice } from "../../lib/bindings";

export interface PairedDevicesListProps {
  className?: string;
}

interface RevokeConfirmProps {
  device: RemoteDevice;
  onConfirm: () => void;
  onCancel: () => void;
}

function RevokeConfirmRow({ device, onConfirm, onCancel }: RevokeConfirmProps) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/5 px-2 py-1.5">
      <span className="text-xs font-medium">{device.name}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          aria-label={t("remote.desktop_ui.revoke_device")}
        >
          {t("remote.desktop_ui.revoke_device")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label={t("actions.cancel")}
        >
          {t("actions.cancel")}
        </button>
      </div>
    </li>
  );
}

export function PairedDevicesList({ className }: PairedDevicesListProps) {
  const { t } = useTranslation();
  const { data: devices } = usePairedDevices();
  const revoke = useRevokePairedDevice();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = (id: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setConfirmId(id);
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleRevoke = (id: string) => {
    revoke.mutate(id);
    setConfirmId(null);
  };

  if (!devices || devices.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {t("remoteControl.noDevices")}
      </p>
    );
  }

  return (
    <ul className={cn("space-y-1", className)}>
      {devices.map((device) => {
        if (confirmId === device.id) {
          return (
            <RevokeConfirmRow
              key={device.id}
              device={device}
              onConfirm={() => handleRevoke(device.id)}
              onCancel={() => setConfirmId(null)}
            />
          );
        }
        return (
          <li
            key={device.id}
            className="flex items-center justify-between rounded-md border border-border px-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">{device.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {device.lastSeenAt
                    ? t("remoteControl.lastSeen", {
                        time: new Date(device.lastSeenAt * 1000).toLocaleString(),
                      })
                    : t("remoteControl.neverSeen")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onPointerDown={() => startLongPress(device.id)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              disabled={revoke.isPending}
              className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
              aria-label={t("remote.desktop_ui.revoke_device")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
