import { useCallback } from "react";
import { useMonitors } from "../lib/queries";
import { openProjectorWindow, closeProjectorWindow } from "../lib/tauri";
import { useDisplayStore } from "../stores/display-store";

export function useMonitorsControl() {
  const { data: monitors } = useMonitors();
  const { projectorWindowOpen, setProjectorWindowOpen } = useDisplayStore();

  const openProjector = useCallback(
    async (index: number) => {
      await openProjectorWindow(index);
      setProjectorWindowOpen(true);
    },
    [setProjectorWindowOpen],
  );

  const closeProjector = useCallback(async () => {
    await closeProjectorWindow();
    setProjectorWindowOpen(false);
  }, [setProjectorWindowOpen]);

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
