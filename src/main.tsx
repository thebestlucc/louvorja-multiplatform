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
