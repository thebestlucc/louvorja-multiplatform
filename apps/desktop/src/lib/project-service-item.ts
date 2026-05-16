import { setSlideContext } from "./tauri";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { catcher } from "./catcher";
import type { LiturgyItem as ServiceItem, SlideContent } from "./bindings";
import { defaultBackground, parseLegacySlideContent } from "../types/presentation";
import { getFileExt, parseOnlineVideoNotes } from "./utils";
import { getHymn } from "./tauri/music";
import { getSyncPoints } from "./tauri/audio";
import { getSlides } from "./tauri/slides";
import { getScheduledMediaItem } from "./tauri/media-library";
import { findOnlineVideoByYtId } from "./tauri/youtube";
import { hymnToSlides } from "../hooks/use-hymn-playback";
import { parseLyricsSyncToPoints } from "./audio-sync";
import { toast } from "sonner";
import i18next from "i18next";
import { clearActivePlayback, projectSlideWithType } from "./projection-playback";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "tiff", "ico"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv", "ogv", "m4v", "ts"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);

/**
 * Sync preview of what a service item looks like as a slide — used for
 * next-item context in setSlideContext only, not for actual projection.
 */
function buildServiceItemSlide(item: ServiceItem): SlideContent {
  const bg = defaultBackground();
  switch (item.itemType) {
    case "hymn":
      return { slideType: "lyrics", text: item.notes ?? "", label: null, background: bg, text_color: null, text_size: null };
    case "bible":
      return { slideType: "bible", text: item.notes ?? "", reference: item.title, mode: { alignment: "center" as const, refPosition: "bottom" as const, textShadow: false, gradient: null, fontFamily: null }, background: bg, text_color: null, text_size: null };
    case "file": {
      const ext = getFileExt(item.notes ?? "");
      if (IMAGE_EXTS.has(ext)) return { slideType: "image", path: item.notes ?? "", caption: item.title, fit: "contain", background: bg };
      if (VIDEO_EXTS.has(ext)) return { slideType: "video", path: item.notes ?? "", auto_play: false, loop_video: false, muted: false, mode: "fullscreen", overlay_text: null, audio_path: null };
      return { slideType: "text", content: item.notes ?? "", background: bg, text_color: null, text_size: null };
    }
    case "online_video": {
      const parsed = parseOnlineVideoNotes(item.notes);
      return { slideType: "onlineVideo", url: "", video_id: parsed?.videoId ?? "", source: "youtube", title: item.title ?? null };
    }
    default:
      return { slideType: "text", content: item.notes ?? "", background: bg, text_color: null, text_size: null };
  }
}

/**
 * Project a service item to the projector — single path for both manual
 * click and auto-advance playback. Stops current content, loads the media
 * player store, projects the slide, and pushes slide context.
 */
