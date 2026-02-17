import { getAllSettings, setSetting } from "./tauri";

export const FIRST_RUN_KEY = "app.firstRunCompleted";

let cachedNeedsOnboarding: boolean | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export async function isOnboardingRequired(): Promise<boolean> {
  const now = Date.now();
  if (cachedNeedsOnboarding != null && now - cachedAt < CACHE_TTL_MS) {
    return cachedNeedsOnboarding;
  }

  try {
    const settings = await getAllSettings();
    const firstRun = settings.find((item) => item.key === FIRST_RUN_KEY)?.value;
    const needsOnboarding = firstRun !== "true";
    cachedNeedsOnboarding = needsOnboarding;
    cachedAt = now;
    return needsOnboarding;
  } catch {
    // Keep startup non-blocking on environments where Tauri commands are unavailable.
    cachedNeedsOnboarding = false;
    cachedAt = now;
    return false;
  }
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
