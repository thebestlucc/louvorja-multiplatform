import { useEffect, useCallback, useMemo } from "react";
import { useLiturgy } from "../lib/queries";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useQueueStore } from "../stores/queue-store";
import { clearActivePlayback } from "../lib/projection-playback";
import { projectServiceItem } from "../lib/project-service-item";
import type { LiturgyItem as ServiceItem } from "../lib/bindings";

export function useLiturgyPlayback() {
  const isPlayingLiturgy = usePresentationStore((s) => s.isPlayingLiturgy);
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const activeLiturgyItemIndex = usePresentationStore((s) => s.activeLiturgyItemIndex);

  const { data } = useLiturgy(activeLiturgyId ?? 0);
  const service = data?.service ?? null;
  const rawItems = data?.items;
  const items: ServiceItem[] = useMemo(
    () => (rawItems ?? []).filter((i) => i.itemType !== "category"),
    [rawItems],
  );

  // Keep liturgyItemsCount in sync so use-media-player can check bounds without importing this hook
  useEffect(() => {
    usePresentationStore.getState().setLiturgyItemsCount(items.length);
  }, [items.length]);

  // Stop all content and unload media player when liturgy stops
  useEffect(() => {
    if (!isPlayingLiturgy) {
      useQueueStore.getState().clearQueue();
      clearActivePlayback();
      useMediaPlayerStore.getState().unload();
    }
  }, [isPlayingLiturgy]);

  const projectItem = useCallback(
    (item: ServiceItem) => projectServiceItem(item, items),
    [items],
  );

  useEffect(() => {
    if (
      isPlayingLiturgy &&
      activeLiturgyItemIndex >= 0 &&
      activeLiturgyItemIndex < items.length
    ) {
      projectItem(items[activeLiturgyItemIndex]);
    }
  }, [isPlayingLiturgy, activeLiturgyItemIndex, items, projectItem]);

  return { service, items };
}
