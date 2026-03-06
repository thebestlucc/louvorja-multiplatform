import { createRootRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { CommandPalette } from "../components/ui/command-palette";
import { KeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { UpdateNotification } from "../components/update-notification";
import { useKeyboard } from "../hooks/use-keyboard";
import { usePlaybackCoordinator } from "../hooks/use-playback-coordinator";
import { useMonitorsControl } from "../hooks/use-monitors";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { queryKeys, useMonitorConfigs, useMonitors } from "../lib/queries";
import { setMonitorConfig } from "../lib/tauri";
import { resolveAutomaticProjectionAssignments } from "../lib/monitor-resolution";
import { useThemeStore } from "../stores/theme-store";
import { useLegacyFetchStore } from "../stores/legacy-fetch-store";
import { catcher } from "../lib/catcher";
import { checkDbVersion } from "../lib/tauri";
import { LANGUAGES, type Language } from "../lib/constants";
import { isOnboardingRequired } from "../lib/onboarding";
import type { LegacyFetchProgress, LegacyFetchReport } from "../lib/bindings";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (isOnboardingExemptRoute(location.pathname)) {
      return;
    }

    const needsOnboarding = await isOnboardingRequired();
    if (needsOnboarding) {
      throw redirect({ to: "/onboarding/welcome" });
    }
  },
  component: RootLayout,
});

