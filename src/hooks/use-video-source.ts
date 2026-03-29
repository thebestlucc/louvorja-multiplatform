import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { getVideoServerStatus, startVideoServer } from "../lib/tauri/video-server";

/** Projection windows only have read-only permissions — never auto-start from them. */
const READONLY_ROUTES = ["/projector", "/return", "/spotlight", "/identify"];
const isReadOnlyWindow = READONLY_ROUTES.includes(window.location.pathname);

/**
 * Converts a local video path (absolute OS path or relative managed path)
 * to a URL served by the dedicated video streaming server.
 *
 * The video server is separate from the SSE streaming server and is
 * purpose-built for video files with HTTP range request support (206 Partial
 * Content), access-token authentication, and loopback-only binding.
 *
 * Auto-starts the server on demand from the main window only.
 * Projection windows retry status queries until the main window starts it.
 */
export function useVideoSource(path: string | null | undefined): string | null {
  const queryClient = useQueryClient();
  const { data: serverInfo } = useQuery({
    queryKey: ["video-server-status"],
    queryFn: getVideoServerStatus,
    staleTime: isReadOnlyWindow ? 10_000 : Infinity,
    // Fallback polling at 10s for the startup race (server may start before listener registers).
    // Primary notification comes via the "video-server-started" event listener below.
    refetchInterval: isReadOnlyWindow && !!path && path.trim().length > 0 ? 10_000 : false,
    gcTime: Infinity,
  });

  // On read-only windows (projector/return), listen for the Tauri event emitted by
  // start_video_server to immediately invalidate and re-fetch server status instead
  // of relying solely on the polling interval.
  useEffect(() => {
    if (!isReadOnlyWindow) return;
    const unlistenPromise = listen("video-server-started", () => {
      queryClient.invalidateQueries({ queryKey: ["video-server-status"] });
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [isReadOnlyWindow, queryClient]);

  const needsServer = !isReadOnlyWindow && !!path && path.trim().length > 0 && !serverInfo?.isRunning;

  useEffect(() => {
    if (!needsServer) return;

    let cancelled = false;
    void startVideoServer()
      .then(() => {
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ["video-server-status"] });
        }
      })
      .catch((err) => {
        console.error("[useVideoSource] Failed to auto-start video server:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [needsServer, queryClient]);

  const url = buildVideoUrl(path, serverInfo?.isRunning ? serverInfo.port : null, serverInfo?.accessToken ?? null);

  // Diagnostic: log when we have a path but no URL (server not ready)
  if (path && path.trim().length > 0 && !url) {
    console.warn(
      "[useVideoSource] path provided but URL is null — server running:",
      serverInfo?.isRunning ?? false,
      "port:", serverInfo?.port ?? "none",
    );
  }

  return url;
}

/** Protocols that pass through to the browser unchanged. */
const PASSTHROUGH_PREFIXES = ["http://", "https://", "data:", "blob:"];

function buildVideoUrl(
  path: string | null | undefined,
  port: number | null | undefined,
  accessToken: string | null | undefined,
): string | null {
  if (!path || path.trim().length === 0) return null;

  const v = path.trim();

  for (const prefix of PASSTHROUGH_PREFIXES) {
    if (v.startsWith(prefix)) return v;
  }

  if (!port || !accessToken) return null;

  return `http://127.0.0.1:${port}/video/${accessToken}/${encodeURIComponent(v)}`;
}
