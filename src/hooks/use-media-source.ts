import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStreamingStatus, startStreamingServer } from "../lib/tauri/streaming";
import { buildMediaUrl } from "../lib/media-url";

/**
 * Converts a media path (absolute OS path, relative managed path, or URL) to
 * a URL the webview can load via the local streaming server.
 *
 * If the streaming server isn't running and a path is provided, the hook
 * auto-starts the server on demand and refreshes the status query.
 * Range requests are supported, making this suitable for video seeking.
 */
export function useMediaSource(path: string | null | undefined): string | null {
  const queryClient = useQueryClient();
  const { data: streamingInfo } = useQuery({
    queryKey: ["streaming-status"],
    queryFn: getStreamingStatus,
    staleTime: Infinity, // port never changes during a session
    gcTime: Infinity,
  });

  const needsServer = !!path && path.trim().length > 0 && !streamingInfo?.isRunning;

  useEffect(() => {
    if (!needsServer) return;

    let cancelled = false;
    void startStreamingServer().then(() => {
      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ["streaming-status"] });
      }
    }).catch((err) => {
      console.error("[useMediaSource] Failed to auto-start streaming server:", err);
    });

    return () => { cancelled = true; };
  }, [needsServer, queryClient]);

  return buildMediaUrl(path, streamingInfo?.isRunning ? streamingInfo.port : null);
}
