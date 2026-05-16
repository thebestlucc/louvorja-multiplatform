// remote-pwa/src/lib/search-selection.ts
export type QueueableTab = "hymns" | "bible" | "videos" | "presentations";
export type SearchTab = QueueableTab | "services";

export interface SelectedItem {
  tab: QueueableTab;
  id: string; // per-tab id: hymnId | verseId | videoId | presentationId
  title: string;
  subtitle?: string;
  // Full payload needed for queue.add batch — shape matches server QueueAddItemRaw
  payload:
    | { kind: "hymn"; hymnId: number }
    | {
        kind: "bible";
        versionId: number;
        book: string;
        bookName: string;
        chapter: number;
        verse: number;
        text: string;
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
}

export function compositeId(tab: QueueableTab, id: string): string {
  return `${tab}:${id}`;
}
