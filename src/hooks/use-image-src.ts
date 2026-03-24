import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { catcher } from "../lib/catcher";
import { buildMediaUrl } from "../lib/media-url";
import { getStreamingStatus } from "../lib/tauri/streaming";

function isCdnRelativePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  const cdnPrefixes = ["/covers/", "/musics/", "/images/", "/videos/"];
  return cdnPrefixes.some((prefix) => path.startsWith(prefix));
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

/**
 * Resolves a local image path to a URL the webview can load.
 *
 * - CDN-relative paths (/covers/, /musics/, etc.) and managed paths (media/...)
 *   are served via the asset protocol (convertFileSrc) — these are always within
 *   the asset scope ($APPDATA).
 * - Absolute OS paths (e.g. legacy slides with picker paths outside $APPDATA)
 *   fall back to the streaming server so they load without scope restrictions.
 */
export function useImageSrc(path: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveSrc() {
      if (!path || path.trim().length === 0) {
        if (!cancelled) setSrc(null);
        return;
      }

      const normalized = path.trim().replace(/\\/g, "/");

      // Block remote URLs — images must be local
      if (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:")
      ) {
        if (!cancelled) setSrc(null);
        return;
      }

      // CDN-relative paths like /covers/foo.jpg
      if (isCdnRelativePath(normalized)) {
        const [absolute, error] = await catcher(
          async () => {
            const appDir = await appDataDir();
            return await join(appDir, normalized.slice(1));
          },
          { notify: false },
        );
        if (!error && absolute && !cancelled) {
          setSrc(convertFileSrc(absolute));
        } else if (!cancelled) {
          setSrc(null);
        }
        return;
      }

      // Absolute OS paths — if the path is within $APPDATA (managed covers, CDN files)
      // use the asset protocol directly. Paths outside $APPDATA (legacy picker paths
      // stored before the copy-on-import fix) fall back to the streaming server.
      if (isAbsolutePath(normalized)) {
        const [appDir, dirErr] = await catcher(appDataDir(), { notify: false });
        if (!dirErr && appDir && normalized.startsWith(appDir)) {
          // Within app_data_dir — asset protocol scope covers it
          if (!cancelled) setSrc(convertFileSrc(normalized));
        } else {
          // Outside app_data_dir — stream via local HTTP to avoid scope restriction
          const [info, infoErr] = await catcher(getStreamingStatus(), { notify: false });
          if (!infoErr && info?.isRunning && !cancelled) {
            setSrc(buildMediaUrl(normalized, info.port));
          } else if (!cancelled) {
            setSrc(null);
          }
        }
        return;
      }

      // Managed relative paths like media/covers/...
      if (normalized.startsWith("media/")) {
        const [absolute, error] = await catcher(
          async () => {
            const appDir = await appDataDir();
            return await join(appDir, normalized);
          },
          { notify: false },
        );
        if (error) {
          if (!cancelled) setSrc(null);
          return;
        }
        if (!cancelled) setSrc(convertFileSrc(absolute!));
        return;
      }

      // Unknown format
      if (!cancelled) setSrc(null);
    }

    void resolveSrc();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return src;
}
