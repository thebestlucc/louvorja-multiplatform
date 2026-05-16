import { completeTour, isTourCompleted, TOUR_COMPLETED_KEY } from "./onboarding";
import { setSetting } from "./tauri";

export interface TourStep {
  /** CSS selector for the target element */
  target: string;
  /** i18n key prefix (e.g. "tour.sidebar" -> title = "tour.sidebar.title") */
  i18nKey: string;
  /** Tooltip placement relative to target */
  placement: "bottom" | "top" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  { target: "[data-tour='sidebar']", i18nKey: "tour.sidebar", placement: "right" },
  { target: "[data-tour='search']", i18nKey: "tour.search", placement: "bottom" },
  { target: "[data-tour='projector-controls']", i18nKey: "tour.projector", placement: "top" },
  { target: "[data-tour='finish']", i18nKey: "tour.finish", placement: "bottom" },
];

export const ROUTE_TOURS: Record<string, TourStep[]> = {
  "/": [
    { target: "[data-tour='sidebar']", i18nKey: "tour.home.sidebar", placement: "right" },
    { target: "[data-tour='search']", i18nKey: "tour.home.search", placement: "bottom" },
    { target: "[data-tour='projector-controls']", i18nKey: "tour.home.projector", placement: "top" },
    { target: "[data-tour='status-bar']", i18nKey: "tour.home.statusBar", placement: "top" },
  ],
  "/hymnal": [
    { target: "[data-tour='hymnal-search']", i18nKey: "tour.hymnal.search", placement: "bottom" },
    { target: "[data-tour='hymnal-list']", i18nKey: "tour.hymnal.card", placement: "right" },
  ],
  "/presentations": [
    { target: "[data-tour='presentations-list']", i18nKey: "tour.presentations.list", placement: "right" },
    { target: "[data-tour='new-presentation']", i18nKey: "tour.presentations.new", placement: "bottom" },
  ],
  "/services": [
    { target: "[data-tour='services-list']", i18nKey: "tour.services.list", placement: "right" },
    { target: "[data-tour='new-service']", i18nKey: "tour.services.new", placement: "bottom" },
  ],
  "/collections": [
    { target: "[data-tour='collections-tabs']", i18nKey: "tour.collections.tabs", placement: "bottom" },
  ],
  "/playing-now": [
    { target: "[data-tour='playing-queue']", i18nKey: "tour.playingNow.queue", placement: "left" },
    { target: "[data-tour='playback-controls']", i18nKey: "tour.playingNow.controls", placement: "top" },
  ],
  "/settings": [
    { target: "[data-tour='settings-tabs']", i18nKey: "tour.settings.theme", placement: "right" },
  ],
};

export function routeTourKey(routePath: string): string {
  const segment = routePath === "/" ? "home" : routePath.replace(/^\//, "").replace(/\//g, "_");
  return `app.tour.${segment}Completed`;
}

export async function isRouteTourCompleted(routePath: string): Promise<boolean> {
  return isTourCompleted(routeTourKey(routePath));
}

export async function completeRouteTour(routePath: string): Promise<void> {
  return completeTour(routeTourKey(routePath));
}

export async function finishTour(): Promise<void> {
  await completeTour();
}

export async function resetAllTours(): Promise<void> {
  const keys = [
    TOUR_COMPLETED_KEY,
    ...Object.keys(ROUTE_TOURS).map(routeTourKey),
  ];
  await Promise.all(keys.map((key) => setSetting(key, "false")));
}
