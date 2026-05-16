import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import RootLayout from "./routes/__root";
import PairRoute from "./routes/pair";
import LiveRoute from "./routes/live";
import SearchRoute from "./routes/search";
import ServiceRoute from "./routes/service";
import QueueRoute from "./routes/queue";
import SettingsRoute from "./routes/settings";

export const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/live" });
  },
});

const pairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pair",
  component: PairRoute,
});

const liveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/live",
  component: LiveRoute,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: SearchRoute,
});

const serviceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/service",
  component: ServiceRoute,
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/queue",
  component: QueueRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  pairRoute,
  liveRoute,
  searchRoute,
  serviceRoute,
  queueRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
