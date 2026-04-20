import { useCallback, useEffect, useMemo } from "react";
import { useSlides } from "./use-slides";
import { useMonitorsControl } from "./use-monitors";
import { usePresentationStore } from "../stores/presentation-store";
import { useQueueStore } from "../stores/queue-store";
import { useAudioStore } from "../stores/audio-store";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { resetCoordinatorPlaybackState } from "./use-playback-coordinator";
import { useDisplayStore } from "../stores/display-store";
import { navigateBible } from "../lib/tauri";
import { useAllSettings } from "../lib/queries";
import {
  SHORTCUT_DEFINITIONS,
  matchesShortcutCombo,
  normalizeShortcutCombo,
} from "../lib/shortcut-definitions";
import { spotlightOpen } from "../lib/tauri";
import { emit } from "@tauri-apps/api/event";
import { useVideoPlayerStore } from "../stores/video-player-store";
import * as videoPipeline from "../lib/tauri/video-pipeline";

export function useKeyboard({ enabled = true }: { enabled?: boolean } = {}) {
  const { nextSlide, prevSlide, goToSlide } = useSlides();
  const { toggleProjector, toggleReturn, toggleBlackScreen, toggleLogoScreen } = useMonitorsControl();
  const { data: allSettings = [] } = useAllSettings({ enabled });

  // Build resolved map: actionId -> normalized local combo
  const shortcutMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const def of SHORTCUT_DEFINITIONS) {
      if (!def.defaultLocal) continue;
      const settingKey = `shortcut.${def.id}.local`;
      const saved = allSettings.find((s) => s.key === settingKey);
      const combo = saved?.value
        ? normalizeShortcutCombo(saved.value, "local")
        : normalizeShortcutCombo(def.defaultLocal, "local");
      map[def.id] = combo;
    }
    return map;
  }, [allSettings]);

  const clearPresentation = useCallback(() => {
    resetCoordinatorPlaybackState();
    usePresentationStore.getState().setSlides([]);
    stopProjectionAndSongAudio();
    // Clear queue when ESC is pressed with one item or at the last item
    const q = useQueueStore.getState();
    if (q.items.length <= 1 || q.currentIndex >= q.items.length - 1) {
      q.clearQueue();
      useMediaPlayerStore.getState().unload();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Spotlight gets priority — works even in text inputs
      if (matchesShortcutCombo(e, shortcutMap["app-command-palette"] ?? "Meta+k")) {
        e.preventDefault();
        spotlightOpen();
        return;
      }

      // Skip other shortcuts when focus is in a text field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Playing Now has its own ArrowLeft/Right handler via use-playing-now-keyboard
      const isPlayingNowRoute = window.location.pathname.startsWith("/playing-now");

      const isBibleRoute = window.location.pathname.startsWith("/bible");
      const isBibleProjecting = useDisplayStore.getState().currentProjectionType === "bible";
      // On Bible route when NOT projecting, let arrow/space through for grid navigation
      if (
        isBibleRoute && !isBibleProjecting &&
        (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "PageDown" || e.key === "PageUp" || e.key === " ")
      ) {
        return;
      }

      // Find which action matches this key event
      const matchedAction = Object.entries(shortcutMap).find(
        ([, combo]) => matchesShortcutCombo(e, combo),
      );
      if (!matchedAction) return;

      const [actionId] = matchedAction;
      e.preventDefault();

      switch (actionId) {
        case "app-shortcuts-help":
          openKeyboardShortcutsPanel();
          break;

        case "playback-play-pause": {
          const mpState = useMediaPlayerStore.getState();
          if (mpState.status === "playing") {
            if (mpState.timelineSource === "audio") {
              useAudioStore.getState().pause();
            } else if (mpState.timelineSource === "video") {
              if (useVideoPlayerStore.getState().useRustVideoPipeline) {
                videoPipeline.pause().catch(() => {});
              } else {
                emit("video-control", { action: "pause" });
              }
            }
            mpState.setStatus("paused");
          } else if (mpState.status === "paused") {
            if (mpState.timelineSource === "audio") {
              useAudioStore.getState().resume();
            } else if (mpState.timelineSource === "video") {
              if (useVideoPlayerStore.getState().useRustVideoPipeline) {
                videoPipeline.play().catch(() => {});
              } else {
                emit("video-control", { action: "play" });
              }
            }
            mpState.setStatus("playing");
          } else {
            nextSlide();
          }
          break;
        }

        case "slides-next": {
          if (isPlayingNowRoute) break; // handled by use-playing-now-keyboard
          const projType = useDisplayStore.getState().currentProjectionType;
          if (projType === "bible") {
            navigateBible("next");
          } else {
            nextSlide();
          }
          break;
        }

        case "slides-prev": {
          if (isPlayingNowRoute) break; // handled by use-playing-now-keyboard
          const projType2 = useDisplayStore.getState().currentProjectionType;
          if (projType2 === "bible") {
            navigateBible("prev");
          } else {
            prevSlide();
          }
          break;
        }

        case "slides-clear":
          if (isPlayingNowRoute) break; // handled by use-playing-now-keyboard (calls stop())
          clearPresentation();
          break;

        case "display-projector":
          toggleProjector();
          break;

        case "display-return":
          toggleReturn();
          break;

        case "display-black":
          toggleBlackScreen();
          break;

        case "display-logo":
          toggleLogoScreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    nextSlide,
    prevSlide,
    toggleProjector,
    toggleReturn,
    toggleBlackScreen,
    toggleLogoScreen,
    clearPresentation,
    shortcutMap,
  ]);

  // Global shortcuts (OS-level) — dispatched by Rust via events
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<string>("global-shortcut", (event) => {
        switch (event.payload) {
          case "slides-next": {
            const projType = useDisplayStore.getState().currentProjectionType;
            if (projType === "bible") navigateBible("next");
            else nextSlide();
            break;
          }
          case "slides-prev": {
            const projType = useDisplayStore.getState().currentProjectionType;
            if (projType === "bible") navigateBible("prev");
            else prevSlide();
            break;
          }
          case "display-black":
            toggleBlackScreen();
            break;
          case "display-logo":
            toggleLogoScreen();
            break;
          case "app-shortcuts-help":
            openKeyboardShortcutsPanel();
            break;
        }
      }).then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enabled, nextSlide, prevSlide, toggleBlackScreen, toggleLogoScreen]);

  // Remote control events — dispatched by the Rust remote handlers
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let unlistens: Array<() => void> = [];

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;

      Promise.all([
        // remote-slide-goto: jump to a specific slide index
        listen<{ index: number }>("remote-slide-goto", (e) => {
          goToSlide(e.payload.index);
        }),
        // remote-slide-clear: clear current projection (same as Escape)
        listen("remote-slide-clear", () => {
          clearPresentation();
        }),
        // remote-service-stop: stop service playback
        listen("remote-service-stop", () => {
          usePresentationStore.getState().setPlayingLiturgy(false);
        }),
        // remote-service-next: advance to next service item
        listen("remote-service-next", () => {
          const { activeLiturgyItemIndex, liturgyItemsCount } = usePresentationStore.getState();
          if (activeLiturgyItemIndex < liturgyItemsCount - 1) {
            usePresentationStore.getState().setActiveLiturgyItemIndex(activeLiturgyItemIndex + 1);
          }
        }),
        // remote-service-prev: go to previous service item
        listen("remote-service-prev", () => {
          const { activeLiturgyItemIndex } = usePresentationStore.getState();
          if (activeLiturgyItemIndex > 0) {
            usePresentationStore.getState().setActiveLiturgyItemIndex(activeLiturgyItemIndex - 1);
          }
        }),
        // remote-service-jump: jump to specific service item index
        listen<{ index: number }>("remote-service-jump", (e) => {
          const { liturgyItemsCount } = usePresentationStore.getState();
          const idx = Math.max(0, Math.min(e.payload.index, liturgyItemsCount - 1));
          usePresentationStore.getState().setActiveLiturgyItemIndex(idx);
        }),
      ]).then((fns) => {
        if (cancelled) {
          fns.forEach((fn) => fn());
        } else {
          unlistens = fns;
        }
      });
    });

    return () => {
      cancelled = true;
      unlistens.forEach((fn) => fn());
    };
  }, [enabled, goToSlide, clearPresentation]);
}
