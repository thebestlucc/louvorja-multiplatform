import { load } from "@tauri-apps/plugin-store";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("app-preferences.json");
  }
  return storeInstance;
}

export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  const store = await getStore();
  const value = await store.get<T>(key);
  return value ?? defaultValue;
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
}

export async function deletePreference(key: string): Promise<void> {
  const store = await getStore();
  await store.delete(key);
}
