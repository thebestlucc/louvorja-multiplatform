// src/types/media.ts
import type { SlideContent, SyncPoint, Hymn } from "../lib/bindings";

/**
 * Discriminated union for all media types supported by the Playing Now system.
 * See docs/plans/playing-now-architecture.md Section 1.
 */
export type MediaItem =
  | HymnMediaItem
  | OnlineVideoMediaItem
  | OfflineVideoMediaItem
  | PresentationMediaItem
  | ImageMediaItem
  | BibleMediaItem
  | AnnotationMediaItem;

export interface HymnMediaItem {
  type: "hymn";
  hymn: Hymn;
  mode: "sung" | "karaoke" | "silent";
  slides: SlideContent[];
  syncPoints: SyncPoint[];
  audioPath?: string;
  playbackPath?: string;
}

export interface OnlineVideoMediaItem {
  type: "online_video";
  videoId: string;
  videoSource: "youtube";
  title: string;
  thumbnailUrl?: string;
}

export interface OfflineVideoMediaItem {
  type: "offline_video";
  videoPath: string;
  title: string;
  thumbnailUrl?: string;
  isManaged: boolean;
}

export interface PresentationMediaItem {
  type: "presentation";
  presentationId: number;
  slides: SlideContent[];
}

export interface ImageMediaItem {
  type: "image";
  imagePath: string;
  title: string;
  isManaged: boolean;
}

export interface BibleMediaItem {
  type: "bible";
  reference: string;
  text: string;
  version: string;
}

export interface AnnotationMediaItem {
  type: "annotation";
  text: string;
  title: string;
}

/** All possible media types as a string union */
export type MediaItemType = MediaItem["type"];

/** State machine status values */
export type MediaStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

/** Which timeline source is active */
export type TimelineSource = "audio" | "video" | "none";

/** Helper: does this media type have slides? */
export function mediaHasSlides(item: MediaItem): boolean {
  return item.type === "hymn" || item.type === "presentation";
}

/** Helper: does this media type have a playback timeline? */
export function mediaHasTimeline(item: MediaItem): boolean {
  return item.type === "hymn"
    || item.type === "online_video"
    || item.type === "offline_video";
}

/** Helper: does this media type have video? */
export function mediaHasVideo(item: MediaItem): boolean {
  return item.type === "online_video" || item.type === "offline_video";
}

/** Helper: type icon map for queue/UI display */
export const MEDIA_TYPE_ICONS: Record<MediaItemType, string> = {
  hymn: "music",
  online_video: "video",
  offline_video: "video",
  presentation: "presentation",
  image: "image",
  bible: "book-open",
  annotation: "file-text",
};
