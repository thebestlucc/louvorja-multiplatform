import { completeTour } from "./onboarding";

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

export async function finishTour(): Promise<void> {
  await completeTour();
}
