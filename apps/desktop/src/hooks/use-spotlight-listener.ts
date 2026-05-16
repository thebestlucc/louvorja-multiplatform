import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useMonitorsControl } from "../hooks/use-monitors";

/** Wraps a listen() promise to log errors instead of swallowing them silently. */
function safeListen(
  promise: Promise<() => void>,
  eventName: string,
): Promise<() => void> {
  return promise.catch((err) => {
    console.error(`[root] Failed to register listener for "${eventName}":`, err);
    return () => {};
  });
}

/**
 * Listens for spotlight-navigated and spotlight-action Tauri events and dispatches
 * them to router navigation or monitor/projection control functions.
 */
export function useSpotlightListener(): void {
  const router = useRouter();
  const {
    toggleProjector,
    toggleReturn,
    toggleBlackScreen,
    toggleLogoScreen,
  } = useMonitorsControl();

  // Stable refs so the effect closure always calls the latest version
  const toggleProjectorRef = useRef(toggleProjector);
  const toggleReturnRef = useRef(toggleReturn);
  const toggleBlackScreenRef = useRef(toggleBlackScreen);
  const toggleLogoScreenRef = useRef(toggleLogoScreen);
  useEffect(() => { toggleProjectorRef.current = toggleProjector; }, [toggleProjector]);
  useEffect(() => { toggleReturnRef.current = toggleReturn; }, [toggleReturn]);
  useEffect(() => { toggleBlackScreenRef.current = toggleBlackScreen; }, [toggleBlackScreen]);
  useEffect(() => { toggleLogoScreenRef.current = toggleLogoScreen; }, [toggleLogoScreen]);

  // Navigate to a route selected in the detached spotlight window
  useEffect(() => {
    const unlistenPromise = safeListen(
      listen<string>("spotlight-navigated", (event) => {
        router.navigate({ to: event.payload as never });
      }),
      "spotlight-navigated",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [router]);

  // Execute an action selected in the detached spotlight window
  useEffect(() => {
    const unlistenPromise = safeListen(
      listen<string>("spotlight-action", (event) => {
        switch (event.payload) {
          case "toggle-projector":
            toggleProjectorRef.current();
            break;
          case "toggle-return":
            toggleReturnRef.current();
            break;
          case "toggle-black":
            toggleBlackScreenRef.current();
            break;
          case "toggle-logo":
            toggleLogoScreenRef.current();
            break;
          case "clear-projection":
            stopProjectionAndSongAudio();
            break;
          case "open-shortcuts":
            openKeyboardShortcutsPanel();
            break;
          case "start-remote":
            import("../lib/bindings").then(({ commands }) =>
              commands.startRemoteServer(null)
            );
            break;
          case "stop-remote":
            import("../lib/bindings").then(({ commands }) =>
              commands.stopRemoteServer()
            );
            break;
          case "remote-settings":
            router.navigate({ to: "/settings", search: { tab: "remote" } as never });
            break;
        }
      }),
      "spotlight-action",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []); // stable refs — no deps needed
}
