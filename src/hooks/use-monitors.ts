import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMonitorConfigs, useMonitors } from "../lib/queries";
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
import { resolveProjectionMonitorIndexes } from "../lib/monitor-resolution";

export function useMonitorsControl() {
  const { data: monitors } = useMonitors();
  const { data: monitorConfigs } = useMonitorConfigs();
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
    async (monitorId: string) => {
      await openProjectorWindow(monitorId);
    },
    [],
  );

  const closeProjector = useCallback(async () => {
    await closeProjectorWindow();
  }, []);

  const toggleProjector = useCallback(async () => {
    if (projectorWindowOpen) {
      await closeProjector();
      return;
    }

    const resolvedIndexes = resolveProjectionMonitorIndexes(monitors ?? [], monitorConfigs ?? []);
    if (!resolvedIndexes) {
      return;
    }
    const targetMonitor = monitors?.[resolvedIndexes.projectorIndex];
    if (!targetMonitor) {
      return;
    }
    await openProjector(targetMonitor.id);
  }, [projectorWindowOpen, monitors, monitorConfigs, openProjector, closeProjector]);

  // Return window
  const openReturn = useCallback(
    async (monitorId: string) => {
      await openReturnWindow(monitorId);
    },
    [],
  );

  const closeReturn = useCallback(async () => {
    await closeReturnWindow();
  }, []);

  const toggleReturn = useCallback(async () => {
    if (returnWindowOpen) {
      await closeReturn();
      return;
    }

    const resolvedIndexes = resolveProjectionMonitorIndexes(monitors ?? [], monitorConfigs ?? []);
    if (!resolvedIndexes) {
      return;
    }
    const targetMonitor = monitors?.[resolvedIndexes.returnIndex];
    if (!targetMonitor) {
      return;
    }
    await openReturn(targetMonitor.id);
  }, [returnWindowOpen, monitors, monitorConfigs, openReturn, closeReturn]);

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
