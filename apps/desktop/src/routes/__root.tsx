import { createRootRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { LiturgyPlaybackBanner } from "../components/layout/liturgy-playback-banner";
import { listen } from "@tauri-apps/api/event";
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
import { useAudioCoordinator } from "../hooks/use-audio-coordinator";
import { useDownloadEvents } from "../hooks/use-download-events";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { useRustVideoPipelineStateBridge } from "../hooks/use-rust-video-pipeline-state";
import { useOnlineVideoBridge } from "../hooks/use-online-video-bridge";
import { useEventCacheInvalidation } from "../hooks/use-event-cache-invalidation";
import { useAutoMonitorAssignment } from "../hooks/use-auto-monitor-assignment";
import { usePackSyncListener } from "../hooks/use-pack-sync-listener";
import { useRemoteStateBroadcast } from "../hooks/use-remote-state-broadcast";
import { useSpotlightListener } from "../hooks/use-spotlight-listener";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useDisplayStore } from "../stores/display-store";
import { useVideoPlayerStore } from "../stores/video-player-store";
import type { SlideContent } from "../lib/bindings";
import type { BibleContext } from "../stores/display-store";
import { useQueueStore } from "../stores/queue-store";
import { deletePreference } from "../lib/store";
import { ContentSyncModal } from "../components/content-sync/content-sync-modal";
import { PackSyncDialog, PackSyncProgressDialog } from "../components/content-sync/pack-sync-dialog";
import { useThemeStore } from "../stores/theme-store";
import { useContentSyncStore } from "../stores/content-sync-store";
import { catcher } from "../lib/catcher";
import { LANGUAGES, type Language } from "../lib/constants";
import { isOnboardingRequired } from "../lib/onboarding";
import { SpotlightTour } from "../components/tour/spotlight-tour";
import { completeRouteTour } from "../lib/tour";
import type { ContentSyncProgress, ContentSyncReport } from "../types/content-sync";

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
  useTimerAlerts(!isBareRoute);
  useEventCacheInvalidation();
  useAutoMonitorAssignment(!isBareRoute);
  usePackSyncListener(!isBareRoute);

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

  const contentSyncPromptSummary = useContentSyncStore((s) => s.promptSummary);
  const contentSyncPromptOpen = useContentSyncStore((s) => s.isPromptOpen);
  const closeContentSyncPrompt = useContentSyncStore((s) => s.closePrompt);
  const setContentSyncProgress = useContentSyncStore((s) => s.setProgress);
  const setContentSyncReport = useContentSyncStore((s) => s.setReport);

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
  }, [setContentSyncProgress, setContentSyncReport]);

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
  useAudioCoordinator();
  useDownloadEvents();
  useRustVideoPipelineStateBridge();
  // Always-on slide → media-player-store bridge so play/pause/seek/volume
  // work even when PersistentVideoPlayer is gated off (rust pipeline flag).
  // Bare routes don't need this — they don't render the playing-now control
  // bar — so we skip it there to avoid duplicate listeners on slide events.
  useOnlineVideoBridge();
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

  useRemoteStateBroadcast(activeLiturgyId, activeLiturgyItemIndex, queueItems, queueCurrentIndex, !isBareRoute);
  useSpotlightListener();

  const router = useRouter();

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
