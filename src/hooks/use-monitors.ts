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
import { toast } from "sonner";
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

  // Debug: listen for projector/return window open and projector-mounted events
  useEffect(() => {
    const un1 = listen<string>("projector-window-opened", (event) => {
      console.log("projector-window-opened -> monitorId:", event.payload);
    });
    const un2 = listen<string>("return-window-opened", (event) => {
      console.log("return-window-opened -> monitorId:", event.payload);
    });
    const un3 = listen("projector-mounted", () => {
      console.log("projector-mounted event received (projector webview mounted)");
    });

    return () => {
      un1.then((fn) => fn());
      un2.then((fn) => fn());
      un3.then((fn) => fn());
    };
  }, []);

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
      try {
        await openProjectorWindow(monitorId);
      } catch (err) {
        console.error("openProjectorWindow failed:", err);
        toast.error(String(err));
        throw err;
      }
    },
    [],
  );

  const closeProjector = useCallback(async () => {
    try {
      await closeProjectorWindow();
    } catch (err) {
      console.error("closeProjectorWindow failed:", err);
      toast.error(String(err));
      throw err;
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
      try {
        await openReturnWindow(monitorId);
      } catch (err) {
        console.error("openReturnWindow failed:", err);
        toast.error(String(err));
        throw err;
      }
    },
    [],
  );

  const closeReturn = useCallback(async () => {
    try {
      await closeReturnWindow();
    } catch (err) {
      console.error("closeReturnWindow failed:", err);
      toast.error(String(err));
      throw err;
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
    try {
      await tauriToggleBlack();
    } catch (err) {
      console.error("toggleBlackScreen failed:", err);
      toast.error(String(err));
      throw err;
    }
  }, []);

  const toggleLogoScreen = useCallback(async () => {
    try {
      await tauriToggleLogo();
    } catch (err) {
      console.error("toggleLogoScreen failed:", err);
      toast.error(String(err));
      throw err;
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
