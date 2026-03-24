import { useQuery } from "@tanstack/react-query";
import { getStreamingStatus } from "../lib/tauri/streaming";
import { buildMediaUrl } from "../lib/media-url";

/**
 * Converts a media path (absolute OS path, relative managed path, or URL) to
 * a URL the webview can load. All local files are served through the streaming
 * server so Rust's full OS access is used — no asset protocol scope needed.
 *
 * Returns null until the streaming port is known (brief startup window only).
 */
export function useMediaSource(path: string | null | undefined): string | null {
  const { data: streamingInfo } = useQuery({
    queryKey: ["streaming-status"],
    queryFn: getStreamingStatus,
    staleTime: Infinity, // port never changes during a session
    gcTime: Infinity,
  });

  return buildMediaUrl(path, streamingInfo?.isRunning ? streamingInfo.port : null);
}
