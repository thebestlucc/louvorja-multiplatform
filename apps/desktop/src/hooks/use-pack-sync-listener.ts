import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { queryKeys, usePlanPackSync } from "../lib/queries";
import { useContentSyncStore } from "../stores/content-sync-store";
import type { PackSyncProgress } from "../types/content-sync";

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
 * Tracks pending pack count, auto-shows the pack sync dialog on startup, and
 * listens to pack-sync-progress Tauri events.
 *
 * @param enabled Pass `false` on bare routes (/projector, /return, etc.) to disable.
 */
export function usePackSyncListener(enabled: boolean): void {
  const queryClient = useQueryClient();
  const packSyncPlanQuery = usePlanPackSync({ enabled });
  const packSyncPlanShownRef = useRef(false);
  const openPackSyncPlan = useContentSyncStore((s) => s.openPackSyncPlan);
  const setPackSyncProgress = useContentSyncStore((s) => s.setPackSyncProgress);
  const setPackSyncPendingCount = useContentSyncStore((s) => s.setPackSyncPendingCount);
  const setPackSyncPlan = useContentSyncStore((s) => s.setPackSyncPlan);

  // Track pending pack count + plan for bell notification
  useEffect(() => {
    const plan = packSyncPlanQuery.data ?? null;
    const visibleItems = plan?.items.filter((i) => !i.packId.startsWith("content-db-")) ?? [];
    const count = visibleItems.length;
    setPackSyncPendingCount(count);
    setPackSyncPlan(count > 0 ? plan : null);
  }, [packSyncPlanQuery.data, setPackSyncPendingCount, setPackSyncPlan]);

  // Show pack sync dialog on startup if there are new manifest items
  useEffect(() => {
    if (!enabled || packSyncPlanShownRef.current) return;
    const plan = packSyncPlanQuery.data;
    const hasVisible = plan?.items.some((i) => !i.packId.startsWith("content-db-"));
    if (plan && hasVisible) {
      packSyncPlanShownRef.current = true;
      openPackSyncPlan();
    }
  }, [packSyncPlanQuery.data, enabled, openPackSyncPlan]);

  // Listen for pack-sync-progress events
  useEffect(() => {
    if (!enabled) return;
    const unlisten = safeListen(
      listen<PackSyncProgress>("pack-sync-progress", (event) => {
        setPackSyncProgress(event.payload);
        const status = event.payload.status;
        if (status === "completed" || status === "completed_with_errors" || status === "failed" || status === "cancelled") {
          queryClient.invalidateQueries({ queryKey: queryKeys.packSyncPlan });
          queryClient.invalidateQueries({ queryKey: ["hymns", "search"], exact: false });
          queryClient.invalidateQueries({ queryKey: ["hymns", "album"], exact: false });
          queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
        }
      }),
      "pack-sync-progress",
    );
    return () => { unlisten.then((fn) => fn()); };
  }, [enabled, setPackSyncProgress, queryClient]);
}
