import { useRef, useCallback } from "react";
import { usePreferencesStore } from "@/stores/preferences-store";

interface UseLongPressOptions {
  onHoldComplete: () => void;
  /** Duration in ms before firing (default 600). */
  duration?: number;
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

export function useLongPress({
  onHoldComplete,
  duration = 600,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onHoldCompleteRef = useRef(onHoldComplete);
  onHoldCompleteRef.current = onHoldComplete;

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      cancel();
      timerRef.current = setTimeout(() => {
        // Check haptics preference at fire time to respect user's current setting
        if (usePreferencesStore.getState().haptics && "vibrate" in navigator) {
          navigator.vibrate(40);
        }
        onHoldCompleteRef.current();
        timerRef.current = undefined;
      }, duration);
    },
    [cancel, duration],
  );

  const onPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      cancel();
    },
    [cancel],
  );

  return {
    onPointerDown,
    onPointerUp,
    onPointerLeave: cancel as unknown as (e: React.PointerEvent) => void,
    onPointerCancel: cancel as unknown as (e: React.PointerEvent) => void,
  };
}