const BARE_ROUTES = ["/projector", "/return", "/spotlight"];

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBareRoute = usesBareLayout(pathname);
  const queryClient = useQueryClient();
  const setLanguage = useThemeStore((state) => state.setLanguage);
  const { data: monitors = [], isSuccess: monitorsLoaded } = useMonitors();
  const { data: monitorConfigs = [], isSuccess: monitorConfigsLoaded } = useMonitorConfigs();
  const previousMonitorIdsRef = useRef<string[] | null>(null);
  const previousPrimaryMonitorIdRef = useRef<string | null>(null);
  const syncingMonitorAssignmentsRef = useRef(false);
  useThemeStore((state) => state.theme);
  useTimerAlerts(!isBareRoute);

  useEffect(() => {
    const applyLanguage = (candidate: string | null | undefined) => {
      if (!isLanguage(candidate)) {
        return;
      }
      if (useThemeStore.getState().language === candidate) {
        return;
      }
      setLanguage(candidate);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "language") {
        return;
      }
      applyLanguage(event.newValue);
    };

    window.addEventListener("storage", onStorage);

    const unlistenPromise = listen<SettingChangedPayload>("setting-changed", (event) => {
      if (event.payload.key !== "app.language") {
        return;
      }
      applyLanguage(event.payload.value);
    }).catch(() => () => {});

    return () => {
      window.removeEventListener("storage", onStorage);
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setLanguage]);

  useEffect(() => {
    const unlistenPromise = listen("monitors-changed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
    }).catch(() => () => {});

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlistenPromise = listen("data-changed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    }).catch(() => () => {});

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  // Global listener for legacy fetch progress events - persists across navigation
  const setLegacyFetchProgress = useLegacyFetchStore((s) => s.setProgress);
  const setLegacyFetchReport = useLegacyFetchStore((s) => s.setReport);
  const prevLegacyFetchStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unlistenProgress = listen<LegacyFetchProgress>("legacy-fetch-progress", (event) => {
      const store = useLegacyFetchStore.getState();
      // Only update if runId matches or if no runId is set yet
      if (!store.runId || event.payload.runId === store.runId) {
        setLegacyFetchProgress(event.payload);
        
        const status = event.payload.status;

        // Reset cancelling flag when a terminal status is reached
        if (["cancelled", "completed", "failed"].includes(status) && store.isCancelling) {
          useLegacyFetchStore.getState().setIsCancelling(false);
        }

        // Invalidate hymns when fetch completes
        if (status === "completed" && prevLegacyFetchStatusRef.current !== "completed") {
          queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
        }
        prevLegacyFetchStatusRef.current = status;
      }
    }).catch(() => () => {});

    const unlistenReport = listen<LegacyFetchReport>("legacy-fetch-report", (event) => {
      const store = useLegacyFetchStore.getState();
      if (!store.runId || event.payload.runId === store.runId) {
        setLegacyFetchReport(event.payload);
      }
    }).catch(() => () => {});

    return () => {
      unlistenProgress.then((unlisten) => unlisten());
      unlistenReport.then((unlisten) => unlisten());
    };
  }, [queryClient, setLegacyFetchProgress, setLegacyFetchReport]);

  useEffect(() => {
    if (isBareRoute) {
      return;
    }
    if (!monitorsLoaded || !monitorConfigsLoaded) {
      return;
    }

    const currentMonitorIds = monitors.map((monitor) => monitor.id);
    const currentPrimaryMonitorId = monitors.find((monitor) => monitor.isPrimary)?.id ?? null;
    const previousMonitorIds = previousMonitorIdsRef.current;
    const previousPrimaryMonitorId = previousPrimaryMonitorIdRef.current;

    previousMonitorIdsRef.current = currentMonitorIds;
    previousPrimaryMonitorIdRef.current = currentPrimaryMonitorId;

    if (!previousMonitorIds || syncingMonitorAssignmentsRef.current) {
      return;
    }

    const assignments = resolveAutomaticProjectionAssignments(
      monitors,
      monitorConfigs,
      previousMonitorIds,
      previousPrimaryMonitorId,
    );
    if (!assignments) {
      return;
    }

    syncingMonitorAssignmentsRef.current = true;
    void (async () => {
      await catcher(async () => {
        await setMonitorConfig(assignments.projectorMonitorId, "projector");
        await setMonitorConfig(assignments.returnMonitorId, "return");
        await queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
      });
      syncingMonitorAssignmentsRef.current = false;
    })();
  }, [isBareRoute, monitorConfigs, monitorConfigsLoaded, monitors, monitorsLoaded, queryClient]);

  // Check for new hymnal data version on mount (runs once, only when not on bare routes)
  const { t } = useTranslation();
  useEffect(() => {
    if (isBareRoute) return;
    void (async () => {
      await catcher(async () => {
        const result = await checkDbVersion();
        if (result.hasNewVersion) {
          toast.info(t("settings.legacyFetch.newVersionAvailable"), {
            description: t("settings.legacyFetch.newVersionDescription"),
          });
        }
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  usePlaybackCoordinator();
  useKeyboard({ enabled: !isBareRoute });

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

  // Spotlight: navigate to a route selected in the detached spotlight window
  useEffect(() => {
    const unlistenPromise = listen<string>("spotlight-navigated", (event) => {
      void router.navigate({ to: event.payload as never });
    }).catch(() => () => {});

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [router]);

  // Spotlight: execute an action selected in the detached spotlight window
  useEffect(() => {
    const unlistenPromise = listen<string>("spotlight-action", (event) => {
      switch (event.payload) {
        case "toggle-projector":
          void toggleProjectorRef.current();
          break;
        case "toggle-return":
          void toggleReturnRef.current();
          break;
        case "toggle-black":
          void toggleBlackScreenRef.current();
          break;
        case "toggle-logo":
          void toggleLogoScreenRef.current();
          break;
        case "clear-projection":
          void stopProjectionAndSongAudio();
          break;
        case "open-shortcuts":
          openKeyboardShortcutsPanel();
          break;
      }
    }).catch(() => () => {});

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []); // stable refs — no deps needed

  if (isBareRoute) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main id="main-scroll-area" className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <CommandPalette />
      <KeyboardShortcutsPanel />
      <UpdateNotification />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "bg-surface text-foreground border-border",
        }}
      />
    </div>
  );
}

interface SettingChangedPayload {
  key: string;
  value: string;
}

function isLanguage(candidate: string | null | undefined): candidate is Language {
  if (!candidate) {
    return false;
  }
  return LANGUAGES.includes(candidate as Language);
}

function usesBareLayout(pathname: string): boolean {
  if (BARE_ROUTES.includes(pathname)) {
    return true;
  }
  return pathname.startsWith("/onboarding");
}

function isOnboardingExemptRoute(pathname: string): boolean {
  if (BARE_ROUTES.includes(pathname)) {
    return true;
  }
  return pathname.startsWith("/onboarding");
}
