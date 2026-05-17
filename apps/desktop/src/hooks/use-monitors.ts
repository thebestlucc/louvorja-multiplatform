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
import { catcher, thrower } from "../lib/catcher";
import { useDisplayStore } from "../stores/display-store";
import { resolveProjectionMonitorIndexes } from "../lib/monitor-resolution";
import { useProjectionState } from "./use-projection-state";

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

  // Overlay state from the Projection Hub (Phase 5). Reference-stable
  // snapshot.overlay enum drives the local Zustand mirror; black/logo bools
  // derived on each render.
  const projection = useProjectionState();
  useEffect(() => {
    if (!projection) return;
    setBlackScreen(projection.overlay === "black");
    setLogoScreen(projection.overlay === "logo");
  }, [projection, setBlackScreen, setLogoScreen]);

  // Projector
  const openProjector = useCallback(
    async (monitorId: string) => {
      const [, error] = await catcher(openProjectorWindow(monitorId), { notify: true });
      if (error) {
        thrower(error);
      }
    },
    [],
  );

  const closeProjector = useCallback(async () => {
    const [, error] = await catcher(closeProjectorWindow(), { notify: true });
    if (error) {
      thrower(error);
    }
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
      const [, error] = await catcher(openReturnWindow(monitorId), { notify: true });
      if (error) {
        thrower(error);
      }
    },
    [],
  );

  const closeReturn = useCallback(async () => {
    const [, error] = await catcher(closeReturnWindow(), { notify: true });
    if (error) {
      thrower(error);
    }
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
    const [, error] = await catcher(tauriToggleBlack(), { notify: true });
    if (error) {
      thrower(error);
    }
  }, []);

  const toggleLogoScreen = useCallback(async () => {
    const [, error] = await catcher(tauriToggleLogo(), { notify: true });
    if (error) {
      thrower(error);
    }
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
