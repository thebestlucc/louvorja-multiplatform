/**
 * Pure URL builder for media paths served through the streaming server.
 *
 * All local files (absolute OS paths or relative managed paths like `media/...`)
 * are served via `http://127.0.0.1:{port}/media/<encodeURIComponent(path)>`.
 * This avoids the need for asset-protocol scope configuration and works for
 * any absolute path the Rust process can access.
 */

/** Protocols that pass through to the browser unchanged. */
const PASSTHROUGH_PREFIXES = ["http://", "https://", "data:", "blob:"];

/**
 * Converts a raw media path to a URL string given a streaming server port.
 *
 * @param path   Raw path from slide content (absolute, relative, or URL).
 * @param port   Streaming server port (from `getStreamingStatus().port`).
 * @returns      A fully-qualified URL string, or `null` if input is empty / port unknown.
 */
export function buildMediaUrl(
  path: string | null | undefined,
  port: number | null | undefined,
): string | null {
  if (!path || path.trim().length === 0) return null;

  const v = path.trim();

  for (const prefix of PASSTHROUGH_PREFIXES) {
    if (v.startsWith(prefix)) return v;
  }

  if (!port) return null;

  return `http://127.0.0.1:${port}/media/${encodeURIComponent(v)}`;
}
