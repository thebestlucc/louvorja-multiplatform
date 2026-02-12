import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { SlideNavBar } from "../components/display/slide-nav-bar";
import { CommandPalette } from "../components/ui/command-palette";
import { useKeyboard } from "../hooks/use-keyboard";

export const Route = createRootRoute({
  component: RootLayout,
});

const BARE_ROUTES = ["/projector", "/return"];

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBareRoute = BARE_ROUTES.includes(pathname);

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
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "bg-surface text-foreground border-border",
        }}
      />
    </div>
  );
}
