import { create } from "zustand";

interface VideoDownload {
  videoId: string;
  playlistId: string;
  progress: number;
  runId: string;
}

interface DownloadStore {
  downloads: Record<string, VideoDownload>;
  startDownload: (videoId: string, playlistId: string, runId: string) => void;
  updateProgress: (videoId: string, progress: number) => void;
  completeDownload: (videoId: string) => void;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  downloads: {},
  startDownload: (videoId, playlistId, runId) =>
    set((s) => ({
      downloads: {
        ...s.downloads,
        [videoId]: { videoId, playlistId, progress: 0, runId },
      },
    })),
  updateProgress: (videoId, progress) =>
    set((s) =>
      s.downloads[videoId]
        ? {
            downloads: {
              ...s.downloads,
              [videoId]: { ...s.downloads[videoId], progress },
            },
          }
        : s,
    ),
  completeDownload: (videoId) =>
    set((s) => {
      const { [videoId]: _, ...rest } = s.downloads;
      return { downloads: rest };
    }),
}));
