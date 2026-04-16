/**
 * use-remote-bridge.ts
 *
 * Listens for Tauri events emitted by the Rust remote WS handlers and bridges
 * them to the desktop app's stores / hooks.
 *
 * Mounted once in __root.tsx (enabled: !isBareRoute). Uses the same lazy-listen
 * pattern as use-keyboard.ts so the Tauri IPC is not imported in projection windows.
 */

import { useEffect } from "react";
import { emit } from "@tauri-apps/api/event";
import { usePresentationStore } from "../stores/presentation-store";
import { useQueueStore } from "../stores/queue-store";
import { useVideoPlayerStore } from "../stores/video-player-store";
import { useMonitorsControl } from "./use-monitors";
import { useDisplayStore } from "../stores/display-store";
import { setMonitorConfig, setCurrentSlide } from "../lib/tauri/display";
import { catcher } from "../lib/catcher";
import { commands } from "../lib/bindings";
import { defaultBackground } from "../types/presentation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemoteVideoCmdPayload {
  action: "play" | "pause" | "seek";
  value?: number;
}

interface RemoteVideoSetTargetsPayload {
  /** Array of screen names that should render live video, e.g. ["projector", "return"]. */
  targets: string[];
}

interface RemoteServiceStartPayload {
  serviceId: number;
}

interface RemoteHymnSelectPayload {
  id: number;
}

interface RemoteBibleSelectPayload {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  bookName: string;
}

interface RemoteQueuePlayPayload {
  id: string;
}

interface RemoteProjectorSetMonitorPayload {
  monitorId: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRemoteBridge({ enabled = true }: { enabled?: boolean } = {}) {
  const { toggleProjector, toggleReturn, closeProjector, closeReturn } =
    useMonitorsControl();

  // Stable refs so the effect closure always calls the latest version
  // (same pattern as __root.tsx)
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const unlistens: Array<() => void> = [];

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;

      Promise.all([
        // ── Projector open/close ───────────────────────────────────────────
        // Guard with store snapshot so these are idempotent (open=no-op if already
        // open; close=no-op if already closed). Avoids accidental toggle semantics.
        listen("remote-projector-open", () => {
          if (!useDisplayStore.getState().projectorWindowOpen) void toggleProjector();
        }),
        listen("remote-projector-close", () => {
          void closeProjector();
        }),
        listen<RemoteProjectorSetMonitorPayload>("remote-projector-set-monitor", (e) => {
          void catcher(setMonitorConfig(e.payload.monitorId, "projector"));
        }),

        // ── Return monitor open/close ──────────────────────────────────────
        listen("remote-return-open", () => {
          if (!useDisplayStore.getState().returnWindowOpen) void toggleReturn();
        }),
        listen("remote-return-close", () => {
          void closeReturn();
        }),

        // ── Service start ─────────────────────────────────────────────────
        listen<RemoteServiceStartPayload>("remote-service-start", (e) => {
          const store = usePresentationStore.getState();
          store.setActiveLiturgy(e.payload.serviceId);
          store.setPlayingLiturgy(true);
          store.setActiveLiturgyItemIndex(0);
        }),

        // ── Video control (bridge remote-video-cmd → video-control) ───────
        listen<RemoteVideoCmdPayload>("remote-video-cmd", (e) => {
          void emit("video-control", e.payload);
        }),

        // ── Video targets (remote-video-set-targets) ──────────────────────
        listen<RemoteVideoSetTargetsPayload>("remote-video-set-targets", (e) => {
          useVideoPlayerStore.getState().setVideoPlaybackTargets(e.payload.targets);
        }),

        // ── Audio skip next / prev ────────────────────────────────────────
        listen("remote-audio-skip-next", () => {
          useQueueStore.getState().next();
        }),
        listen("remote-audio-skip-prev", () => {
          useQueueStore.getState().prev();
        }),

        // ── Hymn select (from search.select type=hymns) ───────────────────
        // Route through the queue so use-playback-coordinator handles audio init,
        // sync points, slides, and projection — same path as desktop hymnal play.
        listen<RemoteHymnSelectPayload>("remote-hymn-select", (e) => {
          void (async () => {
            const [result] = await catcher(commands.getHymn(e.payload.id));
            if (!result || result.status !== "ok") return;
            const hymn = result.data;
            useQueueStore.getState().addToQueue(
              [{ id: crypto.randomUUID(), hymn, type: "audio" }],
              true,
            );
          })();
        }),

        // ── Bible select (from search.select type=bible) ──────────────────
        listen<RemoteBibleSelectPayload>("remote-bible-select", (e) => {
          const { chapter, verse, text, bookName } = e.payload;
          const reference = `${bookName} ${chapter}:${verse}`;
          const slide = {
            slideType: "bible" as const,
            text,
            reference,
            mode: { alignment: "center" as const, refPosition: "bottom" as const, textShadow: false, gradient: null, fontFamily: null },
            background: defaultBackground(),
            text_color: null,
            text_size: null,
          };
          usePresentationStore.getState().setSlides([slide]);
          usePresentationStore.getState().setActiveSlideIndex(0);
          void catcher(setCurrentSlide(slide));
        }),

        // ── Queue play (jump to item by UUID) ─────────────────────────────
        listen<RemoteQueuePlayPayload>("remote-queue-play", (e) => {
          const q = useQueueStore.getState();
          const idx = q.items.findIndex((item) => item.id === e.payload.id);
          if (idx !== -1) {
            q.setCurrentIndex(idx);
          }
        }),
      ]).then((fns) => {
        if (cancelled) {
          fns.forEach((fn) => fn());
        } else {
          fns.forEach((fn) => unlistens.push(fn));
        }
      });
    });

    return () => {
      cancelled = true;
      unlistens.forEach((fn) => fn());
    };
  }, [enabled, toggleProjector, closeProjector, toggleReturn, closeReturn]);
}
