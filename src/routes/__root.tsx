import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { SlideNavBar } from "../components/display/slide-nav-bar";
import { CommandPalette } from "../components/ui/command-palette";
import { KeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { useKeyboard } from "../hooks/use-keyboard";
import { useTimerAlerts } from "../hooks/use-timer-alerts";
import { useThemeStore } from "../stores/theme-store";
import { LANGUAGES, type Language } from "../lib/constants";

export const Route = createRootRoute({
  component: RootLayout,
});

const BARE_ROUTES = ["/projector", "/return"];

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isBareRoute = BARE_ROUTES.includes(pathname);
  const setLanguage = useThemeStore((state) => state.setLanguage);
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
