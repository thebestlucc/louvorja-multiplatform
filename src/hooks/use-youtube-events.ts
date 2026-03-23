import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queries";

/**
 * Listens to Tauri events emitted by YouTube background commands
 * and invalidates the corresponding queries.
 * Call this once in the Online Videos route layout.
 */
export function useYoutubeEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      unlisteners.push(
        await listen("youtube-playlist-added", () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.youtubeVideos.playlists });
        }),
      );
      unlisteners.push(
        await listen("youtube-playlist-refreshed", () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.youtubeVideos.playlists });
          // Also invalidate all video lists
          queryClient.invalidateQueries({ queryKey: ["youtube", "videos"] });
        }),
      );
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [queryClient]);
}
