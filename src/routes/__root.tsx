import { createRootRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Square, ExternalLink } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { AppToaster } from "../components/ui/app-toaster";
import { KeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { UpdateNotification } from "../components/update-notification";
import { PersistentVideoPlayer } from "../components/online-videos/persistent-video-player";
import { useKeyboard } from "../hooks/use-keyboard";
import { useLiturgyPlayback } from "../hooks/use-liturgy-playback";
import { usePlaybackCoordinator } from "../hooks/use-playback-coordinator";
import { useDownloadEvents } from "../hooks/use-download-events";
import { useMonitorsControl } from "../hooks/use-monitors";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { deletePreference } from "../lib/store";
import { Button } from "../components/ui/button";
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
import { SpotlightTour } from "../components/tour/spotlight-tour";
import { completeRouteTour } from "../lib/tour";
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

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBareRoute = usesBareLayout(pathname);
  const queryClient = useQueryClient();

  // Projection windows: disable pointer events on body so YouTube iframes never
  // show their native controls/HUD on hover or focus. Only for actual projection windows, not onboarding.
  const isProjectionWindow = BARE_ROUTES.includes(pathname);
  useEffect(() => {
    if (isProjectionWindow) {
      document.body.classList.add("pointer-events-none");
      return () => { document.body.classList.remove("pointer-events-none"); };
    }
  }, [isProjectionWindow]);
  // Spotlight tour state — triggered via sessionStorage from onboarding ready page
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (isBareRoute) return;
    if (sessionStorage.getItem("louvorja.startTour") === "true") {
      sessionStorage.removeItem("louvorja.startTour");
      const timer = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isBareRoute]);
  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    // Mark home route tour as completed too to avoid double-touring
    void completeRouteTour("/");
  }, []);

  const setLanguage = useThemeStore((state) => state.setLanguage);
  const { data: monitors = [], isSuccess: monitorsLoaded } = useMonitors();
  const { data: monitorConfigs = [], isSuccess: monitorConfigsLoaded } = useMonitorConfigs();
  const previousMonitorIdsRef = useRef<string[] | null>(null);
  const previousPrimaryMonitorIdRef = useRef<string | null>(null);
  const syncingMonitorAssignmentsRef = useRef(false);
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

    const unlistenPromise = safeListen(
      listen<SettingChangedPayload>("setting-changed", (event) => {
        if (event.payload.key !== "app.language") {
          return;
        }
        applyLanguage(event.payload.value);
      }),
      "setting-changed",
    );

    return () => {
      window.removeEventListener("storage", onStorage);
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setLanguage]);

  useEffect(() => {
    const unlistenPromise = safeListen(
      listen("monitors-changed", () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.monitors.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
      }),
      "monitors-changed",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlistenPromise = safeListen(
      listen("data-changed", () => {
        // Invalidate search results and album listings (content changed)
        // Avoid invalidating ["hymns"] prefix which would also refetch per-hymn detail/audioPath queries
        queryClient.invalidateQueries({ queryKey: ["hymns", "search"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["hymns", "album"], exact: false });
        queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
      }),
      "data-changed",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlistenPromise = safeListen(
      listen("streaming-status-changed", () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
      }),
      "streaming-status-changed",
    );

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
    const unlistenProgress = safeListen(
      listen<ContentSyncProgress>("content-sync-progress", (event) => {
        const store = useContentSyncStore.getState();
        if (!store.runId || event.payload.runId === store.runId) {
          setContentSyncProgress(event.payload);
        }
      }),
      "content-sync-progress",
    );

    const unlistenReport = safeListen(
      listen<ContentSyncReport>("content-sync-report", (event) => {
        const store = useContentSyncStore.getState();
        if (!store.runId || event.payload.runId === store.runId) {
          setContentSyncReport(event.payload);
        }
      }),
      "content-sync-report",
    );

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

  // Show pack sync dialog on startup if there are new manifest items (not first-run lang setup — onboarding handles that)
  useEffect(() => {
    if (isBareRoute || packSyncPlanShownRef.current) return;
    const plan = packSyncPlanQuery.data;
    const hasVisible = plan?.items.some((i) => !i.packId.startsWith("content-db-"));
    if (plan && hasVisible) {
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
      if (status === "completed" || status === "completed_with_errors" || status === "failed" || status === "cancelled") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.packSyncPlan });
        // Content DB was hot-swapped — refetch hymn/collection/album data
        void queryClient.invalidateQueries({ queryKey: ["hymns", "search"], exact: false });
        void queryClient.invalidateQueries({ queryKey: ["hymns", "album"], exact: false });
        void queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
      }
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, [isBareRoute, setPackSyncProgress, queryClient]);

  usePlaybackCoordinator();
  useDownloadEvents();
  useKeyboard({ enabled: !isBareRoute });
  const { t } = useTranslation();
  const { service: liturgyService, items: liturgyItems } = useLiturgyPlayback();
  const isPlayingLiturgy = usePresentationStore((s) => s.isPlayingLiturgy);
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const activeLiturgyItemIndex = usePresentationStore((s) => s.activeLiturgyItemIndex);
  const setPlayingLiturgy = usePresentationStore((s) => s.setPlayingLiturgy);
  const setActiveLiturgyItemIndex = usePresentationStore((s) => s.setActiveLiturgyItemIndex);

  const handleStopLiturgy = useCallback(() => {
    setPlayingLiturgy(false);
    useMediaPlayerStore.getState().unload();
    void catcher(deletePreference("activePlayState"));
  }, [setPlayingLiturgy]);

  const handlePrevLiturgyItem = useCallback(() => {
    if (activeLiturgyItemIndex > 0) {
      setActiveLiturgyItemIndex(activeLiturgyItemIndex - 1);
    }
  }, [activeLiturgyItemIndex, setActiveLiturgyItemIndex]);

  const handleNextLiturgyItem = useCallback(() => {
    if (activeLiturgyItemIndex < liturgyItems.length - 1) {
      setActiveLiturgyItemIndex(activeLiturgyItemIndex + 1);
    } else {
      setPlayingLiturgy(false);
      void catcher(deletePreference("activePlayState"));
      void catcher(stopProjectionAndSongAudio(), { notify: true });
    }
  }, [activeLiturgyItemIndex, liturgyItems.length, setActiveLiturgyItemIndex, setPlayingLiturgy]);

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
    const unlistenPromise = safeListen(
      listen<string>("spotlight-navigated", (event) => {
        void router.navigate({ to: event.payload as never });
      }),
      "spotlight-navigated",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [router]);

  // Spotlight: execute an action selected in the detached spotlight window
  useEffect(() => {
    const unlistenPromise = safeListen(
      listen<string>("spotlight-action", (event) => {
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
      }),
      "spotlight-action",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []); // stable refs — no deps needed

  if (isBareRoute) {
    return (
      <>
        <Outlet />
        {/* PersistentVideoPlayer must stay mounted across ALL routes — including bare
            projection/return/spotlight windows — so that videos keep playing while
            the user opens those windows or navigates away from Playing Now. */}
        <PersistentVideoPlayer />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Global liturgy playback banner */}
        {isPlayingLiturgy && liturgyService && (
          <div className="flex items-center gap-3 bg-primary px-4 py-2.5 text-primary-foreground shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {t("services.liveIndicator")}
              </span>
            </div>
            <span className="text-sm font-semibold truncate max-w-50">
              {liturgyService.title}
            </span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium tabular-nums shrink-0">
              {t("services.progressOf", {
                current: activeLiturgyItemIndex + 1,
                total: liturgyItems.length,
              })}
            </span>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/15"
                onClick={handlePrevLiturgyItem}
                disabled={activeLiturgyItemIndex <= 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/15"
                onClick={handleNextLiturgyItem}
                disabled={liturgyItems.length === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {activeLiturgyId != null && (
                <Link to="/services/$serviceId" params={{ serviceId: String(activeLiturgyId) }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-primary-foreground hover:bg-white/15"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    {t("services.goToLiturgy")}
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="destructive"
                className="ml-1 h-7 px-3 text-xs"
                onClick={handleStopLiturgy}
              >
                <Square className="mr-1.5 h-3 w-3" />
                {t("services.stopService")}
              </Button>
            </div>
          </div>
        )}
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
      {showTour && <SpotlightTour onComplete={handleTourComplete} />}
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