export async function projectServiceItem(
  item: ServiceItem,
  allItems: ServiceItem[],
): Promise<void> {
  await clearActivePlayback();
  const { useQueueStore } = await import("../stores/queue-store");
  useQueueStore.getState().clearQueue();

  const mediaStore = useMediaPlayerStore.getState();
  const itemIndex = allItems.findIndex((i) => i.id === item.id);
  const nextItem = itemIndex + 1 < allItems.length ? allItems[itemIndex + 1] : null;

  const pushContext = async () => {
    await setSlideContext({
      next: nextItem ? buildServiceItemSlide(nextItem) : null,
      index: itemIndex >= 0 ? itemIndex : 0,
      total: allItems.length,
      title: item.title,
      currentSlideStartMs: null,
      nextSlideStartMs: null,
      audioDurationMs: null,
    });
  };

  switch (item.itemType) {
    case "hymn": {
      if (item.itemId != null) {
        await catcher(async () => {
          const hymn = await getHymn(item.itemId!);
          const rawPoints = await getSyncPoints(hymn.id);
          const syncPoints = rawPoints.length > 0 ? rawPoints : parseLyricsSyncToPoints(hymn.lyricsSync);
          const slides = hymnToSlides(hymn.title, hymn.lyrics, hymn.album, hymn.coverPath, hymn.lyricsSync);
          mediaStore.load({ type: "hymn", hymn, mode: "sung", slides, syncPoints, audioPath: hymn.audioPath ?? undefined, playbackPath: hymn.playbackPath ?? undefined });
          useAudioStore.getState().setSyncPoints(syncPoints);
          if (hymn.audioPath) await useAudioStore.getState().play(hymn.audioPath, 0);
          if (slides.length > 0) await projectSlideWithType(slides[0], "service");
          await pushContext();
        }, { notify: true });
      } else {
        const slideData = { slideType: "lyrics" as const, text: item.notes ?? "", label: null, background: defaultBackground(), text_color: null, text_size: null };
        mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
        await catcher(async () => {
          await projectSlideWithType(slideData, "service");
          await pushContext();
        }, { notify: true });
      }
      break;
    }
    case "bible": {
      const slideData = { slideType: "bible" as const, text: item.notes ?? "", reference: item.title, mode: { alignment: "center" as const, refPosition: "bottom" as const, textShadow: false, gradient: null, fontFamily: null }, background: defaultBackground(), text_color: null, text_size: null };
      mediaStore.load({ type: "bible", reference: item.title, text: item.notes ?? "", version: "" });
      mediaStore.setSlides([slideData]);
      await catcher(async () => {
        await projectSlideWithType(slideData, "service");
        await pushContext();
      }, { notify: true });
      break;
    }
    case "presentation": {
      if (item.itemId != null) {
        await catcher(async () => {
          const slides = await getSlides(item.itemId!);
          if (slides.length === 0) return;
          const slideContents = slides.map((s) => parseLegacySlideContent(s.content));
          mediaStore.load({ type: "presentation", presentationId: item.itemId!, slides: slideContents });
          await projectSlideWithType(slideContents[0], "presentation");
          await pushContext();
        }, { notify: true });
      }
      break;
    }
    case "annotation": {
      const slideData = { slideType: "text" as const, content: item.notes ?? "", background: defaultBackground(), text_color: null, text_size: null };
      mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
      await catcher(async () => {
        await projectSlideWithType(slideData, "service");
        await pushContext();
      }, { notify: true });
      break;
    }
    case "file": {
      const filePath = item.notes ?? "";
      const ext = getFileExt(filePath);
      if (IMAGE_EXTS.has(ext)) {
        const slideData = { slideType: "image" as const, path: filePath, caption: item.title, fit: "contain" as const, background: defaultBackground() };
        mediaStore.load({ type: "image", imagePath: filePath, title: item.title, isManaged: false });
        await catcher(async () => {
          await projectSlideWithType(slideData, "service");
          await pushContext();
        }, { notify: true });
      } else if (VIDEO_EXTS.has(ext)) {
        mediaStore.load({ type: "offline_video", videoPath: filePath, title: item.title, isManaged: false });
        await catcher(pushContext(), { notify: true });
      } else if (AUDIO_EXTS.has(ext)) {
        const slideData = { slideType: "text" as const, content: item.title, background: defaultBackground(), text_color: null, text_size: null };
        mediaStore.load({ type: "annotation", text: item.title, title: item.title });
        await catcher(async () => {
          await projectSlideWithType(slideData, "service");
          await pushContext();
        }, { notify: true });
      } else {
        const slideData = { slideType: "text" as const, content: filePath, background: defaultBackground(), text_color: null, text_size: null };
        mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
        await catcher(async () => {
          await projectSlideWithType(slideData, "service");
          await pushContext();
        }, { notify: true });
      }
      break;
    }
    case "scheduled_category": {
      const todayDate = new Date().toISOString().slice(0, 10);
      await catcher(async () => {
        const mediaItem = await getScheduledMediaItem(item.itemId ?? 0, todayDate);
        if (!mediaItem) {
          toast.error(i18next.t("mediaLibrary.noItemOnDate", "No item for this date"));
          return;
        }
        const ft = mediaItem.fileType.toLowerCase();
        if (IMAGE_EXTS.has(ft)) {
          const slideData = { slideType: "image" as const, path: mediaItem.filePath, caption: null, fit: "contain" as const, background: defaultBackground() };
          mediaStore.load({ type: "image", imagePath: mediaItem.filePath, title: mediaItem.name, isManaged: false });
          await projectSlideWithType(slideData, "service");
          await pushContext();
        } else if (VIDEO_EXTS.has(ft) || AUDIO_EXTS.has(ft)) {
          mediaStore.load({ type: "offline_video", videoPath: mediaItem.filePath, title: mediaItem.name, isManaged: false });
          await pushContext();
        } else {
          const slideData = { slideType: "text" as const, content: mediaItem.name, background: defaultBackground(), text_color: null, text_size: null };
          mediaStore.load({ type: "annotation", text: mediaItem.name, title: mediaItem.name });
          await projectSlideWithType(slideData, "service");
          await pushContext();
        }
      }, { notify: true });
      break;
    }
    case "online_video": {
      await catcher(async () => {
        const parsed = parseOnlineVideoNotes(item.notes);
        const videoId = parsed?.videoId ?? "";
        const dbRecord = videoId ? await findOnlineVideoByYtId(videoId) : null;
        const localPath = dbRecord?.localPath ?? null;
        const slideData = { slideType: "onlineVideo" as const, url: localPath ?? "", video_id: localPath ? "" : videoId, source: localPath ? "local" as const : "youtube" as const, title: item.title ?? null };
        if (localPath) {
          mediaStore.load({ type: "offline_video", videoPath: localPath, title: item.title ?? "", isManaged: true });
        } else {
          mediaStore.load({ type: "online_video", videoId, videoSource: "youtube", title: item.title ?? "" });
        }
        await projectSlideWithType(slideData, "service");
        await pushContext();
      }, { notify: true });
      break;
    }
    default: {
      const slideData = { slideType: "text" as const, content: item.notes ?? "", background: defaultBackground(), text_color: null, text_size: null };
      mediaStore.load({ type: "annotation", text: item.notes ?? item.title, title: item.title });
      await catcher(async () => {
        await projectSlideWithType(slideData, "service");
        await pushContext();
      }, { notify: true });
      break;
    }
  }
}
