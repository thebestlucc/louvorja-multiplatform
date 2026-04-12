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
 */
export async function initStorePreferences(): Promise<void> {
  if (initialized) return;
  const store = await getStore();
  const entries = await store.entries();
  for (const [key, value] of entries) {
    syncCache.set(key, value);
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
