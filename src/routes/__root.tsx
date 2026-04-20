import { createRootRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LiturgyPlaybackBanner } from "../components/layout/liturgy-playback-banner";
import { listen, emit } from "@tauri-apps/api/event";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { AppToaster } from "../components/ui/app-toaster";
import { KeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { UpdateNotification } from "../components/update-notification";
import { PersistentVideoPlayer } from "../components/online-videos/persistent-video-player";
import { useKeyboard } from "../hooks/use-keyboard";
import { useRemoteBridge } from "../hooks/use-remote-bridge";
import { useSlidePasser } from "../hooks/use-slide-passer";
import { useSlidePasserStore } from "../stores/slide-passer-store";
import { useLiturgyPlayback } from "../hooks/use-liturgy-playback";
import { usePlaybackCoordinator } from "../hooks/use-playback-coordinator";
import { useDownloadEvents } from "../hooks/use-download-events";
import { useMonitorsControl } from "../hooks/use-monitors";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { useRustVideoPipelineStateBridge } from "../hooks/use-rust-video-pipeline-state";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useDisplayStore } from "../stores/display-store";
import { useVideoPlayerStore } from "../stores/video-player-store";
import type { SlideContent, LiturgyWithItems } from "../lib/bindings";
import type { BibleContext } from "../stores/display-store";
import { useQueueStore } from "../stores/queue-store";
import { deletePreference } from "../lib/store";
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
    completeRouteTour("/");
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
        // Invalidate content caches after pack sync (favorites unaffected by sync)
        queryClient.invalidateQueries({ queryKey: ["hymns"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["music"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["collections"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["albums"], exact: false });
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
    const unlisten = safeListen(
      listen<PackSyncProgress>("pack-sync-progress", (event) => {
        setPackSyncProgress(event.payload);
        const status = event.payload.status;
        if (status === "completed" || status === "completed_with_errors" || status === "failed" || status === "cancelled") {
          queryClient.invalidateQueries({ queryKey: queryKeys.packSyncPlan });
          // Content DB was hot-swapped — refetch hymn/collection/album data
          queryClient.invalidateQueries({ queryKey: ["hymns", "search"], exact: false });
          queryClient.invalidateQueries({ queryKey: ["hymns", "album"], exact: false });
          queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
        }
      }),
      "pack-sync-progress",
    );
    return () => { unlisten.then((fn) => fn()); };
  }, [isBareRoute, setPackSyncProgress, queryClient]);

  // Global Bible context + slides sync — keeps Playing Now preview + sidebar updated
  // even when the /bible route is unmounted (e.g. user navigated to Playing Now)
  useEffect(() => {
    if (isBareRoute) return;
    const unlistenContext = safeListen(
      listen<BibleContext & { allSlides?: SlideContent[] }>("bible-context-changed", (event) => {
        const { allSlides, ...ctx } = event.payload;
        useDisplayStore.getState().setBibleContext(ctx);
        // Sync all split parts to presentationStore for sidebar thumbnails
        if (allSlides && allSlides.length > 0) {
          useMediaPlayerStore.setState({ slides: allSlides, activeSlideIndex: ctx.partIndex ?? 0 });
        }
      }),
      "bible-context-changed",
    );
    return () => {
      unlistenContext.then((fn) => fn());
    };
  }, [isBareRoute]);

  // Load slide passer config from plugin-store on first mount
  const slidePasserLoaded = useSlidePasserStore((s) => s.loaded);
  useEffect(() => {
    if (!slidePasserLoaded) {
      useSlidePasserStore.getState().loadFromStore();
    }
  }, [slidePasserLoaded]);

  usePlaybackCoordinator();
  useDownloadEvents();
  useRustVideoPipelineStateBridge();
  useKeyboard({ enabled: !isBareRoute });
  useRemoteBridge({ enabled: !isBareRoute });
  useSlidePasser({ enabled: !isBareRoute });
  const { service: liturgyService, items: liturgyItems } = useLiturgyPlayback();
  const isPlayingLiturgy = usePresentationStore((s) => s.isPlayingLiturgy);
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const activeLiturgyItemIndex = usePresentationStore((s) => s.activeLiturgyItemIndex);
  const setPlayingLiturgy = usePresentationStore((s) => s.setPlayingLiturgy);
  const setActiveLiturgyItemIndex = usePresentationStore((s) => s.setActiveLiturgyItemIndex);
  const queueItems = useQueueStore((s) => s.items);
  const queueCurrentIndex = useQueueStore((s) => s.currentIndex);
  // Smoke-test gating: when the Rust video pipeline flag is on, the legacy
  // PersistentVideoPlayer (hidden YouTube iframe + LocalVideoMaster) must NOT
  // mount, otherwise it contends with the new pipeline (audio/iframe stutter,
  // visible YT overlay). Cleanup of the legacy player is deferred to Phase 7.
  const useRust = useVideoPlayerStore((s) => s.useRustVideoPipeline);

  const handleStopLiturgy = useCallback(() => {
    setPlayingLiturgy(false);
    useMediaPlayerStore.getState().unload();
    catcher(deletePreference("activePlayState"));
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
      catcher(deletePreference("activePlayState"));
      catcher(stopProjectionAndSongAudio(), { notify: true });
    }
  }, [activeLiturgyItemIndex, liturgyItems.length, setActiveLiturgyItemIndex, setPlayingLiturgy]);

  // Broadcast service state to PWA clients when service or item index changes.
  useEffect(() => {
    if (!activeLiturgyId) return;
    const data = queryClient.getQueryData<LiturgyWithItems>(
      queryKeys.services.detail(activeLiturgyId)
    );
    if (!data) return;
    const payload = {
      title: data.service.title,
      activeIndex: activeLiturgyItemIndex,
      items: data.items.map((item) => ({
        id: String(item.id),
        title: item.title,
        type: item.itemType,
      })),
    };
    emit("service-state", payload);
  }, [activeLiturgyId, activeLiturgyItemIndex, queryClient]);

  // Broadcast queue state to PWA clients when playing queue changes.
  useEffect(() => {
    const nowPlaying =
      queueCurrentIndex >= 0 && queueCurrentIndex < queueItems.length
        ? {
            id: queueItems[queueCurrentIndex].id,
            title:
              queueItems[queueCurrentIndex].hymn?.title ??
              queueItems[queueCurrentIndex].title ??
              "",
            artist: queueItems[queueCurrentIndex].hymn?.author ?? undefined,
          }
        : null;
    const history = queueItems
      .slice(0, Math.max(0, queueCurrentIndex))
      .map((i) => ({ id: i.id, title: i.hymn?.title ?? i.title ?? "" }));
    const upNext = queueItems
      .slice(queueCurrentIndex + 1)
      .map((i) => ({ id: i.id, title: i.hymn?.title ?? i.title ?? "" }));
    emit("queue-state", { nowPlaying, upNext, history });
  }, [queueItems, queueCurrentIndex]);

  // Re-emit current service + queue state whenever a new remote device connects.
  // Uses getState() for fresh reads to avoid stale closures.
  useEffect(() => {
    if (isBareRoute) return;
    const unlistenPromise = listen("remote-devices-changed", () => {
      // Re-broadcast service state
      const { activeLiturgyId: lid, activeLiturgyItemIndex: idx } = usePresentationStore.getState();
      if (lid) {
        const data = queryClient.getQueryData<LiturgyWithItems>(
          queryKeys.services.detail(lid)
        );
        if (data) {
          emit("service-state", {
            title: data.service.title,
            activeIndex: idx,
            items: data.items.map((item) => ({
              id: String(item.id),
              title: item.title,
              type: item.itemType,
            })),
          });
        }
      } else {
        // No active service — signal cleared state to remote
        emit("service-state", null);
      }

      // Re-broadcast queue state with enriched metadata per kind
      const { items, currentIndex } = useQueueStore.getState();
      const mapItem = (i: import("../stores/queue-store").QueueItem) => {
        const base = {
          id: i.id,
          kind: i.kind,
          title: i.hymn?.title ?? i.title ?? "",
          artist: i.hymn?.author ?? undefined,
        };
        if (i.kind === "video" && i.videoMedia) {
          return {
            ...base,
            title: i.videoMedia.videoTitle ?? i.title ?? "Video",
            duration: i.videoMedia.duration,
            videoId: i.videoMedia.videoId,
            thumbnail: i.videoMedia.videoId
              ? `https://img.youtube.com/vi/${i.videoMedia.videoId}/mqdefault.jpg`
              : undefined,
          };
        }
        if (i.kind === "bible" && i.bibleContext) {
          return { ...base, title: i.title ?? `${i.bibleContext.bookName} ${i.bibleContext.chapter}` };
        }
        return base;
      };
      const nowPlaying =
        currentIndex >= 0 && currentIndex < items.length
          ? mapItem(items[currentIndex])
          : null;
      const history = items.slice(0, Math.max(0, currentIndex)).map(mapItem);
      const upNext = items.slice(currentIndex + 1).map(mapItem);
      emit("queue-state", { nowPlaying, upNext, history });
    });
    return () => { unlistenPromise.then((fn) => fn()); };
  }, [isBareRoute, queryClient]);

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
        router.navigate({ to: event.payload as never });
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
            toggleProjectorRef.current();
            break;
          case "toggle-return":
            toggleReturnRef.current();
            break;
          case "toggle-black":
            toggleBlackScreenRef.current();
            break;
          case "toggle-logo":
            toggleLogoScreenRef.current();
            break;
          case "clear-projection":
            stopProjectionAndSongAudio();
            break;
          case "open-shortcuts":
            openKeyboardShortcutsPanel();
            break;
          case "start-remote":
            import("../lib/bindings").then(({ commands }) =>
              commands.startRemoteServer(null)
            );
            break;
          case "stop-remote":
            import("../lib/bindings").then(({ commands }) =>
              commands.stopRemoteServer()
            );
            break;
          case "remote-settings":
            router.navigate({ to: "/settings", search: { tab: "remote" } as never });
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
            the user opens those windows or navigates away from Playing Now.
            Flag-gated off when useRustVideoPipeline is on (Phase 2 smoke-test): the
            new Rust pipeline owns playback end-to-end and must not coexist with the
            legacy hidden YouTube iframe / LocalVideoMaster. */}
        {!useRust && <PersistentVideoPlayer />}
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Global liturgy playback banner */}
        {isPlayingLiturgy && liturgyService && activeLiturgyId != null && (
          <LiturgyPlaybackBanner
            service={liturgyService}
            activeLiturgyId={activeLiturgyId}
            activeItemIndex={activeLiturgyItemIndex}
            items={liturgyItems}
            onPrev={handlePrevLiturgyItem}
            onNext={handleNextLiturgyItem}
            onStop={handleStopLiturgy}
          />
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
          router.navigate({ to: "/settings", search: { tab: "sync" } });
        }}
      />
      <PackSyncDialog />
      <PackSyncProgressDialog />
      <UpdateNotification />
      {showTour && <SpotlightTour onComplete={handleTourComplete} />}
      <AppToaster />
      {!useRust && <PersistentVideoPlayer />}
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
