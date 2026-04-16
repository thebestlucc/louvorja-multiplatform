/**
 * IndexedDB storage for the paired device token.
 * Uses a simple key-value pattern: db "louvorja-remote", store "kv".
 *
 * Graceful degradation: if IndexedDB is unavailable (e.g. private browsing
 * restrictions or non-browser environment), an in-memory fallback is used.
 * Data is not persisted across page loads in fallback mode.
 */

const DB_NAME = "louvorja-remote";
const STORE_NAME = "kv";
const DB_VERSION = 1;
const DEVICE_KEY = "device";

export interface DeviceInfo {
  id: string;
  // TODO(review): Token is stored as plaintext in IndexedDB (acceptable for LAN-local
  // use — same-origin only). Document threat model: attacker needs physical access to
  // the device OR a same-origin XSS to extract. (ring:security-reviewer, 2026-04-12, Low)
  token: string;
  host: string;
  port: number;
  name: string;
}

/** True when IndexedDB is accessible in this environment. */
function isIdbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** In-memory fallback used when IndexedDB is unavailable. */
let _memDevice: DeviceInfo | null = null;

// TODO(review): Cache the IDBDatabase promise at module level to avoid opening a new connection
// per call — each getDevice/setDevice currently opens its own connection.
// (ring:code-reviewer, 2026-04-12, Low)
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDevice(): Promise<DeviceInfo | null> {
  if (!isIdbAvailable()) return _memDevice;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(DEVICE_KEY);
    req.onsuccess = () => resolve((req.result as DeviceInfo) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setDevice(info: DeviceInfo): Promise<void> {
  if (!isIdbAvailable()) { _memDevice = info; return; }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(info, DEVICE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearDevice(): Promise<void> {
  if (!isIdbAvailable()) { _memDevice = null; return; }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(DEVICE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
