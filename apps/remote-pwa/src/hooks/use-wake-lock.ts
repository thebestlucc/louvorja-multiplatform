/**
 * useWakeLock — requests/releases the Screen Wake Lock API based on the
 * preferences store setting and WS connection state.
 *
 * Acquires the lock when `wakeLock === true` AND the WS is connected.
 * Automatically re-acquires after visibility changes (browser requirement).
 * Auto-releases when battery level drops below 15% to conserve power.
 */

import { useEffect, useRef } from "react";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useConnectionStore } from "@/stores/connection-store";

// Minimal type shim for the Battery Status API (not yet in lib.dom.d.ts).
interface BatteryManager extends EventTarget {
  level: number;
  addEventListener(type: "levelchange", listener: () => void): void;
  removeEventListener(type: "levelchange", listener: () => void): void;
}

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
}

export function useWakeLock(): void {
  const wakeLockEnabled = usePreferencesStore((s) => s.wakeLock);
  const wsState = useConnectionStore((s) => s.wsState);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const shouldAcquire = wakeLockEnabled && wsState === "connected";

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;
    let battery: BatteryManager | null = null;

    async function acquire(): Promise<void> {
      // Don't acquire if battery is low.
      if (battery && battery.level < 0.15) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (!cancelled) sentinelRef.current = null;
        });
      } catch {
        // Permission denied or API unavailable — silently ignore.
      }
    }

    function release(): void {
      sentinelRef.current?.release();
      sentinelRef.current = null;
    }

    // Auto-release when battery drops below 15%.
    function onBatteryLevelChange(): void {
      if (battery && battery.level < 0.15) {
        release();
      }
    }

    async function setupBattery(): Promise<void> {
      if (typeof navigator.getBattery === "function") {
        try {
          battery = await navigator.getBattery();
          battery.addEventListener("levelchange", onBatteryLevelChange);
          // Immediately release if already low when hook runs.
          if (battery.level < 0.15) {
            release();
            return;
          }
        } catch {
          // Battery API unavailable — proceed without guard.
        }
      }
    }

    if (shouldAcquire) {
      setupBattery().then(() => {
        if (!cancelled && shouldAcquire) acquire();
      });
    } else {
      release();
    }

    // Re-acquire on tab becoming visible again (browser drops lock on hide).
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible" && shouldAcquire) {
        acquire();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (battery) {
        battery.removeEventListener("levelchange", onBatteryLevelChange);
        battery = null;
      }
      release();
    };
  }, [shouldAcquire]);
}
