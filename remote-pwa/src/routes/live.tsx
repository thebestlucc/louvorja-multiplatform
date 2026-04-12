import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Square, Image, X, Wifi, WifiOff, Loader } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 600;

interface SlidePayload {
  text?: string;
  type?: string;
  title?: string;
}

// TODO(review): useLongPress captures `action` in useCallback deps — callers passing inline arrow
// functions will cause new timer registrations each render. Memoize action at call site or use
// a useRef for the action ref pattern. (ring:code-reviewer, 2026-04-12, Low)
/** Returns pointerdown/pointerup/pointerleave handlers that fire `action` after LONG_PRESS_MS. */
function useLongPress(action: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const start = useCallback(() => {
    timerRef.current = setTimeout(action, LONG_PRESS_MS);
  }, [action]);

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  return { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel };
}

export default function LiveRoute() {
  const { t } = useTranslation();
  const wsState = useConnectionStore((s) => s.wsState);
  const ws = useConnectionStore((s) => s.ws);

  const [slide, setSlide] = useState<SlidePayload | null>(null);

  // Subscribe to slide.changed events from WS
  useEffect(() => {
    if (!ws || typeof ws.on !== "function") return;
    const unsub = ws.on("slide.changed", (payload) => {
      setSlide(payload as SlidePayload);
    });
    return unsub;
  }, [ws]);

  const sendCmd = useCallback(
    (op: string, payload: Record<string, unknown> = {}) => {
      ws?.send(op, payload);
    },
    [ws],
  );

  const blackLongPress = useLongPress(() => sendCmd("display.overlay", { overlay: "black" }));
  const logoLongPress = useLongPress(() => sendCmd("display.overlay", { overlay: "logo" }));
  const clearLongPress = useLongPress(() => sendCmd("display.overlay", { overlay: "clear" }));

  return (
    <div className="flex flex-col h-full">
      {/* Connection pill */}
      <ConnectionPill state={wsState} />

      {/* Slide preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <SlidePreview slide={slide} noSlideLabel={t("remote.live.no_slide")} />
      </div>

      {/* Overlay row */}
      <div className="flex justify-center gap-3 px-4 pb-2">
        <OverlayButton label={t("remote.live.black")} Icon={Square} longPress={blackLongPress} />
        <OverlayButton label={t("remote.live.logo")} Icon={Image} longPress={logoLongPress} />
        <OverlayButton label={t("remote.live.clear")} Icon={X} longPress={clearLongPress} />
      </div>

      {/* Prev / Next bar */}
      <PrevNextBar
        onPrev={() => sendCmd("slide.prev", {})}
        onNext={() => sendCmd("slide.next", {})}
        prevLabel={t("remote.live.prev")}
        nextLabel={t("remote.live.next")}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConnectionPill({ state }: { state: string }) {
  const { t } = useTranslation();

  const label =
    state === "connected"
      ? t("remote.live.connected")
      : state === "reconnecting"
        ? t("remote.live.reconnecting")
        : t("remote.live.disconnected");

  const Icon = state === "connected" ? Wifi : state === "reconnecting" ? Loader : WifiOff;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium",
        state === "connected"
          ? "text-primary"
          : state === "reconnecting"
            ? "text-amber-500"
            : "text-destructive",
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </div>
  );
}

function SlidePreview({ slide, noSlideLabel }: { slide: SlidePayload | null; noSlideLabel: string }) {
  if (!slide || !slide.text) {
    return (
      <div className="flex items-center justify-center w-full aspect-video rounded-lg border border-border bg-surface-1">
        <p className="text-sm text-fg-muted">{noSlideLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full aspect-video rounded-lg border border-border bg-surface-1 p-4 overflow-hidden">
      <p className="text-center text-base font-medium leading-relaxed line-clamp-6">{slide.text}</p>
    </div>
  );
}

interface LongPressHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
}

function OverlayButton({
  label,
  Icon,
  longPress,
}: {
  label: string;
  Icon: React.ElementType;
  longPress: LongPressHandlers;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...longPress}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-1 p-3 text-xs text-fg-muted",
        "active:scale-95 transition-transform select-none touch-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}

function PrevNextBar({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex gap-3 p-4 pt-2">
      <button
        type="button"
        aria-label={prevLabel}
        onClick={onPrev}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 h-14 rounded-lg border border-border bg-surface-1",
          "text-sm font-medium text-fg active:scale-95 transition-transform",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        {prevLabel}
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={onNext}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 h-14 rounded-lg bg-primary text-white",
          "text-sm font-medium active:scale-95 transition-transform",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        )}
      >
        {nextLabel}
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
