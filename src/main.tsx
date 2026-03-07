import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./components/ui/tooltip";
import { routeTree } from "./routeTree.gen";
import { SpotlightWindow } from "./routes/spotlight";
import "./lib/i18n";
import { catcherSync } from "./lib/catcher";

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

if (windowLabel === "spotlight") {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <SpotlightWindow />
    </React.StrictMode>,
  );
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
    },
  });

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
