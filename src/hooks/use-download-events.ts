import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useDownloadStore } from "../stores/download-store";

interface YtdlpProgressPayload {
  runId: string;
  videoId: string;
  percent: number;
  status: "downloading" | "completed" | "cancelled" | "error";
  playlistId?: string;
}

export function useDownloadEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlistenPromise = listen<YtdlpProgressPayload>(
      "ytdlp-progress",
      (event) => {
        const { videoId, percent, status } = event.payload;
        const store = useDownloadStore.getState();

        if (status === "downloading") {
          store.updateProgress(videoId, percent);
        } else {
          // Read playlistId before removing from store
          const download = store.downloads[videoId];
          store.completeDownload(videoId);

          if (download) {
            queryClient.invalidateQueries({
              queryKey: ["youtube", "videos", download.playlistId],
            });
          }
        }
      },
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [queryClient]);
}
