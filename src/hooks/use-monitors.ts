import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMonitors } from "../lib/queries";
import {
  openProjectorWindow,
  closeProjectorWindow,
  openReturnWindow,
  closeReturnWindow,
  toggleBlackScreen as tauriToggleBlack,
  toggleLogoScreen as tauriToggleLogo,
} from "../lib/tauri";
import { useDisplayStore } from "../stores/display-store";
import type { OverlayState } from "../types/presentation";

export function useMonitorsControl() {
  const { data: monitors } = useMonitors();
  const {
    projectorWindowOpen,
    setProjectorWindowOpen,
    returnWindowOpen,
    setReturnWindowOpen,
    isBlackScreen,
    isLogoScreen,
    setBlackScreen,
    setLogoScreen,
  } = useDisplayStore();

  // Sync projector state
  useEffect(() => {
    const unlisten = listen<boolean>("projector-state-changed", (event) => {
      setProjectorWindowOpen(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProjectorWindowOpen]);

  // Sync return window state
  useEffect(() => {
    const unlisten = listen<boolean>("return-state-changed", (event) => {
      setReturnWindowOpen(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setReturnWindowOpen]);

  // Sync overlay state
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-changed", (event) => {
      setBlackScreen(event.payload.blackScreen);
      setLogoScreen(event.payload.logoScreen);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setBlackScreen, setLogoScreen]);

  // Projector
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
      await openProjector(1);
    } else if (monitors && monitors.length === 1) {
      await openProjector(0);
    }
  }, [projectorWindowOpen, monitors, openProjector, closeProjector]);

  // Return window
  const openReturn = useCallback(
    async (index: number) => {
      await openReturnWindow(index);
    },
    [],
  );

  const closeReturn = useCallback(async () => {
    await closeReturnWindow();
  }, []);

  const toggleReturn = useCallback(async () => {
    if (returnWindowOpen) {
      await closeReturn();
    } else if (monitors && monitors.length > 2) {
      // Use third monitor
      await openReturn(2);
    } else if (monitors) {
      // Fallback to primary
      await openReturn(0);
    }
  }, [returnWindowOpen, monitors, openReturn, closeReturn]);

  // Overlays
  const toggleBlackScreen = useCallback(async () => {
    await tauriToggleBlack();
  }, []);

  const toggleLogoScreen = useCallback(async () => {
    await tauriToggleLogo();
  }, []);

  return {
    monitors: monitors ?? [],
    isProjectorOpen: projectorWindowOpen,
    isReturnOpen: returnWindowOpen,
    isBlackScreen,
    isLogoScreen,
    openProjector,
    closeProjector,
    toggleProjector,
    openReturn,
    closeReturn,
    toggleReturn,
    toggleBlackScreen,
    toggleLogoScreen,
  };
}
