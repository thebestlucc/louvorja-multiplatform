import { createRootRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { AppToaster } from "../components/ui/app-toaster";
import { KeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { UpdateNotification } from "../components/update-notification";
import { PersistentVideoPlayer } from "../components/online-videos/persistent-video-player";
import { useKeyboard } from "../hooks/use-keyboard";
import { usePlaybackCoordinator } from "../hooks/use-playback-coordinator";
import { useDownloadEvents } from "../hooks/use-download-events";
import { useMonitorsControl } from "../hooks/use-monitors";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { ContentSyncModal } from "../components/content-sync/content-sync-modal";
import { PackSyncDialog, PackSyncProgressDialog } from "../components/content-sync/pack-sync-dialog";
import { queryKeys, useMonitorConfigs, useMonitors, usePlanPackSync } from "../lib/queries";
import { setMonitorConfig } from "../lib/tauri";
import { resolveAutomaticProjectionAssignments } from "../lib/monitor-resolution";
import { useThemeStore } from "../stores/theme-store";
import { useContentSyncStore } from "../stores/content-sync-store";
import { catcher } from "../lib/catcher";
import { LANGUAGES, type Language } from "../lib/constants";
import { isOnboardingRequired } from "../lib/onboarding";
import type { ContentSyncProgress, ContentSyncReport, PackSyncProgress } from "../types/content-sync";

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

const BARE_ROUTES = ["/projector", "/return", "/spotlight", "/identify"];

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
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
    }).catch(() => () => {});

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  const contentSyncPromptSummary = useContentSyncStore((s) => s.promptSummary);
  const contentSyncPromptOpen = useContentSyncStore((s) => s.isPromptOpen);
  const closeContentSyncPrompt = useContentSyncStore((s) => s.closePrompt);
  const setContentSyncProgress = useContentSyncStore((s) => s.setProgress);
  const setContentSyncReport = useContentSyncStore((s) => s.setReport);
  const packSyncPlanQuery = usePlanPackSync({ enabled: !isBareRoute });
  const packSyncPlanShownRef = useRef(false);
  const openPackSyncPlan = useContentSyncStore((s) => s.openPackSyncPlan);
  const setPackSyncProgress = useContentSyncStore((s) => s.setPackSyncProgress);
  const setPackSyncPendingCount = useContentSyncStore((s) => s.setPackSyncPendingCount);
  const setPackSyncPlan = useContentSyncStore((s) => s.setPackSyncPlan);

  useEffect(() => {
    const unlistenProgress = listen<ContentSyncProgress>("content-sync-progress", (event) => {
      const store = useContentSyncStore.getState();
      if (!store.runId || event.payload.runId === store.runId) {
        setContentSyncProgress(event.payload);
      }
    }).catch(() => () => {});

    const unlistenReport = listen<ContentSyncReport>("content-sync-report", (event) => {
      const store = useContentSyncStore.getState();
      if (!store.runId || event.payload.runId === store.runId) {
        setContentSyncReport(event.payload);
      }
    }).catch(() => () => {});

    return () => {
      unlistenProgress.then((unlisten) => unlisten());
      unlistenReport.then((unlisten) => unlisten());
    };
  }, [queryClient, setContentSyncProgress, setContentSyncReport]);

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


  // Track pending pack count + plan for bell notification
  useEffect(() => {
    const plan = packSyncPlanQuery.data ?? null;
    // Only count visible (non-db) items for the bell badge
    const visibleItems = plan?.items.filter((i) => !i.packId.startsWith("content-db-")) ?? [];
    const count = visibleItems.length;
    setPackSyncPendingCount(count);
    setPackSyncPlan(count > 0 ? plan : null);
  }, [packSyncPlanQuery.data, setPackSyncPendingCount, setPackSyncPlan]);

  // Show pack sync dialog on startup if there are items OR if language selection is needed
  useEffect(() => {
    if (isBareRoute || packSyncPlanShownRef.current) return;
    const plan = packSyncPlanQuery.data;
    const hasVisible = plan?.items.some((i) => !i.packId.startsWith("content-db-"));
    const needsLangSetup = plan && plan.selectedLanguages.length === 0 && plan.availableLanguages.length > 0;
    if (plan && (hasVisible || needsLangSetup)) {
      packSyncPlanShownRef.current = true;
      openPackSyncPlan();
    }
  }, [packSyncPlanQuery.data, isBareRoute, openPackSyncPlan]);

  // Listen for pack-sync-progress events
  useEffect(() => {
    if (isBareRoute) return;
    const unlisten = listen<PackSyncProgress>("pack-sync-progress", (event) => {
      setPackSyncProgress(event.payload);
      const status = event.payload.status;
      if (status === "completed" || status === "failed" || status === "cancelled") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.packSyncPlan });
      }
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, [isBareRoute, setPackSyncProgress, queryClient]);

  usePlaybackCoordinator();
  useDownloadEvents();
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
      <KeyboardShortcutsPanel />
      <ContentSyncModal
        open={contentSyncPromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeContentSyncPrompt();
          }
        }}
        summary={contentSyncPromptSummary}
        onOpenSettings={() => {
          closeContentSyncPrompt();
          void router.navigate({ to: "/settings", search: { tab: "sync" } });
        }}
      />
      <PackSyncDialog />
      <PackSyncProgressDialog />
      <UpdateNotification />
      <AppToaster />
      <PersistentVideoPlayer />
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
