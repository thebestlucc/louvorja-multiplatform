import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { StatusBar } from "../components/layout/status-bar";
import { CommandPalette } from "../components/ui/command-palette";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
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
