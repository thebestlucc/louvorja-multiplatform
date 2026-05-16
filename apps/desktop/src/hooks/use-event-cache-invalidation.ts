import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { queryKeys } from "../lib/queries";

/** Wraps a listen() promise to log errors instead of swallowing them silently. */
function safeListen(
  promise: Promise<() => void>,
  eventName: string,
): Promise<() => void> {
  return promise.catch((err) => {
    console.error(`[root] Failed to register listener for "${eventName}":`, err);
    return () => {};
  });
}

/**
 * Registers Tauri event listeners that invalidate TanStack Query caches when
 * backend data changes: monitors-changed, data-changed, streaming-status-changed.
 */
export function useEventCacheInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlistenPromise = safeListen(
      listen("monitors-changed", () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.monitors.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.monitors.configs });
      }),
      "monitors-changed",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlistenPromise = safeListen(
      listen("data-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["hymns"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["music"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["collections"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["albums"], exact: false });
      }),
      "data-changed",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlistenPromise = safeListen(
      listen("streaming-status-changed", () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
      }),
      "streaming-status-changed",
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);
}
