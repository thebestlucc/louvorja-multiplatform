import { createRootRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { SlideNavBar } from "../components/display/slide-nav-bar";
import { CommandPalette } from "../components/ui/command-palette";
import { KeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { UpdateNotification } from "../components/update-notification";
import { useKeyboard } from "../hooks/use-keyboard";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { queryKeys, useMonitorConfigs, useMonitors } from "../lib/queries";
import { setMonitorConfig } from "../lib/tauri";
import { resolveAutomaticProjectionAssignments } from "../lib/monitor-resolution";
import { useThemeStore } from "../stores/theme-store";
import { useLegacyFetchStore } from "../stores/legacy-fetch-store";
import { LANGUAGES, type Language } from "../lib/constants";
import { isOnboardingRequired } from "../lib/onboarding";
import type { LegacyFetchProgress, LegacyFetchReport } from "../types/legacy-fetch";

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

const BARE_ROUTES = ["/projector", "/return"];

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
  useTimerAlerts({ enabled: !isBareRoute });

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
        
        // Invalidate hymns when fetch completes
        const status = event.payload.status;
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
    const currentPrimaryMonitorId = monitors.find((monitor) => monitor.is_primary)?.id ?? null;
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
      try {
        await setMonitorConfig(assignments.projectorMonitorId, "projector");
        await setMonitorConfig(assignments.returnMonitorId, "return");
        await queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
      } finally {
        syncingMonitorAssignmentsRef.current = false;
      }
    })();
  }, [isBareRoute, monitorConfigs, monitorConfigsLoaded, monitors, monitorsLoaded, queryClient]);

  useKeyboard({ enabled: !isBareRoute });

  if (isBareRoute) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
        <SlideNavBar />
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
