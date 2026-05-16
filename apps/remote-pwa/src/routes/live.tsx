import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  X,
  Wifi,
  WifiOff,
  Loader,
  Play,
  Pause,
  LayoutGrid,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { useVideoTargetsStore } from "@/stores/video-targets-store";
import { cn } from "@/lib/utils";
import { PresenceSheet } from "@/components/live/PresenceSheet";
import { SeekSlider } from "@/components/queue/SeekSlider";
import { VolumeSlider } from "@/components/queue/VolumeSlider";
import { TargetChips } from "@/components/queue/TargetChips";
import { NowPlayingStrip } from "@/components/live/now-playing-strip";
import { TileGrid } from "@/components/live/tile-grid";
import type { TileItem } from "@/components/live/tile-grid";
import { TransportBar } from "@/components/live/transport-bar";
import type { WsOpName } from "../lib/ws-ops";

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

  // Overlay active state (local — server doesn't push this back yet)
  const [blackActive, setBlackActive] = useState(false);
  const [frozenActive, setFrozenActive] = useState(false);

  // All-slides grid (modal dialog)
  const [gridOpen, setGridOpen] = useState(false);

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

  // Close grid on Escape
  useEffect(() => {
    if (!gridOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGridOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [gridOpen]);

  const sendCmd = useCallback(
    (op: WsOpName, payload: Record<string, unknown> = {}) => {
      ws?.send(op, payload);
    },
    [ws],
  );

  const handleGoto = useCallback(
    (index: number) => {
      sendCmd("slide.goto", { index });
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

  const handleBlack = useCallback(() => {
    if (blackActive) {
      sendCmd("display.overlay", { overlay: "clear" });
      setBlackActive(false);
      setFrozenActive(false);
    } else {
      sendCmd("display.overlay", { overlay: "black" });
      setBlackActive(true);
      setFrozenActive(false);
    }
  }, [sendCmd, blackActive]);

  const handleFreeze = useCallback(() => {
    if (frozenActive) {
      sendCmd("display.overlay", { overlay: "clear" });
      setFrozenActive(false);
      setBlackActive(false);
    } else {
      // Use logo overlay as a "freeze" approximation — keeps last visible frame
      sendCmd("display.overlay", { overlay: "logo" });
      setFrozenActive(true);
      setBlackActive(false);
    }
  }, [sendCmd, frozenActive]);

  const handleLogo = useCallback(() => sendCmd("display.overlay", { overlay: "logo" }), [sendCmd]);
  const handleClear = useCallback(() => {
    sendCmd("display.overlay", { overlay: "clear" });
    setBlackActive(false);
    setFrozenActive(false);
  }, [sendCmd]);

  const totalSlides = slide?.total ?? 0;
  const currentIndex = slide?.index ?? -1;

  // Swipe-up from bottom 25% of viewport opens the all-slides grid.
  // Threshold: 80px upward swipe. Bottom-zone gate avoids triggering on
  // scroll gestures within the tile grid.
  const touchStartYRef = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const startY = touchStartYRef.current;
      touchStartYRef.current = null;
      if (startY === null || totalSlides === 0) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const viewportHeight = window.innerHeight;
      const inBottomZone = startY >= viewportHeight * 0.75;
      const swipeUpDistance = startY - endY;
      if (inBottomZone && swipeUpDistance > 80) {
        setGridOpen(true);
      }
    },
    [totalSlides],
  );

  const isPlaying = audioStatus?.playing ?? false;

  // Contextual control gates
  const hasAudio = audioStatus != null && (audioStatus.playing || (audioStatus.duration ?? 0) > 0);
  const slideType = slide?.type;
  const hasVideo =
    slideType === "online_video" ||
    slideType === "onlineVideo" ||
    slideType === "video";

  // Build tile list from slide count
  const tiles: TileItem[] = Array.from({ length: totalSlides }, (_, i) => ({
    index: i,
    label: `Slide ${i + 1}`,
    sublabel: undefined,
  }));

  // Now-playing strip data: prefer queue nowPlaying title, fall back to slide title/text.
  // Empty when neither queue nor slide is set — NoSlidesPlaceholder already shows the
  // "Waiting for content" message in the main area.
  const stripTitle =
    queue?.nowPlaying?.title ??
    slide?.title ??
    slide?.text?.split("\n")[0] ??
    "";
  const stripSubtitle =
    totalSlides > 0 && typeof slide?.index === "number"
      ? `${slide.index + 1} / ${totalSlides}`
      : undefined;
  const coverUrl = queue?.nowPlaying?.thumbnail;

  return (
    <div
      className="flex h-full flex-col bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Connection pill + presence */}
      <div className="flex items-center justify-between px-3 pt-1 flex-shrink-0">
        <ConnectionPill state={wsState} />
        <PresenceSheet ws={ws} peers={peers} />
      </div>

      {/* Now Playing Strip */}
      <NowPlayingStrip
        title={stripTitle}
        subtitle={stripSubtitle}
        coverUrl={coverUrl}
      />

      {/* Tile Grid — main content, scrollable */}
      {totalSlides > 0 ? (
        <TileGrid
          className="flex-1 min-h-0"
          tiles={tiles}
          activeIndex={currentIndex}
          onTileClick={handleGoto}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <NoSlidesPlaceholder label={t("remote.live.no_slide")} />
        </div>
      )}

      {/* Audio controls block — shown when audio is active */}
      {hasAudio && (
        <section className="px-4 pb-2 space-y-2 flex-shrink-0 border-t border-border pt-2">
          {queue?.nowPlaying?.artist && (
            <p className="text-xs text-fg-muted truncate">{queue.nowPlaying.artist}</p>
          )}

          {/* Skip prev/next for the audio queue */}
          <div className="flex items-center justify-center gap-3">
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
        <section className="px-4 pb-2 space-y-2 flex-shrink-0 border-t border-border pt-2">
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

      {/* Overlay row (all-slides + logo + clear) — always visible alongside TransportBar */}
      <div className="flex justify-center gap-3 px-4 py-2 flex-shrink-0">
        {totalSlides > 0 && (
          <OverlayButton
            label={t("remote.live.all_slides")}
            Icon={LayoutGrid}
            onClick={() => setGridOpen(true)}
          />
        )}
        <OverlayButton label={t("remote.live.logo")} Icon={Image} onClick={handleLogo} />
        <OverlayButton label={t("remote.live.clear")} Icon={X} onClick={handleClear} />
      </div>

      {/* All-slides dialog */}
      {gridOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setGridOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("remote.live.all_slides")}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface w-full max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl p-4 overflow-y-auto"
          >
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => {
                const isActive = tile.index === currentIndex;
                return (
                  <button
                    key={tile.index}
                    type="button"
                    aria-label={`Slide ${tile.index + 1} of ${totalSlides}`}
                    aria-pressed={isActive}
                    onClick={() => {
                      handleGoto(tile.index);
                      setGridOpen(false);
                    }}
                    className={cn(
                      "relative rounded-lg p-3 min-h-[80px] flex flex-col justify-between cursor-pointer",
                      "border transition-transform active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "border-primary ring-1 ring-primary bg-primary/5 text-fg"
                        : "border-border bg-surface-1 hover:bg-surface-2",
                    )}
                  >
                    <span className="text-sm font-medium text-fg">{tile.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transport Bar */}
      <TransportBar
        isPlaying={isPlaying}
        onPrev={() => sendCmd("slide.prev", {})}
        onPlayPause={() => sendCmd("audio.toggle", {})}
        onNext={() => sendCmd("slide.next", {})}
        onBlack={handleBlack}
        onFreeze={handleFreeze}
        blackActive={blackActive}
        frozenActive={frozenActive}
        showSlideControls={totalSlides > 0}
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

function NoSlidesPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center w-full aspect-video rounded-lg border border-border bg-surface-1 mx-4">
      <p className="text-sm text-fg-muted">{label}</p>
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

