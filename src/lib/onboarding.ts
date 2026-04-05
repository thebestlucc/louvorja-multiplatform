import { getAllSettings, setSetting } from "./tauri";
import { catcher } from "./catcher";

export const FIRST_RUN_KEY = "app.firstRunCompleted";

let cachedNeedsOnboarding: boolean | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export async function isOnboardingRequired(): Promise<boolean> {
  const now = Date.now();
  if (cachedNeedsOnboarding != null && now - cachedAt < CACHE_TTL_MS) {
    return cachedNeedsOnboarding;
  }

  const [settings, error] = await catcher(getAllSettings(), { notify: false });

  if (error || !settings) {
    // Keep startup non-blocking on environments where Tauri commands are unavailable.
    cachedNeedsOnboarding = false;
    cachedAt = now;
    return false;
  }

  const firstRun = settings.find((item) => item.key === FIRST_RUN_KEY)?.value;
  const needsOnboarding = firstRun !== "true";
  cachedNeedsOnboarding = needsOnboarding;
  cachedAt = now;
  return needsOnboarding;
}

export async function completeOnboarding(): Promise<void> {
  await setSetting(FIRST_RUN_KEY, "true");
  cachedNeedsOnboarding = false;
  cachedAt = Date.now();
}

export function invalidateOnboardingCache() {
  cachedNeedsOnboarding = null;
  cachedAt = 0;
}

export const TOUR_COMPLETED_KEY = "app.tourCompleted";

export async function isTourCompleted(): Promise<boolean> {
  const [settings, error] = await catcher(getAllSettings(), { notify: false });
  if (error || !settings) return true;
  return settings.find((item) => item.key === TOUR_COMPLETED_KEY)?.value === "true";
}

export async function completeTour(): Promise<void> {
  await setSetting(TOUR_COMPLETED_KEY, "true");
}

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
