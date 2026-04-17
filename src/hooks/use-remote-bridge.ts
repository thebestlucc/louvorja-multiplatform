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
import { buildQueueItemsFromRemote, type RemoteQueueAddPayload } from "./build-queue-items-from-remote";

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
          const validTargets = e.payload.targets.filter(
            (t): t is "main" | "projector" | "return" =>
              t === "main" || t === "projector" || t === "return",
          );
          useVideoPlayerStore.getState().setVideoPlaybackTargets(validTargets);
        }),

        // ── Audio skip next / prev ────────────────────────────────────────
        listen("remote-audio-skip-next", () => {
          useQueueStore.getState().next();
        }),
        listen("remote-audio-skip-prev", () => {
          useQueueStore.getState().prev();
        }),

        // ── Hymn select (from search.select type=hymns) ───────────────────
        // "Play now" single-item path — called by the PWA's bottom action bar when the user
        // presses Play now. For multi-select Play now, the FIRST selected item goes via this
        // path; the REMAINING items go via remote-queue-add.
        // Route through the queue so use-playback-coordinator handles audio init,
        // sync points, slides, and projection — same path as desktop hymnal play.
        listen<RemoteHymnSelectPayload>("remote-hymn-select", (e) => {
          void (async () => {
            const [result] = await catcher(commands.getHymn(e.payload.id));
            if (!result || result.status !== "ok") return;
            const hymn = result.data;
            useQueueStore.getState().addToQueue(
              [{ id: crypto.randomUUID(), kind: "hymn", hymn, type: "audio" }],
              true,
            );
          })();
        }),

        // ── Queue add (from search.tsx "Add to queue" action — no projection) ─
        // Appends mixed-kind items to existing queue. Does NOT clear or auto-project.
        listen<RemoteQueueAddPayload>("remote-queue-add", (e) => {
          void (async () => {
            const items = await buildQueueItemsFromRemote(e.payload);
            if (items.length === 0) return;
            useQueueStore.getState().addToQueue(items, false);
          })();
        }),

        // ── Bible select (from search.select type=bible) ──────────────────
        // "Play now" single-item path — called by the PWA's bottom action bar when the user
        // presses Play now. For multi-select Play now, the FIRST selected item goes via this
        // path; the REMAINING items go via remote-queue-add.
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
          // Light up the playing-now indicator — sidebar checks currentProjectionType.
          useDisplayStore.getState().setCurrentProjectionType("bible");
          void catcher(setCurrentSlide(slide));
        }),

        // ── Video select (from search.select type=video) ──────────────────
        listen<{ videoSource: "youtube" | "local"; videoId?: string; videoUrl?: string; videoTitle?: string }>(
          "remote-video-select", (e) => {
            // Clear queue + start single video item
            const item = {
              id: crypto.randomUUID(),
              kind: "video" as const,
              type: "projection" as const,
              title: e.payload.videoTitle ?? e.payload.videoUrl ?? e.payload.videoId ?? "Video",
              videoMedia: { ...e.payload },
            };
            useQueueStore.getState().addToQueue([item], true);
          },
        ),

        // ── Presentation select (from search.select type=presentation) ────
        listen<{ presentationId: number }>(
          "remote-presentation-select", (e) => {
            const item = {
              id: crypto.randomUUID(),
              kind: "presentation" as const,
              type: "projection" as const,
              title: `Presentation #${e.payload.presentationId}`,
              presentationId: e.payload.presentationId,
            };
            useQueueStore.getState().addToQueue([item], true);
          },
        ),

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
