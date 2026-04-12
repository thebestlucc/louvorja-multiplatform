import { useRef, useCallback } from "react";

interface UseLongPressOptions {
  onHoldComplete: () => void;
  /** Duration in ms before firing (default 600). */
  duration?: number;
  /** Trigger haptic feedback if available. */
  haptics?: boolean;
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
  haptics = true,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
        if (haptics && "vibrate" in navigator) {
          navigator.vibrate(40);
        }
        onHoldComplete();
        timerRef.current = undefined;
      }, duration);
    },
    [cancel, duration, haptics, onHoldComplete],
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
