// src/hooks/build-queue-items-from-remote.ts
import type { QueueItem } from "../stores/queue-store";
import { commands } from "../lib/bindings";
import { catcher } from "../lib/catcher";

/**
 * Batch-shaped payload emitted by Rust `remote-queue-add`:
 *   { items: RemoteQueueAddItem[] }
 * Each item is one of the 4 discriminated shapes below.
 */
export type RemoteQueueAddItem =
  | { kind: "hymn"; hymnId: number }
  | {
      kind: "bible";
      versionId: number;
      book: string;
      bookName: string;
      chapter: number;
      verse: number; // initial verse selected in the remote
    }
  | {
      kind: "video";
      videoSource: "youtube" | "local";
      videoId?: string;
      videoUrl?: string;
      videoTitle?: string;
      duration?: number;
    }
  | { kind: "presentation"; presentationId: number };

export interface RemoteQueueAddPayload {
  items: RemoteQueueAddItem[];
}

/**
 * Resolves each raw remote item into a full `QueueItem` ready for `addToQueue`.
 * Hymn items need a DB lookup (to get audio path, lyrics, sync points).
 * Bible items need a chapter fetch (to preserve intra-chapter nav).
 * Video + presentation items pass through; coordinator resolves details at play time.
 */
export async function buildQueueItemsFromRemote(
  payload: RemoteQueueAddPayload,
): Promise<QueueItem[]> {
  const out: QueueItem[] = [];
  for (const raw of payload.items) {
    switch (raw.kind) {
      case "hymn": {
        const [result] = await catcher(commands.getHymn(raw.hymnId));
        if (!result || result.status !== "ok") continue;
        out.push({
          id: crypto.randomUUID(),
          kind: "hymn",
          type: "audio",
          hymn: result.data,
        });
        break;
      }
      case "bible": {
        // Fetch entire chapter so intra-chapter next/prev works without advancing queue.
        // NOTE: uses commands.getVerses (bindings name for bibleListVerses)
        const [result] = await catcher(
          commands.getVerses(raw.versionId, raw.book, raw.chapter),
        );
        if (!result || result.status !== "ok") continue;
        out.push({
          id: crypto.randomUUID(),
          kind: "bible",
          type: "projection",
          title: `${raw.bookName} ${raw.chapter}:${raw.verse}`,
          bibleContext: {
            versionId: raw.versionId,
            book: raw.book,
            bookName: raw.bookName,
            chapter: raw.chapter,
            initialVerse: raw.verse,
            verses: result.data,
          },
        });
        break;
      }
      case "video": {
        out.push({
          id: crypto.randomUUID(),
          kind: "video",
          type: "projection",
          title: raw.videoTitle ?? raw.videoUrl ?? raw.videoId ?? "Video",
          videoMedia: { ...raw },
        });
        break;
      }
      case "presentation": {
        out.push({
          id: crypto.randomUUID(),
          kind: "presentation",
          type: "projection",
          title: `Presentation #${raw.presentationId}`, // coordinator will refresh from DB
          presentationId: raw.presentationId,
        });
        break;
      }
    }
  }
  return out;
}
