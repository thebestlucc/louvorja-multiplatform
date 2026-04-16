import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Square,
  Image,
  X,
  Wifi,
  WifiOff,
  Loader,
  LayoutGrid,
  SkipBack,
  SkipForward,
  Play,
  Pause,
} from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import type { SlidePayload } from "@/stores/connection-store";
import { useVideoTargetsStore } from "@/stores/video-targets-store";
import { cn } from "@/lib/utils";
import { PresenceSheet } from "@/components/live/PresenceSheet";
import { SeekSlider } from "@/components/queue/SeekSlider";
import { VolumeSlider } from "@/components/queue/VolumeSlider";
import { TargetChips } from "@/components/queue/TargetChips";

/** Minimum vertical swipe distance (px) to open the grid. */
const SWIPE_THRESHOLD_PX = 80;
/** Touch must start in the bottom 25% of the screen to trigger. */
const SWIPE_START_ZONE = 0.75;
/** Debounce interval for volume slider network traffic. */
const VOLUME_DEBOUNCE_MS = 150;

export default function LiveRoute() {
  const { t } = useTranslation();
  const wsState = useConnectionStore((s) => s.wsState);
  const ws = useConnectionStore((s) => s.ws);
  const peers = useConnectionStore((s) => s.peers);
  const slide = useConnectionStore((s) => s.currentSlide);
  const queue = useConnectionStore((s) => s.currentQueue);
  const audioStatus = useConnectionStore((s) => s.currentAudioStatus);

  const { targets, setTargets } = useVideoTargetsStore();

  const [gridOpen, setGridOpen] = useState(false);

  // Touch tracking for swipe-up gesture
  const touchStartY = useRef<number | null>(null);
  const touchStartScreenFraction = useRef<number | null>(null);

  // Debounce timer for volume
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    return () => {
      if (volumeDebounceRef.current !== undefined) {
        clearTimeout(volumeDebounceRef.current);
        volumeDebounceRef.current = undefined;
      }
    };
  }, []);

  const sendCmd = useCallback(
    (op: string, payload: Record<string, unknown> = {}) => {
      ws?.send(op, payload);
    },
    [ws],
  );

  const handleGoto = useCallback(
    (index: number) => {
      sendCmd("slide.goto", { index });
      setGridOpen(false);
    },
    [sendCmd],
  );

  const handleSeek = useCallback(
    (secs: number) => {
      sendCmd("audio.seek", { ms: Math.round(secs * 1000) });
    },
    [sendCmd],
  );

  const handleVolumeChange = useCallback(
    (vol: number) => {
      if (volumeDebounceRef.current !== undefined) clearTimeout(volumeDebounceRef.current);
      volumeDebounceRef.current = setTimeout(() => {
        sendCmd("audio.volume", { value: vol / 100 });
      }, VOLUME_DEBOUNCE_MS);
    },
    [sendCmd],
  );

  const handleTargetsChange = useCallback(
    (newTargets: ("projector" | "return")[]) => {
      setTargets(newTargets);
      sendCmd("video.set_targets", {
        projector: newTargets.includes("projector"),
        return: newTargets.includes("return"),
      });
    },
    [setTargets, sendCmd],
  );

  // Overlay buttons use plain onClick — no distinct hold action exists yet.
  const handleBlack = useCallback(() => sendCmd("display.overlay", { overlay: "black" }), [sendCmd]);
  const handleLogo = useCallback(() => sendCmd("display.overlay", { overlay: "logo" }), [sendCmd]);
  const handleClear = useCallback(() => sendCmd("display.overlay", { overlay: "clear" }), [sendCmd]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const fraction = touch.clientY / window.innerHeight;
    touchStartY.current = touch.clientY;
    touchStartScreenFraction.current = fraction;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch || touchStartY.current === null || touchStartScreenFraction.current === null) return;
    const deltaY = touchStartY.current - touch.clientY; // positive = swipe up
    const startedInBottomZone = touchStartScreenFraction.current > SWIPE_START_ZONE;
    if (startedInBottomZone && deltaY > SWIPE_THRESHOLD_PX) {
      setGridOpen(true);
    }
    touchStartY.current = null;
    touchStartScreenFraction.current = null;
  }, []);

  const totalSlides = slide?.total ?? 0;
  const currentIndex = slide?.index ?? null;

  // Contextual control gates — show audio controls when audio is active (playing or has duration)
  const hasAudio = audioStatus != null && (audioStatus.playing || (audioStatus.duration ?? 0) > 0);
  const slideType = slide?.type;
  const hasVideo = slideType === "online_video" || slideType === "video";

  return (
    <div
      className="flex flex-col h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Connection pill + presence */}
      <div className="flex items-center justify-between px-3 pt-1">
        <ConnectionPill state={wsState} />
        <PresenceSheet ws={ws} peers={peers} />
      </div>

      {/* Slide preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <SlidePreview slide={slide} noSlideLabel={t("remote.live.no_slide")} />
      </div>

      {/* Audio controls block — shown when audio is playing */}
      {hasAudio && (
        <section className="px-4 pb-2 space-y-2">
          {queue?.nowPlaying && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg truncate">{queue.nowPlaying.title}</p>
              {queue.nowPlaying.artist && (
                <p className="text-xs text-fg-muted truncate">{queue.nowPlaying.artist}</p>
              )}
            </div>
          )}

          {/* Playback buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t("remote.queue.skip_prev")}
              onClick={() => sendCmd("audio.skip_prev", {})}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-full border border-border bg-surface-1",
                "text-fg active:scale-90 transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <SkipBack className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label={audioStatus?.playing ? t("remote.queue.pause") : t("remote.queue.play")}
              onClick={() => sendCmd("audio.toggle", {})}
              className={cn(
                "flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white",
                "active:scale-90 transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              )}
            >
              {audioStatus?.playing ? (
                <Pause className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Play className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              aria-label={t("remote.queue.skip_next")}
              onClick={() => sendCmd("audio.skip_next", {})}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-full border border-border bg-surface-1",
                "text-fg active:scale-90 transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <SkipForward className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Seek slider */}
          <SeekSlider
            position={audioStatus?.position ?? 0}
            duration={audioStatus?.duration ?? 0}
            onSeek={handleSeek}
          />

          {/* Volume slider */}
          <VolumeSlider
            volume={audioStatus != null ? Math.round(audioStatus.volume * 100) : 100}
            onVolumeChange={handleVolumeChange}
          />
        </section>
      )}

      {/* Video controls block — shown when a video slide is projected */}
      {hasVideo && (
        <section className="px-4 pb-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-muted font-medium">{t("remote.queue.video_targets")}</span>
            <TargetChips targets={targets} onChange={handleTargetsChange} />
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t("remote.queue.play")}
              onClick={() => sendCmd("video.play", {})}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-full border border-border bg-surface-1",
                "text-fg active:scale-90 transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <Play className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("remote.queue.pause")}
              onClick={() => sendCmd("video.pause", {})}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-full border border-border bg-surface-1",
                "text-fg active:scale-90 transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <Pause className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Swipe hint — shown when there are slides */}
      {totalSlides > 0 && (
        <p className="text-center text-xs text-fg-subtle pb-1 select-none" aria-hidden="true">
          {t("remote.live.swipe_up_hint")}
        </p>
      )}

      {/* Overlay row — always visible */}
      <div className="flex justify-center gap-3 px-4 pb-2">
        <OverlayButton label={t("remote.live.black")} Icon={Square} onClick={handleBlack} />
        <OverlayButton label={t("remote.live.logo")} Icon={Image} onClick={handleLogo} />
        <OverlayButton label={t("remote.live.clear")} Icon={X} onClick={handleClear} />
        {totalSlides > 0 && (
          <button
            type="button"
            aria-label={t("remote.live.all_slides")}
            onClick={() => setGridOpen(true)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-1 p-3 text-xs text-fg-muted active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            {t("remote.live.all_slides")}
          </button>
        )}
      </div>

      {/* Prev / Next bar — only when slides exist */}
      {totalSlides > 0 && (
        <PrevNextBar
          onPrev={() => sendCmd("slide.prev", {})}
          onNext={() => sendCmd("slide.next", {})}
          prevLabel={t("remote.live.prev")}
          nextLabel={t("remote.live.next")}
        />
      )}

      {/* Slide grid overlay */}
      {gridOpen && (
        <SlideGrid
          total={totalSlides}
          currentIndex={currentIndex}
          onGoto={handleGoto}
          onClose={() => setGridOpen(false)}
          title={t("remote.live.all_slides")}
          closeLabel={t("remote.live.close_grid")}
          slideLabel={t("remote.live.slide_counter")}
        />
      )}
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

  const slideCounter =
    typeof slide.index === "number" && typeof slide.total === "number"
      ? `${slide.index + 1} / ${slide.total}`
      : null;

  return (
    <div className="flex flex-col items-center justify-center w-full aspect-video rounded-lg border border-border bg-surface-1 p-4 overflow-hidden">
      <p className="text-center text-base font-medium leading-relaxed line-clamp-6">{slide.text}</p>
      {slideCounter && (
        <p className="text-xs text-fg-muted mt-2 font-medium" aria-label={`Slide ${slideCounter}`}>
          {slideCounter}
        </p>
      )}
    </div>
  );
}

function OverlayButton({
  label,
  Icon,
  onClick,
}: {
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-1 p-3 text-xs text-fg-muted",
        "active:scale-95 transition-transform select-none",
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

function SlideGrid({
  total,
  currentIndex,
  onGoto,
  onClose,
  title,
  closeLabel,
  slideLabel,
}: {
  total: number;
  currentIndex: number | null;
  onGoto: (index: number) => void;
  onClose: () => void;
  title: string;
  closeLabel: string;
  slideLabel: string;
}) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      {/* Panel — stop propagation so taps inside don't close */}
      <div
        className="bg-surface rounded-t-2xl max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-sm font-semibold text-fg">{title}</span>
          <button
            type="button"
            aria-label={closeLabel}
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

        {/* Grid */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: total }, (_, i) => {
              const isCurrent = currentIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={slideLabel.replace("{{n}}", String(i + 1)).replace("{{total}}", String(total))}
                  aria-pressed={isCurrent}
                  onClick={() => onGoto(i)}
                  className={cn(
                    "aspect-video rounded-lg border text-sm font-semibold flex items-center justify-center",
                    "active:scale-95 transition-transform",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isCurrent
                      ? "bg-primary text-white border-primary"
                      : "bg-surface-1 border-border text-fg hover:bg-surface-2",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
