import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMonitors } from "../lib/queries";
import { openProjectorWindow, closeProjectorWindow } from "../lib/tauri";
import { useDisplayStore } from "../stores/display-store";

export function useMonitorsControl() {
  const { data: monitors } = useMonitors();
  const { projectorWindowOpen, setProjectorWindowOpen } = useDisplayStore();

  // Keep Zustand in sync with Rust state via events
  useEffect(() => {
    const unlisten = listen<boolean>("projector-state-changed", (event) => {
      setProjectorWindowOpen(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProjectorWindowOpen]);

  const openProjector = useCallback(
    async (index: number) => {
      await openProjectorWindow(index);
    },
    [],
  );

  const closeProjector = useCallback(async () => {
    await closeProjectorWindow();
  }, []);

  const toggleProjector = useCallback(async () => {
    if (projectorWindowOpen) {
      await closeProjector();
    } else if (monitors && monitors.length > 1) {
      // Default to second monitor (index 1)
      await openProjector(1);
    } else if (monitors && monitors.length === 1) {
      await openProjector(0);
    }
  }, [projectorWindowOpen, monitors, openProjector, closeProjector]);

  return {
    monitors: monitors ?? [],
    isProjectorOpen: projectorWindowOpen,
    openProjector,
    closeProjector,
    toggleProjector,
  };
}
