import { useEffect, useCallback, useMemo } from "react";
import { useLiturgy } from "../lib/queries";
import { useHymn } from "../lib/queries";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { useQueueStore } from "../stores/queue-store";
import { catcher } from "../lib/catcher";
import { projectSlideWithType } from "../lib/projection-playback";
import { setSlideContext } from "../lib/tauri";
import { EMPTY_SLIDE_PROPS } from "../lib/projector-screen-defaults";
import type { LiturgyItem as ServiceItem, SlideContent } from "../lib/bindings";

const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv", "ogv", "m4v", "ts"]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "tiff"]);

function getFileExt(filePath: string): string {
  return filePath.replace(/\\/g, "/").split(".").pop()?.toLowerCase() ?? "";
}

function buildSlideData(item: ServiceItem): SlideContent {
  switch (item.itemType) {
    case "hymn":
      return { ...EMPTY_SLIDE_PROPS, slideType: "lyrics", title: item.title, text: item.notes ?? "" };
    case "bible":
      return { ...EMPTY_SLIDE_PROPS, slideType: "bible", title: item.title, text: item.notes ?? "" };
    case "annotation":
      return { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: item.notes ?? "" };
    case "file": {
      const filePath = item.notes ?? "";
      const ext = getFileExt(filePath);
      if (IMAGE_EXTS.has(ext)) {
        return { ...EMPTY_SLIDE_PROPS, slideType: "image", label: item.title, backgroundImage: filePath };
      } else if (VIDEO_EXTS.has(ext)) {
        return { ...EMPTY_SLIDE_PROPS, slideType: "video", label: item.title, videoPath: filePath };
      } else {
        return { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: filePath };
      }
    }
    default:
      return { ...EMPTY_SLIDE_PROPS, slideType: "text", title: item.title, text: item.notes ?? "" };
  }
}

function stopCurrentContent() {
  useQueueStore.getState().clearQueue();
  useAudioStore.getState().stop();
  useAudioStore.getState().setSyncPoints([]);
}

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

  // Resolve current hymn id unconditionally (Rules of Hooks)
  const currentItem = items[activeLiturgyItemIndex] ?? null;
  const currentHymnId =
    currentItem?.itemType === "hymn" && currentItem.itemId != null
      ? currentItem.itemId
      : null;

  // useHymn has built-in `enabled: id > 0` guard — no request fires when not on a hymn item
  const { data: hymnData } = useHymn(currentHymnId ?? 0);

  // Keep liturgyItemsCount in sync so use-media-player can check bounds without importing this hook
  useEffect(() => {
    usePresentationStore.getState().setLiturgyItemsCount(items.length);
  }, [items.length]);

  // Unload media player when liturgy stops
  useEffect(() => {
    if (!isPlayingLiturgy) {
      stopCurrentContent();
      useMediaPlayerStore.getState().unload();
    }
  }, [isPlayingLiturgy]);

  const projectItem = useCallback(
    async (
      item: ServiceItem,
      allItems: ServiceItem[],
      hymnForItem: typeof hymnData,
    ) => {
      stopCurrentContent();

      const mediaStore = useMediaPlayerStore.getState();
      const itemIndex = allItems.findIndex((i) => i.id === item.id);
      const nextItem = itemIndex + 1 < allItems.length ? allItems[itemIndex + 1] : null;

      const buildContext = async () => {
        await setSlideContext({
          next: nextItem ? buildSlideData(nextItem) : null,
          index: itemIndex >= 0 ? itemIndex : 0,
          total: allItems.length,
          title: item.title,
          currentSlideStartMs: null,
          nextSlideStartMs: null,
          audioDurationMs: null,
        });
      };

      if (item.itemType === "hymn" && item.itemId != null && hymnForItem != null) {
        // Delegate to usePlaybackCoordinator — same path as playing from hymnal/collection.
        useQueueStore.getState().addToQueue([{ id: crypto.randomUUID(), hymn: hymnForItem, type: "audio" }], true);
        await catcher(buildContext(), { notify: true });
        return;
      }

      const slideData = buildSlideData(item);

      if (item.itemType === "hymn") {
        // Hymn without itemId (annotation-style)
        mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
        await catcher(async () => {
          await projectSlideWithType(slideData, "service");
          await buildContext();
        }, { notify: true });
        return;
      }

      if (item.itemType === "bible") {
        mediaStore.load({ type: "bible", reference: item.title, text: item.notes ?? "", version: "" });
        mediaStore.setSlides([slideData]); // BibleMediaItem has no slides field; set for preview canvas
        await catcher(async () => {
          await projectSlideWithType(slideData, "service");
          await buildContext();
        }, { notify: true });
        return;
      }

      if (item.itemType === "file") {
        const filePath = item.notes ?? "";
        const ext = getFileExt(filePath);
        if (VIDEO_EXTS.has(ext)) {
          mediaStore.load({ type: "offline_video", videoPath: filePath, title: item.title, isManaged: false });
          await catcher(buildContext(), { notify: true });
          return;
        } else if (IMAGE_EXTS.has(ext)) {
          mediaStore.load({ type: "image", imagePath: filePath, title: item.title, isManaged: false });
          await catcher(async () => {
            await projectSlideWithType(slideData, "service");
            await buildContext();
          }, { notify: true });
          return;
        } else {
          mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
          await catcher(async () => {
            await projectSlideWithType(slideData, "service");
            await buildContext();
          }, { notify: true });
          return;
        }
      }

      // annotation, url, and any other types
      mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
      await catcher(async () => {
        await projectSlideWithType(slideData, "service");
        await buildContext();
      }, { notify: true });
    },
    [],
  );

  useEffect(() => {
    if (
      isPlayingLiturgy &&
      activeLiturgyItemIndex >= 0 &&
      activeLiturgyItemIndex < items.length
    ) {
      const item = items[activeLiturgyItemIndex];
      if (item.itemType === "hymn" && item.itemId != null && hymnData == null) {
        return; // wait for hymn data; effect re-runs when hymnData arrives
      }
      void projectItem(item, items, hymnData);
    }
  }, [isPlayingLiturgy, activeLiturgyItemIndex, items, hymnData, projectItem]);

  return { service, items };
}
