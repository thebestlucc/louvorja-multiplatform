import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { emit, listen } from "@tauri-apps/api/event";
import type { LiturgyWithItems } from "../lib/bindings";
import { queryKeys } from "../lib/queries";
import { usePresentationStore } from "../stores/presentation-store";
import { useQueueStore } from "../stores/queue-store";
import type { QueueItem } from "../stores/queue-store";

/**
 * Broadcasts service and queue state to connected PWA remote clients via Tauri
 * events. Fires on service/queue changes and re-fires on every new device connection.
 *
 * @param enabled Pass `false` on bare routes (/projector, /return, etc.) to disable.
 */
export function useRemoteStateBroadcast(
  activeLiturgyId: string | number | null,
  activeLiturgyItemIndex: number,
  queueItems: ReturnType<typeof useQueueStore.getState>["items"],
  queueCurrentIndex: number,
  enabled: boolean,
): void {
  const queryClient = useQueryClient();

  // Broadcast service state to PWA clients when service or item index changes.
  useEffect(() => {
    if (!activeLiturgyId) return;
    const data = queryClient.getQueryData<LiturgyWithItems>(
      queryKeys.services.detail(activeLiturgyId as number)
    );
    if (!data) return;
    const payload = {
      title: data.service.title,
      activeIndex: activeLiturgyItemIndex,
      items: data.items.map((item) => ({
        id: String(item.id),
        title: item.title,
        type: item.itemType,
      })),
    };
    emit("service-state", payload);
  }, [activeLiturgyId, activeLiturgyItemIndex, queryClient]);

  // Broadcast queue state to PWA clients when playing queue changes.
  useEffect(() => {
    const nowPlaying =
      queueCurrentIndex >= 0 && queueCurrentIndex < queueItems.length
        ? {
            id: queueItems[queueCurrentIndex].id,
            title:
              queueItems[queueCurrentIndex].hymn?.title ??
              queueItems[queueCurrentIndex].title ??
              "",
            artist: queueItems[queueCurrentIndex].hymn?.author ?? undefined,
          }
        : null;
    const history = queueItems
      .slice(0, Math.max(0, queueCurrentIndex))
      .map((i) => ({ id: i.id, title: i.hymn?.title ?? i.title ?? "" }));
    const upNext = queueItems
      .slice(queueCurrentIndex + 1)
      .map((i) => ({ id: i.id, title: i.hymn?.title ?? i.title ?? "" }));
    emit("queue-state", { nowPlaying, upNext, history });
  }, [queueItems, queueCurrentIndex]);

  // Re-emit current service + queue state whenever a new remote device connects.
  // Uses getState() for fresh reads to avoid stale closures.
  useEffect(() => {
    if (!enabled) return;
    const unlistenPromise = listen("remote-devices-changed", () => {
      // Re-broadcast service state
      const { activeLiturgyId: lid, activeLiturgyItemIndex: idx } = usePresentationStore.getState();
      if (lid) {
        const data = queryClient.getQueryData<LiturgyWithItems>(
          queryKeys.services.detail(lid)
        );
        if (data) {
          emit("service-state", {
            title: data.service.title,
            activeIndex: idx,
            items: data.items.map((item) => ({
              id: String(item.id),
              title: item.title,
              type: item.itemType,
            })),
          });
        }
      } else {
        // No active service — signal cleared state to remote
        emit("service-state", null);
      }

      // Re-broadcast queue state with enriched metadata per kind
      const { items, currentIndex } = useQueueStore.getState();
      const mapItem = (i: QueueItem) => {
        const base = {
          id: i.id,
          kind: i.kind,
          title: i.hymn?.title ?? i.title ?? "",
          artist: i.hymn?.author ?? undefined,
        };
        if (i.kind === "video" && i.videoMedia) {
          return {
            ...base,
            title: i.videoMedia.videoTitle ?? i.title ?? "Video",
            duration: i.videoMedia.duration,
            videoId: i.videoMedia.videoId,
            thumbnail: i.videoMedia.videoId
              ? `https://img.youtube.com/vi/${i.videoMedia.videoId}/mqdefault.jpg`
              : undefined,
          };
        }
        if (i.kind === "bible" && i.bibleContext) {
          return { ...base, title: i.title ?? `${i.bibleContext.bookName} ${i.bibleContext.chapter}` };
        }
        return base;
      };
      const nowPlaying =
        currentIndex >= 0 && currentIndex < items.length
          ? mapItem(items[currentIndex])
          : null;
      const history = items.slice(0, Math.max(0, currentIndex)).map(mapItem);
      const upNext = items.slice(currentIndex + 1).map(mapItem);
      emit("queue-state", { nowPlaying, upNext, history });
    });
    return () => { unlistenPromise.then((fn) => fn()); };
  }, [enabled, queryClient]);
}
