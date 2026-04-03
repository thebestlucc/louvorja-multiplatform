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
import { findOnlineVideoByYtId } from "../lib/tauri/youtube";
import { defaultBackground } from "../types/presentation";
import { getFileExt, parseOnlineVideoNotes } from "../lib/utils";
import type { LiturgyItem as ServiceItem, SlideContent } from "../lib/bindings";

const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv", "ogv", "m4v", "ts"]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "tiff"]);

function buildSlideData(item: ServiceItem): SlideContent {
  const bg = defaultBackground();
  switch (item.itemType) {
    case "hymn":
      return { slideType: "lyrics", text: item.notes ?? "", label: null, background: bg, text_color: null, text_size: null };
    case "bible":
      return { slideType: "bible", text: item.notes ?? "", reference: item.title, mode: { alignment: "center", refPosition: "bottom", textShadow: false, gradient: null }, background: bg, text_color: null, text_size: null };
    case "annotation":
      return { slideType: "text", content: item.notes ?? "", background: bg, text_color: null, text_size: null };
    case "file": {
      const filePath = item.notes ?? "";
      const ext = getFileExt(filePath);
      if (IMAGE_EXTS.has(ext)) {
        return { slideType: "image", path: filePath, caption: item.title, fit: "contain", background: bg };
      } else if (VIDEO_EXTS.has(ext)) {
        return { slideType: "video", path: filePath, auto_play: false, loop_video: false, muted: false, mode: "fullscreen", overlay_text: null, audio_path: null };
      } else {
        return { slideType: "text", content: filePath, background: bg, text_color: null, text_size: null };
      }
    }
    case "online_video": {
      const parsed = parseOnlineVideoNotes(item.notes);
      return { slideType: "onlineVideo", url: "", video_id: parsed?.videoId ?? "", source: "youtube", title: item.title ?? null };
    }
    default:
      return { slideType: "text", content: item.notes ?? "", background: bg, text_color: null, text_size: null };
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

      if (item.itemType === "online_video") {
        const parsed = parseOnlineVideoNotes(item.notes);
        const videoId = parsed?.videoId ?? "";
        const dbRecord = videoId ? await findOnlineVideoByYtId(videoId) : null;
        const localPath = dbRecord?.localPath ?? null;
        const onlineSlide: SlideContent = {
          slideType: "onlineVideo",
          url: localPath ?? "",
          video_id: localPath ? "" : videoId,
          source: localPath ? "local" : "youtube",
          title: item.title ?? null,
        };
        if (localPath) {
          mediaStore.load({ type: "offline_video", videoPath: localPath, title: item.title ?? "", isManaged: true });
        } else {
          mediaStore.load({ type: "online_video", videoId, videoSource: "youtube", title: item.title ?? "" });
        }
        await catcher(async () => {
          await projectSlideWithType(onlineSlide, "service");
          await buildContext();
        }, { notify: true });
        return;
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
