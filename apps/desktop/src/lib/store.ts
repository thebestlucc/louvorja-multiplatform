import { load } from "@tauri-apps/plugin-store";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

/**
 * Synchronous cache of every preference read since init. Populated by
 * `initStorePreferences()` at app startup (before first render) and kept in
 * sync by `setPreference`. Enables `getPreferenceSync()` so hooks can return
 * the stored value on the *very first render* — no flash of default content
 * while the async plugin-store call resolves.
 */
const syncCache = new Map<string, unknown>();
let initialized = false;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("app-preferences.json");
  }
  return storeInstance;
}

/**
 * Load the plugin-store file and populate the synchronous cache with every
 * entry. Must be awaited before `ReactDOM.createRoot().render()` so UI hooks
 * can read preferences synchronously on first render.
 *
 * Resilience note: `store.entries()` requires the `store:allow-entries`
 * capability. If that grant is missing on a given window (projector / return /
 * spotlight have minimal capability sets), this used to throw and silently
 * leave `syncCache` empty — which made every `getPreferenceSync()` return its
 * fallback value, including the experimental `useRustVideoPipeline` flag (the
 * P3.11 dogfood regression where projector + return mounted legacy followers
 * even when the flag was persisted as `true` on disk). We now catch the error
 * and mark the cache as initialized so individual `getPreference()` calls
 * (which only require `store:allow-get`) can still populate it on demand.
 */
export async function initStorePreferences(): Promise<void> {
  if (initialized) return;
  const store = await getStore();
  try {
    const entries = await store.entries();
    for (const [key, value] of entries) {
      syncCache.set(key, value);
    }
  } catch (err) {
    // Projector / return / spotlight windows lack `store:allow-entries`.
    // That's expected — fall through with an empty cache; per-key reads via
    // `getPreference()` (covered by `store:allow-get`) will still work.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? "?";
    console.warn(
      `[store] initStorePreferences: entries() failed on '${label}' (likely missing capability). ` +
        `Falling back to per-key reads. Error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  initialized = true;
}

/**
 * Synchronous read from the in-memory cache. Returns `fallback` if the key has
 * not been loaded yet (pre-init) or was never set.
 */
export function getPreferenceSync<T>(key: string, fallback: T): T {
  if (!syncCache.has(key)) return fallback;
  return (syncCache.get(key) as T) ?? fallback;
}

export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  const store = await getStore();
  const value = await store.get<T>(key);
  const resolved = value ?? defaultValue;
  syncCache.set(key, resolved);
  return resolved;
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
  syncCache.set(key, value);
}

export async function deletePreference(key: string): Promise<void> {
  const store = await getStore();
  await store.delete(key);
  syncCache.delete(key);
}
