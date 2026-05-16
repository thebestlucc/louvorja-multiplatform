import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./components/ui/tooltip";
import { routeTree } from "./routeTree.gen";
import { SpotlightWindow } from "./routes/spotlight";
import { ProjectorView } from "./components/slides/projector-view";
import { ReturnPage } from "./routes/return";
import "./styles/fonts.css";
import "./lib/i18n";
import "./stores/video-player-store-hmr";
import {
  hydrateVideoPlayerPreferences,
  refreshVideoPlayerPreferencesFromDisk,
  startVideoPlayerCrossWindowSync,
} from "./stores/video-player-store";
import { catcher, catcherSync } from "./lib/catcher";
import { initStorePreferences } from "./lib/store";

type AppRouter = ReturnType<typeof createRouter<typeof routeTree>>;
declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

function getTauriWindowLabel(): string {
  const [label] = catcherSync(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label,
  );
  return label ?? "";
}

const windowLabel = getTauriWindowLabel();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

async function bootstrap() {
  // Preload plugin-store preferences synchronously into an in-memory cache
  // before first render. This prevents UI "flash of default" bugs where a
  // persisted view mode (e.g. hymnal grid/list) renders as the fallback for
  // one frame and then flips on async resolution. Errors are tolerated —
  // hooks fall back to their per-call default values.
  await catcher(initStorePreferences());

  // Re-sync any Zustand store whose initial state was computed from
  // `getPreferenceSync()` *before* `initStorePreferences()` populated the
  // cache (Zustand's `create()` runs its initializer at module-load time,
  // which happens before bootstrap awaits the cache). Without this hydration
  // the experimental `useRustVideoPipeline` flag would start as `false` even
  // when persisted as `true`, briefly mounting the legacy
  // `<PersistentVideoPlayer>` and triggering 404 errors on the first frame.
  hydrateVideoPlayerPreferences();

  // P3.12 — Always re-read from disk asynchronously after the sync hydration.
  // On projector + return windows the sync hydration may have read a stale
  // (or empty) cache because `initStorePreferences()` calls `store.entries()`
  // which requires `store:allow-entries` (we now grant it, but the async
  // disk read is the *defensive* belt-and-braces that survives any future
  // capability/permission drift). Without this, projector+return mounted
  // with `useRustVideoPipeline=false` even when the flag was persisted as
  // `true` on disk — the legacy YouTube/HTML5 follower then autoplayed
  // independently of the rust pipeline.
  await catcher(refreshVideoPlayerPreferencesFromDisk());

  // Observability: log post-bootstrap value per webview so dogfood console
  // output makes the propagation chain visible end-to-end.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bootstrapLabel = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? "?";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bootstrapFlag = ((window as any).__TAURI_BOOTSTRAP_DEBUG__ ??= {}) as Record<string, unknown>;
  bootstrapFlag.label = bootstrapLabel;
  console.log(`[bootstrap] webview='${bootstrapLabel}' bootstrap complete`);

  // P3.11 — Start the cross-webview sync listener so flag changes on the
  // main window propagate live to projector + return. Without this, opening
  // the projector before toggling the flag leaves it stuck on the legacy
  // follower path (independent autoplay HTML5 / YT iframe with no master to
  // drive controls). Fire-and-forget — the listen() is async but doesn't
  // need to gate render; once registered any subsequent flip applies.
  catcher(startVideoPlayerCrossWindowSync());

  if (windowLabel === "spotlight") {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <SpotlightWindow />
      </React.StrictMode>,
    );
  } else if (windowLabel === "projector") {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>
            <ProjectorView />
          </TooltipProvider>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  } else if (windowLabel === "return") {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>
            <ReturnPage />
          </TooltipProvider>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  } else {
    const router = createRouter({ routeTree });

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>
            <RouterProvider router={router} />
          </TooltipProvider>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  }
}

catcher(bootstrap());
