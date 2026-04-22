// src/lib/event-bus.ts
// Typed in-process pub/sub bus for decoupling Zustand stores.
// Do NOT use for Tauri events — use `listen()`/`emit()` from @tauri-apps/api/event for those.

type Listener<T> = (payload: T) => void;

class TypedEventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as Listener<unknown>);
    return () => set.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      listener(payload);
    }
  }
}

/**
 * Domain events emitted by Zustand stores to decouple cross-store calls.
 * Add new entries here as more cross-calls are migrated.
 */
export interface AppEventMap extends Record<string, unknown> {
  /** Fired by useAudioStore when sync determines the active slide index changed. */
  "audio:slide-sync": { slideIndex: number };
  /** Fired by useAudioStore when it needs to know the current projection type. */
  "audio:query-projection-type": unknown;
  /** Fired synchronously with the projection type in response to the query above. */
  "audio:projection-type-response": { projectionType: string | null };
  /** Fired by useVideoPlayerStore when the Rust pipeline flag is disabled. */
  "video:pipeline-disabled": unknown;
}

export const appEventBus = new TypedEventBus<AppEventMap>();
